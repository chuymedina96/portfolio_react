import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// ── Docking lights that blink around the perimeter ───────────────────────────
const DockingLights = ({ color, radius = 12, count = 12 }) => {
  const lightsRef = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lightsRef.current.forEach((m, i) => {
      if (!m) return;
      const phase  = (i / count) * Math.PI * 2;
      const bright = 0.5 + 0.5 * Math.sin(t * 3 + phase);
      m.material.emissiveIntensity = bright * 3;
      m.material.opacity = 0.5 + bright * 0.5;
    });
  });

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={el => (lightsRef.current[i] = el)}
            position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}
          >
            <sphereGeometry args={[0.22, 6, 6]} />
            <meshStandardMaterial
              color={color} emissive={color} emissiveIntensity={2}
              transparent opacity={0.9}
            />
          </mesh>
        );
      })}
    </>
  );
};

// ── Main station component ────────────────────────────────────────────────────
export default function Station({ id, position, label, sublabel, color = '#00d4ff', isActive }) {
  const outerRingRef = useRef();
  const innerRingRef = useRef();
  const tiltRingRef  = useRef();
  const coreRef      = useRef();
  const armRef       = useRef();
  const glowRef      = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (outerRingRef.current) outerRingRef.current.rotation.z = t * 0.3;
    if (innerRingRef.current) innerRingRef.current.rotation.z = -t * 0.5;
    if (tiltRingRef.current)  tiltRingRef.current.rotation.x  = t * 0.2;
    if (coreRef.current) {
      const pulse = isActive
        ? 1.0 + Math.sin(t * 5) * 0.12
        : 0.8 + Math.sin(t * 1.5) * 0.05;
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.material.emissiveIntensity = isActive ? 3 + Math.sin(t * 5) * 1.5 : 1.5;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (isActive ? 0.12 : 0.06) + Math.sin(t * 1.2) * 0.03;
    }
    // Arms slowly rotate around Y
    if (armRef.current) armRef.current.rotation.y = t * 0.15;
  });

  return (
    <group position={position.toArray()}>

      {/* Station ambient light */}
      <pointLight color={color} intensity={isActive ? 10 : 4} distance={120} />

      {/* ── Large glow sphere ── */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[22, 12, 12]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={0.3}
          transparent opacity={0.07} depthWrite={false} side={THREE.BackSide}
        />
      </mesh>

      {/* ── Outer docking ring ── */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[12, 0.5, 16, 90]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={isActive ? 3.5 : 1.8}
          roughness={0.1} metalness={0.95}
        />
      </mesh>

      {/* ── Inner ring (spins opposite) ── */}
      <mesh ref={innerRingRef}>
        <torusGeometry args={[8, 0.28, 12, 72]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={isActive ? 2.5 : 1.2}
          roughness={0.15} metalness={0.9} transparent opacity={0.85}
        />
      </mesh>

      {/* ── Tilted orbital ring (like a gyroscope) ── */}
      <mesh ref={tiltRingRef} rotation={[Math.PI * 0.4, 0.3, 0]}>
        <torusGeometry args={[10, 0.18, 10, 60]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={1}
          roughness={0.2} metalness={0.85} transparent opacity={0.55}
        />
      </mesh>

      {/* ── Central core sphere ── */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[2.8, 20, 20]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={1.5}
          roughness={0.1} metalness={0.8}
        />
      </mesh>

      {/* Core wireframe overlay */}
      <mesh>
        <sphereGeometry args={[2.85, 8, 8]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={0.8}
          wireframe transparent opacity={0.35}
        />
      </mesh>

      {/* ── Docking arms (4 radial spokes) ── */}
      <group ref={armRef}>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh position={[8, 0, 0]}>
                <boxGeometry args={[10, 0.25, 0.25]} />
                <meshStandardMaterial
                  color={color} emissive={color} emissiveIntensity={0.6}
                  roughness={0.3} metalness={0.9}
                />
              </mesh>
              {/* Docking pad at end of arm */}
              <mesh position={[13.5, 0, 0]}>
                <boxGeometry args={[1.5, 0.6, 1.5]} />
                <meshStandardMaterial
                  color="#112244" emissive={color} emissiveIntensity={0.4}
                  roughness={0.4} metalness={0.8}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ── Docking lights around perimeter ── */}
      <DockingLights color={color} radius={12} count={16} />

      {/* ── Labels (always face camera) ── */}
      <Billboard follow>
        {/* Section number marker */}
        <mesh position={[0, 18, 0]}>
          <planeGeometry args={[12, 3.5]} />
          <meshStandardMaterial
            color="#000820" emissive={color} emissiveIntensity={0.15}
            transparent opacity={0.7}
          />
        </mesh>

        <Text
          position={[0, 18.4, 0.02]}
          fontSize={2.2}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000010"
          letterSpacing={0.08}
        >
          {label}
        </Text>
        <Text
          position={[0, 16.2, 0.02]}
          fontSize={1.05}
          color="rgba(180,210,255,0.75)"
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>

        {/* Dock prompt — only shows when player is close */}
        {isActive && (
          <Text
            position={[0, -17, 0]}
            fontSize={1.0}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            ▶ PRESS E TO DOCK
          </Text>
        )}
      </Billboard>

    </group>
  );
}
