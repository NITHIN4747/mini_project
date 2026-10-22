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
  system_state: "ARMED",
  temperature: 4.8,
  humidity: 54.2,
  voltage: 11.85,
  peltier: true,
  fan: true,
  source: "AUTO_STREAM",
  packet_id: 100
};

let lastHardwarePacketTime = Date.now();
let simulationActive = true;
let targetEspIp = "192.168.31.173";
let pollInterval = null;

// Registry of discovered ESP32 devices on network / MQTT
const discoveredDevices = new Map([
  ["192.168.31.173", {
    ip: "192.168.31.173",
    name: "ESP32-S3 ColdTwin (Primary Prototype)",
    status: "ONLINE",
    type: "ESP32-S3",
    signal: "-52 dBm",
    mac: "E8:6B:EA:D4:31:AC",
    lastSeen: Date.now()
  }],
  ["192.168.1.50", {
    ip: "192.168.1.50",
    name: "ESP32 Lab Bench Controller",
    status: "ONLINE",
    type: "ESP32-WROOM-32",
    signal: "-64 dBm",
    mac: "24:6F:28:B2:91:F0",
    lastSeen: Date.now() - 4000
  }]
]);

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
    const tempDelta = (Math.random() - 0.48) * 0.15;
    const humDelta = (Math.random() - 0.5) * 0.3;
    const voltDelta = (Math.random() - 0.52) * 0.02;

    const newTemp = Math.max(-2, Math.min(42, latestTelemetry.temperature + tempDelta));
    const newVolt = Math.max(6.5, Math.min(12.6, latestTelemetry.voltage + voltDelta));
    const newHum = Math.max(20, Math.min(95, latestTelemetry.humidity + humDelta));

    const shouldCool = newTemp > 6.0;

    latestTelemetry = {
      ...latestTelemetry,
      device_ip: targetEspIp,
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

// Active direct polling if ESP32 hosts a local HTTP /telemetry endpoint
function startDirectPolling(ip) {
  if (pollInterval) clearInterval(pollInterval);
  targetEspIp = ip;
  latestTelemetry.device_ip = ip;

  // Poll direct ESP32 webserver if configured
  pollInterval = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://${ip}/telemetry`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        lastHardwarePacketTime = Date.now();
        latestTelemetry = {
          ...latestTelemetry,
          ...data,
          device_ip: ip,
          timestamp: Date.now(),
          source: "ESP32_DIRECT_HTTP"
        };
        broadcast(latestTelemetry);
      }
    } catch {
      // Quiet fail if ESP32 is relying on MQTT instead
    }
  }, 2000);
}

// Handle incoming MQTT messages from ESP32
mqttClient.on('message', (topic, message) => {
  if (topic === MQTT_TOPIC) {
    try {
      const data = JSON.parse(message.toString());
      lastHardwarePacketTime = Date.now();
      const incomingIp = data.device_ip || targetEspIp;

      // Register or update discovered device
      discoveredDevices.set(incomingIp, {
        ip: incomingIp,
        name: `ESP32 (${incomingIp})`,
        status: "ACTIVE_STREAMING",
        type: "ESP32-S3",
        signal: "-48 dBm",
        lastSeen: Date.now()
      });

      latestTelemetry = {
        ...latestTelemetry,
        ...data,
        device_ip: incomingIp,
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
  const incomingIp = req.body.device_ip || req.ip?.replace('::ffff:', '') || targetEspIp;

  discoveredDevices.set(incomingIp, {
    ip: incomingIp,
    name: `ESP32 (${incomingIp})`,
    status: "ACTIVE_STREAMING",
    type: "ESP32-S3",
    signal: "-50 dBm",
    lastSeen: Date.now()
  });

  latestTelemetry = {
    ...latestTelemetry,
    ...req.body,
    device_ip: incomingIp,
    timestamp: Date.now(),
    source: req.body.source || "HTTP_HARDWARE",
    packet_id: (latestTelemetry.packet_id || 0) + 1
  };
  console.log('Received Telemetry via HTTP:', latestTelemetry);
  broadcast(latestTelemetry);
  res.status(200).send({ status: 'ok', received: latestTelemetry });
});

// Device discovery scanner endpoint
app.get('/api/scan-devices', (req, res) => {
  const devices = Array.from(discoveredDevices.values());
  res.json({
    active_ip: targetEspIp,
    devices: devices,
    mqtt_broker: MQTT_BROKER,
    mqtt_topic: MQTT_TOPIC,
    scanned_at: Date.now()
  });
});

// Change active target ESP32 device
app.post('/api/set-device', (req, res) => {
  const { ip, name } = req.body;
  if (ip) {
    targetEspIp = ip;
    latestTelemetry.device_ip = ip;
    discoveredDevices.set(ip, {
      ip,
      name: name || `ESP32 (${ip})`,
      status: "CONNECTED",
      type: "ESP32",
      signal: "-55 dBm",
      lastSeen: Date.now()
    });
    startDirectPolling(ip);
    broadcast(latestTelemetry);
    res.json({ status: 'ok', active_ip: ip });
  } else {
    res.status(400).json({ error: 'IP address required' });
  }
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
      } else if (msg.action === 'SET_DEVICE_IP') {
        if (msg.ip) {
          targetEspIp = msg.ip;
          latestTelemetry.device_ip = msg.ip;
          startDirectPolling(msg.ip);
          broadcast(latestTelemetry);
        }
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
