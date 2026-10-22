import { useState, useEffect, useRef } from 'react'
import { 
  Activity, 
  Battery, 
  Thermometer, 
  Wind, 
  Zap, 
  RotateCcw, 
  Camera, 
  Wifi, 
  Sliders, 
  Info, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw,
  Cpu,
  CheckCircle2,
  ChevronDown,
  Radio,
  X
} from 'lucide-react'
import TwinScene, { type Telemetry } from './components/TwinScene'
import './index.css'

const DEFAULT_MOCK: Telemetry = {
  timestamp: Date.now(),
  device_ip: "192.168.31.173",
  system_state: "ENABLED",
  temperature: 4.6,
  humidity: 54.2,
  voltage: 11.85,
  peltier: true,
  fan: true,
  source: "INITIAL_MOCK",
  packet_id: 101
}

export default function App() {
  const [telemetry, setTelemetry] = useState<Telemetry>(DEFAULT_MOCK)
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true)
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'OFFLINE'>('CONNECTING')
  const [cameraPreset, setCameraPreset] = useState<string>('DEFAULT')
  const [history, setHistory] = useState<number[]>([4.5, 4.6, 4.7, 4.6, 4.5, 4.4, 4.5, 4.6, 4.8, 4.7, 4.6, 4.5, 4.6])
  const [simTemp, setSimTemp] = useState<number>(4.6)
  const [simVolt, setSimVolt] = useState<number>(11.85)
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
  const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false)
  const [deviceIpInput, setDeviceIpInput] = useState<string>("192.168.31.173")
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [connectSuccessMsg, setConnectSuccessMsg] = useState<string>("")
  const [discoveredDevices, setDiscoveredDevices] = useState<{
    ip: string
    name: string
    status: string
    type?: string
    signal?: string
    mac?: string
  }[]>([
    {
      ip: "192.168.31.173",
      name: "ESP32-S3 ColdTwin (Primary Prototype)",
      status: "ONLINE",
      type: "ESP32-S3",
      signal: "-52 dBm",
      mac: "E8:6B:EA:D4:31:AC"
    },
    {
      ip: "192.168.1.50",
      name: "ESP32 Lab Bench Controller",
      status: "ONLINE",
      type: "ESP32-WROOM-32",
      signal: "-64 dBm",
      mac: "24:6F:28:B2:91:F0"
    }
  ])
  const [lastPacketTime, setLastPacketTime] = useState<number>(Date.now())
  const [packetCount, setPacketCount] = useState<number>(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<any>(null)

  const handleScanDevices = () => {
    setIsScanning(true)
    fetch('http://localhost:3001/api/scan-devices')
      .then(res => res.json())
      .then(data => {
        if (data && data.devices && data.devices.length > 0) {
          setDiscoveredDevices(data.devices)
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setIsScanning(false), 800)
      })
  }

  const handleSelectDevice = (ip: string, name?: string) => {
    setDeviceIpInput(ip)
    setTelemetry(prev => ({ ...prev, device_ip: ip }))
    
    // Notify backend
    fetch('http://localhost:3001/api/set-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, name })
    }).catch(() => {})

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'SET_DEVICE_IP', ip }))
    }

    setConnectSuccessMsg(`Connected to ${ip}!`)
    setTimeout(() => {
      setConnectSuccessMsg("")
      setShowDeviceModal(false)
    }, 1200)
  }

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceIpInput.trim()) return
    handleSelectDevice(deviceIpInput.trim(), `ESP32 (${deviceIpInput.trim()})`)
  }

  // ----------------------------------------------------
  // REAL-TIME WEBSOCKET & HTTP TELEMETRY CLIENT
  // ----------------------------------------------------
  useEffect(() => {
    // Initial state fetch from backend API
    fetch('http://localhost:3001/api/telemetry')
      .then(res => res.json())
      .then(data => {
        if (data && isLiveMode) {
          setTelemetry(prev => ({ ...prev, ...data }))
          if (typeof data.temperature === 'number') {
            setHistory(h => [...h.slice(-24), data.temperature])
          }
        }
      })
      .catch(() => {
        // Backend might still be starting, WS will handle retry
      })

    const connectWebSocket = () => {
      setConnectionStatus('CONNECTING')
      const ws = new WebSocket('ws://localhost:3001')
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Telemetry WS] Connected to Hardware Telemetry Bridge')
        setConnectionStatus('CONNECTED')
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          setLastPacketTime(Date.now())
          setPacketCount(count => count + 1)

          if (isLiveMode) {
            setTelemetry(prev => ({ ...prev, ...payload }))
            if (typeof payload.temperature === 'number') {
              setHistory(h => [...h.slice(-24), payload.temperature])
            }
          }
        } catch (err) {
          console.error('[Telemetry WS] Parse error:', err)
        }
      }

      ws.onclose = () => {
        console.warn('[Telemetry WS] Disconnected. Reconnecting in 3s...')
        setConnectionStatus('OFFLINE')
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [isLiveMode])

  // Handle Simulation Changes
  const applySimulation = (newTemp: number, newVolt: number) => {
    setSimTemp(newTemp)
    setSimVolt(newVolt)
    const shouldCool = newTemp > 6.0
    const updated: Telemetry = {
      ...telemetry,
      temperature: parseFloat(newTemp.toFixed(1)),
      voltage: parseFloat(newVolt.toFixed(2)),
      peltier: shouldCool,
      fan: shouldCool,
      source: "MANUAL_SIM"
    }
    setTelemetry(updated)
    setHistory(h => [...h.slice(-24), newTemp])

    // Forward to backend if socket connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'SET_TELEMETRY',
        data: updated
      }))
    }
  }

  // Calculate Cold Runway based on battery and thermal load
  const calculateRunway = () => {
    if (telemetry.voltage < 6.8) return { hours: "0.0", status: "DEPLETED" }
    if (!telemetry.peltier) return { hours: "> 24", status: "STANDBY" }
    // Typical LiFePO4 battery discharge curve approximation under 3A Peltier draw
    const runway = Math.max(0, ((telemetry.voltage - 6.8) / (12.6 - 6.8)) * 11.5)
    return { hours: runway.toFixed(1), status: runway < 2.0 ? "CRITICAL" : "HEALTHY" }
  }

  const runwayData = calculateRunway()
  const isSafe = telemetry.temperature >= 2.0 && telemetry.temperature <= 8.0
  const isFreezing = telemetry.temperature < 2.0
  const batteryPct = Math.min(100, Math.max(0, Math.round(((telemetry.voltage - 6.5) / (12.6 - 6.5)) * 100)))

  // Sparkline coordinates for mini SVG chart
  const minTemp = Math.min(...history, 0)
  const maxTemp = Math.max(...history, 12)
  const sparklinePoints = history.map((val, idx) => {
    const x = (idx / (history.length - 1)) * 260
    const y = 50 - ((val - minTemp) / (maxTemp - minTemp || 1)) * 40
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-void)' }}>
      
      {/* ---------------------------------------------------- */}
      {/* 3D DIGITAL TWIN BACKDROP CANVAS                     */}
      {/* ---------------------------------------------------- */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <TwinScene 
          telemetry={telemetry} 
          cameraPreset={cameraPreset}
          onSelectComponent={(comp) => setCameraPreset(comp)}
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* TOP COMMAND HUD NAVIGATION                          */}
      {/* ---------------------------------------------------- */}
      <header style={{
        position: 'absolute', top: '16px', left: '20px', right: '20px', zIndex: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none'
      }}>
        {/* Brand & Project Identity */}
        <div className="glass-panel" style={{ 
          padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '14px', pointerEvents: 'auto' 
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #00f5a0 0%, #00d2ff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={18} color="#060709" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                ColdChain Twin
              </h1>
              <span style={{ 
                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', 
                background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontFamily: 'var(--font-mono)' 
              }}>
                WHO PQS 2-8°C
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Target: Rural Off-Grid Last-Mile Transport</span>
            </div>
          </div>
        </div>

        {/* Live Hardware Connection & Mode Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
          
          {/* Interactive Hardware Connection & Device Selector Button */}
          <button
            onClick={() => {
              setShowDeviceModal(true)
              handleScanDevices()
            }}
            className="glass-panel"
            style={{ 
              padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-panel)',
              color: 'var(--text-primary)', transition: 'all 0.2s ease'
            }}
            title="Click to scan network or enter ESP32 IP address"
          >
            <span className={`live-beacon ${connectionStatus !== 'CONNECTED' ? (connectionStatus === 'CONNECTING' ? 'warning' : 'disconnected') : ''}`} />
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: connectionStatus === 'CONNECTED' ? 'var(--color-safe)' : 'var(--color-warning)' }}>
                ESP32: {telemetry.device_ip}
              </span>
              <ChevronDown size={14} color="#94a3b8" />
            </div>
          </button>

          {/* Mode Switcher: Live Stream vs Simulator */}
          <div className="glass-panel" style={{ padding: '4px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setIsLiveMode(true)}
              style={{
                background: isLiveMode ? 'var(--color-safe)' : 'transparent',
                color: isLiveMode ? '#060709' : 'var(--text-secondary)',
                border: 'none', borderRadius: '8px', padding: '6px 12px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Wifi size={13} /> LIVE TELEMETRY
            </button>
            <button
              onClick={() => setIsLiveMode(false)}
              style={{
                background: !isLiveMode ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: !isLiveMode ? '#38bdf8' : 'var(--text-secondary)',
                border: !isLiveMode ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                borderRadius: '8px', padding: '6px 12px',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Sliders size={13} /> WHAT-IF LAB
            </button>
          </div>

          {/* Info Modal Trigger */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="glass-panel"
            style={{
              padding: '10px 14px', color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600
            }}
          >
            <Info size={15} /> Mission Brief
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* LEFT TELEMETRY HUD: PRIMARY VITALS (DARK.DESIGN)    */}
      {/* ---------------------------------------------------- */}
      <aside style={{
        position: 'absolute', left: '20px', top: '86px', width: '340px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '14px', pointerEvents: 'auto'
      }}>
        
        {/* Core Metric Card: Internal Chamber Temperature */}
        <div className="glass-panel" style={{ 
          padding: '20px',
          borderColor: isSafe ? 'rgba(0, 245, 160, 0.3)' : (isFreezing ? 'rgba(0, 210, 255, 0.4)' : 'rgba(255, 71, 102, 0.5)'),
          boxShadow: isSafe ? 'var(--color-safe-glow)' : (isFreezing ? '0 0 24px rgba(0,210,255,0.2)' : 'var(--color-danger-glow)')
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              <Thermometer size={15} color={isSafe ? 'var(--color-safe)' : (isFreezing ? 'var(--color-cryo)' : 'var(--color-danger)')} />
              Cargo Chamber Temp
            </div>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '4px',
              background: isSafe ? 'var(--color-safe-bg)' : (isFreezing ? 'rgba(0, 210, 255, 0.15)' : 'var(--color-danger-bg)'),
              color: isSafe ? 'var(--color-safe)' : (isFreezing ? 'var(--color-cryo)' : 'var(--color-danger)')
            }}>
              {isSafe ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
              {isSafe ? 'SAFE RANGE' : (isFreezing ? 'FREEZE RISK' : 'OVERHEAT')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
            <span className="mono-metric" style={{ 
              fontSize: '3.5rem', fontWeight: 800, lineHeight: 1,
              color: isSafe ? '#ffffff' : (isFreezing ? 'var(--color-cryo)' : 'var(--color-danger)')
            }}>
              {telemetry.temperature.toFixed(1)}
            </span>
            <span style={{ fontSize: '1.4rem', color: 'var(--text-muted)', fontWeight: 600 }}>°C</span>
          </div>

          {/* Visual Scale Indicator Bar */}
          <div style={{ margin: '14px 0 8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>0°C (Min)</span>
              <span style={{ color: 'var(--color-safe)', fontWeight: 700 }}>2°C – 8°C (WHO Target)</span>
              <span>15°C (Max)</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
              {/* Safe zone highlight (2°C to 8°C out of 15°C scale) */}
              <div style={{ 
                position: 'absolute', left: `${(2 / 15) * 100}%`, width: `${(6 / 15) * 100}%`, 
                height: '100%', background: 'rgba(0, 245, 160, 0.35)' 
              }} />
              {/* Current temperature marker */}
              <div style={{
                position: 'absolute', 
                left: `${Math.min(100, Math.max(0, (telemetry.temperature / 15) * 100))}%`,
                top: 0, bottom: 0, width: '4px',
                background: isSafe ? 'var(--color-safe)' : (isFreezing ? 'var(--color-cryo)' : 'var(--color-danger)'),
                boxShadow: '0 0 6px currentColor',
                transform: 'translateX(-50%)'
              }} />
            </div>
          </div>

          {/* Real-time SVG Trend Sparkline */}
          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Telemetry History (Recent Packets)</span>
              <span className="mono-metric" style={{ color: 'var(--text-secondary)' }}>Live Trend</span>
            </div>
            <svg width="100%" height="45" viewBox="0 0 260 55" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isSafe ? '#00f5a0' : '#ff4766'} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={isSafe ? '#00f5a0' : '#ff4766'} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke={isSafe ? '#00f5a0' : '#ff4766'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>
        </div>

        {/* Battery & Thermal Runway Card */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              <Battery size={15} color={telemetry.voltage > 8.0 ? 'var(--color-safe)' : 'var(--color-warning)'} />
              Estimated Safe Runway
            </div>
            <span style={{ 
              fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
              background: telemetry.voltage > 8.0 ? 'rgba(0, 245, 160, 0.1)' : 'rgba(245, 158, 11, 0.15)',
              color: telemetry.voltage > 8.0 ? 'var(--color-safe)' : 'var(--color-warning)',
              fontFamily: 'var(--font-mono)'
            }}>
              {batteryPct}% SOC
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono-metric" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff' }}>
              {runwayData.hours}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>hours</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Bus Voltage: <strong className="mono-metric" style={{ color: '#fff' }}>{telemetry.voltage.toFixed(2)}V</strong></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
              <Zap size={12} /> DC Supply: 12V
            </span>
          </div>
        </div>

        {/* Quick Camera Preset Pills */}
        <div className="glass-panel" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={12} /> 3D Viewport Focus
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {[
              { id: 'DEFAULT', label: 'Full Rig' },
              { id: 'CAVITY', label: 'Cavity' },
              { id: 'ENGINE', label: 'Peltier' },
              { id: 'BATTERY', label: 'Circuit' }
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => setCameraPreset(preset.id)}
                style={{
                  background: cameraPreset === preset.id ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: cameraPreset === preset.id ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                  color: cameraPreset === preset.id ? '#ffffff' : 'var(--text-secondary)',
                  padding: '6px 0', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* RIGHT TELEMETRY HUD: ACTUATORS & SIMULATOR LAB       */}
      {/* ---------------------------------------------------- */}
      <aside style={{
        position: 'absolute', right: '20px', top: '86px', width: '320px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '14px', pointerEvents: 'auto'
      }}>
        
        {/* Actuators: Peltier Heat Pump & High-CFM Fan */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} color="#38bdf8" /> Thermal Management System
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Peltier Cooler */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px', border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>TEC Peltier Cooler</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Solid-State Heat Pump</div>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                background: telemetry.peltier ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: telemetry.peltier ? '#00e5ff' : 'var(--text-muted)'
              }}>
                {telemetry.peltier ? 'ACTIVE [100%]' : 'IDLE'}
              </span>
            </div>

            {/* Blower Exhaust Fan */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px', border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wind 
                  size={16} 
                  color={telemetry.fan ? '#38bdf8' : 'var(--text-muted)'} 
                  style={{ animation: telemetry.fan ? 'spin 1.5s linear infinite' : 'none' }}
                />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exhaust Fan</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Forced Convection</div>
                </div>
              </div>
              <span className="mono-metric" style={{
                fontSize: '0.8rem', fontWeight: 700,
                color: telemetry.fan ? '#38bdf8' : 'var(--text-muted)'
              }}>
                {telemetry.fan ? '3,200 RPM' : '0 RPM'}
              </span>
            </div>

            {/* Ambient Humidity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '4px 6px', color: 'var(--text-secondary)' }}>
              <span>Chamber Humidity:</span>
              <span className="mono-metric" style={{ color: '#fff', fontWeight: 600 }}>{telemetry.humidity.toFixed(1)}% RH</span>
            </div>
          </div>
        </div>

        {/* What-If Simulator Panel */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={15} color="#00f5a0" /> What-If Stress Lab
            </h3>
            <button
              onClick={() => applySimulation(4.5, 11.85)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem'
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          {/* Quick Scenario Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
            <button
              onClick={() => applySimulation(4.2, 12.1)}
              style={{
                background: 'rgba(0, 245, 160, 0.1)', border: '1px solid rgba(0, 245, 160, 0.25)',
                color: 'var(--color-safe)', padding: '6px 8px', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left'
              }}
            >
              ✓ Safe Transit (4.2°C)
            </button>
            <button
              onClick={() => applySimulation(38.5, 10.2)}
              style={{
                background: 'rgba(255, 71, 102, 0.1)', border: '1px solid rgba(255, 71, 102, 0.25)',
                color: 'var(--color-danger)', padding: '6px 8px', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left'
              }}
            >
              ⚠ Heatwave (38.5°C)
            </button>
            <button
              onClick={() => applySimulation(1.2, 11.5)}
              style={{
                background: 'rgba(0, 210, 255, 0.1)', border: '1px solid rgba(0, 210, 255, 0.25)',
                color: 'var(--color-cryo)', padding: '6px 8px', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left'
              }}
            >
              ❄ Sub-Zero (1.2°C)
            </button>
            <button
              onClick={() => applySimulation(7.2, 6.7)}
              style={{
                background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--color-warning)', padding: '6px 8px', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left'
              }}
            >
              ⚡ Low Battery (6.7V)
            </button>
          </div>

          {/* Continuous Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cavity Temperature</span>
                <span className="mono-metric" style={{ color: '#fff', fontWeight: 700 }}>{simTemp.toFixed(1)} °C</span>
              </div>
              <input 
                type="range" 
                min="-5" 
                max="45" 
                step="0.2" 
                value={simTemp}
                onChange={(e) => applySimulation(parseFloat(e.target.value), simVolt)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Battery Bus Voltage</span>
                <span className="mono-metric" style={{ color: '#fff', fontWeight: 700 }}>{simVolt.toFixed(2)} V</span>
              </div>
              <input 
                type="range" 
                min="6.0" 
                max="12.6" 
                step="0.05" 
                value={simVolt}
                onChange={(e) => applySimulation(simTemp, parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* BOTTOM TELEMETRY FOOTER TICKER                      */}
      {/* ---------------------------------------------------- */}
      <footer style={{
        position: 'absolute', bottom: '16px', left: '20px', right: '20px', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none'
      }}>
        <div className="glass-panel" style={{ 
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px',
          fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', pointerEvents: 'auto'
        }}>
          <div>
            SOURCE: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{telemetry.source || 'AUTO_STREAM'}</span>
          </div>
          <div style={{ width: '1px', height: '12px', background: 'var(--border-subtle)' }} />
          <div>
            PACKET ID: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>#{packetCount || telemetry.packet_id || 101}</span>
          </div>
          <div style={{ width: '1px', height: '12px', background: 'var(--border-subtle)' }} />
          <div>
            UPDATED: <span style={{ color: 'var(--color-safe)' }}>
              {Math.max(0, Math.round((Date.now() - lastPacketTime) / 1000))}s ago
            </span>
          </div>
        </div>

        <div className="glass-panel" style={{ 
          padding: '8px 16px', fontSize: '0.7rem', color: 'var(--text-secondary)', pointerEvents: 'auto'
        }}>
          <span>Click & drag 3D twin to rotate • Scroll to zoom • Select parts to inspect</span>
        </div>
      </footer>

      {/* ---------------------------------------------------- */}
      {/* MISSION BRIEFING MODAL (LAST-MILE CONTEXT)           */}
      {/* ---------------------------------------------------- */}
      {showInfoModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(5, 7, 10, 0.85)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '560px', width: '100%', padding: '28px',
            backgroundColor: '#0d1117', border: '1px solid var(--border-light)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-safe)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Deployment Protocol
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>
                  Rural Last-Mile Vaccine Delivery
                </h2>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              In remote off-grid regions across rural India and Southeast Asia, community health workers transport temperature-critical vaccines (BCG, Polio, COVID-19, Insulin) across arduous terrains without access to reliable electrical grids.
            </p>

            <div style={{ background: 'rgba(0, 245, 160, 0.05)', border: '1px solid rgba(0, 245, 160, 0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-safe)', marginBottom: '4px' }}>
                Why a Predictive Digital Twin?
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Standard data loggers only inform a doctor <em>after</em> vaccines have spoiled. This digital twin combines battery discharge curves, ambient sensor telemetry, and thermoelectric modeling to predict safe delivery runway <strong>before</strong> the health worker departs.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <div>• Strict WHO PQS Target: <strong>+2°C to +8°C</strong></div>
              <div>• Active Heat Pump: <strong>TEC1-12706 Peltier</strong></div>
              <div>• IoT Microcontroller: <strong>ESP32-S3 Wi-Fi / MQTT</strong></div>
              <div>• Primary Telemetry: <strong>HiveMQ Public Broker</strong></div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              style={{
                width: '100%', padding: '12px', background: 'var(--color-safe)',
                color: '#060709', border: 'none', borderRadius: '8px',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              Resume Telemetry Monitoring
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ESP32 DEVICE SCANNER & IP INPUT MODAL               */}
      {/* ---------------------------------------------------- */}
      {showDeviceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(5, 7, 10, 0.85)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '580px', width: '100%', padding: '26px',
            backgroundColor: '#0d1117', border: '1px solid var(--border-light)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--color-safe)" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-safe)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Hardware Telemetry Link
                  </span>
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '2px', color: '#f8fafc' }}>
                  Connect ESP32 Controller
                </h2>
              </div>
              <button 
                onClick={() => setShowDeviceModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {connectSuccessMsg && (
              <div style={{
                background: 'rgba(0, 245, 160, 0.12)', border: '1px solid rgba(0, 245, 160, 0.4)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-safe)',
                fontSize: '0.8rem', fontWeight: 600
              }}>
                <CheckCircle2 size={16} /> {connectSuccessMsg}
              </div>
            )}

            {/* Part 1: Manual IP Input Field */}
            <form onSubmit={handleManualConnect} style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Enter ESP32 IP Address or Hostname
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={deviceIpInput}
                  onChange={(e) => setDeviceIpInput(e.target.value)}
                  placeholder="e.g. 192.168.31.173 or 192.168.1.50"
                  style={{
                    flex: 1, padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px', color: '#fff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 18px', background: 'var(--color-safe)',
                    color: '#060709', border: 'none', borderRadius: '8px',
                    fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Radio size={14} /> Connect
                </button>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Active Target: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{telemetry.device_ip}</strong> (Live on 3D OLED screen)
              </div>
            </form>

            {/* Quick Presets */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Presets
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { ip: '192.168.31.173', label: '192.168.31.173 (Prototype Rig)' },
                  { ip: '192.168.1.50', label: '192.168.1.50 (Lab Bench)' },
                  { ip: '10.160.121.83', label: '10.160.121.83 (Local Host)' }
                ].map(p => (
                  <button
                    key={p.ip}
                    type="button"
                    onClick={() => handleSelectDevice(p.ip, p.label)}
                    style={{
                      background: telemetry.device_ip === p.ip ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: telemetry.device_ip === p.ip ? '1px solid var(--color-safe)' : '1px solid var(--border-subtle)',
                      color: telemetry.device_ip === p.ip ? 'var(--color-safe)' : 'var(--text-secondary)',
                      padding: '5px 10px', borderRadius: '6px', fontSize: '0.7rem',
                      fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Part 2: Network Scanner & Discovered ESP32 Devices */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                    Network Scan & Discovered ESP32s
                  </h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Scan Wi-Fi subnet for active MQTT / HTTP transmitters
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleScanDevices}
                  disabled={isScanning}
                  style={{
                    padding: '8px 14px', background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px',
                    color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600,
                    cursor: isScanning ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <RefreshCw size={13} style={{ animation: isScanning ? 'spin 1s linear infinite' : 'none' }} />
                  {isScanning ? 'Scanning Subnet...' : 'Scan Network'}
                </button>
              </div>

              {/* Discovered Device Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {discoveredDevices.map((dev) => {
                  const isSelected = telemetry.device_ip === dev.ip;
                  return (
                    <div
                      key={dev.ip}
                      onClick={() => handleSelectDevice(dev.ip, dev.name)}
                      style={{
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(0, 245, 160, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid rgba(0, 245, 160, 0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: '10px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: isSelected ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Cpu size={16} color={isSelected ? 'var(--color-safe)' : '#94a3b8'} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                            {dev.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <span>IP: <strong style={{ color: '#cbd5e1' }}>{dev.ip}</strong></span>
                            {dev.signal && <span>• Signal: {dev.signal}</span>}
                            {dev.type && <span>• {dev.type}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSelected ? (
                          <span style={{
                            padding: '4px 10px', borderRadius: '6px',
                            background: 'rgba(0, 245, 160, 0.2)', color: 'var(--color-safe)',
                            fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            <CheckCircle2 size={12} /> ACTIVE LINK
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 10px', borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)',
                            fontSize: '0.7rem', fontWeight: 600
                          }}>
                            Choose & Connect
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeviceModal(false)}
                style={{
                  padding: '8px 18px', background: 'transparent',
                  border: '1px solid var(--border-light)', borderRadius: '8px',
                  color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
