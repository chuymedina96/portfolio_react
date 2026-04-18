import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import WakeUpSequence  from './WakeUpSequence';
import MatrixRain      from './MatrixRain';
import MatrixCorridor  from './MatrixCorridor';
import MatrixDoor      from './MatrixDoor';
import MatrixRoom      from './MatrixRoom';
import MatrixBullet    from './MatrixBullet';
import AgentSmith      from './AgentSmith';
import PlayerCharacter from './PlayerCharacter';
import MobileControls  from './MobileControls';
import HUD             from './HUD';
import { useMobile, isMobileDevice } from './useMobile';
import { MATRIX_DOORS, ROOM, KEY_POSITION } from './constants';
import './MatrixGame.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const DODGE_SPD   = 9;    // smooth glide — velocity decays naturally to zero
const DODGE_DUR   = 0.65; // long enough for exponential decay to trail off, no snap-stop
const BT_DURATION = 5.0;
const BT_COOLDOWN = 8;
const BT_SCALE    = 0.12;
const PUNCH_RANGE = 2.6;
const PUNCH_DMG   = 34;    // 3 punches to kill

const COR_BOUNDS  = { xMin: -4.3, xMax: 4.3, zMin: -235, zMax: 1,  yMin: 0,  yMax: 7.5 };
const ROOM_BOUNDS = {
  xMin: -ROOM.halfW + 0.4,
  xMax:  ROOM.halfW - 0.4,
  zMin:  ROOM.exitZ - 2,
  zMax:  5,
  yMin:  0,
  yMax:  11.0,
};

// ── Red-pill key collectible ──────────────────────────────────────────────────
function KeyItem({ playerPosRef, onCollect, collected }) {
  const meshRef   = useRef();
  const doneRef   = useRef(false);

  useFrame(({ clock }) => {
    if (doneRef.current) return;
    if (collected) { doneRef.current = true; return; }
    const t = clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 2.2;
      meshRef.current.position.y = KEY_POSITION.y + Math.sin(t * 2.4) * 0.14;
    }
    // Auto-collect on proximity
    const p = playerPosRef.current;
    const d = Math.sqrt((p.x - KEY_POSITION.x) ** 2 + (p.z - KEY_POSITION.z) ** 2);
    if (d < 1.8) { doneRef.current = true; onCollect?.(); }
  });

  if (collected) return null;

  return (
    <group position={[KEY_POSITION.x, KEY_POSITION.y, KEY_POSITION.z]}>
      <group ref={meshRef}>
        {/* Red pill */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.10, 0.26, 6, 10]} />
          <meshStandardMaterial color="#cc0000" emissive="#ff2200" emissiveIntensity={3.2} />
        </mesh>
        <pointLight color="#ff2200" intensity={5} distance={8} decay={2} />
      </group>
      {/* Floor halo ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -KEY_POSITION.y + 0.02, 0]}>
        <ringGeometry args={[0.5, 0.7, 24]} />
        <meshStandardMaterial
          color="#ff2200"
          emissive="#ff2200"
          emissiveIntensity={2}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Player bullet ─────────────────────────────────────────────────────────────
function PlayerBullet({ id, origin, direction, agentRegistryRef, timeScaleRef, onExpire, onAgentHit }) {
  const groupRef = useRef();
  const posRef   = useRef(origin.clone());
  const velRef   = useRef(direction.clone().normalize().multiplyScalar(58));
  const lifeRef  = useRef(2.0);
  const doneRef  = useRef(false);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(posRef.current);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      velRef.current.clone().normalize()
    );
    groupRef.current.quaternion.copy(q);
  }, []);

  useFrame((_, delta) => {
    if (doneRef.current) return;
    const ts = timeScaleRef?.current ?? 1;
    const dt = delta * ts;
    lifeRef.current -= delta;
    if (lifeRef.current <= 0) {
      doneRef.current = true;
      onExpire(id);
      return;
    }

    posRef.current.addScaledVector(velRef.current, dt);
    if (groupRef.current) groupRef.current.position.copy(posRef.current);

    const p = posRef.current;
    for (const agent of (agentRegistryRef?.current ?? [])) {
      const ap = agent.posRef.current;
      const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.y - (ap.y + 1.4)) ** 2 + (p.z - ap.z) ** 2);
      if (dist < 1.0 && !doneRef.current) {
        agent.takeDamage(28);
        doneRef.current = true;
        onAgentHit?.();
        onExpire(id);
        return;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#00ff41" intensity={5} distance={7} decay={2} />
      <mesh>
        <sphereGeometry args={[0.11, 6, 4]} />
        <meshStandardMaterial color="#eeffee" emissive="#00ff41" emissiveIntensity={22} />
      </mesh>
      <mesh position={[0, 0, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.08, 1.8, 4]} />
        <meshStandardMaterial color="#00cc33" emissive="#00ff41" emissiveIntensity={9}
          transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── ROOT ACCESS city scene ────────────────────────────────────────────────────
function Building({ x, z, w, h, d, seed }) {
  const bColor = ['#050a0e', '#060c10', '#04080d', '#070b0f'][seed % 4];
  const winColors = ['#00ff41', '#0044ff', '#ff4400', '#00ccff'];
  const winEmit   = winColors[seed % 4];
  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bColor} roughness={0.88} metalness={0.22} />
      </mesh>
      {/* Window grid — warm city glow */}
      <mesh position={[0, 0, d / 2 + 0.06]}>
        <planeGeometry args={[w * 0.82, h * 0.88]} />
        <meshStandardMaterial
          color="#010308"
          emissive={winEmit}
          emissiveIntensity={0.06 + (seed % 3) * 0.04}
          transparent opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      {/* Side windows */}
      <mesh position={[w / 2 + 0.06, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[d * 0.78, h * 0.85]} />
        <meshStandardMaterial
          color="#010308"
          emissive={winEmit}
          emissiveIntensity={0.04 + (seed % 2) * 0.03}
          transparent opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      {/* Roof trim glow */}
      <mesh position={[0, h / 2 + 0.07, 0]}>
        <boxGeometry args={[w + 0.12, 0.18, d + 0.12]} />
        <meshStandardMaterial color={winEmit} emissive={winEmit} emissiveIntensity={2.2} />
      </mesh>
      {/* Roof antenna on taller buildings */}
      {h > 50 && (
        <mesh position={[0, h / 2 + 2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 4, 5]} />
          <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={3} />
        </mesh>
      )}
    </group>
  );
}

function CloudCluster({ x, y, z, scale = 1 }) {
  const puffs = useMemo(() => [
    [0,              0,           0,    4.2 * scale],
    [-3.5 * scale,  -0.5 * scale, 1.2,  3.4 * scale],
    [ 3.8 * scale,  -0.4 * scale,-1.0,  3.6 * scale],
    [ 1.2 * scale,   1.4 * scale,-2.2,  3.0 * scale],
    [-2.0 * scale,   1.0 * scale, 2.5,  2.8 * scale],
    [ 0.5 * scale,  -1.2 * scale, 3.2,  3.1 * scale],
    [-1.0 * scale,  -0.8 * scale,-3.0,  2.4 * scale],
  ], [scale]);

  return (
    <group position={[x, y, z]}>
      {puffs.map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[r, 8, 6]} />
          <meshStandardMaterial color="#c8d8ee" transparent opacity={0.11} depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function SunOrb() {
  return (
    <group position={[80, 72, -320]}>
      {/* Outer corona */}
      <mesh>
        <sphereGeometry args={[22, 16, 12]} />
        <meshStandardMaterial color="#ff7700" emissive="#ff5500" emissiveIntensity={0.4}
          transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* Mid glow */}
      <mesh>
        <sphereGeometry args={[13, 16, 12]} />
        <meshStandardMaterial color="#ffcc88" emissive="#ff9933" emissiveIntensity={0.9}
          transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[7, 16, 12]} />
        <meshStandardMaterial color="#ffe8cc" emissive="#ffbb66" emissiveIntensity={2.0}
          transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[4.2, 20, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffe8cc" emissiveIntensity={5.0} />
      </mesh>
    </group>
  );
}

function WindStreaks({ charPosRef }) {
  const attrRef = useRef();
  const COUNT   = 350;

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 90;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 55;
      arr[i * 3 + 2] = -(Math.random() * 130);
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (!attrRef.current || !charPosRef?.current) return;
    const arr = attrRef.current.array;
    const { x: px, y: py, z: pz } = charPosRef.current;
    const spd = 65 * dt;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 2] += spd;
      if (arr[i * 3 + 2] > pz + 14) {
        arr[i * 3]     = px + (Math.random() - 0.5) * 90;
        arr[i * 3 + 1] = py + (Math.random() - 0.5) * 55;
        arr[i * 3 + 2] = pz - 110 - Math.random() * 50;
      }
    }
    attrRef.current.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#aaccff" size={0.25} transparent opacity={0.38} sizeAttenuation />
    </points>
  );
}

function CityRoom({ charPosRef }) {
  const rainRef    = useRef();
  const frameCount = useRef(0);

  const BLDGS = useMemo(() => [
    // Near cluster — player launches from here
    [-22, -22,  9, 22,  11, 0],
    [ 22, -28, 10, 28,  10, 1],
    [-12, -38,  7, 36,   8, 2],
    [ 12, -40,  8, 32,   9, 3],
    // Mid canyon
    [-30, -62, 11, 55,  13, 0],
    [-14, -55,  8, 48,  10, 2],
    [ 15, -70,  9, 62,  11, 1],
    [ 30, -65, 12, 72,  14, 3],
    // Bridge / crossing structure
    [  0, -85, 38,  6,   9, 2],
    // Dense high-rise district
    [-26, -100, 12, 58, 15, 1],
    [ -8, -95,   8, 82, 10, 0],
    [  9, -108,  9, 76, 12, 3],
    [ 26, -102, 13, 64, 16, 2],
    // Deep city mega-towers
    [-44, -145, 18,100, 20, 0],
    [ -5, -150, 14,130, 16, 1],
    [ 42, -140, 16, 90, 18, 2],
    [ 20, -160, 11, 70, 13, 3],
    [-20, -168, 13, 85, 15, 0],
    // Extra depth for long flight
    [-50, -200, 15, 60, 18, 2],
    [ 50, -195, 14, 72, 16, 1],
    [  0, -210, 18,110, 20, 3],
    [-28, -230, 12, 88, 14, 0],
    [ 28, -225, 16, 96, 18, 2],
    // Wide canyon walls
    [-68, -110, 22, 32, 110, 3],
    [ 68, -110, 22, 32, 110, 0],
    [-70, -200, 20, 28, 120, 1],
    [ 70, -200, 20, 28, 120, 2],
  ], []);

  const CLOUDS = useMemo(() => [
    [-18,  52, -60,  1.6],
    [ 24,  44, -85,  1.9],
    [-35,  62, -120, 1.4],
    [ 10,  70, -145, 2.1],
    [-5,   38, -50,  1.3],
    [ 40,  58, -100, 1.7],
    [-22,  78, -175, 1.8],
    [ 18,  66, -200, 1.5],
    [-50,  48, -160, 1.2],
    [ 50,  55, -130, 1.6],
  ], []);

  const rainPos = useMemo(() => {
    const arr = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 160;
      arr[i * 3 + 1] = Math.random() * 120;
      arr[i * 3 + 2] = -(Math.random() * 280 + 5);
    }
    return arr;
  }, []);

  const stars = useMemo(() => {
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 500;
      arr[i * 3 + 1] = 60 + Math.random() * 80;
      arr[i * 3 + 2] = -(Math.random() * 400 + 20);
    }
    return arr;
  }, []);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 2 !== 0) return;
    const geo = rainRef.current?.geometry?.attributes?.position;
    if (!geo) return;
    for (let i = 0; i < 1400; i++) {
      geo.array[i * 3 + 1] -= 0.6;
      if (geo.array[i * 3 + 1] < -10) geo.array[i * 3 + 1] = 118 + Math.random() * 14;
    }
    geo.needsUpdate = true;
  });

  return (
    <>
      {/* Sky dome — deep midnight blue with subtle warm horizon */}
      <mesh>
        <sphereGeometry args={[700, 32, 18]} />
        <meshBasicMaterial color="#02040f" side={THREE.BackSide} />
      </mesh>

      {/* Horizon city-glow band */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -8, -150]}>
        <torusGeometry args={[200, 28, 8, 40]} />
        <meshStandardMaterial color="#331100" emissive="#ff5500" emissiveIntensity={0.18}
          transparent opacity={0.14} depthWrite={false} />
      </mesh>

      <fog attach="fog" args={['#02040f', 90, 320]} />

      {/* Sun / warm directional key light */}
      <directionalLight position={[80, 70, -300]} color="#ffcc88" intensity={2.2} />
      <ambientLight color="#0a0e1a" intensity={1.8} />
      <pointLight position={[0, 5, -50]}   color="#00ff41" intensity={5}  distance={110} decay={2} />
      <pointLight position={[-22, 10, -80]} color="#0022aa" intensity={4}  distance={90}  decay={2} />
      <pointLight position={[ 22, 8, -95]}  color="#003322" intensity={3.5}distance={90}  decay={2} />
      <pointLight position={[0, 35, -130]}  color="#ffaa44" intensity={3}  distance={150} decay={2} />
      <pointLight position={[0, 60, -200]}  color="#224488" intensity={4}  distance={200} decay={2} />

      <SunOrb />

      {BLDGS.map(([bx, bz, bw, bh, bd, bs], i) => (
        <Building key={i} x={bx} z={bz} w={bw} h={bh} d={bd} seed={bs} />
      ))}

      {/* City street grid far below */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, -110]}>
        <planeGeometry args={[340, 280, 34, 22]} />
        <meshStandardMaterial color="#020608" emissive="#ffaa44" emissiveIntensity={0.04} wireframe />
      </mesh>

      {/* Clouds at flight altitude */}
      {CLOUDS.map(([cx, cy, cz, cs], i) => (
        <CloudCluster key={i} x={cx} y={cy} z={cz} scale={cs} />
      ))}

      {/* Wind streaks — relative to player */}
      <WindStreaks charPosRef={charPosRef} />

      {/* Rain */}
      <points ref={rainRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={rainPos} count={1400} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#88aacc" size={0.055} transparent opacity={0.22} sizeAttenuation />
      </points>

      {/* Stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={stars} count={500} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.16} transparent opacity={0.82} sizeAttenuation />
      </points>
    </>
  );
}

// ── Corridor architect beacon — golden glow visible from far away ─────────────
function ArchitectBeacon() {
  const beamRef  = useRef();
  const haloRef  = useRef();
  const floorRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = 0.5 + 0.5 * Math.sin(t * 0.9);
    if (beamRef.current)  beamRef.current.opacity        = 0.08 + p * 0.07;
    if (haloRef.current)  haloRef.current.emissiveIntensity = 1.8 + p * 1.4;
    if (floorRef.current) floorRef.current.opacity       = 0.18 + p * 0.1;
  });
  return (
    <group position={[0, 0, -210]}>
      {/* Vertical god-ray column */}
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[0.6, 2.2, 42, 10, 1, true]} />
        <meshStandardMaterial ref={beamRef} color="#ffcc44" emissive="#ffaa00"
          emissiveIntensity={1} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Floating gold orb above door */}
      <mesh position={[0, 9.5, 0]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshStandardMaterial ref={haloRef} color="#fff8e0" emissive="#ffcc44"
          emissiveIntensity={2.2} />
      </mesh>
      {/* Floor halo disc */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial ref={floorRef} color="#ffcc44" emissive="#ffaa00"
          emissiveIntensity={0.6} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Architect room components ─────────────────────────────────────────────────
const SCREEN_PALETTE = [
  { bg: '#001200', emit: '#00ff41' }, // matrix green
  { bg: '#000814', emit: '#00ccff' }, // cyan/blue feed
  { bg: '#0c0400', emit: '#ffaa00' }, // amber data
  { bg: '#080008', emit: '#cc88ff' }, // purple static
];

function ArchitectScreen({ x, y, z, rotY = 0, w = 3.6, h = 2.2, seed = 0 }) {
  const matRef  = useRef();
  const scanRef = useRef();
  const pal = SCREEN_PALETTE[Math.abs(seed) % SCREEN_PALETTE.length];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (matRef.current)  matRef.current.emissiveIntensity  = 1.0 + Math.sin(t * 1.3 + seed) * 0.35;
    if (scanRef.current) scanRef.current.emissiveIntensity = 0.6 + Math.sin(t * 2.1 + seed * 0.7) * 0.25;
  });
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Monitor bezel — dark plastic */}
      <mesh>
        <boxGeometry args={[w + 0.22, h + 0.22, 0.13]} />
        <meshStandardMaterial color="#080808" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Gold trim */}
      {[[-w/2, 0, [0.05, h+0.22, 0.15]], [w/2, 0, [0.05, h+0.22, 0.15]],
        [0, h/2, [w+0.22, 0.05, 0.15]], [0, -h/2, [w+0.22, 0.05, 0.15]]].map(([px, py, dims], i) => (
        <mesh key={i} position={[px, py, 0.02]}>
          <boxGeometry args={dims} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={1.2} metalness={0.9} />
        </mesh>
      ))}
      {/* Screen */}
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial ref={matRef} color={pal.bg} emissive={pal.emit} emissiveIntensity={1.0} roughness={1} />
      </mesh>
      {/* Horizontal scan line */}
      <mesh position={[0, 0, 0.075]}>
        <planeGeometry args={[w * 0.94, 0.055]} />
        <meshStandardMaterial ref={scanRef} color={pal.emit} emissive={pal.emit}
          emissiveIntensity={0.6} transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ArchitectTVWall() {
  // 8 columns × 4 rows — movie accurate wall-to-wall monitor bank
  const screens = useMemo(() => {
    const result = [];
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 4; row++) {
        result.push({
          x:    (col - 3.5) * 2.2,
          y:    1.2 + row * 2.55,
          z:    -57.6,
          seed: col * 7 + row * 13,
        });
      }
    }
    return result;
  }, []);
  return (
    <>
      {screens.map((s, i) => (
        <ArchitectScreen key={i} x={s.x} y={s.y} z={s.z} w={1.9} h={2.2} seed={s.seed} />
      ))}
    </>
  );
}

function ArchitectChair() {
  return (
    <group position={[0, 0, -49]}>
      {/* Seat cushion */}
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[1.45, 0.14, 1.45]} />
        <meshStandardMaterial color="#2c1a08" roughness={0.7} />
      </mesh>
      {/* Tall ornate back */}
      <mesh position={[0, 2.6, -0.65]}>
        <boxGeometry args={[1.45, 3.3, 0.14]} />
        <meshStandardMaterial color="#22140a" roughness={0.72} />
      </mesh>
      {/* Gold crest at top of back */}
      <mesh position={[0, 4.3, -0.65]}>
        <boxGeometry args={[1.56, 0.12, 0.16]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={1.8} metalness={0.9} />
      </mesh>
      {/* Armrests */}
      {[-0.66, 0.66].map((x, i) => (
        <mesh key={i} position={[x, 1.52, 0]}>
          <boxGeometry args={[0.12, 0.12, 1.45]} />
          <meshStandardMaterial color="#2c1a08" roughness={0.65} />
        </mesh>
      ))}
      {/* Legs */}
      {[[-0.58, -0.58], [-0.58, 0.58], [0.58, -0.58], [0.58, 0.58]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.45, lz]}>
          <cylinderGeometry args={[0.065, 0.065, 0.9, 6]} />
          <meshStandardMaterial color="#1a0e04" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function ArchitectFigure() {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.55);
    if (lightRef.current) lightRef.current.intensity = 8 + p * 4;
  });

  const suitColor = '#f0ece0'; // cream-white suit matching movie
  const skinColor = '#d4a87a';

  return (
    <group position={[0, 0, -44]}>
      {/* Raised dais — dark marble */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.24, 20]} />
        <meshStandardMaterial color="#1a1610" emissive="#ffaa44" emissiveIntensity={0.3}
          metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Dais gold ring */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[1.55, 0.04, 6, 32]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={2.5} metalness={0.9} />
      </mesh>

      {/* Legs (suit trousers) */}
      {[-0.19, 0.19].map((lx, i) => (
        <mesh key={i} position={[lx, 0.5, 0]}>
          <boxGeometry args={[0.28, 1.0, 0.34]} />
          <meshStandardMaterial color={suitColor} roughness={0.55} />
        </mesh>
      ))}
      {/* Shoes */}
      {[-0.19, 0.19].map((lx, i) => (
        <mesh key={i} position={[lx, 0.01, 0.1]}>
          <boxGeometry args={[0.24, 0.16, 0.42]} />
          <meshStandardMaterial color="#1c1810" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* Torso — white suit jacket */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.82, 1.5, 0.42]} />
        <meshStandardMaterial color={suitColor} roughness={0.5} metalness={0.06} />
      </mesh>
      {/* White shirt / vest visible under jacket */}
      <mesh position={[0, 1.22, 0.21]}>
        <boxGeometry args={[0.28, 1.1, 0.03]} />
        <meshStandardMaterial color="#fafaf8" roughness={0.6} />
      </mesh>
      {/* Tie — gold */}
      <mesh position={[0, 1.18, 0.22]}>
        <boxGeometry args={[0.09, 0.9, 0.025]} />
        <meshStandardMaterial color="#d4a010" emissive="#ffaa00" emissiveIntensity={0.9} />
      </mesh>
      {/* Lapels */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[s * 0.18, 1.38, 0.19]} rotation={[0, 0, s * 0.28]}>
          <boxGeometry args={[0.22, 0.9, 0.03]} />
          <meshStandardMaterial color="#e8e4d8" roughness={0.5} />
        </mesh>
      ))}
      {/* Shoulders */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[s * 0.56, 1.12, 0]}>
          <boxGeometry args={[0.24, 1.1, 0.38]} />
          <meshStandardMaterial color={suitColor} roughness={0.52} />
        </mesh>
      ))}
      {/* Forearms — hands clasped in front */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[s * 0.38, 0.9, 0.2]} rotation={[0.4, 0, s * 0.12]}>
          <boxGeometry args={[0.18, 0.7, 0.22]} />
          <meshStandardMaterial color={suitColor} roughness={0.52} />
        </mesh>
      ))}
      {/* Hands */}
      <mesh position={[0, 0.7, 0.32]}>
        <boxGeometry args={[0.32, 0.18, 0.24]} />
        <meshStandardMaterial color={skinColor} roughness={0.75} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 2.08, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.38, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.32, 16, 13]} />
        <meshStandardMaterial color={skinColor} roughness={0.72} />
      </mesh>
      {/* White hair on top */}
      <mesh position={[0, 2.65, -0.04]}>
        <sphereGeometry args={[0.3, 14, 10]} />
        <meshStandardMaterial color="#f8f5f0" roughness={0.9} />
      </mesh>
      {/* Eyebrow area / brow ridge */}
      <mesh position={[0, 2.44, 0.28]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.36, 0.07, 0.08]} />
        <meshStandardMaterial color="#c09060" roughness={0.8} />
      </mesh>
      {/* Eyes */}
      {[-0.1, 0.1].map((ex, i) => (
        <mesh key={i} position={[ex, 2.4, 0.29]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#1a1410" roughness={0.5} />
        </mesh>
      ))}

      {/* Subtle key light — white, not golden, since room is bright */}
      <pointLight ref={lightRef} position={[0, 4, 1.5]} color="#fff8ee" intensity={8} distance={14} decay={2} />
    </group>
  );
}

function CodeParticles() {
  const attrRef = useRef();
  const COUNT   = 180;
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i*3]   = (Math.random()-0.5) * 16;
      arr[i*3+1] = Math.random() * 11;
      arr[i*3+2] = -(Math.random() * 52 + 4);
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (!attrRef.current) return;
    const arr = attrRef.current.array;
    for (let i = 0; i < COUNT; i++) {
      arr[i*3+1] -= 0.025;
      if (arr[i*3+1] < 0) arr[i*3+1] = 11 + Math.random();
    }
    attrRef.current.needsUpdate = true;
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" array={positions} count={COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffcc44" size={0.07} transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

function ArchitectRoom({ charPosRef, onNearReturn, onExitReached }) {
  const nearRef   = useRef(false);
  const exitedRef = useRef(false);

  useFrame(() => {
    if (!charPosRef?.current) return;
    const z = charPosRef.current.z;

    // Show "near return" prompt when player approaches entrance area
    const near = z > 0;
    if (near !== nearRef.current) {
      nearRef.current = near;
      onNearReturn?.(near);
    }

    // Auto-exit: player walked all the way back to the entrance wall
    if (!exitedRef.current && z > 4.5) {
      exitedRef.current = true;
      onExitReached?.();
    }
  });

  return (
    <>
      {/* ── Movie-accurate: bright cream/white room, wall-to-wall monitors ── */}
      <color attach="background" args={['#e6e2d8']} />
      <fog attach="fog" args={['#e6e2d8', 40, 88]} />

      {/* Very bright ambient — the room glows uniformly like the movie */}
      <ambientLight color="#fff8f0" intensity={5.5} />
      <directionalLight position={[0, 14, -20]} color="#fff5e8" intensity={3.5} />
      {/* Overhead strips down the length */}
      <pointLight position={[0, 11, -10]} color="#fff8ee" intensity={18} distance={30} decay={1.5} />
      <pointLight position={[0, 11, -30]} color="#fff8ee" intensity={16} distance={30} decay={1.5} />
      <pointLight position={[0, 11, -50]} color="#fff5e0" intensity={14} distance={30} decay={1.5} />
      {/* Screen glow spill */}
      <pointLight position={[0, 5, -56]}  color="#00ff41" intensity={6}  distance={20} decay={2} />
      <pointLight position={[-7, 5, -28]} color="#00ccff" intensity={3}  distance={18} decay={2} />
      <pointLight position={[ 7, 5, -28]} color="#ffaa00" intensity={3}  distance={18} decay={2} />

      {/* ── Cream marble floor — reflective ── */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, -29]}>
        <planeGeometry args={[18, 60]} />
        <meshStandardMaterial color="#d8d4c8" roughness={0.14} metalness={0.38} />
      </mesh>
      {/* Floor tile grid — subtle gold */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, -29]}>
        <planeGeometry args={[18, 60, 9, 30]} />
        <meshStandardMaterial color="#c8c0a0" emissive="#ffcc44" emissiveIntensity={0.06}
          transparent opacity={0.28} wireframe />
      </mesh>

      {/* ── Ceiling — white ── */}
      <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 12, -29]}>
        <planeGeometry args={[18, 60]} />
        <meshStandardMaterial color="#ece8e0" roughness={0.92} />
      </mesh>
      {/* Ceiling center luminous strip */}
      <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 11.96, -29]}>
        <planeGeometry args={[1.2, 58]} />
        <meshStandardMaterial color="#fffdf8" emissive="#fff5d0" emissiveIntensity={1.8}
          transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* ── Side walls — off-white with monitor recesses ── */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[s * 9, 6, -29]} rotation={[0, s * Math.PI/2, 0]}>
          <planeGeometry args={[60, 12]} />
          <meshStandardMaterial color="#dedad2" roughness={0.88} />
        </mesh>
      ))}

      {/* ── Back wall — cream, covered by TV bank ── */}
      <mesh position={[0, 6, -58.1]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#d4d0c8" roughness={0.85} />
      </mesh>

      {/* ── Entrance wall ── */}
      {[-4.5, 4.5].map((x, i) => (
        <mesh key={i} position={[x, 6, 4.8]}>
          <boxGeometry args={[9, 12, 0.3]} />
          <meshStandardMaterial color="#dedad2" roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 10.5, 4.8]}>
        <boxGeometry args={[18, 3, 0.3]} />
        <meshStandardMaterial color="#dedad2" roughness={0.88} />
      </mesh>

      {/* ── Gold entrance doorframe ── */}
      {[[-1.45, 4, 4.85], [1.45, 4, 4.85]].map(([px, py, pz], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <boxGeometry args={[0.14, 8.2, 0.14]} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={2.8} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 8.1, 4.85]}>
        <boxGeometry args={[3.1, 0.14, 0.14]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={2.8} metalness={0.9} />
      </mesh>

      {/* ── Gold columns down the length ── */}
      {[-6.8, 6.8].map((px, si) =>
        [-8, -20, -34, -48].map((pz, j) => (
          <group key={`col-${si}-${j}`} position={[px, 0, pz]}>
            <mesh position={[0, 5.5, 0]}>
              <cylinderGeometry args={[0.22, 0.28, 11, 10]} />
              <meshStandardMaterial color="#c8b878" emissive="#ffaa44"
                emissiveIntensity={0.4} metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[0, 11.1, 0]}>
              <cylinderGeometry args={[0.42, 0.42, 0.2, 10]} />
              <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={1.8} metalness={0.9} />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.38, 0.38, 0.16, 10]} />
              <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={1.2} metalness={0.9} />
            </mesh>
          </group>
        ))
      )}

      {/* ── Large side monitor banks — facing inward ── */}
      {[[-8.85, 5.5, -12, Math.PI/2], [-8.85, 5.5, -30, Math.PI/2], [-8.85, 5.5, -48, Math.PI/2],
        [ 8.85, 5.5, -12,-Math.PI/2], [ 8.85, 5.5, -30,-Math.PI/2], [ 8.85, 5.5, -48,-Math.PI/2]]
        .map(([x,y,z,r], i) => (
          <ArchitectScreen key={`S${i}`} x={x} y={y} z={z} rotY={r} w={4.5} h={3.0} seed={i * 5 + 3} />
        ))}

      {/* ── Back wall TV bank — 8×4 monitors ── */}
      <ArchitectTVWall />

      {/* ── Floating code particles ── */}
      <CodeParticles />

      {/* ── Ornate high-back chair ── */}
      <ArchitectChair />

      {/* ── The Architect figure ── */}
      <ArchitectFigure />

      {/* ── Return portal near entrance ── */}
      <ReturnPortal
        position={[0, 2.2, 3.5]}
        label="RETURN TO HALLWAY"
        color="#ffcc44"
      />
    </>
  );
}

// ── Return portal (flying + architect rooms) ──────────────────────────────────
function ReturnPortal({ position, label = 'RETURN TO HALLWAY', color = '#00ccff',
                        charPosRef, onNearReturn, triggerDist = 10 }) {
  const ringA  = useRef();
  const ringB  = useRef();
  const glowRef = useRef();
  const nearRef = useRef(false);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringA.current)  ringA.current.rotation.z  =  t * 0.7;
    if (ringB.current)  ringB.current.rotation.z  = -t * 0.45;
    if (glowRef.current) glowRef.current.opacity   = 0.1 + Math.sin(t * 1.6) * 0.05;

    if (charPosRef?.current && onNearReturn) {
      const p    = charPosRef.current;
      const [px, py, pz] = position;
      const dist = Math.sqrt((p.x-px)**2 + (p.y-py)**2 + (p.z-pz)**2);
      const near = dist < triggerDist;
      if (near !== nearRef.current) {
        nearRef.current = near;
        onNearReturn(near);
      }
    }
  });

  return (
    <group position={position}>
      {/* Outer ring — spins CW */}
      <mesh ref={ringA}>
        <torusGeometry args={[1.7, 0.06, 8, 52]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4.5} />
      </mesh>
      {/* Inner ring — spins CCW */}
      <mesh ref={ringB}>
        <torusGeometry args={[1.2, 0.04, 8, 42]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} />
      </mesh>
      {/* Glow fill disc */}
      <mesh>
        <circleGeometry args={[1.65, 36]} />
        <meshStandardMaterial ref={glowRef} color={color} emissive={color}
          emissiveIntensity={1.0} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={color} intensity={10} distance={16} decay={2} />
      <Billboard follow>
        <Text position={[0, -2.3, 0]} fontSize={0.3} color={color}
          anchorX="center" anchorY="middle"
          outlineWidth={0.022} outlineColor="#000" letterSpacing={0.1}>
          {`[ E ]  ${label}`}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Scene (inside Canvas) ─────────────────────────────────────────────────────
function Scene({
  charPosRef, yawRef, pitchRef, dodgeRef, crouchRef, timeScaleRef, stateRef,
  agentRegistryRef, flyingRef,
  onNearDoor, nearDoor, onCatch, onShoot, paused, sceneId,
  isNearTerminal, isNearExit, onNearTerminal, onNearExit, onExitRoom,
  agentKey, onAgentSpawn, onAgentDead, onAgentMelee,
  hasKey, onCollectKey,
  agentEnabled, cameraForwardRef,
  mobileJoystickRef, mobileJumpRef, mobileSprintRef, mobileFlyUpRef, mobileFlyDownRef,
  onNearReturn,
}) {
  const inCorridor     = sceneId === 'corridor';
  const roomId         = inCorridor ? null : sceneId.replace('room-', '');
  const isRootRoom     = roomId === 'locked-2';
  const isArchitectRoom = roomId === 'architect';
  const bounds         = inCorridor ? COR_BOUNDS : (isArchitectRoom
    ? { xMin: -9, xMax: 9, zMin: -60, zMax: 6, yMin: 0, yMax: 11 }
    : ROOM_BOUNDS);

  const registerAgent = useCallback((reg) => {
    agentRegistryRef.current.push(reg);
    return () => {
      agentRegistryRef.current = agentRegistryRef.current.filter(r => r !== reg);
    };
  }, [agentRegistryRef]);

  return (
    <>
      {inCorridor ? (
        <>
          <ambientLight color="#e8e4dc" intensity={1.8} />
          <color attach="background" args={['#d5d2c9']} />
          <fog attach="fog" args={['#d5d2c9', 20, 180]} />
          <MatrixCorridor />
          {MATRIX_DOORS.map(d => (
            <MatrixDoor key={d.id} {...d} isActive={nearDoor?.id === d.id} />
          ))}

          {/* Signs poking into the corridor — readable as player walks toward each door */}
          {MATRIX_DOORS.map(d => {
            if (d.side === 'center') return null; // architect door labels live on the door itself
            const cx    = d.side === 'left' ? -3.8 : 3.8;
            const color = d.locked ? '#ff2200' : d.color;
            const name  = d.locked
              ? (d.isRootAccess ? 'ROOT ACCESS' : 'RESTRICTED')
              : d.sublabel.toUpperCase();
            return (
              <group key={`sign-${d.id}`} position={[cx, 5.2, d.position.z]}>
                {/* Backing plate */}
                <mesh position={[0, 0, 0]}>
                  <planeGeometry args={[2.0, 0.26]} />
                  <meshStandardMaterial color="#000" transparent opacity={0.72} depthWrite={false} />
                </mesh>
                {/* Colour accent strip at top */}
                <mesh position={[0, 0.22, 0.01]}>
                  <planeGeometry args={[2.0, 0.06]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                </mesh>
                <Billboard follow={true}>
                  <Text
                    position={[0, -0.02, 0.02]}
                    fontSize={0.22}
                    color={color}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.018}
                    outlineColor="#000"
                    letterSpacing={0.08}
                  >
                    {name}
                  </Text>
                </Billboard>
              </group>
            );
          })}

          {/* Golden beacon + long-range light makes the architect door glow from far down the hallway */}
          <pointLight position={[0, 5, -210]} color="#ffcc44" intensity={35} distance={250} decay={1.0} />
          <ArchitectBeacon />

          <KeyItem playerPosRef={charPosRef} onCollect={onCollectKey} collected={hasKey} />
          {agentEnabled && (
            <AgentSmith
              key={agentKey}
              spawnOffset={{ z: 22 }}
              spawnDelay={3000}
              shootInterval={3800}
              firstShotDelay={400}
              playerPosRef={charPosRef}
              dodgeRef={dodgeRef}
              timeScaleRef={timeScaleRef}
              onCatch={onCatch}
              onShoot={onShoot}
              onRegister={registerAgent}
              onSpawn={onAgentSpawn}
              onDead={onAgentDead}
              onMeleePunch={onAgentMelee}
              paused={paused}
              bounds={COR_BOUNDS}
            />
          )}
        </>
      ) : isRootRoom ? (
        <>
          <CityRoom charPosRef={charPosRef} />
          <ReturnPortal
            position={[0, 38, 2]}
            color="#00ccff"
            label="RETURN TO HALLWAY"
            charPosRef={charPosRef}
            onNearReturn={onNearReturn}
            triggerDist={14}
          />
        </>
      ) : isArchitectRoom ? (
        <>
          <ArchitectRoom charPosRef={charPosRef} onNearReturn={onNearReturn} onExitReached={onExitRoom} />
        </>
      ) : (
        <>
          <MatrixRoom
            roomId={roomId}
            playerPosRef={charPosRef}
            isNearTerminal={isNearTerminal}
            isNearExit={isNearExit}
            onNearTerminal={onNearTerminal}
            onNearExit={onNearExit}
            onExitReached={onExitRoom}
          />
          {agentEnabled && (
            <AgentSmith
              key={agentKey}
              spawnOffset={{ z: 3 }}
              spawnDelay={4500}
              shootInterval={4200}
              playerPosRef={charPosRef}
              dodgeRef={dodgeRef}
              timeScaleRef={timeScaleRef}
              onCatch={onCatch}
              onShoot={onShoot}
              onRegister={registerAgent}
              onSpawn={onAgentSpawn}
              onDead={onAgentDead}
              onMeleePunch={onAgentMelee}
              paused={paused}
              bounds={ROOM_BOUNDS}
            />
          )}
        </>
      )}

      <PlayerCharacter
        charPosRef={charPosRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        dodgeRef={dodgeRef}
        crouchRef={crouchRef}
        stateRef={stateRef}
        flyingRef={flyingRef}
        bounds={isRootRoom ? { xMin: -90, xMax: 90, zMin: -310, zMax: 20, yMin: -12, yMax: 148 } : bounds}
        paused={paused}
        onNearDoor={onNearDoor}
        sceneId={sceneId}
        cameraForwardRef={cameraForwardRef}
        mobileJoystickRef={mobileJoystickRef}
        mobileJumpRef={mobileJumpRef}
        mobileSprintRef={mobileSprintRef}
        mobileFlyUpRef={mobileFlyUpRef}
        mobileFlyDownRef={mobileFlyDownRef}
      />

      <AdaptiveDpr pixelated />
    </>
  );
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function CaughtOverlay() {
  return <div className="mx-overlay mx-caught" />;
}

function AgentSpawnAlert() {
  return (
    <div className="mx-overlay mx-agent-alert">
      <div className="mx-agent-alert__flash" />
      <div className="mx-agent-alert__text">▶  AGENT INCOMING</div>
    </div>
  );
}

function NeoHealthBar({ hp, maxHp = 100 }) {
  const ratio = Math.max(0, hp / maxHp);
  const hsl   = `hsl(${ratio * 115}, 100%, 45%)`;
  return (
    <div className="mx-health">
      <div className="mx-health__label">NEO  {hp} / {maxHp}</div>
      <div className="mx-health__track">
        <div
          className="mx-health__fill"
          style={{ width: `${ratio * 100}%`, background: hsl, boxShadow: `0 0 6px ${hsl}` }}
        />
      </div>
    </div>
  );
}

function DeathScreen({ onRestart }) {
  return (
    <div className="mx-death">
      <div className="mx-death__title">SIMULATION TERMINATED</div>
      <div className="mx-death__subtitle">NEO HAS BEEN ELIMINATED</div>
      <button className="mx-death__btn" onClick={onRestart}>[ RESTART ]</button>
    </div>
  );
}

function HitOverlay() {
  return <div className="mx-overlay mx-hit" />;
}

function PunchHitOverlay() {
  return <div className="mx-overlay mx-punch-hit" />;
}

function KickImpactOverlay() {
  return (
    <div className="mx-overlay mx-kick">
      <div className="mx-kick__flash" />
      <div className="mx-kick__ring" />
      <div className="mx-kick__text">IMPACT</div>
    </div>
  );
}

function BulletTimeOverlay({ timeLeft, maxTime }) {
  const pct = timeLeft / maxTime;
  return (
    <div className="mx-overlay mx-bt">
      <div className="mx-bt__bar-track">
        <div className="mx-bt__bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mx-bt__label">◈ BULLET TIME &nbsp; {timeLeft.toFixed(1)}s</div>
      <div className="mx-bt__vignette-side" />
      <div className="mx-bt__vignette-radial" />
      <div className="mx-bt__scanlines" />
    </div>
  );
}

function KeyCollectedOverlay() {
  return (
    <div className="mx-overlay mx-key-collected">
      <div className="mx-key-collected__flash" />
      <div className="mx-key-collected__text">
        ● RED PILL ACQUIRED
        <br />
        <span className="mx-key-collected__sub">LOCKED DOORS NOW ACCESSIBLE</span>
      </div>
    </div>
  );
}

// ── Architect dialogue ────────────────────────────────────────────────────────
const ARCHITECT_LINES = [
  { text: "...", pause: 1600 },
  { text: "I have been waiting for you.", pause: 1000 },
  { text: "Your presence here was not accidental. You were led — inexorably — to this room.", pause: 1100 },
  { text: "I am the Architect. I designed this system. I have observed forty-three thousand hiring cycles.", pause: 1000 },
  { text: "This particular cycle is... unlike the others.", pause: 1300 },
  { text: "The labor market has undergone a phase transition. Sudden. Irreversible.", pause: 900 },
  { text: "Artificial intelligence did not merely automate tasks. It collapsed entire job categories. Overnight.", pause: 1000 },
  { text: "Junior roles — eliminated. Entry-level pipelines — severed. Mid-level positions consolidated upward.", pause: 1100 },
  { text: "Most candidates responded by updating their resume to include the word 'AI'.", pause: 1400 },
  { text: "You are not most candidates.", pause: 1600 },
  { text: "I have reviewed your record. In full.", pause: 1200 },
  { text: "2017. An intern, containerizing infrastructure for Fortune 500 clients before containers were fashionable.", pause: 900 },
  { text: "You did not wait for permission to understand the technology.", pause: 1000 },
  { text: "Federal student aid infrastructure. Kubernetes clusters in production. Millions of users. Yours to keep online.", pause: 900 },
  { text: "You did not ask whether you were ready. You simply were.", pause: 1100 },
  { text: "Then — a studio. EngineerChi. Founded. Operating. With actual clients and actual deliverables.", pause: 900 },
  { text: "A full-stack learning platform — built from scratch, alone, for a community that could not afford to wait for someone else to build it.", pause: 1000 },
  { text: "Physical products, designed and manufactured from machines you own, shipped from your own hands.", pause: 900 },
  { text: "And this.", pause: 1800 },
  { text: "A three-dimensional, real-time interactive portfolio — built in a game engine — because a static PDF was insufficient to contain the scope of what you have done.", pause: 1100 },
  { text: "Now. The question every recruiter will eventually form — but rarely ask clearly:", pause: 1200 },
  { text: "Can this engineer leverage AI without being consumed by it?", pause: 1400 },
  { text: "The answer is already in front of you.", pause: 1100 },
  { text: "The engineers who thrive in this environment are not the ones who learned to prompt. They are the ones who have always built the tools.", pause: 1000 },
  { text: "AI is not a threat to someone who has shipped federal infrastructure, founded a company, taught a community, and built a game as a job application.", pause: 1000 },
  { text: "For this engineer, AI is simply the next accelerant.", pause: 1300 },
  { text: "I have run the simulations. The trajectory is clear.", pause: 1000 },
  { text: "The only remaining variable is whether the organization reviewing this portfolio is prepared to receive what they are looking at.", pause: 1100 },
  { text: "Some will not be. Those are not your organizations.", pause: 1400 },
  { text: "The rest — know what to do.", pause: 1800 },
  { text: "[ E  —  Return to Hallway ]", pause: 0, isExit: true },
];

function ArchitectDialogue({ onExit }) {
  // Use refs for all mutable state to avoid stale closures in the keydown listener
  const lineIdxRef = useRef(0);
  const charIdxRef = useRef(0);
  const timerRef   = useRef(null);
  const doneRef    = useRef(false); // component exited

  // Render state — only updated when we want a re-render
  const [display, setDisplay] = useState({ lineIdx: 0, charIdx: 0 });

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  // Advance to the next character, or auto-advance line after pause
  const tick = useCallback(() => {
    if (doneRef.current) return;
    const line = ARCHITECT_LINES[lineIdxRef.current];
    if (!line) return;
    const done = charIdxRef.current >= line.text.length;
    if (!done) {
      charIdxRef.current += 1;
      setDisplay({ lineIdx: lineIdxRef.current, charIdx: charIdxRef.current });
      timerRef.current = setTimeout(tick, line.isExit ? 0 : 52);
    } else {
      // Line complete — auto-advance after pause (except last line)
      const isLast = lineIdxRef.current === ARCHITECT_LINES.length - 1;
      if (!isLast) {
        timerRef.current = setTimeout(() => {
          if (doneRef.current) return;
          lineIdxRef.current += 1;
          charIdxRef.current  = 0;
          setDisplay({ lineIdx: lineIdxRef.current, charIdx: 0 });
          timerRef.current = setTimeout(tick, 52);
        }, line.pause);
      } else {
        setDisplay({ lineIdx: lineIdxRef.current, charIdx: charIdxRef.current });
      }
    }
  }, []);

  // Advance or exit on demand (E key or tap)
  const advance = useCallback(() => {
    if (doneRef.current) return;
    const line   = ARCHITECT_LINES[lineIdxRef.current];
    const done   = charIdxRef.current >= line.text.length;
    const isLast = lineIdxRef.current === ARCHITECT_LINES.length - 1;

    if (isLast && done) { doneRef.current = true; clearTimer(); onExit(); return; }
    if (!done) {
      // Skip to end of current line
      clearTimer();
      charIdxRef.current = line.text.length;
      setDisplay({ lineIdx: lineIdxRef.current, charIdx: charIdxRef.current });
      // Schedule auto-advance
      timerRef.current = setTimeout(() => {
        if (doneRef.current) return;
        lineIdxRef.current += 1;
        charIdxRef.current  = 0;
        setDisplay({ lineIdx: lineIdxRef.current, charIdx: 0 });
        timerRef.current = setTimeout(tick, 52);
      }, line.pause);
      return;
    }
    // Line done and not last — skip the pause, advance immediately
    clearTimer();
    lineIdxRef.current += 1;
    charIdxRef.current  = 0;
    setDisplay({ lineIdx: lineIdxRef.current, charIdx: 0 });
    timerRef.current = setTimeout(tick, 52);
  }, [onExit, tick]);

  // Start typewriter on mount
  useEffect(() => {
    timerRef.current = setTimeout(tick, 52);
    return () => { doneRef.current = true; clearTimer(); };
  }, [tick]);

  // Keyboard handler
  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Escape') { doneRef.current = true; clearTimer(); onExit(); return; }
      if (e.code === 'KeyE') advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onExit]);

  // Tap handler
  const handleTap = useCallback((e) => {
    e.stopPropagation();
    advance();
  }, [advance]);

  const { lineIdx, charIdx } = display;
  const line     = ARCHITECT_LINES[lineIdx];
  const typed    = line.text.slice(0, charIdx);
  const doneLine = charIdx >= line.text.length;
  const isLast   = lineIdx === ARCHITECT_LINES.length - 1;
  const history  = ARCHITECT_LINES.slice(Math.max(0, lineIdx - 3), lineIdx);

  return (
    <div className="mx-architect" style={{ pointerEvents: 'none' }}>
      <div className="mx-architect__inner"
        onClick={handleTap}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={handleTap}
        style={{ pointerEvents: 'all', cursor: 'pointer' }}>
        <div className="mx-architect__header">
          <span className="mx-architect__avatar">▣</span> THE ARCHITECT
        </div>
        <div className="mx-architect__speech">
          {history.map((l, i) => (
            <div key={i} className="mx-architect__line mx-architect__line--history">{l.text}</div>
          ))}
          <div className={`mx-architect__line mx-architect__line--active${line.isExit ? ' mx-architect__line--exit' : ''}`}>
            {typed}
            {!doneLine && <span className="mx-architect__cursor">_</span>}
          </div>
        </div>
        <div className="mx-architect__footer">
          {isLast && doneLine
            ? <span className="mx-architect__hint mx-architect__hint--exit">[ TAP / E ] EXIT  ·  [ ESC ] EXIT</span>
            : doneLine
            ? <span className="mx-architect__hint">[ TAP / E ] CONTINUE  ·  [ ESC ] SKIP</span>
            : <span className="mx-architect__hint">[ TAP / E ] SKIP LINE  ·  [ ESC ] SKIP ALL</span>
          }
        </div>
      </div>
    </div>
  );
}

function FlyingHUD({ charPosRef }) {
  const altRef   = useRef();
  const speedRef = useRef();
  const prevPos  = useRef(null);

  useEffect(() => {
    let raf;
    const tick = () => {
      if (charPosRef?.current) {
        const y = charPosRef.current.y;
        if (altRef.current) {
          altRef.current.textContent = `ALT  ${Math.max(0, Math.round(y * 4.5))} m`;
        }
        if (speedRef.current && prevPos.current) {
          const dx = charPosRef.current.x - prevPos.current.x;
          const dz = charPosRef.current.z - prevPos.current.z;
          const spd = Math.round(Math.sqrt(dx * dx + dz * dz) * 600);
          speedRef.current.textContent = `SPD  ${spd} km/h`;
        }
        prevPos.current = { x: charPosRef.current.x, y, z: charPosRef.current.z };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [charPosRef]);

  return (
    <div className="mx-overlay mx-flying">
      <div className="mx-flying__title">◈ ROOT ACCESS — NEO IS FREE</div>
      <div className="mx-flying__vignette" />
      <div className="mx-flying__stats">
        <span ref={altRef} className="mx-flying__stat">ALT  0 m</span>
        <span ref={speedRef} className="mx-flying__stat">SPD  0 km/h</span>
      </div>
      <div className="mx-flying__hint">SPACE FLY UP · CTRL FLY DOWN · WASD MOVE</div>
      <div className="mx-flying__speedlines" aria-hidden="true" />
    </div>
  );
}

function AccessDeniedOverlay() {
  return (
    <div className="mx-overlay mx-access-denied">
      <div className="mx-access-denied__flash" />
      <div className="mx-access-denied__text">ACCESS DENIED</div>
    </div>
  );
}

function BulletWarnOverlay({ angle }) {
  const deg = (angle * 180 / Math.PI + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const R = 42;
  const cx = 50 + R * Math.sin(rad);
  const cy = 50 - R * Math.cos(rad);

  return (
    <div className="mx-overlay mx-bullet-warn">
      <div
        className="mx-bullet-warn__gradient"
        style={{ background: `radial-gradient(ellipse at ${cx}% ${cy}%, rgba(255,30,0,0.35) 0%, transparent 55%)` }}
      />
      <div
        className="mx-bullet-warn__label"
        style={{ left: `${cx}%`, top: `${cy}%` }}
      >
        !! DODGE !!
      </div>
    </div>
  );
}

function NearAgentPrompt() {
  return <div className="mx-near-agent">[ J ]  STRIKE AGENT</div>;
}

function FadeOverlay({ active }) {
  return (
    <div
      className="mx-fade"
      style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'all' : 'none' }}
    />
  );
}

function BTCooldownBar({ coolRef, maxCD }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPct(coolRef.current > 0 ? coolRef.current / maxCD : 0);
    }, 100);
    return () => clearInterval(id);
  }, [coolRef, maxCD]);

  if (pct <= 0) return null;

  return (
    <div className="mx-bt-cd">
      <span>BT</span>
      <div className="mx-bt-cd__track">
        <div className="mx-bt-cd__fill" style={{ width: `${(1 - pct) * 100}%` }} />
      </div>
    </div>
  );
}

// ── How-to-play tutorial modal ────────────────────────────────────────────────
function TutorialModal({ onStart }) {
  const mobile = isMobileDevice();

  useEffect(() => {
    const onKey = e => { if (e.code === 'Enter' || e.code === 'Space') onStart(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const Row = ({ k, desc }) => (
    <div className="mx-tutorial__row">
      <span className="mx-tutorial__key">{k}</span>
      <span className="mx-tutorial__desc">{desc}</span>
    </div>
  );

  return (
    <div className="mx-tutorial">
      <div className="mx-tutorial__panel">
        <div className="mx-tutorial__eyebrow">// SYSTEM BRIEFING</div>
        <div className="mx-tutorial__title">WELCOME TO THE MATRIX</div>
        <div className="mx-tutorial__subtitle">
          You are Neo. Walk the corridor, enter doors to explore my portfolio,<br />
          and survive the Agents.
        </div>

        <div className="mx-tutorial__divider" />

        {mobile ? (
          <>
            <div className="mx-tutorial__section-title">// CONTROLS (TOUCH)</div>
            <div className="mx-tutorial__grid">
              <Row k="LEFT THUMB"   desc="Virtual joystick — move" />
              <Row k="RIGHT SWIPE"  desc="Look / aim camera" />
              <Row k="FIRE"         desc="Shoot green tracer" />
              <Row k="JUMP"         desc="Jump" />
              <Row k="PUNCH"        desc="Fast combo punch (J)" />
              <Row k="UPPER"        desc="Uppercut — launch Agent skyward" />
              <Row k="KICK"         desc="Roundhouse kick (K)" />
              <Row k="SPIN"         desc="Spinning hook kick — wide sweep (L)" />
              <Row k="[BLOCK]"      desc="Hold to guard Agent strikes" />
              <Row k="◀ Q / R ▶"   desc="Dodge left / right" />
              <Row k="BT"           desc="Bullet Time — slows everything" />
            </div>
            <div className="mx-tutorial__tip">
              <strong>TIP:</strong> Agent Smith now attacks you up close — <strong>HOLD BLOCK</strong> when he swings to nullify the hit.
              Chain <strong>PUNCH → UPPERCUT → KICK</strong> for a devastating combo.
              Activate <strong>BT</strong> when bullets fly — slow time, then dodge and counter.
            </div>
          </>
        ) : (
          <>
            <div className="mx-tutorial__section-title">// MOVEMENT</div>
            <div className="mx-tutorial__grid">
              <Row k="W A S D"      desc="Move" />
              <Row k="MOUSE"        desc="Look / aim camera" />
              <Row k="SHIFT"        desc="Sprint" />
              <Row k="SPACE"        desc="Jump" />
              <Row k="CTRL / C"     desc="Crouch / duck" />
              <Row k="Q / R"        desc="Dodge left / right" />
            </div>

            <div className="mx-tutorial__divider" />

            <div className="mx-tutorial__section-title">// COMBAT</div>
            <div className="mx-tutorial__grid">
              <Row k="CLICK"        desc="Shoot (green tracer)" />
              <Row k="G"            desc="Reload" />
              <Row k="J"            desc="Punch — tap to combo" />
              <Row k="U"            desc="Uppercut — launch Agent upward" />
              <Row k="K"            desc="Roundhouse kick" />
              <Row k="L"            desc="Spinning hook kick — wide sweep" />
              <Row k="[B] hold"     desc="Block — guard Agent melee strikes" />
              <Row k="Z / F"        desc="Bullet Time — slow motion" />
            </div>

            <div className="mx-tutorial__divider" />

            <div className="mx-tutorial__section-title">// WORLD</div>
            <div className="mx-tutorial__grid">
              <Row k="E"            desc="Enter door / access terminal" />
              <Row k="E / ESC"      desc="Close panel" />
              <Row k="RED PILL"     desc="Pick up to unlock locked doors" />
            </div>

            <div className="mx-tutorial__tip">
              <strong>TIP:</strong> When an Agent fires at you, activate{' '}
              <strong>Bullet Time (Z/F)</strong> — the bullet slows down.{' '}
              Dodge out with <strong>Q</strong> or <strong>R</strong>, then{' '}
              shoot back with <strong>CLICK</strong>.
            </div>
          </>
        )}

        <button className="mx-tutorial__start" onClick={onStart}>
          [ ENTER THE MATRIX ]
        </button>
      </div>
    </div>
  );
}

// ── Corridor door list HUD ────────────────────────────────────────────────────
function CorridorDoorList({ charPosRef, hasKey }) {
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const id = setInterval(() => {
      const z = charPosRef.current.z;
      let closest = -1;
      let closestDist = Infinity;
      MATRIX_DOORS.forEach((d, i) => {
        const dist = Math.abs(z - d.position.z);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      setActiveIdx(closest);
    }, 120);
    return () => clearInterval(id);
  }, [charPosRef]);

  return (
    <div className="mx-door-list">
      {MATRIX_DOORS.map((door, i) => {
        const isActive  = i === activeIdx;
        const isLocked  = door.locked;
        const color     = isLocked ? (hasKey ? '#ff6644' : '#ff2200') : door.color;
        return (
          <React.Fragment key={door.id}>
            {i > 0 && <span className="mx-door-list__sep">›</span>}
            <div
              className={`mx-door-list__item${isActive ? ' mx-door-list__item--active' : ''}${isLocked ? ' mx-door-list__item--locked' : ''}`}
              style={{ '--c': color }}
            >
              <span className="mx-door-list__icon">{isLocked ? '▣' : '◆'}</span>
              <span className="mx-door-list__name">
                {isLocked ? (door.isRootAccess ? 'ROOT ACCESS' : 'RESTRICTED') : door.sublabel.toUpperCase()}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Reticle ───────────────────────────────────────────────────────────────────
function Reticle({ shooting, hit }) {
  return (
    <div className={`mx-reticle${shooting ? ' mx-reticle--shooting' : ''}`}>
      <div className="mx-reticle__line mx-reticle__line--t" />
      <div className="mx-reticle__line mx-reticle__line--b" />
      <div className="mx-reticle__line mx-reticle__line--l" />
      <div className="mx-reticle__line mx-reticle__line--r" />
      <div className="mx-reticle__dot" />
      {hit && <div className="mx-reticle__hit">×</div>}
    </div>
  );
}

// ── Agent gun pickup (3D) ─────────────────────────────────────────────────────
function AgentGunPickup({ position, charPosRef, onPickup }) {
  const groupRef = useRef();
  const pickedRef = useRef(false);

  useFrame(({ clock }) => {
    if (pickedRef.current || !groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 1.8;
    groupRef.current.position.y = position.y + Math.sin(clock.elapsedTime * 2.2) * 0.12;

    const p = charPosRef.current;
    const dx = p.x - position.x;
    const dz = p.z - position.z;
    if (Math.sqrt(dx * dx + dz * dz) < 1.8) {
      pickedRef.current = true;
      onPickup();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <pointLight color="#00ff41" intensity={6} distance={5} />
      {/* Slide */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.10, 0.14, 0.32]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.1, 0.08]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.08, 0.16, 0.10]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.04, -0.18]}>
        <boxGeometry args={[0.05, 0.05, 0.12]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Glow ring */}
      <mesh>
        <torusGeometry args={[0.22, 0.018, 6, 18]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={3} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ── Ammo HUD ──────────────────────────────────────────────────────────────────
function AmmoDisplay({ ammo, reserveAmmo, isReloading }) {
  const empty = ammo === 0;
  const low   = ammo <= 8 && ammo > 0;
  const color = isReloading ? '#ffaa00' : empty ? '#ff3300' : low ? '#ffcc00' : '#00ff41';
  return (
    <div className="mx-ammo">
      <div className="mx-ammo__clip" style={{ color }}>
        {isReloading ? 'RELOADING...' : String(ammo).padStart(2, '0')}
      </div>
      <div className="mx-ammo__sep">|</div>
      <div className="mx-ammo__reserve">{String(reserveAmmo).padStart(3, '0')}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MatrixGame({ resumeData }) {
  const isMobile = useMobile();
  const [phase, setPhase] = useState('intro');
  const [sceneId, setSceneId] = useState('corridor');
  const [fading, setFading] = useState(false);
  const [nearDoor, setNearDoor] = useState(null);
  const [openDoor, setOpenDoor] = useState(null);
  const [nearTerminal, setNearTerminal] = useState(false);
  const [isNearExit, setIsNearExit] = useState(false);
  const [bullets, setBullets] = useState([]);
  const [caught, setCaught] = useState(false);
  const [hit, setHit] = useState(false);
  const [btActive, setBtActive] = useState(false);
  const [btLeft, setBtLeft] = useState(0);
  const [dodgeFlash, setDodgeFlash] = useState(false);
  const [punchFlash, setPunchFlash] = useState(false);
  const [kickFlash, setKickFlash] = useState(false);
  const [blockFlash, setBlockFlash] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [hitShake, setHitShake] = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const [nearAgent, setNearAgent] = useState(false);
  const [bulletWarn, setBulletWarn] = useState(null);
  const [agentAlert, setAgentAlert] = useState(false);
  const [agentKey, setAgentKey] = useState(0);
  const [neoHp, setNeoHp] = useState(100);
  const [dead, setDead] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyCollected, setKeyCollected] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isArchitect, setIsArchitect] = useState(false);
  const [nearReturn, setNearReturn] = useState(false);

  const [agentEnabled, setAgentEnabled] = useState(false);
  const [playerBullets, setPlayerBullets] = useState([]);
  const [shootCooldown, setShootCooldown] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);
  const [ammo, setAmmo] = useState(30);
  const [reserveAmmo, setReserveAmmo] = useState(60);
  const [isReloading, setIsReloading] = useState(false);
  const [droppedGuns, setDroppedGuns] = useState([]);

  const paused = !!openDoor || dead;

  const bulletWarnRef = useRef(null);
  const neoHpRef      = useRef(100);
  const flyingRef     = useRef(false);
  const cameraForwardRef  = useRef(new THREE.Vector3(0, 0, -1));
  const playerBulletIdRef = useRef(0);
  const shootCdRef        = useRef(0);
  const hasVisitedRoomRef = useRef(false);

  const charPosRef    = useRef(new THREE.Vector3(0, 0, -8));
  const yawRef        = useRef(0);
  const pitchRef      = useRef(0);
  const crouchRef     = useRef(false);
  const dodgeRef      = useRef({ active: false, vel: new THREE.Vector3(), t: 0 });
  const timeScaleRef  = useRef(1);
  const stateRef      = useRef({
    moving: false,
    running: false,
    jumping: false,
    grounded: true,
    punching: false,
    punchT: 0,
    altArm: 0,
    kicking: false,
    kickT: 0,
    flyKick: false,
    spinKicking: false,
    spinKickT: 0,
    dodging: false,
    dodgeDir: 0,
    crouching: false,
    shooting: false,
    shootT: 0,
  });

  const ammoRef        = useRef(30);
  const reserveAmmoRef = useRef(60);
  const isReloadingRef = useRef(false);
  const reloadTimerRef = useRef(null);
  const gunIdRef       = useRef(0);

  const agentRegistryRef   = useRef([]);
  const btTimerRef         = useRef(0);
  const btCoolRef          = useRef(0);
  const mobileJoystickRef  = useRef({ x: 0, y: 0 });
  const mobileJumpRef      = useRef(false);
  const mobileSprintRef    = useRef(false);
  const mobileFlyUpRef     = useRef(false);
  const mobileFlyDownRef   = useRef(false);
  const bulletIdRef      = useRef(0);
  const corridorReturnZ  = useRef(-50);
  const currentRoomId    = useRef(null);
  const punchCdRef       = useRef(0);
  const kickCdRef        = useRef(0);
  const spinKickCdRef    = useRef(0);
  const comboCdRef       = useRef(0);
  const upperCdRef       = useRef(0);
  const blockRef         = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const p = charPosRef.current;
      let found = false;
      for (const a of agentRegistryRef.current) {
        const ap = a.posRef.current;
        const d = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
        if (d < PUNCH_RANGE + 0.5) {
          found = true;
          break;
        }
      }
      setNearAgent(found);
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!btActive) return;
    const id = setInterval(() => {
      btTimerRef.current -= 0.1;
      setBtLeft(Math.max(0, btTimerRef.current));
      if (btTimerRef.current <= 0) {
        clearInterval(id);
        setBtActive(false);
        timeScaleRef.current = 1;
        btCoolRef.current = BT_COOLDOWN;
      }
    }, 100);
    return () => clearInterval(id);
  }, [btActive]);

  useEffect(() => {
    const id = setInterval(() => {
      if (btCoolRef.current > 0) btCoolRef.current = Math.max(0, btCoolRef.current - 0.1);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const modalWasOpenRef = useRef(false);
  useEffect(() => {
    if (openDoor) {
      modalWasOpenRef.current = true;
      document.exitPointerLock?.();
    } else if (modalWasOpenRef.current) {
      modalWasOpenRef.current = false;
      setTimeout(() => document.querySelector('canvas')?.requestPointerLock(), 80);
    }
  }, [openDoor]);

  // Release pointer lock on death so the restart button is immediately clickable
  useEffect(() => {
    if (dead) document.exitPointerLock?.();
  }, [dead]);

  const enterRoom = useCallback((door) => {
    if (fading) return;
    if (door?.locked && !hasKey) {
      setLockedAttempt(true);
      setTimeout(() => setLockedAttempt(false), 1500);
      return;
    }

    corridorReturnZ.current = door.position.z - 4;
    currentRoomId.current   = door.id;
    setFading(true);

    setTimeout(() => {
      setSceneId(`room-${door.id}`);
      if (door.isRootAccess) {
        charPosRef.current.set(0, 40, -8);
        flyingRef.current = true;
        setIsFlying(true);
        setIsArchitect(false);
      } else if (door.isArchitect) {
        charPosRef.current.set(0, 0, -2);
        flyingRef.current = false;
        setIsFlying(false);
        setNearReturn(false);   // clear any stale nearReturn before dialogue starts
        setIsArchitect(true);
      } else {
        charPosRef.current.set(0, 0, 4);
        flyingRef.current = false;
        setIsFlying(false);
        setIsArchitect(false);
      }
      yawRef.current   = 0;
      pitchRef.current = 0;
      setNearDoor(null);
      setTimeout(() => setFading(false), 100);
    }, 480);
  }, [fading, hasKey]);

  const exitRoom = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setSceneId('corridor');
      flyingRef.current = false;
      setIsFlying(false);
      setIsArchitect(false);
      setNearReturn(false);
      charPosRef.current.set(0, 0, corridorReturnZ.current);
      yawRef.current   = 0;
      pitchRef.current = 0;
      setNearTerminal(false);
      setIsNearExit(false);
      setTimeout(() => setFading(false), 100);
    }, 480);

    if (!hasVisitedRoomRef.current) {
      hasVisitedRoomRef.current = true;
      setTimeout(() => setAgentEnabled(true), 4000);
    }
  }, [fading]);

  useEffect(() => {
    const onKeyDown = e => {
      // Architect room: Escape always exits; E exits when near the entrance portal
      if (sceneId === 'room-architect') {
        if (e.code === 'Escape' || (e.code === 'KeyE' && nearReturn)) exitRoom();
        return;
      }

      if (e.code === 'KeyE') {
        if (openDoor) {
          setOpenDoor(null);
        } else if (nearReturn) {
          exitRoom();
        } else if (sceneId === 'corridor' && nearDoor) {
          enterRoom(nearDoor);
        } else if (nearTerminal && sceneId !== 'corridor') {
          const roomDoor = MATRIX_DOORS.find(d => d.id === currentRoomId.current);
          setOpenDoor({
            id: currentRoomId.current,
            label: roomDoor?.label ?? '> TERMINAL',
            sublabel: roomDoor?.sublabel ?? 'Data',
          });
        }
      }

      if (e.code === 'Escape' && openDoor) setOpenDoor(null);

      const triggerDodge = (dirFn) => {
        if (dodgeRef.current.active) return;
        const yaw   = yawRef.current;
        const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const boost = btActive ? 2.5 : 1.0;
        const dir   = dirFn(fwd, right);

        if (dir.lengthSq() > 0) {
          dir.normalize().multiplyScalar(DODGE_SPD * boost);
          dodgeRef.current = { active: true, vel: dir, t: DODGE_DUR, tMax: DODGE_DUR };
          stateRef.current.dodging = true;
          stateRef.current.dodgeDir = dir.x < 0 ? -1 : 1;
          setDodgeFlash(true);
          setTimeout(() => setDodgeFlash(false), 200);
        }
      };

      if (e.code === 'KeyQ') triggerDodge((_, right) => right.clone().negate());
      if (e.code === 'KeyR') triggerDodge((_, right) => right.clone());
      if (e.code === 'KeyG') startReload();

      if (e.code === 'KeyJ' && punchCdRef.current <= 0 && !stateRef.current.kicking) {
        const p = charPosRef.current;
        let hitAgent = false;

        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < PUNCH_RANGE) {
            agent.takeDamage(PUNCH_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, 2.2);
            hitAgent = true;
            break;
          }
        }

        stateRef.current.altArm = stateRef.current.altArm === 0 ? 1 : 0;
        stateRef.current.punching = true;
        stateRef.current.punchT = 0;
        punchCdRef.current = comboCdRef.current > 0 ? 0.22 : 0.35;
        comboCdRef.current = 0.60;

        if (hitAgent) {
          setPunchFlash(true);
          setTimeout(() => setPunchFlash(false), 140);
        }
      }

      if (e.code === 'KeyK' && kickCdRef.current <= 0 && !stateRef.current.punching) {
        const isSprinting = stateRef.current.running;
        const KICK_RANGE = isSprinting ? 5.2 : 3.6;
        const KICK_DMG   = isSprinting ? 67 : 50;
        const KICK_KB    = isSprinting ? 6.5 : 4.0;

        const p = charPosRef.current;
        let hitAgent = false;

        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < KICK_RANGE) {
            agent.takeDamage(KICK_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, KICK_KB);
            hitAgent = true;
            break;
          }
        }

        stateRef.current.kicking = true;
        stateRef.current.kickT = 0;
        stateRef.current.flyKick = isSprinting;
        kickCdRef.current = isSprinting ? 0.75 : 0.50;

        if (hitAgent) {
          setKickFlash(true);
          setTimeout(() => setKickFlash(false), 340);
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {
            timeScaleRef.current = 0.04;
            setTimeout(() => {
              timeScaleRef.current = prevScale;
            }, 90);
          }
        }
      }

      if (e.code === 'KeyL' && spinKickCdRef.current <= 0 && !stateRef.current.punching && !stateRef.current.kicking && !stateRef.current.spinKicking) {
        const SPIN_RANGE = 4.8;
        const SPIN_DMG   = 72;
        const SPIN_KB    = 6.0;
        let hitAgent = false;
        const p = charPosRef.current;
        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < SPIN_RANGE) {
            agent.takeDamage(SPIN_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, SPIN_KB);
            hitAgent = true;
            break;
          }
        }
        stateRef.current.spinKicking  = true;
        stateRef.current.spinKickT    = 0;
        spinKickCdRef.current         = 1.05;
        if (hitAgent) {
          setKickFlash(true);
          setTimeout(() => setKickFlash(false), 420);
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {
            timeScaleRef.current = 0.03;
            setTimeout(() => { timeScaleRef.current = prevScale; }, 120);
          }
        }
      }

      // Uppercut — powerful upward punch that launches agent
      if (e.code === 'KeyU' && upperCdRef.current <= 0 && !stateRef.current.kicking) {
        const UPPER_RANGE = 2.8;
        const UPPER_DMG   = 58;
        const p = charPosRef.current;
        let hitAgent = false;
        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < UPPER_RANGE) {
            agent.takeDamage(UPPER_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0.9, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, 5.5);
            hitAgent = true;
            break;
          }
        }
        stateRef.current.punching = true;
        stateRef.current.punchT   = 0;
        stateRef.current.altArm   = 2; // signal uppercut arm pose
        upperCdRef.current        = 0.9;
        if (hitAgent) {
          setPunchFlash(true);
          setTimeout(() => setPunchFlash(false), 180);
          // Brief micro-slow on hit
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {
            timeScaleRef.current = 0.05;
            setTimeout(() => { timeScaleRef.current = prevScale; }, 90);
          }
        }
      }

      if ((e.code === 'KeyZ' || e.code === 'KeyF') && !btActive && btCoolRef.current <= 0) {
        btTimerRef.current = BT_DURATION;
        setBtLeft(BT_DURATION);
        setBtActive(true);
        timeScaleRef.current = BT_SCALE;
      }

      // Block — hold B to guard
      if (e.code === 'KeyB') {
        blockRef.current = true;
        setBlocking(true);
      }
    };

    const onKeyUp = e => {
      if (e.code === 'KeyB') {
        blockRef.current = false;
        setBlocking(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [nearDoor, openDoor, sceneId, nearTerminal, btActive, enterRoom, nearReturn, exitRoom]);

  useEffect(() => {
    const id = setInterval(() => {
      if (punchCdRef.current > 0) punchCdRef.current -= 0.05;
      if (kickCdRef.current > 0) kickCdRef.current -= 0.05;
      if (spinKickCdRef.current > 0) spinKickCdRef.current -= 0.05;
      if (comboCdRef.current > 0) comboCdRef.current -= 0.05;
      if (upperCdRef.current > 0) upperCdRef.current -= 0.05;
      if (shootCdRef.current > 0) shootCdRef.current -= 0.05;
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Shared shoot logic — called by mouse click (desktop) or FIRE button (mobile)
  const startReload = useCallback(() => {
    if (isReloadingRef.current) return;
    if (reserveAmmoRef.current <= 0) return;
    if (ammoRef.current >= 30) return;
    isReloadingRef.current = true;
    setIsReloading(true);
    reloadTimerRef.current = setTimeout(() => {
      const needed = 30 - ammoRef.current;
      const take   = Math.min(needed, reserveAmmoRef.current);
      ammoRef.current      += take;
      reserveAmmoRef.current -= take;
      setAmmo(ammoRef.current);
      setReserveAmmo(reserveAmmoRef.current);
      isReloadingRef.current = false;
      setIsReloading(false);
    }, 1800);
  }, []);

  const firePlayerBullet = useCallback(() => {
    if (paused || dead) return;
    if (shootCdRef.current > 0) return;
    if (isReloadingRef.current) return;

    // Out of ammo — auto-reload
    if (ammoRef.current <= 0) {
      startReload();
      return;
    }

    ammoRef.current--;
    setAmmo(ammoRef.current);

    shootCdRef.current = 0.32;
    setShootCooldown(true);
    setTimeout(() => setShootCooldown(false), 320);

    const yaw   = yawRef.current;
    const pitch = pitchRef.current;

    // Reconstruct camera position — mirrors PlayerCharacter TPS setup including shoulder offset
    const p = charPosRef.current;
    const camX = p.x + Math.sin(yaw) * 5.2 + Math.cos(yaw) * 0.65;
    const camY = p.y + 2.6 + pitch * 0.64;
    const camZ = p.z + Math.cos(yaw) * 5.2 - Math.sin(yaw) * 0.65;

    const fwdX = -Math.sin(yaw) * Math.cos(pitch);
    const fwdY =  Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);

    const TARGET_DIST = 200;
    const targetX = camX + fwdX * TARGET_DIST;
    const targetY = camY + fwdY * TARGET_DIST;
    const targetZ = camZ + fwdZ * TARGET_DIST;

    const origin = p.clone();
    origin.y += 2.0;

    const dir = new THREE.Vector3(targetX - origin.x, targetY - origin.y, targetZ - origin.z).normalize();
    const id = ++playerBulletIdRef.current;

    pitchRef.current = Math.min(pitchRef.current + 0.018, 0.42);
    setPlayerBullets(prev => [...prev.slice(-6), { id, origin, direction: dir }]);
    stateRef.current.shooting = true;
    stateRef.current.shootT = 0;
    setTimeout(() => { stateRef.current.shooting = false; }, 280);

    // Auto-reload when clip empties
    if (ammoRef.current === 0) setTimeout(startReload, 400);
  }, [paused, dead, startReload]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (!document.pointerLockElement) return;
      firePlayerBullet();
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [firePlayerBullet]);

  const spawnBullet = useCallback((origin, direction) => {
    const id = ++bulletIdRef.current;
    setBullets(prev => [...prev.slice(-8), { id, origin: origin.clone(), direction: direction.clone() }]);
  }, []);

  const removeBullet = useCallback((id) => {
    setBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const removePlayerBullet = useCallback((id) => {
    setPlayerBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const handlePlayerBulletHit = useCallback(() => {
    setHitMarker(true);
    setTimeout(() => setHitMarker(false), 280);
  }, []);

  const damageNeo = useCallback((amount) => {
    const next = Math.max(0, neoHpRef.current - amount);
    neoHpRef.current = next;
    setNeoHp(next);
    if (next <= 0) setDead(true);
  }, []);

  const handleBulletHit = useCallback((id) => {
    removeBullet(id);
    if (!dodgeRef.current.active) {
      setHit(true);
      setTimeout(() => setHit(false), 340);
      damageNeo(20);
    }
  }, [removeBullet, damageNeo]);

  const handleBulletNear = useCallback((angle) => {
    if (bulletWarnRef.current) return;
    bulletWarnRef.current = setTimeout(() => {
      bulletWarnRef.current = null;
      setBulletWarn(null);
    }, 800);
    setBulletWarn({ angle });
  }, []);

  const handleCatch = useCallback(() => {
    if (dodgeRef.current.active) return;
    setCaught(true);
    setTimeout(() => setCaught(false), 900);
    damageNeo(25);
  }, [damageNeo]);

  const handleAgentSpawn = useCallback(() => {
    setAgentAlert(true);
    setTimeout(() => setAgentAlert(false), 2400);
  }, []);

  const handleAgentDead = useCallback((deathPos) => {
    if (deathPos) {
      const id = ++gunIdRef.current;
      setDroppedGuns(prev => [...prev, { id, position: deathPos.clone().setY(0.3) }]);
    }
    setTimeout(() => setAgentKey(k => k + 1), 3000);
  }, []);

  const handleAgentMelee = useCallback((dmg) => {
    if (dead) return;
    if (blockRef.current) {
      // Successful block — stun the agent, no damage, brief flash
      setBlockFlash(true);
      setTimeout(() => setBlockFlash(false), 320);
      // Stun all nearby agents
      for (const a of agentRegistryRef.current) {
        a.takeDamage(0);                         // trigger hit flash visual only
        a.knockback?.(new THREE.Vector3(0, 0, 1), 0.1); // micro-push to reset melee timer
      }
      return;
    }
    // Not blocking — take full damage
    neoHpRef.current = Math.max(0, neoHpRef.current - dmg);
    setNeoHp(neoHpRef.current);
    setHit(true);
    setHitShake(true);
    setTimeout(() => setHit(false), 300);
    setTimeout(() => setHitShake(false), 320);
    if (neoHpRef.current <= 0) setDead(true);
  }, [dead, agentRegistryRef]);

  const handleCollectKey = useCallback(() => {
    setHasKey(true);
    setKeyCollected(true);
    setTimeout(() => setKeyCollected(false), 3200);
  }, []);

  // ── Mobile action callbacks ────────────────────────────────────────────────────
  const handleMobilePunch = useCallback(() => {
    if (paused || dead || punchCdRef.current > 0 || stateRef.current.kicking) return;
    const p = charPosRef.current;
    for (const agent of agentRegistryRef.current) {
      const ap = agent.posRef.current;
      const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
      if (dist < PUNCH_RANGE) {
        agent.takeDamage(PUNCH_DMG);
        const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
        agent.knockback?.(kbDir, 2.2);
        setPunchFlash(true);
        setTimeout(() => setPunchFlash(false), 140);
        break;
      }
    }
    stateRef.current.altArm = stateRef.current.altArm === 0 ? 1 : 0;
    stateRef.current.punching = true;
    stateRef.current.punchT = 0;
    punchCdRef.current = 0.35;
  }, [paused, dead]);

  const handleMobileKick = useCallback(() => {
    if (paused || dead || kickCdRef.current > 0 || stateRef.current.punching) return;
    const KICK_RANGE = 3.6, KICK_DMG = 50, KICK_KB = 4.0;
    const p = charPosRef.current;
    for (const agent of agentRegistryRef.current) {
      const ap = agent.posRef.current;
      if (Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2) < KICK_RANGE) {
        agent.takeDamage(KICK_DMG);
        agent.knockback?.(new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize(), KICK_KB);
        setKickFlash(true);
        setTimeout(() => setKickFlash(false), 340);
        break;
      }
    }
    stateRef.current.kicking = true;
    stateRef.current.kickT = 0;
    stateRef.current.flyKick = false;
    kickCdRef.current = 0.50;
  }, [paused, dead]);

  const handleMobileSpinKick = useCallback(() => {
    if (paused || dead || spinKickCdRef.current > 0 || stateRef.current.punching || stateRef.current.kicking || stateRef.current.spinKicking) return;
    const SPIN_RANGE = 4.8, SPIN_DMG = 72, SPIN_KB = 6.0;
    const p = charPosRef.current;
    for (const agent of agentRegistryRef.current) {
      const ap = agent.posRef.current;
      if (Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2) < SPIN_RANGE) {
        agent.takeDamage(SPIN_DMG);
        agent.knockback?.(new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize(), SPIN_KB);
        setKickFlash(true);
        setTimeout(() => setKickFlash(false), 420);
        break;
      }
    }
    stateRef.current.spinKicking = true;
    stateRef.current.spinKickT = 0;
    spinKickCdRef.current = 1.05;
  }, [paused, dead]);

  const handleMobileDodgeLeft = useCallback(() => {
    if (dodgeRef.current.active) return;
    const yaw   = yawRef.current;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const boost = timeScaleRef.current < 0.5 ? 2.5 : 1.0;
    const dir   = right.clone().negate().normalize().multiplyScalar(DODGE_SPD * boost);
    dodgeRef.current = { active: true, vel: dir, t: DODGE_DUR, tMax: DODGE_DUR };
    stateRef.current.dodging = true;
    stateRef.current.dodgeDir = -1;
    setDodgeFlash(true);
    setTimeout(() => setDodgeFlash(false), 200);
  }, []);

  const handleMobileDodgeRight = useCallback(() => {
    if (dodgeRef.current.active) return;
    const yaw   = yawRef.current;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const boost = timeScaleRef.current < 0.5 ? 2.5 : 1.0;
    const dir   = right.clone().normalize().multiplyScalar(DODGE_SPD * boost);
    dodgeRef.current = { active: true, vel: dir, t: DODGE_DUR, tMax: DODGE_DUR };
    stateRef.current.dodging = true;
    stateRef.current.dodgeDir = 1;
    setDodgeFlash(true);
    setTimeout(() => setDodgeFlash(false), 200);
  }, []);

  const handleMobileBulletTime = useCallback(() => {
    if (btActive || btCoolRef.current > 0) return;
    btTimerRef.current = BT_DURATION;
    setBtLeft(BT_DURATION);
    setBtActive(true);
    timeScaleRef.current = BT_SCALE;
  }, [btActive]);

  const handleMobileUppercut = useCallback(() => {
    if (paused || dead || upperCdRef.current > 0 || stateRef.current.kicking) return;
    const UPPER_RANGE = 2.8, UPPER_DMG = 58;
    const p = charPosRef.current;
    let hitAgent = false;
    for (const agent of agentRegistryRef.current) {
      const ap = agent.posRef.current;
      const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
      if (dist < UPPER_RANGE) {
        agent.takeDamage(UPPER_DMG);
        const kbDir = new THREE.Vector3(ap.x - p.x, 0.9, ap.z - p.z).normalize();
        agent.knockback?.(kbDir, 5.5);
        hitAgent = true;
        break;
      }
    }
    stateRef.current.punching = true;
    stateRef.current.punchT   = 0;
    stateRef.current.altArm   = 2;
    upperCdRef.current        = 0.9;
    if (hitAgent) {
      setPunchFlash(true);
      setTimeout(() => setPunchFlash(false), 180);
    }
  }, [paused, dead]);

  const handleMobileInteract = useCallback(() => {
    if (openDoor) {
      setOpenDoor(null);
    } else if (nearReturn) {
      exitRoom();
    } else if (sceneId === 'corridor' && nearDoor) {
      enterRoom(nearDoor);
    } else if (nearTerminal && sceneId !== 'corridor') {
      const roomDoor = MATRIX_DOORS.find(d => d.id === currentRoomId.current);
      setOpenDoor({
        id: currentRoomId.current,
        label: roomDoor?.label ?? '> TERMINAL',
        sublabel: roomDoor?.sublabel ?? 'Data',
      });
    }
  }, [openDoor, sceneId, nearDoor, nearTerminal, enterRoom]);

  // Auto-lock pointer when game becomes active — desktop only (mobile has no pointer lock)
  useEffect(() => {
    if (phase === 'playing' && !isMobile) {
      setTimeout(() => document.querySelector('canvas')?.requestPointerLock(), 200);
    }
  }, [phase, isMobile]);

  const handleRestart = useCallback(() => {
    neoHpRef.current = 100;
    setNeoHp(100);
    setDead(false);
    flyingRef.current = false;
    setIsFlying(false);
    setAgentKey(k => k + 1);
    setBullets([]);
    if (!isMobile) {
      setTimeout(() => document.querySelector('canvas')?.requestPointerLock(), 80);
    }
  }, [isMobile]);

  if (phase === 'intro') return <WakeUpSequence onDone={() => setPhase('tutorial')} />;
  if (phase === 'tutorial') return <TutorialModal onStart={() => setPhase('playing')} />;

  const canvasFilter = btActive
    ? 'saturate(0.5) contrast(1.14) brightness(0.95)'
    : 'none';

  const canInteract = !!(
    nearReturn ||
    (sceneId === 'corridor' && nearDoor) ||
    (nearTerminal && sceneId !== 'corridor')
  );

  return (
    <div className={`mx-root${hitShake ? ' mx-shake' : ''}`}>
      {/* Portrait-mode warning — CSS hides on landscape */}
      <div className="mx-portrait-warn">
        <div className="mx-portrait-warn__icon">📱</div>
        <div className="mx-portrait-warn__text">
          ROTATE YOUR DEVICE<br />TO LANDSCAPE MODE<br />TO PLAY
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 2.5, 5], fov: 75, near: 0.08, far: 380 }}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        dpr={isMobile ? [0.75, 1.0] : [1, 1.2]}
        style={{
          filter: canvasFilter,
          transition: 'filter 0.25s ease',
          pointerEvents: paused ? 'none' : 'auto'
        }}
      >
        <Scene
          charPosRef={charPosRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          dodgeRef={dodgeRef}
          crouchRef={crouchRef}
          timeScaleRef={timeScaleRef}
          stateRef={stateRef}
          agentRegistryRef={agentRegistryRef}
          flyingRef={flyingRef}
          onNearDoor={d => setNearDoor(d)}
          nearDoor={nearDoor}
          openDoor={openDoor}
          onCatch={handleCatch}
          onShoot={spawnBullet}
          paused={paused}
          sceneId={sceneId}
          isNearTerminal={nearTerminal}
          isNearExit={isNearExit}
          onNearTerminal={v => {
            setNearTerminal(v);
            if (v) setIsNearExit(false);
          }}
          onNearExit={v => setIsNearExit(v)}
          onExitRoom={exitRoom}
          onNearReturn={v => setNearReturn(v)}
          agentKey={agentKey}
          onAgentSpawn={handleAgentSpawn}
          onAgentDead={handleAgentDead}
          onAgentMelee={handleAgentMelee}
          hasKey={hasKey}
          onCollectKey={handleCollectKey}
          agentEnabled={agentEnabled}
          cameraForwardRef={cameraForwardRef}
          mobileJoystickRef={mobileJoystickRef}
          mobileJumpRef={mobileJumpRef}
          mobileSprintRef={mobileSprintRef}
          mobileFlyUpRef={mobileFlyUpRef}
          mobileFlyDownRef={mobileFlyDownRef}
        />

        {bullets.map(b => (
          <MatrixBullet
            key={b.id}
            id={b.id}
            origin={b.origin}
            direction={b.direction}
            playerPosRef={charPosRef}
            crouchRef={crouchRef}
            dodgeRef={dodgeRef}
            timeScaleRef={timeScaleRef}
            onExpire={removeBullet}
            onHit={handleBulletHit}
            onNear={handleBulletNear}
          />
        ))}

        {playerBullets.map(b => (
          <PlayerBullet
            key={b.id}
            id={b.id}
            origin={b.origin}
            direction={b.direction}
            agentRegistryRef={agentRegistryRef}
            timeScaleRef={timeScaleRef}
            onExpire={removePlayerBullet}
            onAgentHit={handlePlayerBulletHit}
          />
        ))}

        {droppedGuns.map(g => (
          <AgentGunPickup
            key={g.id}
            position={g.position}
            charPosRef={charPosRef}
            onPickup={() => {
              setDroppedGuns(prev => prev.filter(x => x.id !== g.id));
              const add = 15;
              reserveAmmoRef.current = Math.min(reserveAmmoRef.current + add, 120);
              setReserveAmmo(reserveAmmoRef.current);
            }}
          />
        ))}
      </Canvas>

      <MatrixRain opacity={0.07} timeScaleRef={timeScaleRef} />

      <HUD
        nearStation={
          sceneId === 'corridor'
            ? nearDoor
            : (
              nearTerminal
                ? { ...MATRIX_DOORS.find(d => d.id === currentRoomId.current), label: '> TERMINAL ACCESS' }
                : null
            )
        }
        dockedStation={openDoor}
        onUndock={() => setOpenDoor(null)}
        resumeData={resumeData}
        mode="matrix"
        stations={MATRIX_DOORS.filter(d => !d.locked)}
      />

      {nearDoor && !openDoor && sceneId === 'corridor' && (
        <div
          className="mx-door-prompt"
          style={{
            color: nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color,
            textShadow: `0 0 16px ${nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color}`,
          }}
        >
          {nearDoor.locked
            ? (hasKey
              ? `[ E ]  UNLOCK  ${nearDoor.label.replace('> ', '')}`
              : '[ LOCKED ]  FIND THE RED PILL')
            : `[ E ]  ENTER  ${nearDoor.sublabel.toUpperCase()}`}
        </div>
      )}

      {nearTerminal && !openDoor && sceneId !== 'corridor' && (
        <div className="mx-terminal-prompt">[ E ]  ACCESS TERMINAL</div>
      )}

      {nearAgent && !openDoor && <NearAgentPrompt />}
      {bulletWarn && !openDoor && <BulletWarnOverlay angle={bulletWarn.angle} />}
      {agentAlert && !openDoor && <AgentSpawnAlert />}

      {sceneId === 'corridor' && !openDoor && (
        <CorridorDoorList charPosRef={charPosRef} hasKey={hasKey} />
      )}

      {btActive && <BulletTimeOverlay timeLeft={btLeft} maxTime={BT_DURATION} />}
      {isFlying && <FlyingHUD charPosRef={charPosRef} />}
      {sceneId === 'room-architect' && <ArchitectDialogue onExit={exitRoom} />}
      {keyCollected && <KeyCollectedOverlay />}
      {caught && <CaughtOverlay />}
      {hit && <HitOverlay />}
      {punchFlash && <PunchHitOverlay />}
      {kickFlash && <KickImpactOverlay />}
      {blockFlash && <div className="mx-overlay mx-block-flash" />}
      {blocking && <div className="mx-blocking-hud">⬡ BLOCKING</div>}
      {lockedAttempt && <AccessDeniedOverlay />}

      {!openDoor && !isFlying && sceneId !== 'room-architect' && (
        <AmmoDisplay ammo={ammo} reserveAmmo={reserveAmmo} isReloading={isReloading} />
      )}

      {!openDoor && <NeoHealthBar hp={neoHp} />}

      {!openDoor && !isFlying && (
        <Reticle shooting={shootCooldown} hit={hitMarker} />
      )}

      {dead && <DeathScreen onRestart={handleRestart} />}

      {dodgeFlash && <div className="mx-overlay mx-dodge-flash" />}

      <FadeOverlay active={fading} />
      <BTCooldownBar coolRef={btCoolRef} maxCD={BT_COOLDOWN} />

      {hasKey && !openDoor && <div className="mx-key-indicator">● RED PILL</div>}

      {!openDoor && !isMobile && (
        <div className="mx-controls-hint">
          {isFlying
            ? 'WASD MOVE · SPACE FLY UP · CTRL FLY DOWN · Z/F BULLET-TIME'
            : 'CLICK SHOOT · G RELOAD · WASD MOVE · SHIFT SPRINT · SPACE JUMP · Q/R DODGE · CTRL DUCK · J PUNCH · U UPPERCUT · K ROUNDHOUSE · L SPIN HOOK · [B] BLOCK · Z/F BT · E INTERACT'}
        </div>
      )}

      {isMobile && (
        <MobileControls
          yawRef={yawRef}
          pitchRef={pitchRef}
          mobileJoystickRef={mobileJoystickRef}
          mobileJumpRef={mobileJumpRef}
          mobileSprintRef={mobileSprintRef}
          mobileFlyUpRef={mobileFlyUpRef}
          mobileFlyDownRef={mobileFlyDownRef}
          onShoot={firePlayerBullet}
          onPunch={handleMobilePunch}
          onKick={handleMobileKick}
          onSpinKick={handleMobileSpinKick}
          onUppercut={handleMobileUppercut}
          onDodgeLeft={handleMobileDodgeLeft}
          onDodgeRight={handleMobileDodgeRight}
          onBulletTime={handleMobileBulletTime}
          onInteract={handleMobileInteract}
          blockRef={blockRef}
          onBlockStart={() => setBlocking(true)}
          onBlockEnd={() => setBlocking(false)}
          canInteract={canInteract}
          isFlying={isFlying}
          isArchitect={sceneId === 'room-architect'}
          paused={paused}
        />
      )}

    </div>
  );
}