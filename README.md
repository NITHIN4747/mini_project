# ColdChain Twin — Real-Time Predictive Digital Twin for Off-Grid Vaccine Transport

> **A real-time 3D cyber-physical digital twin for battery-buffered, temperature-critical last-mile vaccine and medicine logistics.**

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-00f5a0?style=for-the-badge&logo=github)](https://nithin4747.github.io/mini_project/)
[![React](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite%206-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MQTT](https://img.shields.io/badge/MQTT-HiveMQ-FF6600?style=for-the-badge&logo=hivemq&logoColor=white)](https://www.hivemq.com/)

---

## 🌍 The Problem & Real-World Use Case

In off-grid rural communities across developing regions (parts of India, Southeast Asia, and Africa), community health workers transport temperature-critical vaccines (e.g., BCG, Polio, COVID-19, and Insulin) across challenging terrains without access to reliable electrical grids. 

Conventional data loggers only alert doctors **after** the vaccines have suffered thermal degradation. 

**ColdChain Twin** is an active, predictive decision tool that combines live battery voltage curves, ambient sensor telemetry, and thermal physics to estimate safe cooling runway **before** the healthcare worker departs.

* **Target Range**: Strict WHO PQS compliance ($+2.0^\circ\text{C}$ to $+8.0^\circ\text{C}$).
* **Active Cooling**: TEC1-12706 solid-state thermoelectric Peltier heat pump.
* **Controller**: ESP32-S3 microcontroller with Wi-Fi / MQTT telemetry broadcasting.

---

## ⚡ Physical Prototype Hardware Architecture

The 3D digital twin is an exact physical replica of the deployed bench prototype:

1. **Polystyrene Cryo-Chamber**: White Styrofoam insulation box with hinged open lid, holding an interior eutectic cold pack and blue-capped vaccine vials.
2. **DHT22 Temperature & Humidity Sensor**: High-accuracy digital sensor mounted on the interior wall.
3. **TEC1-12706 Peltier Module**: Solid-state thermoelectric cooler with front-mounted blue LED cooling fan.
4. **IoT Control Panel**:
   - **ESP32-S3 Microcontroller** (GPIO control, telemetry ingestion, Wi-Fi).
   - **I2C OLED Graphics Display** (Live IP, temperature, bus voltage, and armed state).
   - **4-Channel Relay Bank** (Actuates high-current Peltier and fan loads).
   - **0–25V DC Voltage Divider Sensor** ($R_1: 30\text{k}\Omega, R_2: 7.5\text{k}\Omega$ monitoring LiFePO4 battery bus voltage).
   - **PIR Motion Sensor (GPIO21) & Piezo Buzzer (GPIO23)** for security alarm monitoring.
   - **12V DC Primary Power Adapter**.

---

## 💻 Tech Stack

### Frontend
* **Core Framework**: React 19 + TypeScript + Vite
* **3D Visual Engine**: Three.js, `@react-three/fiber`, `@react-three/drei`
* **Post-Processing**: `@react-three/postprocessing` (ACES Filmic tone-mapping, calibrated bloom, vignette)
* **Design Aesthetic**: Inspired by **dark.design** and **inspo-mcp** (frosted glassmorphism HUD, tabular monospace telemetry, WHO color-coded indicators)

### Backend
* **Runtime**: Node.js & Express
* **Streaming Protocol**: WebSockets (`ws`) for real-time bi-directional browser synchronization
* **IoT Telemetry**: MQTT client connected to HiveMQ public broker (`mini_project_cold/telemetry`)
* **HTTP Endpoints**: REST API fallback (`/api/telemetry` and `/api/simulator`)

---

## 🚀 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/NITHIN4747/mini_project.git
cd mini_project
```

### 2. Start the Backend Server
```bash
cd backend
npm install
npm start
```
* Backend runs on `http://localhost:3001`
* WebSocket streaming on `ws://localhost:3001`

### 3. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
* Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🎮 What-If Simulation Lab

The dashboard includes an interactive **What-If Stress Lab** allowing engineers and judges to test scenarios without physical heat chambers:
* **Safe Transit ($4.2^\circ\text{C}$)**: Standard WHO-compliant route.
* **Heatwave Spike ($38.5^\circ\text{C}$)**: Ambient temperature spike triggering 100% Peltier power & 3,200 RPM turbo exhaust fan.
* **Sub-Zero Freezing ($1.2^\circ\text{C}$)**: Alerts against vaccine denaturation due to overcooling.
* **Low Battery ($6.7\text{V}$)**: Depleted battery testing.

---

## 📜 License
MIT License. Developed as a predictive cold-chain engineering prototype.
