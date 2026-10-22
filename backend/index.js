const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Public MQTT broker for ESP32 hardware prototype
const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'mini_project_cold/telemetry';

console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT Broker!');
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (!err) {
      console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
    } else {
      console.error('MQTT Subscription Error:', err);
    }
  });
});

let latestTelemetry = {
  timestamp: Date.now(),
  device_ip: "192.168.31.173",
  system_state: "ENABLED",
  temperature: 4.8,
  humidity: 54.2,
  voltage: 11.85,
  peltier: true,
  fan: true,
  source: "HARDWARE_SIM",
  packet_id: 100
};

let lastHardwarePacketTime = Date.now();
let simulationActive = true;

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Background ticker to provide realistic sensor telemetry if hardware is offline
setInterval(() => {
  const hardwareInactive = (Date.now() - lastHardwarePacketTime) > 15000;
  if (simulationActive && hardwareInactive) {
    // Gentle natural micro-fluctuations around realistic target
    const tempDelta = (Math.random() - 0.48) * 0.15;
    const humDelta = (Math.random() - 0.5) * 0.3;
    const voltDelta = (Math.random() - 0.52) * 0.02;

    const newTemp = Math.max(-2, Math.min(42, latestTelemetry.temperature + tempDelta));
    const newVolt = Math.max(6.5, Math.min(12.6, latestTelemetry.voltage + voltDelta));
    const newHum = Math.max(20, Math.min(95, latestTelemetry.humidity + humDelta));

    // Automated Peltier & Fan logic based on thermal threshold
    const shouldCool = newTemp > 6.0;

    latestTelemetry = {
      ...latestTelemetry,
      timestamp: Date.now(),
      temperature: parseFloat(newTemp.toFixed(2)),
      humidity: parseFloat(newHum.toFixed(1)),
      voltage: parseFloat(newVolt.toFixed(2)),
      peltier: shouldCool,
      fan: shouldCool,
      source: "AUTO_STREAM",
      packet_id: (latestTelemetry.packet_id || 0) + 1
    };

    broadcast(latestTelemetry);
  }
}, 2000);

// Handle incoming MQTT messages from ESP32
mqttClient.on('message', (topic, message) => {
  if (topic === MQTT_TOPIC) {
    try {
      const data = JSON.parse(message.toString());
      lastHardwarePacketTime = Date.now();
      latestTelemetry = {
        ...latestTelemetry,
        ...data,
        timestamp: Date.now(),
        source: "MQTT_HARDWARE",
        packet_id: (latestTelemetry.packet_id || 0) + 1
      };
      console.log('Received Telemetry via MQTT:', latestTelemetry);
      broadcast(latestTelemetry);
    } catch (e) {
      console.error('Error parsing MQTT message:', e);
    }
  }
});

// HTTP endpoint for direct POST from ESP32 or testing scripts
app.post('/api/telemetry', (req, res) => {
  lastHardwarePacketTime = Date.now();
  latestTelemetry = {
    ...latestTelemetry,
    ...req.body,
    timestamp: Date.now(),
    source: req.body.source || "HTTP_HARDWARE",
    packet_id: (latestTelemetry.packet_id || 0) + 1
  };
  console.log('Received Telemetry via HTTP:', latestTelemetry);
  broadcast(latestTelemetry);
  res.status(200).send({ status: 'ok', received: latestTelemetry });
});

// Control endpoint to manually override simulation or test conditions
app.post('/api/simulator', (req, res) => {
  latestTelemetry = {
    ...latestTelemetry,
    ...req.body,
    timestamp: Date.now(),
    source: "MANUAL_SIM",
    packet_id: (latestTelemetry.packet_id || 0) + 1
  };
  broadcast(latestTelemetry);
  res.status(200).send({ status: 'ok', telemetry: latestTelemetry });
});

app.get('/api/telemetry', (req, res) => {
  res.json({
    ...latestTelemetry,
    server_time: Date.now(),
    hardware_active: (Date.now() - lastHardwarePacketTime) < 15000
  });
});

wss.on('connection', (ws) => {
  console.log('Frontend client connected via WebSocket');
  // Send current state immediately
  ws.send(JSON.stringify({ ...latestTelemetry, type: 'INITIAL_STATE' }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === 'SET_TELEMETRY') {
        latestTelemetry = {
          ...latestTelemetry,
          ...msg.data,
          timestamp: Date.now(),
          source: "CLIENT_OVERRIDE"
        };
        broadcast(latestTelemetry);
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
  console.log(`WebSocket Server running on ws://localhost:${PORT}`);
});
