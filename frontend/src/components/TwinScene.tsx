import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Environment, ContactShadows, RoundedBox, OrbitControls, Grid } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

export type Telemetry = {
  timestamp: number
  device_ip: string
  system_state: string
  temperature: number
  humidity: number
  voltage: number
  peltier: boolean
  fan: boolean
  source?: string
  packet_id?: number
}

// ----------------------------------------------------
// 1. PHYSICAL WOODEN WORKBENCH BASEPLATE (High Contrast Lab Bench)
// ----------------------------------------------------
function WorkbenchBase() {
  return (
    <group position={[0, -0.1, 0]}>
      {/* Plywood Baseplate - Rich Warm Birch Tone (Non-reflective) */}
      <RoundedBox args={[10.5, 0.22, 6.4]} radius={0.06} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#8c6843" 
          roughness={0.9} 
          metalness={0.02} 
        />
      </RoundedBox>

      {/* Wood grain edge trim / border bevel */}
      <mesh position={[0, -0.09, 3.2]}>
        <boxGeometry args={[10.52, 0.04, 0.04]} />
        <meshStandardMaterial color="#63482d" roughness={0.9} />
      </mesh>

      {/* Vertical Wood Panel for OLED Display & Wire Routing */}
      <RoundedBox args={[4.2, 3.8, 0.18]} radius={0.05} smoothness={4} position={[2.8, 1.85, -1.8]}>
        <meshStandardMaterial 
          color="#7d5b38" 
          roughness={0.9} 
          metalness={0.02} 
        />
      </RoundedBox>
    </group>
  )
}

// ----------------------------------------------------
// 2. STYROFOAM COOLER BOX WITH OPEN LID & PAYLOAD
// ----------------------------------------------------
function StyrofoamCooler({ temp, humidity, isSafe, onSelect }: { temp: number, humidity: number, isSafe: boolean, onSelect?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const isFreezing = temp < 2.0
  const tempColor = isSafe ? '#00f5a0' : (isFreezing ? '#00d2ff' : '#ff4766')

  // Natural matte cooler material - NO blown-out white glare
  const styroMaterial = (
    <meshStandardMaterial 
      color="#cbd5e1" 
      roughness={0.95} 
      metalness={0.0} 
    />
  )

  const styroRimMaterial = (
    <meshStandardMaterial 
      color="#94a3b8" 
      roughness={0.9} 
      metalness={0.05} 
    />
  )

  return (
    <group 
      position={[-2.3, 0.0, 0.1]} 
      onClick={onSelect}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer Polystyrene Base Walls */}
      {/* Bottom Floor */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[4.4, 0.3, 3.8]} />
        {styroMaterial}
      </mesh>

      {/* Front Wall with Fan Window */}
      <group position={[0, 1.05, 1.75]}>
        <mesh position={[-1.4, 0, 0]}>
          <boxGeometry args={[1.6, 1.5, 0.3]} />
          {styroMaterial}
        </mesh>
        <mesh position={[1.4, 0, 0]}>
          <boxGeometry args={[1.6, 1.5, 0.3]} />
          {styroMaterial}
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.3]} />
          {styroMaterial}
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.3]} />
          {styroMaterial}
        </mesh>
      </group>

      {/* Back Wall */}
      <mesh position={[0, 1.05, -1.75]}>
        <boxGeometry args={[4.4, 1.5, 0.3]} />
        {styroMaterial}
      </mesh>
      {/* Left Wall */}
      <mesh position={[-2.05, 1.05, 0]}>
        <boxGeometry args={[0.3, 1.5, 3.2]} />
        {styroMaterial}
      </mesh>
      {/* Right Wall */}
      <mesh position={[2.05, 1.05, 0]}>
        <boxGeometry args={[0.3, 1.5, 3.2]} />
        {styroMaterial}
      </mesh>

      {/* Lip / Rim Chamfer on Top Edges */}
      <mesh position={[0, 1.82, -1.75]}>
        <boxGeometry args={[4.42, 0.05, 0.32]} />
        {styroRimMaterial}
      </mesh>
      <mesh position={[-2.05, 1.82, 0]}>
        <boxGeometry args={[0.32, 0.05, 3.22]} />
        {styroRimMaterial}
      </mesh>
      <mesh position={[2.05, 1.82, 0]}>
        <boxGeometry args={[0.32, 0.05, 3.22]} />
        {styroRimMaterial}
      </mesh>
      <mesh position={[0, 1.82, 1.75]}>
        <boxGeometry args={[4.42, 0.05, 0.32]} />
        {styroRimMaterial}
      </mesh>

      {/* Styrofoam Lid - Open Tilted Back */}
      <group position={[0, 1.8, -1.8]} rotation={[-Math.PI / 3.2, 0, 0]}>
        <RoundedBox args={[4.5, 0.35, 3.9]} radius={0.08} smoothness={3} position={[0, 0, 1.95]}>
          <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
        </RoundedBox>
        {/* Recessed Interior Rim on Lid */}
        <mesh position={[0, -0.2, 1.95]}>
          <boxGeometry args={[3.7, 0.08, 3.1]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.95} />
        </mesh>
      </group>

      {/* Interior Cold Gel Ice Pack (Center Floor) */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.6, 0.28, 1.6]} />
        <meshPhysicalMaterial 
          color="#0284c7" 
          transmission={0.7} 
          roughness={0.3} 
          thickness={0.5} 
          transparent 
          opacity={0.8} 
        />
      </mesh>

      {/* Vaccine Vials Surrounding the Ice Pack */}
      {[
        [-1.2, 0.35, -0.8],
        [-0.6, 0.35, -0.8],
        [0.0, 0.35, -0.8],
        [0.6, 0.35, -0.8],
        [1.2, 0.35, -0.8],
        [-1.2, 0.35, 0.8],
        [-0.6, 0.35, 0.8],
        [0.0, 0.35, 0.8],
        [0.6, 0.35, 0.8],
        [1.2, 0.35, 0.8],
      ].map((pos, idx) => (
        <group key={idx} position={pos as [number, number, number]}>
          {/* Glass Vial Body */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.5, 16]} />
            <meshPhysicalMaterial 
              color="#f8fafc" 
              transmission={0.85} 
              opacity={0.8} 
              roughness={0.15} 
              transparent 
            />
          </mesh>
          {/* Liquid Vaccine Solution */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.38, 16]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.7} />
          </mesh>
          {/* Aluminum Seal */}
          <mesh position={[0, 0.51, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Blue Flip-Off Safety Cap */}
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.05, 16]} />
            <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* DHT22 Sensor (White Slotted Sensor on Interior Wall) */}
      <group position={[-1.2, 1.25, -1.55]}>
        <RoundedBox args={[0.3, 0.45, 0.18]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </RoundedBox>
        {/* Sensor Grill Lines */}
        {[-0.1, -0.04, 0.02, 0.08].map((y, i) => (
          <mesh key={i} position={[0, y, 0.1]}>
            <boxGeometry args={[0.2, 0.02, 0.02]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}
        {/* DHT22 Connection Wires (Red, Black, Yellow) */}
        <mesh position={[-0.05, -0.35, 0.05]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0.0, -0.35, 0.05]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.05, -0.35, 0.05]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      </group>

      {/* Gentle Interior Point Light (Controlled soft luminescence) */}
      <pointLight position={[0, 0.9, 0]} color={tempColor} intensity={0.4} distance={2.5} />

      {/* Inspection Tooltip */}
      <Html position={[0, 2.3, 0]} center style={{ pointerEvents: 'none', transition: 'all 0.3s ease', opacity: hovered ? 1 : 0.85 }}>
        <div style={{
          background: 'rgba(8, 11, 16, 0.92)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          borderLeft: `3px solid ${tempColor}`,
          borderRadius: '8px',
          padding: '6px 14px',
          color: 'white',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.75rem',
          boxShadow: `0 4px 20px rgba(0,0,0,0.6)`,
          whiteSpace: 'nowrap'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>POLAR CAVITY + DHT22</div>
          <div style={{ fontWeight: 800, color: tempColor, fontSize: '1.2rem' }}>
            {temp.toFixed(1)}°C <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({humidity.toFixed(0)}% RH)</span>
          </div>
        </div>
      </Html>
    </group>
  )
}

// ----------------------------------------------------
// 3. TEC1-12706 PELTIER MODULE + BLUE LED COOLING FAN
// ----------------------------------------------------
function PeltierCoolingUnit({ fanActive, peltierActive, onSelect }: { fanActive: boolean, peltierActive: boolean, onSelect?: () => void }) {
  const fanRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    if (fanActive && fanRef.current) {
      fanRef.current.rotation.z -= delta * 24
    }
  })

  return (
    <group 
      position={[-2.3, 0.0, 0.1]}
      onClick={onSelect}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* FRONT COOLING FAN (Mounted on front face of Styrofoam box) */}
      <group position={[0, 1.05, 1.95]}>
        {/* Fan Shroud (Dark Industrial Black Housing) */}
        <RoundedBox args={[1.18, 1.18, 0.22]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#090d16" roughness={0.5} metalness={0.6} />
        </RoundedBox>

        {/* Circular Impeller Duct Rim */}
        <mesh position={[0, 0, 0.12]}>
          <ringGeometry args={[0.48, 0.54, 32]} />
          <meshStandardMaterial color="#0284c7" emissive="#00e5ff" emissiveIntensity={peltierActive ? 0.9 : 0.2} />
        </mesh>

        {/* Outer Circular Chrome Fan Guard Wire */}
        <mesh position={[0, 0, 0.13]}>
          <ringGeometry args={[0.53, 0.55, 32]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Fan Rotor & Blades (Translucent Electric Blue LED Blades) */}
        <group ref={fanRef} position={[0, 0, 0.05]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.1, 24]} />
            <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3.5]}>
              <boxGeometry args={[0.85, 0.12, 0.02]} />
              <meshPhysicalMaterial 
                color="#00d2ff" 
                emissive="#00e5ff" 
                emissiveIntensity={fanActive ? 1.2 : 0.1} 
                transparent 
                opacity={0.85} 
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>

        {/* Blue LED Illumination Point Light */}
        <pointLight position={[0, 0, 0.35]} color="#00e5ff" intensity={fanActive ? 0.9 : 0.2} distance={2.5} />
      </group>



      {/* Tooltip */}
      <Html position={[0, 0.4, 2.1]} center style={{ pointerEvents: 'none', transition: 'all 0.3s ease', opacity: hovered ? 1 : 0 }}>
        <div style={{
          background: 'rgba(8, 11, 16, 0.92)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          borderLeft: '3px solid #00e5ff',
          borderRadius: '6px',
          padding: '4px 10px',
          color: 'white',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
          whiteSpace: 'nowrap'
        }}>
          <div>TEC1-12706 PELTIER MODULE + FAN</div>
          <div style={{ color: fanActive ? '#38bdf8' : '#64748b' }}>
            STATUS: {peltierActive ? 'ACTIVE (COOLING)' : 'STANDBY'}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ----------------------------------------------------
// 4. ELECTRONICS RIG: ESP32, RELAY, OLED, VOLTAGE SENSOR, BUZZER & PIR
// ----------------------------------------------------
function ElectronicsRig({ telemetry, onSelect }: { telemetry: Telemetry, onSelect?: (comp: string) => void }) {
  const [hoveredComp, setHoveredComp] = useState<string | null>(null)

  return (
    <group position={[0, 0, 0]}>
      {/* A. OLED TELEMETRY DISPLAY (Realistic High-Contrast Graphic Screen) */}
      <group 
        position={[2.8, 2.3, -1.65]}
        onClick={() => onSelect && onSelect('OLED')}
        onPointerOver={(e) => { e.stopPropagation(); setHoveredComp('OLED') }}
        onPointerOut={() => setHoveredComp(null)}
      >
        {/* Display Bezel / Housing */}
        <RoundedBox args={[2.0, 1.3, 0.09]} radius={0.04} smoothness={3}>
          <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
        </RoundedBox>
        {/* Display Glass Screen */}
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[1.75, 1.05]} />
          <meshStandardMaterial color="#030712" roughness={0.1} />
        </mesh>
        {/* Rendered Live Screen Content in High-Contrast Pixel Font */}
        <Html position={[0, 0, 0.06]} transform scale={0.155} style={{ pointerEvents: 'none' }}>
          <div style={{
            width: '180px', height: '105px',
            backgroundColor: '#030712',
            color: '#38bdf8',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '9px',
            fontWeight: 700,
            lineHeight: 1.45,
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: 'inset 0 0 10px rgba(2, 132, 199, 0.3)'
          }}>
            <div style={{ color: '#00f5a0' }}>● WIFI CONNECTED</div>
            <div>IP: {telemetry.device_ip || '192.168.31.173'}</div>
            <div>TEMP: {telemetry.temperature.toFixed(1)}°C</div>
            <div>BATT: {telemetry.voltage.toFixed(2)}V</div>
            <div style={{ color: '#38bdf8' }}>STATE: {telemetry.system_state || 'ARMED'}</div>
          </div>
        </Html>
      </group>

      {/* B. HORIZONTAL ELECTRONICS SUB-BOARD */}
      <group position={[2.4, 0.02, 0.5]}>
        {/* Acrylic Sub-Plate (Translucent Smokey Grey) */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[3.2, 0.04, 2.8]} />
          <meshPhysicalMaterial color="#334155" roughness={0.3} transmission={0.6} transparent opacity={0.7} />
        </mesh>

        {/* ESP32 Controller Module */}
        <group 
          position={[-0.7, 0.12, 0.4]}
          onClick={() => onSelect && onSelect('ESP32')}
          onPointerOver={(e) => { e.stopPropagation(); setHoveredComp('ESP32') }}
          onPointerOut={() => setHoveredComp(null)}
        >
          {/* Black Matte PCB */}
          <mesh>
            <boxGeometry args={[0.65, 0.05, 1.2]} />
            <meshStandardMaterial color="#090d16" roughness={0.5} />
          </mesh>
          {/* Silver Metal RF Shield */}
          <mesh position={[0, 0.05, -0.2]}>
            <boxGeometry args={[0.5, 0.06, 0.6]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* USB Port & Power LEDs */}
          <mesh position={[0, 0.06, 0.55]}>
            <boxGeometry args={[0.2, 0.08, 0.15]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
          <mesh position={[-0.15, 0.06, 0.3]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
          </mesh>
          <mesh position={[0.15, 0.06, 0.3]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#00f5a0" emissive="#00f5a0" emissiveIntensity={1.5} />
          </mesh>
        </group>

        {/* Green Push-Button Toggle (GPIO15 System Toggle) */}
        <group position={[-1.2, 0.14, 0.4]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.1, 24]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
            <meshStandardMaterial color="#10b981" emissive="#00f5a0" emissiveIntensity={1.0} />
          </mesh>
        </group>

        {/* 4-Channel Blue Relay Module */}
        <group 
          position={[-0.2, 0.15, -0.6]}
          onClick={() => onSelect && onSelect('RELAY')}
          onPointerOver={(e) => { e.stopPropagation(); setHoveredComp('RELAY') }}
          onPointerOut={() => setHoveredComp(null)}
        >
          {/* Blue PCB */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.5, 0.05, 1.1]} />
            <meshStandardMaterial color="#0369a1" roughness={0.4} />
          </mesh>
          {/* 4 Blue Songle Relays */}
          {[-0.5, -0.17, 0.17, 0.5].map((x, i) => (
            <mesh key={i} position={[x, 0.18, 0]}>
              <boxGeometry args={[0.28, 0.3, 0.45]} />
              <meshStandardMaterial color="#0284c7" roughness={0.4} />
            </mesh>
          ))}
          {/* Black Screw Terminals */}
          <mesh position={[0, 0.12, 0.45]}>
            <boxGeometry args={[1.3, 0.2, 0.15]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} />
          </mesh>
        </group>

        {/* 0-25V DC Voltage Divider Breakout */}
        <group position={[0.7, 0.12, 0.4]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.6]} />
            <meshStandardMaterial color="#0369a1" />
          </mesh>
          <mesh position={[0.15, 0.1, 0]}>
            <boxGeometry args={[0.2, 0.18, 0.35]} />
            <meshStandardMaterial color="#0284c7" metalness={0.5} />
          </mesh>
          <mesh position={[-0.15, 0.06, 0]}>
            <boxGeometry args={[0.15, 0.05, 0.25]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>

        {/* Realistic Wiring Harness Routing between Modules */}
        <mesh position={[-0.5, 0.08, -0.1]}>
          <boxGeometry args={[0.02, 0.02, 0.8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <mesh position={[-0.45, 0.08, -0.1]}>
          <boxGeometry args={[0.02, 0.02, 0.8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.4, 0.08, -0.1]}>
          <boxGeometry args={[0.02, 0.02, 0.8]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* C. 12V DC POWER ADAPTER BRICK (Black Industrial Adapter) */}
      <group position={[4.0, 0.35, 0.6]}>
        <RoundedBox args={[1.2, 0.65, 2.4]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#0b0f19" roughness={0.5} metalness={0.5} />
        </RoundedBox>
        {/* Power Status LED */}
        <mesh position={[-0.4, 0.34, 0.8]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#00f5a0" emissive="#00f5a0" emissiveIntensity={1.5} />
        </mesh>
        {/* AC and DC Heavy Duty Cords */}
        <mesh position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
        <mesh position={[0, 0, -1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.4, 16]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
      </group>

      {/* D. PIR MOTION SENSOR & PIEZO BUZZER (Bottom Left Corner) */}
      <group position={[-4.4, 0.15, 2.2]}>
        {/* PIR Geodesic Dome on Green PCB */}
        <group position={[0, 0.05, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.65, 0.06, 0.65]} />
            <meshStandardMaterial color="#047857" />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
          </mesh>
        </group>
        {/* Black Piezo Sounder Buzzer */}
        <group position={[0.7, 0.08, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.16, 24]} />
            <meshStandardMaterial color="#090d16" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      </group>

      {/* Tooltip Overlay */}
      {hoveredComp && (
        <Html position={[2.8, 3.2, -1.5]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(8, 11, 16, 0.92)',
            border: '1px solid #38bdf8',
            borderRadius: '6px',
            padding: '4px 10px',
            color: '#38bdf8',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.7rem',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
          }}>
            {hoveredComp === 'ESP32' && 'ESP32 IOT CORE (GPIO CONTROLLER)'}
            {hoveredComp === 'OLED' && 'OLED TELEMETRY HUD (I2C BUS)'}
            {hoveredComp === 'RELAY' && '4-CHANNEL POWER RELAY BANK'}
          </div>
        </Html>
      )}
    </group>
  )
}

// ----------------------------------------------------
// 5. CAMERA DIRECTOR (Supports Isometric Bench Overview)
// ----------------------------------------------------
function CameraDirector({ cameraPreset }: { cameraPreset: string }) {
  const controlsRef = useRef<any>(null)

  useFrame((state, delta) => {
    // Beautiful 3/4 isometric perspective showing both cooler and electronics clearly
    let targetPos = new THREE.Vector3(-0.5, 4.8, 9.6)
    let lookTarget = new THREE.Vector3(0.2, 0.8, 0.0)

    if (cameraPreset === 'CAVITY') {
      targetPos = new THREE.Vector3(-2.3, 3.4, 3.2)
      lookTarget = new THREE.Vector3(-2.3, 0.8, 0.1)
    } else if (cameraPreset === 'ENGINE') {
      targetPos = new THREE.Vector3(-2.3, 1.4, 4.4)
      lookTarget = new THREE.Vector3(-2.3, 1.05, 1.95)
    } else if (cameraPreset === 'BATTERY') {
      targetPos = new THREE.Vector3(2.6, 3.4, 3.4)
      lookTarget = new THREE.Vector3(2.6, 1.0, 0.2)
    } else if (cameraPreset === 'TOP') {
      targetPos = new THREE.Vector3(0, 10.5, 0.1)
      lookTarget = new THREE.Vector3(0, 0, 0)
    }

    if (cameraPreset !== 'ORBIT') {
      state.camera.position.lerp(targetPos, delta * 2.5)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(lookTarget, delta * 2.5)
        controlsRef.current.update()
      }
    }
  })

  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2 + 0.02}
      minDistance={3.0}
      maxDistance={24}
    />
  )
}

export default function TwinScene({ 
  telemetry, 
  cameraPreset = 'DEFAULT',
  onSelectComponent
}: { 
  telemetry: Telemetry, 
  cameraPreset?: string,
  onSelectComponent?: (comp: string) => void
}) {
  const isSafe = telemetry.temperature >= 2.0 && telemetry.temperature <= 8.0

  return (
    <Canvas 
      shadows 
      camera={{ position: [-0.5, 4.8, 9.6], fov: 40 }}
      gl={{ 
        antialias: true, 
        alpha: false, 
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.95
      }}
    >
      <color attach="background" args={['#060709']} />
      
      <CameraDirector cameraPreset={cameraPreset} />
      
      {/* Cinematic Studio Lighting - High Contrast & Controlled Luminescence */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 6]} intensity={0.9} castShadow shadow-mapSize={1024} />
      <directionalLight position={[-6, 5, -4]} intensity={0.4} color="#38bdf8" />
      
      {/* Studio Environment with Low Ambient Fill */}
      <Environment preset="night" environmentIntensity={0.25} />

      {/* Cybernetic Grid Floor */}
      <Grid 
        position={[0, -0.12, 0]} 
        args={[45, 45]} 
        cellSize={0.8} 
        cellThickness={0.5} 
        cellColor="#0e1726" 
        sectionSize={4} 
        sectionThickness={1.0} 
        sectionColor="#1e293b" 
        fadeDistance={24} 
      />

      {/* Complete Hardware Assembly Replica */}
      <group position={[0, 0, 0]}>
        <WorkbenchBase />
        
        <StyrofoamCooler 
          temp={telemetry.temperature} 
          humidity={telemetry.humidity} 
          isSafe={isSafe} 
          onSelect={() => onSelectComponent && onSelectComponent('CAVITY')}
        />

        <PeltierCoolingUnit 
          fanActive={telemetry.fan} 
          peltierActive={telemetry.peltier} 
          onSelect={() => onSelectComponent && onSelectComponent('ENGINE')}
        />

        <ElectronicsRig 
          telemetry={telemetry} 
          onSelect={(comp) => onSelectComponent && onSelectComponent(comp)}
        />
      </group>

      {/* Soft Contact Shadows on Workbench Floor */}
      <ContactShadows 
        position={[0, -0.11, 0]} 
        opacity={0.8} 
        scale={16} 
        blur={2.2} 
        far={3} 
        color="#000000" 
      />

      {/* Post-Processing: Bloom Threshold set high (0.92) so ONLY emissive LEDs bloom */}
      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={0.92} mipmapBlur intensity={0.8} levels={5} />
        <Vignette offset={0.3} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  )
}
