import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM } from './constants';

const { halfW: HW, height: H, depth: D, terminalZ: TZ, exitZ: EZ } = ROOM;
const EXIT_TRIGGER = 1.8;
const TERM_TRIGGER = 5.0;
const G = '#00ff41';

// ── Shared helpers ────────────────────────────────────────────────────────────

function StarField({ count = 350, spread = 350, minY = 12, maxY = 90, zRange = 280 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = minY + Math.random() * (maxY - minY);
      arr[i * 3 + 2] = -Math.random() * zRange - 10;
    }
    return arr;
  }, [count, spread, minY, maxY, zRange]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.14} transparent opacity={0.92} sizeAttenuation />
    </points>
  );
}

function Terminal({ color = G, label, isNear }) {
  const screenRef = useRef();
  useFrame(({ clock }) => {
    if (screenRef.current)
      screenRef.current.material.emissiveIntensity = 1.8 + Math.sin(clock.elapsedTime * 2.4) * 0.7;
  });
  return (
    <group position={[0, 0, TZ]}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.8, 8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh ref={screenRef} position={[0, 1.6, 0]}>
        <boxGeometry args={[1.5, 1.0, 0.1]} />
        <meshStandardMaterial color="#030f04" emissive={color} emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0, 1.6, -0.06]}>
        <boxGeometry args={[1.62, 1.12, 0.06]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.3} metalness={0.9} />
      </mesh>
      <pointLight position={[0, 1.6, 0.6]} color={color} intensity={6} distance={8} />
      <Billboard follow>
        <Text position={[0, 2.5, 0]} fontSize={0.32} color={color} anchorX="center" anchorY="middle">
          {label}
        </Text>
        {isNear && (
          <Text position={[0, -0.5, 0]} fontSize={0.36} color={color} anchorX="center">
            {'[ E ]  ACCESS'}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

function ExitPortal({ isNear }) {
  const surfRef  = useRef();
  const frameRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (surfRef.current)  surfRef.current.material.opacity = 0.55 + Math.sin(t * 2.5) * 0.2;
    if (frameRef.current) {
      frameRef.current.traverse(c => {
        if (c.isMesh && c.material) c.material.emissiveIntensity = 4 + Math.sin(t * 3) * 2;
      });
    }
  });
  return (
    <group position={[0, 0, EZ]}>
      <group ref={frameRef}>
        {[[0, 3.2, 0, [3.4, 0.2, 0.2]], [0, -0.1, 0, [3.4, 0.2, 0.2]],
          [-1.6, 1.55, 0, [0.2, 3.3, 0.2]], [1.6, 1.55, 0, [0.2, 3.3, 0.2]]].map(([px, py, pz, dims], i) => (
          <mesh key={i} position={[px, py, pz]}>
            <boxGeometry args={dims} />
            <meshStandardMaterial color="#030f04" emissive={G} emissiveIntensity={4} />
          </mesh>
        ))}
      </group>
      <mesh ref={surfRef} position={[0, 1.55, 0]}>
        <planeGeometry args={[3.0, 3.2]} />
        <meshStandardMaterial color="#001800" emissive={G} emissiveIntensity={2.5}
          transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color={G} intensity={10} distance={14} position={[0, 1.5, 1]} />
      <Billboard follow>
        {isNear && <Text position={[0, 3.9, 0]} fontSize={0.38} color={G} anchorX="center">[ EXIT SIMULATION ]</Text>}
      </Billboard>
    </group>
  );
}

// ── Rain (instanced) ──────────────────────────────────────────────────────────
function RainParticles({ count = 500 }) {
  const meshRef = useRef();
  const data = useMemo(() => Array.from({ length: count }, () => [
    (Math.random() - 0.5) * HW * 4,
    Math.random() * 16,
    -Math.random() * (D + 20),
  ]), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    data.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [data, dummy]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const spd = 12;
    data.forEach((p, i) => {
      p[1] -= spd * delta;
      if (p[1] < -0.5) {
        p[1] = 16;
        p[0] = (Math.random() - 0.5) * HW * 4;
        p[2] = -Math.random() * (D + 20);
      }
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry args={[0.018, 0.28, 0.018]} />
      <meshStandardMaterial color="#aabbd8" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Room 1: NIGHT OCEAN SHORE (About Me) ───────────────────────────────────────
function OceanRoom({ isNearTerminal, isNearExit }) {
  const wave1 = useRef(), wave2 = useRef(), wave3 = useRef(), wave4 = useRef();
  const foam1 = useRef(), foam2 = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wave1.current) {
      wave1.current.position.z = -20 + Math.sin(t * 0.55) * 2.8;
      wave1.current.position.y = 0.10 + Math.sin(t * 0.9) * 0.10;
    }
    if (wave2.current) {
      wave2.current.position.z = -32 + Math.sin(t * 0.42 + 1.2) * 2.2;
      wave2.current.position.y = 0.06 + Math.sin(t * 0.7 + 2) * 0.07;
    }
    if (wave3.current) {
      wave3.current.position.z = -46 + Math.sin(t * 0.35 + 2.5) * 1.8;
      wave3.current.position.y = 0.03 + Math.sin(t * 0.5 + 1) * 0.05;
    }
    if (wave4.current) {
      wave4.current.position.z = -62 + Math.sin(t * 0.28 + 3.5) * 1.4;
    }
    if (foam1.current) foam1.current.material.opacity = 0.3 + Math.sin(t * 1.8) * 0.2;
    if (foam2.current) foam2.current.material.opacity = 0.2 + Math.sin(t * 1.4 + 1.5) * 0.15;
  });

  // Rocky cliff geometry on sides
  const cliffRocks = useMemo(() => {
    const rocks = [];
    for (let z = 2; z > -(D + 20); z -= 6) {
      rocks.push({ x: -(HW + 5 + Math.random() * 8), h: 3 + Math.random() * 14, w: 5 + Math.random() * 7, z, side: 'left' });
      rocks.push({ x:   HW + 5 + Math.random() * 8,  h: 3 + Math.random() * 14, w: 5 + Math.random() * 7, z, side: 'right' });
    }
    return rocks;
  }, []);

  // Boulders on beach
  const boulders = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    x: (Math.random() - 0.5) * (HW * 1.6),
    z: -3 - Math.random() * 16,
    s: 0.3 + Math.random() * 0.8,
  })), []);

  return (
    <group>
      <color attach="background" args={['#020508']} />
      <fog   attach="fog"        args={['#020508', 25, 140]} />
      <ambientLight color="#1a2840" intensity={1.6} />
      {/* Sky fill */}
      <hemisphereLight skyColor="#1a3a6a" groundColor="#050a14" intensity={1.2} />
      {/* Wide moonlight fill */}
      <directionalLight color="#4060a0" intensity={0.55} position={[18, 38, -110]} castShadow={false} />
      <pointLight color="#2040a0" intensity={5} position={[0, 35, -80]} distance={260} decay={2} />
      {/* Shore fill — warm reflection from wet sand */}
      <pointLight color="#2a3a70" intensity={3} position={[0, 2, -12]} distance={30} decay={2} />

      {/* Moon */}
      <mesh position={[18, 38, -110]}>
        <sphereGeometry args={[5, 14, 14]} />
        <meshStandardMaterial color="#f0e8c8" emissive="#d0c890" emissiveIntensity={0.7} />
      </mesh>
      <pointLight color="#f0e8c8" intensity={4.5} position={[18, 38, -110]} distance={350} decay={2} />

      {/* Moon reflection on water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, -55]}>
        <planeGeometry args={[3, 20]} />
        <meshStandardMaterial color="#fffadf" emissive="#fffadf" emissiveIntensity={0.35}
          transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <StarField count={320} />

      {/* Sandy beach floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -D / 2 + 5]}>
        <planeGeometry args={[HW * 2, D + 20]} />
        <meshStandardMaterial color="#8a7d62" roughness={0.97} />
      </mesh>
      {/* Wet sand near water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -18]}>
        <planeGeometry args={[HW * 2, 8]} />
        <meshStandardMaterial color="#5a5244" roughness={0.82} metalness={0.12} />
      </mesh>

      {/* Deep ocean (background) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -120]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#020d1a" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Animated waves */}
      <mesh ref={wave1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, -20]}>
        <planeGeometry args={[HW * 3, 5]} />
        <meshStandardMaterial color="#0a1e38" roughness={0.6} metalness={0.2} transparent opacity={0.88} />
      </mesh>
      <mesh ref={foam1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, -20]}>
        <planeGeometry args={[HW * 3, 1.2]} />
        <meshStandardMaterial color="#9bb8d8" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={wave2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, -32]}>
        <planeGeometry args={[HW * 3.5, 5.5]} />
        <meshStandardMaterial color="#071428" roughness={0.65} metalness={0.18} transparent opacity={0.85} />
      </mesh>
      <mesh ref={foam2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -32]}>
        <planeGeometry args={[HW * 3.5, 1.0]} />
        <meshStandardMaterial color="#8aa8c8" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={wave3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -46]}>
        <planeGeometry args={[HW * 4, 6]} />
        <meshStandardMaterial color="#050f20" roughness={0.7} metalness={0.15} transparent opacity={0.82} />
      </mesh>
      <mesh ref={wave4} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -62]}>
        <planeGeometry args={[HW * 5, 8]} />
        <meshStandardMaterial color="#030b18" roughness={0.75} metalness={0.12} transparent opacity={0.78} />
      </mesh>

      {/* Rocky cliffs on sides */}
      {cliffRocks.map((r, i) => (
        <mesh key={i} position={[r.x, r.h / 2, r.z]}>
          <boxGeometry args={[r.w, r.h, 5.5 + Math.random() * 2]} />
          <meshStandardMaterial color="#18151a" roughness={0.97} />
        </mesh>
      ))}

      {/* Beach boulders */}
      {boulders.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.4, b.z]}>
          <dodecahedronGeometry args={[b.s, 0]} />
          <meshStandardMaterial color="#2a2520" roughness={0.95} />
        </mesh>
      ))}

      {/* Atmospheric fog strip on water horizon */}
      <mesh position={[0, 3, -85]}>
        <boxGeometry args={[200, 6, 2]} />
        <meshStandardMaterial color="#0a1428" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <Terminal color="#00aaff" label="> ABOUT.SYS" isNear={isNearTerminal} />
      <ExitPortal isNear={isNearExit} />
    </group>
  );
}

// ── Room 2: RAINY CITY STREET (Resume & Skills) ────────────────────────────────
// ── Pedestrian walker ──────────────────────────────────────────────────────────
const PED_COLORS = ['#3a3a3a', '#2a3a4a', '#4a2a2a', '#2a4a2a', '#4a3a1a', '#1a1a4a'];

function Pedestrian({ x, startZ, range, speed, colorIdx, height = 1 }) {
  const groupRef = useRef();
  const lL = useRef(), rL = useRef(), lA = useRef(), rA = useRef();
  const zRef = useRef(startZ);
  const dirRef = useRef(-1);

  const c = PED_COLORS[colorIdx % PED_COLORS.length];

  useFrame(({ clock }, delta) => {
    const ts = 1; // pedestrians always real-time speed
    zRef.current += speed * dirRef.current * delta;
    if (zRef.current < startZ - range) dirRef.current =  1;
    if (zRef.current > startZ + 2)     dirRef.current = -1;

    if (groupRef.current) {
      groupRef.current.position.z = zRef.current;
      groupRef.current.rotation.y = dirRef.current > 0 ? 0 : Math.PI;
    }

    const t = clock.elapsedTime * 9 * height;
    const a = 0.38;
    if (lL.current) lL.current.rotation.x =  Math.sin(t) * a;
    if (rL.current) rL.current.rotation.x = -Math.sin(t) * a;
    if (lA.current) lA.current.rotation.x = -Math.sin(t) * a * 0.55;
    if (rA.current) rA.current.rotation.x =  Math.sin(t) * a * 0.55;
  });

  const s = 0.82 + height * 0.18;
  return (
    <group ref={groupRef} position={[x, 0, startZ]} scale={[s, s, s]}>
      {/* Body */}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[0.60, 0.85, 0.38]} />
        <meshStandardMaterial color={c} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.08, 0]}>
        <boxGeometry args={[0.40, 0.40, 0.38]} />
        <meshStandardMaterial color="#9a8878" roughness={0.8} />
      </mesh>
      {/* Left arm */}
      <group ref={lA} position={[-0.38, 1.75, 0]}>
        <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.20, 0.56, 0.20]} /><meshStandardMaterial color={c} roughness={0.85} /></mesh>
      </group>
      {/* Right arm */}
      <group ref={rA} position={[0.38, 1.75, 0]}>
        <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.20, 0.56, 0.20]} /><meshStandardMaterial color={c} roughness={0.85} /></mesh>
      </group>
      {/* Left leg */}
      <group ref={lL} position={[-0.16, 1.0, 0]}>
        <mesh position={[0, -0.42, 0]}><boxGeometry args={[0.22, 0.84, 0.24]} /><meshStandardMaterial color="#111118" roughness={0.9} /></mesh>
      </group>
      {/* Right leg */}
      <group ref={rL} position={[0.16, 1.0, 0]}>
        <mesh position={[0, -0.42, 0]}><boxGeometry args={[0.22, 0.84, 0.24]} /><meshStandardMaterial color="#111118" roughness={0.9} /></mesh>
      </group>
    </group>
  );
}

function CityStreetRoom({ isNearTerminal, isNearExit }) {
  // Buildings on both sides
  const buildings = useMemo(() => {
    const bs = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const depth = 8 + Math.random() * 10;
      bs.push({
        x:     side * (HW + 3.5 + Math.random() * 5),
        z:    -4 - i * 5 - Math.random() * 2,
        h:    10 + Math.random() * 22,
        w:     5 + Math.random() * 6,
        depth,
        side,
      });
    }
    return bs;
  }, []);

  // Neon signs
  const neons = useMemo(() => [
    { x: -(HW + 1.5), y: 5.5, z: -10,  w: 3.2, h: 0.8, color: '#ff0066', text: 'HOTEL' },
    { x:   HW + 1.5,  y: 7.0, z: -18,  w: 4.5, h: 0.9, color: '#00ccff', text: 'DINER' },
    { x: -(HW + 1.5), y: 6.2, z: -28,  w: 2.8, h: 0.75, color: '#ff8800', text: 'BAR' },
    { x:   HW + 1.5,  y: 5.0, z: -36,  w: 5.0, h: 0.9, color: '#88ff00', text: 'OPEN' },
    { x: -(HW + 1.5), y: 8.0, z: -44,  w: 3.8, h: 0.85, color: '#cc00ff', text: 'CAFE' },
  ], []);

  // Puddle reflections on ground
  const puddles = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    x: (Math.random() - 0.5) * (HW * 1.6),
    z: -3 - i * 7 - Math.random() * 4,
    s: 0.8 + Math.random() * 1.8,
  })), []);

  // Street lights alternating sides
  const streetLights = useMemo(() => {
    const sl = [];
    for (let z = -5; z > -(D - 5); z -= 14) {
      sl.push({ x: -(HW - 0.5), z });
      sl.push({ x:   HW - 0.5,  z: z - 7 });
    }
    return sl;
  }, []);

  return (
    <group>
      <color attach="background" args={['#020308']} />
      <fog   attach="fog"        args={['#020308', 12, 90]} />
      <ambientLight color="#0a1020" intensity={1.4} />
      {/* Overcast sky fill */}
      <hemisphereLight skyColor="#1a2040" groundColor="#050508" intensity={0.9} />
      {/* Street-level fill — bounced light from wet pavement */}
      <pointLight color="#204060" intensity={4} position={[0, 1, -30]} distance={80} decay={1.5} />
      {/* Neon spillover fill lights */}
      <pointLight color="#ff0066" intensity={2.5} position={[-HW, 3, -10]} distance={22} decay={2} />
      <pointLight color="#00aaff" intensity={2.5} position={[ HW, 4, -20]} distance={22} decay={2} />

      {/* Wide pavement floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -D / 2 + 5]}>
        <planeGeometry args={[HW * 2, D + 10]} />
        <meshStandardMaterial color="#0a0a0e" roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Sidewalk stripes (subtly lighter) */}
      {[-HW + 1.5, HW - 1.5].map((sx, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[sx, 0.002, -D / 2 + 5]}>
          <planeGeometry args={[2, D + 10]} />
          <meshStandardMaterial color="#0d0d12" roughness={0.75} />
        </mesh>
      ))}

      {/* Puddles */}
      {puddles.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.003, p.z]}>
          <circleGeometry args={[p.s, 12]} />
          <meshStandardMaterial color="#151820" roughness={0.1} metalness={0.85}
            transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}

      {/* Buildings */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          {/* Building body */}
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.depth]} />
            <meshStandardMaterial color="#060610" roughness={0.85} />
          </mesh>
          {/* Window rows (facing corridor) */}
          {Array.from({ length: Math.floor(b.h / 2.2) }, (_, row) =>
            Array.from({ length: Math.floor(b.w / 2.0) }, (_, col) => {
              const lit = Math.random() > 0.25;
              if (!lit) return null;
              const wx = -b.w / 2 + 1.0 + col * 2.0;
              return (
                <mesh key={`${row}-${col}`}
                  position={[wx, 1.8 + row * 2.2, b.side * b.depth / 2 * 0.5]}>
                  <boxGeometry args={[0.7, 0.85, 0.05]} />
                  <meshStandardMaterial
                    color="#fffacc"
                    emissive="#fffacc"
                    emissiveIntensity={1.2 + Math.random() * 0.8}
                    transparent opacity={0.85}
                  />
                </mesh>
              );
            })
          )}
        </group>
      ))}

      {/* Neon signs */}
      {neons.map((n, i) => (
        <group key={i} position={[n.x, n.y, n.z]}>
          <mesh>
            <boxGeometry args={[n.w, n.h, 0.08]} />
            <meshStandardMaterial color="#030303" emissive={n.color} emissiveIntensity={3.5} />
          </mesh>
          <pointLight color={n.color} intensity={4} distance={12} position={[0, 0, 0.5]} />
          {/* Neon glow haze */}
          <mesh position={[0, 0, -0.2]}>
            <boxGeometry args={[n.w + 1.2, n.h + 0.8, 0.6]} />
            <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.8}
              transparent opacity={0.08} depthWrite={false} side={THREE.BackSide} />
          </mesh>
        </group>
      ))}

      {/* Street lights */}
      {streetLights.map((sl, i) => (
        <group key={i} position={[sl.x, 0, sl.z]}>
          {/* Pole */}
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 8, 6]} />
            <meshStandardMaterial color="#1a1820" roughness={0.6} metalness={0.7} />
          </mesh>
          {/* Arm */}
          <mesh position={[sl.x < 0 ? 0.6 : -0.6, 7.6, 0]}>
            <boxGeometry args={[1.2, 0.1, 0.1]} />
            <meshStandardMaterial color="#1a1820" roughness={0.6} metalness={0.7} />
          </mesh>
          {/* Lamp head */}
          <mesh position={[sl.x < 0 ? 1.1 : -1.1, 7.5, 0]}>
            <boxGeometry args={[0.5, 0.22, 0.38]} />
            <meshStandardMaterial color="#ffdd99" emissive="#ffdd99" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[sl.x < 0 ? 1.1 : -1.1, 7.2, 0]}
            color="#ffdd88" intensity={5} distance={18} decay={2} />
        </group>
      ))}

      <RainParticles count={300} />

      <Terminal color="#33ff88" label="> CAREER.LOG" isNear={isNearTerminal} />
      <ExitPortal isNear={isNearExit} />
    </group>
  );
}

// ── Room 3: MOUNTAIN PEAK AT NIGHT (Portfolio/Projects) ────────────────────────
function MountainRoom({ isNearTerminal, isNearExit }) {
  // Pine trees on sides
  const trees = useMemo(() => {
    const ts = [];
    for (let z = -2; z > -(D + 10); z -= 4) {
      const scatter = Math.random() * 3;
      ts.push({ x: -(HW + 2.5 + scatter), z, s: 0.7 + Math.random() * 0.8 });
      ts.push({ x:   HW + 2.5 + scatter,  z, s: 0.7 + Math.random() * 0.8 });
    }
    return ts;
  }, []);

  // Mountain silhouettes in background
  const peaks = useMemo(() => [
    { x: -22, h: 55, w: 20, z: -130 },
    { x:  15, h: 70, w: 25, z: -155 },
    { x:  40, h: 42, w: 16, z: -120 },
    { x: -48, h: 38, w: 15, z: -110 },
    { x:   0, h: 90, w: 30, z: -180 },
    { x: -30, h: 58, w: 18, z: -160 },
    { x:  55, h: 35, w: 14, z: -105 },
  ], []);

  // Terrain bumps (ground irregularity)
  const terrain = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    x: (Math.random() - 0.5) * HW * 2,
    z: -Math.random() * (D + 5),
    h: 0.2 + Math.random() * 0.7,
    s: 0.8 + Math.random() * 1.8,
  })), []);

  return (
    <group>
      <color attach="background" args={['#010208']} />
      <fog   attach="fog"        args={['#010208', 30, 160]} />
      <ambientLight color="#0c1228" intensity={1.3} />
      {/* Cold moonlit sky */}
      <hemisphereLight skyColor="#1a2850" groundColor="#06040c" intensity={1.0} />
      {/* Moon key light */}
      <directionalLight color="#c0d0f0" intensity={0.5} position={[-25, 55, -140]} castShadow={false} />
      <pointLight color="#3050c0" intensity={3.5} position={[0, 60, -120]} distance={340} decay={2} />
      {/* Cold blue rim from opposite side (star scatter) */}
      <pointLight color="#2040a8" intensity={2} position={[20, 30, -60]} distance={120} decay={2} />

      {/* Full moon */}
      <mesh position={[-25, 55, -140]}>
        <sphereGeometry args={[7, 14, 14]} />
        <meshStandardMaterial color="#f5f0e8" emissive="#e0d8c0" emissiveIntensity={0.6} />
      </mesh>
      <pointLight color="#f0e8d0" intensity={5} position={[-25, 55, -140]} distance={400} decay={2} />

      <StarField count={380} minY={20} maxY={100} zRange={300} />

      {/* Rocky mountain ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -D / 2 + 5]}>
        <planeGeometry args={[HW * 2, D + 15]} />
        <meshStandardMaterial color="#0f0d12" roughness={0.98} />
      </mesh>
      {/* Ground terrain bumps */}
      {terrain.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]}>
          <boxGeometry args={[t.s * 1.5, t.h, t.s]} />
          <meshStandardMaterial color="#181520" roughness={0.99} />
        </mesh>
      ))}

      {/* Distant ground extending beyond room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -200]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0a0810" roughness={0.99} />
      </mesh>

      {/* Mountain peaks */}
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* Main peak body */}
          <mesh position={[0, p.h / 2, 0]}>
            <coneGeometry args={[p.w, p.h, 5]} />
            <meshStandardMaterial color="#12101a" roughness={0.96} />
          </mesh>
          {/* Snow cap */}
          <mesh position={[0, p.h * 0.82, 0]}>
            <coneGeometry args={[p.w * 0.22, p.h * 0.22, 5]} />
            <meshStandardMaterial color="#dde0ea" roughness={0.88} />
          </mesh>
          {/* Mid snow patches */}
          <mesh position={[p.w * 0.12, p.h * 0.62, 0]}>
            <coneGeometry args={[p.w * 0.1, p.h * 0.1, 4]} />
            <meshStandardMaterial color="#c8ccd8" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Side mountain walls */}
      {[[-HW - 5, -D / 2], [HW + 5, -D / 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 10, z]}>
          <boxGeometry args={[14, 22, D + 40]} />
          <meshStandardMaterial color="#0c0a14" roughness={0.97} />
        </mesh>
      ))}

      {/* Pine trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={[t.s, t.s, t.s]}>
          {/* Trunk */}
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.17, 0.22, 1.7, 6]} />
            <meshStandardMaterial color="#1a0e06" roughness={0.96} />
          </mesh>
          {/* Lower cone */}
          <mesh position={[0, 2.4, 0]}>
            <coneGeometry args={[1.15, 2.4, 7]} />
            <meshStandardMaterial color="#071a0c" roughness={0.93} />
          </mesh>
          {/* Mid cone */}
          <mesh position={[0, 3.45, 0]}>
            <coneGeometry args={[0.85, 2.0, 7]} />
            <meshStandardMaterial color="#081e0d" roughness={0.93} />
          </mesh>
          {/* Top cone */}
          <mesh position={[0, 4.3, 0]}>
            <coneGeometry args={[0.56, 1.6, 7]} />
            <meshStandardMaterial color="#0a2010" roughness={0.93} />
          </mesh>
          {/* Snow on top */}
          <mesh position={[0, 5.1, 0]}>
            <coneGeometry args={[0.28, 0.5, 7]} />
            <meshStandardMaterial color="#cdd0dc" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Mist layer at base of mountains */}
      <mesh position={[0, 4, -110]}>
        <boxGeometry args={[300, 8, 30]} />
        <meshStandardMaterial color="#080c18" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      <Terminal color="#00ffcc" label="> PROJECTS.DAT" isNear={isNearTerminal} />
      <ExitPortal isNear={isNearExit} />
    </group>
  );
}

// ── Room 4: THE ORACLE'S KITCHEN (Contact) ─────────────────────────────────────
function OracleRoom({ isNearTerminal, isNearExit }) {
  const candleRef1 = useRef(), candleRef2 = useRef(), candleRef3 = useRef();
  const ovenRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Candle flicker
    [candleRef1, candleRef2, candleRef3].forEach((ref, i) => {
      if (ref.current) ref.current.intensity = 2.8 + Math.sin(t * (12 + i * 7) + i) * 0.4 + Math.sin(t * (31 + i * 5)) * 0.3;
    });
    // Oven glow pulse
    if (ovenRef.current) ovenRef.current.material.emissiveIntensity = 2 + Math.sin(t * 0.8) * 0.6;
  });

  // Wall artwork frames
  const frames = useMemo(() => [
    { x: -(HW - 0.15), y: 4.5, z: -12, w: 2.2, h: 1.8 },
    { x: -(HW - 0.15), y: 5.0, z: -22, w: 1.6, h: 2.0 },
    { x:   HW - 0.15,  y: 4.2, z: -10, w: 1.8, h: 2.2 },
    { x:   HW - 0.15,  y: 5.5, z: -24, w: 3.0, h: 1.4 },
  ], []);

  return (
    <group>
      <color attach="background" args={['#120800']} />
      <fog   attach="fog"        args={['#120800', 18, 70]} />
      <ambientLight color="#4a2810" intensity={1.4} />
      {/* Warm room fill */}
      <hemisphereLight skyColor="#5a3018" groundColor="#1a0a02" intensity={0.9} />

      {/* Main ceiling lights — flicker via refs */}
      <pointLight ref={candleRef1} color="#ff9933" intensity={5.5} position={[0, 9, -14]} distance={35} decay={2} />
      <pointLight ref={candleRef2} color="#ffbb55" intensity={4.0} position={[-3, 6, -24]} distance={28} decay={2} />
      <pointLight ref={candleRef3} color="#ff8822" intensity={3.5} position={[ 4, 5, -18]} distance={26} decay={2} />
      {/* Back room fill */}
      <pointLight color="#cc7722" intensity={2.5} position={[0, 4, -40]} distance={30} decay={2} />

      {/* Warm wood floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -D / 2 + 5]}>
        <planeGeometry args={[HW * 2, D + 10]} />
        <meshStandardMaterial color="#2c1508" roughness={0.88} />
      </mesh>
      {/* Floor boards */}
      {[-3, -1, 1, 3].map(fx => (
        <mesh key={fx} rotation={[-Math.PI / 2, 0, 0]} position={[fx, 0.003, -D / 2 + 5]}>
          <planeGeometry args={[0.02, D + 10]} />
          <meshStandardMaterial color="#1e0e04" roughness={0.9} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Walls */}
      {[[-HW, H / 2, -D / 2 + 5], [HW, H / 2, -D / 2 + 5]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.22, H + 0.3, D + 10]} />
          <meshStandardMaterial color="#1e0f06" roughness={0.94} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, -D / 2 + 5]}>
        <planeGeometry args={[HW * 2, D + 10]} />
        <meshStandardMaterial color="#150a04" roughness={0.97} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, H / 2, -(D - 5)]}>
        <boxGeometry args={[HW * 2 + 0.5, H + 0.3, 0.3]} />
        <meshStandardMaterial color="#1e0f06" />
      </mesh>

      {/* Wall art frames */}
      {frames.map((f, i) => (
        <group key={i} position={[f.x, f.y, f.z]}>
          <mesh>
            <boxGeometry args={[f.w + 0.2, f.h + 0.2, 0.07]} />
            <meshStandardMaterial color="#3a1e0a" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[f.w, f.h, 0.04]} />
            <meshStandardMaterial color="#2a1508" roughness={0.9} emissive="#ff6600" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}

      {/* Kitchen counter left side */}
      <group position={[-(HW - 1.6), 0, -7]}>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[2.8, 0.12, 1.0]} />
          <meshStandardMaterial color="#3a2010" roughness={0.65} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[2.6, 0.9, 0.95]} />
          <meshStandardMaterial color="#281508" roughness={0.8} />
        </mesh>
        {/* Oven */}
        <mesh ref={ovenRef} position={[0, 0.45, 0.45]}>
          <boxGeometry args={[0.6, 0.55, 0.08]} />
          <meshStandardMaterial color="#ff3300" emissive="#ff2200" emissiveIntensity={2} />
        </mesh>
        <pointLight color="#ff4400" intensity={2} distance={5} position={[0, 1.2, 0.8]} />
      </group>

      {/* Shelf above counter */}
      <group position={[-(HW - 1.6), 4.5, -7.5]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.8, 0.08, 0.5]} />
          <meshStandardMaterial color="#3a2010" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* Jars/bottles on shelf */}
        {[-0.8, 0, 0.8].map((jx, i) => (
          <mesh key={i} position={[jx, 0.25, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.5, 8]} />
            <meshStandardMaterial color={['#c0a820', '#1a4a22', '#8a1a08'][i]} roughness={0.3} metalness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Round dining table */}
      <group position={[1.5, 0, -22]}>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[1.55, 1.55, 0.1, 20]} />
          <meshStandardMaterial color="#3a1a08" roughness={0.65} metalness={0.08} />
        </mesh>
        {/* Table leg */}
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.1, 0.14, 0.76, 8]} />
          <meshStandardMaterial color="#1e0e04" roughness={0.5} />
        </mesh>
        {/* Plate with cookies */}
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.04, 16]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.5} />
        </mesh>
        {[[-0.25, 0.89, -0.12], [0.22, 0.89, 0.08], [0.02, 0.89, 0.28], [-0.18, 0.89, 0.22]].map(([cx, cy, cz], i) => (
          <mesh key={i} position={[cx, cy, cz]}>
            <cylinderGeometry args={[0.11, 0.11, 0.06, 10]} />
            <meshStandardMaterial color="#7a4018" roughness={0.95} />
          </mesh>
        ))}
        {/* Tea cups */}
        {[[-1.0, 0.86, 0.4], [0.8, 0.86, -0.6]].map(([cx, cy, cz], i) => (
          <mesh key={i} position={[cx, cy, cz]}>
            <cylinderGeometry args={[0.12, 0.1, 0.22, 8]} />
            <meshStandardMaterial color="#f0ede0" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Chairs around table */}
      {[[1.5 + 1.9, 0, -22], [1.5 - 1.9, 0, -22], [1.5, 0, -22 + 1.9], [1.5, 0, -22 - 1.9]].map(([cx, cy, cz], i) => (
        <group key={i} position={[cx, cy, cz]} rotation={[0, (i * Math.PI / 2), 0]}>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[0.62, 0.09, 0.62]} />
            <meshStandardMaterial color="#2a1208" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.95, -0.28]}>
            <boxGeometry args={[0.62, 0.88, 0.1]} />
            <meshStandardMaterial color="#2a1208" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Sunlight streaming through window */}
      <mesh position={[HW - 0.12, 5.5, -10]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.0, 2.5]} />
        <meshStandardMaterial color="#ffee99" emissive="#ffee99" emissiveIntensity={2.2}
          transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#ffdd88" intensity={4} distance={20} position={[HW - 0.6, 5.5, -10]} />

      {/* Window on right side further down */}
      <mesh position={[HW - 0.12, 4.5, -28]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 2.0]} />
        <meshStandardMaterial color="#ffe8aa" emissive="#ffe8aa" emissiveIntensity={1.8}
          transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Hanging light bulb */}
      <group position={[0, 7.8, -14]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
          <meshStandardMaterial color="#1a0a02" roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color="#fff8e0" emissive="#fff8e0" emissiveIntensity={3.5} />
        </mesh>
        <pointLight position={[0, -0.75, 0]} color="#ffcc66" intensity={5} distance={16} decay={2} />
      </group>

      <Terminal color="#ffaa44" label="> oracle@matrix:~$" isNear={isNearTerminal} />
      <ExitPortal isNear={isNearExit} />
    </group>
  );
}

// ── Proximity checker ─────────────────────────────────────────────────────────
const EXIT_NEAR = 6.0; // show "EXIT" text when this close

function RoomProximity({ playerPosRef, onNearTerminal, onNearExit, onExitReached }) {
  const nearTermRef = useRef(false);
  const nearExitRef = useRef(false);
  const exitDoneRef = useRef(false);

  useFrame(() => {
    const p   = playerPosRef.current;

    // Terminal proximity
    const dzt  = Math.abs(p.z - TZ);
    const dxt  = Math.abs(p.x);
    const near = dzt < TERM_TRIGGER && dxt < HW - 0.5;
    if (near !== nearTermRef.current) {
      nearTermRef.current = near;
      onNearTerminal(near);
    }

    // Exit proximity
    const dze   = Math.abs(p.z - EZ);
    const nearE = dze < EXIT_NEAR;
    if (nearE !== nearExitRef.current) {
      nearExitRef.current = nearE;
      onNearExit(nearE);
    }

    // Auto-exit
    if (!exitDoneRef.current && p.z < EZ - EXIT_TRIGGER) {
      exitDoneRef.current = true;
      onExitReached();
    }
  });
  return null;
}

// ── Room map ──────────────────────────────────────────────────────────────────
const ROOM_MAP = {
  about:     OceanRoom,
  resume:    CityStreetRoom,
  portfolio: MountainRoom,
  contact:   OracleRoom,
};

export default function MatrixRoom({ roomId, playerPosRef, isNearTerminal, isNearExit, onNearTerminal, onNearExit, onExitReached }) {
  const Component = ROOM_MAP[roomId];
  if (!Component) return null;
  return (
    <>
      <Component isNearTerminal={isNearTerminal} isNearExit={isNearExit} />
      <RoomProximity
        playerPosRef={playerPosRef}
        onNearTerminal={onNearTerminal}
        onNearExit={onNearExit ?? (() => {})}
        onExitReached={onExitReached}
      />
    </>
  );
}
