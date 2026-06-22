'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import ParticleCanvas from './ParticleCanvas'

// ─── Camera drift ─────────────────────────────────────────────────────────────
function CameraDrift() {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.13) * 0.5
    camera.position.y = Math.cos(t * 0.11) * 0.35
  })
  return null
}

// ─── Particle field ───────────────────────────────────────────────────────────
function ParticleField() {
  const groupRef = useRef<THREE.Group>(null)
  const COUNT = 300

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 100
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60
      arr[i * 3 + 2] = (Math.random() - 0.5) * 100
    }
    return arr
  }, [])

  const colors = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    const gold  = new THREE.Color('#f59e0b')
    const white = new THREE.Color('#ffffff')
    for (let i = 0; i < COUNT; i++) {
      const c = Math.random() > 0.5 ? gold : white
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.0005 })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color"    args={[colors, 3]}    />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.6} sizeAttenuation />
      </points>
    </group>
  )
}

// ─── Gold halo plane behind the miner ────────────────────────────────────────
function GlowPlane() {
  return (
    <mesh position={[1.5, -0.5, -0.1]}>
      <planeGeometry args={[8, 4]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.08} depthWrite={false} />
    </mesh>
  )
}

// ─── LED grid (instanced) ─────────────────────────────────────────────────────
interface LEDGridProps {
  ledSpeedRef: React.MutableRefObject<number>
}

function LEDGrid({ ledSpeedRef }: LEDGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const COUNT = 32
  const COLS  = 8

  const ledPositions = useMemo(() => {
    const sx = 0.52, sy = 0.48
    const ox = -(COLS - 1) * sx / 2
    const oy = -3 * sy / 2
    return Array.from({ length: COUNT }, (_, i) => ({
      x: ox + (i % COLS) * sx,
      y: oy + Math.floor(i / COLS) * sy,
      z: 0.77,
    }))
  }, [])

  const dummy  = useMemo(() => new THREE.Object3D(), [])
  const dimC   = useMemo(() => new THREE.Color('#1a0e00'), [])
  const brightC = useMemo(() => new THREE.Color('#ffdd00'), [])
  const tempC  = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    if (!meshRef.current) return
    ledPositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy, ledPositions])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const speed = ledSpeedRef.current
    for (let i = 0; i < COUNT; i++) {
      const col = i % COLS
      const brightness = (Math.sin(t * speed - col * 0.55) + 1) / 2
      tempC.lerpColors(dimC, brightC, brightness)
      meshRef.current.setColorAt(i, tempC)
    }
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.12, 8, 6]} />
      <meshBasicMaterial />
    </instancedMesh>
  )
}

// ─── Fan ─────────────────────────────────────────────────────────────────────
function Fan({ position, dir }: { position: [number, number, number]; dir: 1 | -1 }) {
  const bladeRef = useRef<THREE.Group>(null)
  useFrame(() => { if (bladeRef.current) bladeRef.current.rotation.z += 0.045 * dir })

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <torusGeometry args={[0.62, 0.05, 8, 32]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <circleGeometry args={[0.6, 32]} />
        <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.5} />
      </mesh>
      <group ref={bladeRef}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 6) * Math.PI * 2 + Math.PI / 12]}>
            <planeGeometry args={[0.08, 0.48]} />
            <meshStandardMaterial color="#1a1f35" roughness={0.4} metalness={0.9} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 16]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.95} emissive="#f59e0b" emissiveIntensity={2.0} />
      </mesh>
    </group>
  )
}

// ─── Electric arc ─────────────────────────────────────────────────────────────
interface ArcConfig { sx: number; sy: number; sz: number; dx: number; dy: number; dz: number; phase: number }

function ElectricArc({ cfg }: { cfg: ArcConfig }) {
  const POINTS = 14

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3))
    return g
  }, [])

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color('#ffe566'),
    transparent: true,
    opacity: 0.9,
  }), [])

  const line = useMemo(() => new THREE.Line(geo, mat), [geo, mat])
  const len = Math.sqrt(cfg.dx * cfg.dx + cfg.dy * cfg.dy) || 1
  const px = -cfg.dy / len
  const py =  cfg.dx / len

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + cfg.phase
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < POINTS; i++) {
      const p = i / (POINTS - 1)
      const wave = Math.sin(t * 3 + p * Math.PI * 2.5) * (1 - p) * 1.4
      pos.setXYZ(i,
        cfg.sx + cfg.dx * p * 7 + px * wave,
        cfg.sy + cfg.dy * p * 7 + py * wave,
        cfg.sz + cfg.dz * p * 7,
      )
    }
    pos.needsUpdate = true
  })

  return <primitive object={line} />
}

const ARC_CONFIGS: ArcConfig[] = [
  { sx:  3, sy:  0,   sz: 0, dx:  1,   dy:  0,   dz: 0, phase: 0   },
  { sx: -3, sy:  0,   sz: 0, dx: -1,   dy:  0,   dz: 0, phase: 0.8 },
  { sx:  0, sy:  1.5, sz: 0, dx:  0,   dy:  1,   dz: 0, phase: 1.6 },
  { sx:  0, sy: -1.5, sz: 0, dx:  0,   dy: -1,   dz: 0, phase: 2.4 },
  { sx:  3, sy:  1.5, sz: 0, dx:  0.7, dy:  0.7, dz: 0, phase: 0.4 },
  { sx: -3, sy:  1.5, sz: 0, dx: -0.7, dy:  0.7, dz: 0, phase: 1.2 },
  { sx:  3, sy: -1.5, sz: 0, dx:  0.7, dy: -0.7, dz: 0, phase: 2.0 },
  { sx: -3, sy: -1.5, sz: 0, dx: -0.7, dy: -0.7, dz: 0, phase: 2.8 },
]

// ─── ASIC miner ───────────────────────────────────────────────────────────────
interface ASICMinerProps {
  chassisMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>
  ledSpeedRef:   React.MutableRefObject<number>
}

function ASICMiner({ chassisMatRef, ledSpeedRef }: ASICMinerProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y += -0.003
    groupRef.current.position.y = Math.sin(t * 0.45) * 0.12
  })

  return (
    <group ref={groupRef}>
      {/* Main chassis — FIX 1 material */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[6, 3, 1.5]} />
        <meshStandardMaterial
          ref={chassisMatRef}
          color="#3a3a4a"
          metalness={1.0}
          roughness={0.1}
          emissive="#1a1a3a"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Front face inset */}
      <mesh position={[0, 0, 0.755]}>
        <boxGeometry args={[5.7, 2.7, 0.02]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Top gold stripe */}
      <mesh position={[0, 1.47, 0]}>
        <boxGeometry args={[5.85, 0.06, 1.45]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.0} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Bottom gold stripe */}
      <mesh position={[0, -1.47, 0]}>
        <boxGeometry args={[5.85, 0.06, 1.45]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.0} roughness={0.2} metalness={0.9} />
      </mesh>

      <LEDGrid ledSpeedRef={ledSpeedRef} />
      <Fan position={[-3.08, 0, 0]} dir={1}  />
      <Fan position={[ 3.08, 0, 0]} dir={-1} />
      {ARC_CONFIGS.map((cfg, i) => <ElectricArc key={i} cfg={cfg} />)}
    </group>
  )
}

// ─── Lightning bolt helper ────────────────────────────────────────────────────
function generateLightningPoints(
  start: THREE.Vector3,
  end:   THREE.Vector3,
  roughness: number,
  depth: number,
): THREE.Vector3[] {
  if (depth === 0) return [start.clone(), end.clone()]
  const t = 0.4 + Math.random() * 0.2
  const mid = start.clone().lerp(end, t)
  const dir = end.clone().sub(start)
  const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize()
  mid.addScaledVector(perp, (Math.random() - 0.5) * 2 * roughness)
  const left  = generateLightningPoints(start, mid, roughness * 0.6, depth - 1)
  const right = generateLightningPoints(mid,   end, roughness * 0.6, depth - 1)
  return [...left, ...right.slice(1)]
}

// ─── Lightning effect (FIX 2) ─────────────────────────────────────────────────
type LightPhase = 'idle' | 'enter' | 'hold' | 'exit'

interface LightningEffectProps {
  ambientRef: React.MutableRefObject<THREE.AmbientLight | null>
}

function LightningEffect({ ambientRef }: LightningEffectProps) {
  const { camera, gl, scene } = useThree()

  const linesRef     = useRef<THREE.Line[]>([])
  const phaseRef     = useRef<LightPhase>('idle')
  const phaseTimeRef = useRef(0)
  const flashRef     = useRef(0)
  const numPointsRef = useRef(9)

  // Stable refs to avoid stale closures in event handlers
  const cameraRef = useRef(camera)
  const glRef     = useRef(gl)
  const sceneRef  = useRef(scene)
  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => { glRef.current = gl }, [gl])
  useEffect(() => { sceneRef.current = scene }, [scene])

  const cleanup = useCallback(() => {
    linesRef.current.forEach(l => {
      l.geometry.dispose()
      ;(l.material as THREE.LineBasicMaterial).dispose()
      sceneRef.current.remove(l)
    })
    linesRef.current = []
  }, [])

  const spawnLightning = useCallback((screenX: number, screenY: number) => {
    cleanup()
    const cam    = cameraRef.current
    const canvas = glRef.current.domElement
    const rect   = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    // Convert DOM position → world position at z = 0
    const ndcX = ((screenX - rect.left) / rect.width)  * 2 - 1
    const ndcY = -((screenY - rect.top)  / rect.height) * 2 + 1
    const v    = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(cam)
    const dir  = v.clone().sub(cam.position).normalize()
    const tVal = -cam.position.z / dir.z
    const endW = cam.position.clone().addScaledVector(dir, tVal)

    // Start from the miner's right-front edge (world space includes group offset [1.5,-0.5,0])
    const startW = new THREE.Vector3(4.5, -0.3, 0.8)

    const DEPTH = 3   // 2^3 + 1 = 9 points per bolt
    numPointsRef.current = Math.pow(2, DEPTH) + 1

    const opacities = [0.95, 0.65, 0.45]
    for (let fork = 0; fork < 3; fork++) {
      const pts = generateLightningPoints(startW, endW, 1.2, DEPTH)
      const pos = new Float32Array(pts.length * 3)
      pts.forEach((p, i) => { pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z })

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setDrawRange(0, 0)

      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#ffe066'),
        transparent: true,
        opacity: opacities[fork],
      })
      const line = new THREE.Line(geo, mat)
      sceneRef.current.add(line)
      linesRef.current.push(line)
    }

    flashRef.current = 0.12
    phaseRef.current = 'enter'
    phaseTimeRef.current = 0
  }, [cleanup])

  useEffect(() => {
    const onStart = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      spawnLightning(x, y)
    }
    const onEnd = () => {
      if (phaseRef.current !== 'idle') {
        phaseRef.current = 'exit'
        phaseTimeRef.current = 0
      }
    }
    window.addEventListener('lightning:start', onStart)
    window.addEventListener('lightning:end',   onEnd)
    window.addEventListener('lightning:click', onStart)
    return () => {
      window.removeEventListener('lightning:start', onStart)
      window.removeEventListener('lightning:end',   onEnd)
      window.removeEventListener('lightning:click', onStart)
      cleanup()
    }
  }, [spawnLightning, cleanup])

  useFrame((_, delta) => {
    // Ambient flash when lightning fires
    if (flashRef.current > 0) {
      flashRef.current -= delta
      if (ambientRef.current) {
        ambientRef.current.intensity = flashRef.current > 0 ? 5.0 : 2.5
      }
    }

    if (phaseRef.current === 'idle') return
    phaseTimeRef.current += delta
    const n = numPointsRef.current

    if (phaseRef.current === 'enter') {
      const p = Math.min(phaseTimeRef.current / 0.15, 1)
      const count = Math.max(2, Math.round(p * n))
      linesRef.current.forEach(l => l.geometry.setDrawRange(0, count))
      if (p >= 1) { phaseRef.current = 'hold'; phaseTimeRef.current = 0 }

    } else if (phaseRef.current === 'hold') {
      if (phaseTimeRef.current >= 0.3) { phaseRef.current = 'exit'; phaseTimeRef.current = 0 }

    } else if (phaseRef.current === 'exit') {
      const p = Math.min(phaseTimeRef.current / 0.2, 1)
      const baseOpacities = [0.95, 0.65, 0.45]
      linesRef.current.forEach((l, idx) => {
        ;(l.material as THREE.LineBasicMaterial).opacity = (1 - p) * baseOpacities[idx]
      })
      if (p >= 1) { phaseRef.current = 'idle'; cleanup() }
    }
  })

  return null
}

// ─── Full scene ───────────────────────────────────────────────────────────────
function Scene() {
  const ambientRef    = useRef<THREE.AmbientLight>(null)
  const goldLightRef  = useRef<THREE.PointLight>(null)
  const chassisMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const ledSpeedRef   = useRef(2.5)

  // FIX 3: breathing glow pulse every 3 seconds
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const cyclePos = t % 3.0
    const pulseAmt = cyclePos < 1.5
      ? Math.sin((cyclePos / 1.5) * Math.PI)
      : 0

    if (goldLightRef.current) {
      goldLightRef.current.intensity = 0.8 + pulseAmt * 1.7   // 0.8 → 2.5
    }
    if (chassisMatRef.current) {
      chassisMatRef.current.emissiveIntensity = 0.3 + pulseAmt * 0.5  // 0.3 → 0.8
    }
    ledSpeedRef.current = 2.5 + pulseAmt * 3.5   // 2.5 → 6.0
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight ref={ambientRef} intensity={2.5} />
      {/* Key light */}
      <directionalLight position={[4, 6, 3]}   intensity={2.0} color="#ffffff" />
      {/* Fill light */}
      <directionalLight position={[-4, -2, 4]}  intensity={1.2} color="#ffffff" />
      {/* Rimlight — creates dramatic edge highlight making miner pop */}
      <directionalLight position={[-5, 3, -5]}  intensity={1.5} color="#ffffff" />
      {/* Gold top light */}
      <pointLight position={[-3, 4, 3]}  intensity={2.0} color="#f59e0b" />
      {/* Blue accent */}
      <pointLight position={[5, -3, 2]}  intensity={1.0} color="#3d7aed" />
      {/* Front fill */}
      <pointLight position={[0, 0, 6]}   intensity={1.5} color="#ffffff" />
      {/* Gold underlight (FIX 1 + FIX 3 pulse target) */}
      <pointLight ref={goldLightRef} position={[0, -3, 2]} intensity={0.8} color="#f59e0b" />
      <CameraDrift />
      <ParticleField />
      <GlowPlane />
      <group position={[1.5, -0.5, 0]}>
        <ASICMiner chassisMatRef={chassisMatRef} ledSpeedRef={ledSpeedRef} />
      </group>
      <LightningEffect ambientRef={ambientRef} />
    </>
  )
}

// ─── Exported wrapper with device detection ───────────────────────────────────
export default function MiningScene() {
  const [showThree, setShowThree] = useState<boolean | null>(null)

  useEffect(() => {
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || window.innerWidth < 768
    setShowThree(!lowEnd)
  }, [])

  if (showThree === null) return null
  if (!showThree) return <ParticleCanvas />

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 60 }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
    >
      <Scene />
    </Canvas>
  )
}
