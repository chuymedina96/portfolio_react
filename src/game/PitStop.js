import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

const GATE_WIDTH  = 22;
const GATE_HEIGHT = 12;

export default function PitStop({ id, position, label, sublabel, color = '#00d4ff', isActive }) {
  const signRef   = useRef();
  const glowRef   = useRef();
  const beaconRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (signRef.current) {
      signRef.current.material.emissiveIntensity = (isActive ? 1.8 : 0.9) + Math.sin(t * 2) * 0.3;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (isActive ? 0.18 : 0.08) + Math.sin(t * 1.5) * 0.04;
    }
    if (beaconRef.current) {
      const scale = 1 + Math.sin(t * 4) * 0.12;
      beaconRef.current.scale.setScalar(scale);
      beaconRef.current.material.emissiveIntensity = 3 + Math.sin(t * 4) * 1.5;
    }
  });

  const pos = position.toArray();

  return (
    <group position={pos}>

      {/* Station ambient light */}
      <pointLight color={color} intensity={isActive ? 12 : 5} distance={80} />

      {/* ── Gate arch (overhead structure spanning the road) ── */}
      {/* Left pillar */}
      <mesh position={[-(GATE_WIDTH / 2), GATE_HEIGHT / 2, 0]}>
        <boxGeometry args={[1.2, GATE_HEIGHT, 1.2]} />
        <meshStandardMaterial color="#0c1230" emissive={color}
          emissiveIntensity={0.5} roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Right pillar */}
      <mesh position={[(GATE_WIDTH / 2), GATE_HEIGHT / 2, 0]}>
        <boxGeometry args={[1.2, GATE_HEIGHT, 1.2]} />
        <meshStandardMaterial color="#0c1230" emissive={color}
          emissiveIntensity={0.5} roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Top beam */}
      <mesh position={[0, GATE_HEIGHT, 0]}>
        <boxGeometry args={[GATE_WIDTH + 1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="#0c1230" emissive={color}
          emissiveIntensity={0.6} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* ── Neon edge strips on gate ── */}
      {/* Left edge */}
      <mesh position={[-(GATE_WIDTH / 2) - 0.65, GATE_HEIGHT / 2, 0.65]}>
        <boxGeometry args={[0.08, GATE_HEIGHT, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
      </mesh>
      {/* Right edge */}
      <mesh position={[(GATE_WIDTH / 2) + 0.65, GATE_HEIGHT / 2, 0.65]}>
        <boxGeometry args={[0.08, GATE_HEIGHT, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
      </mesh>
      {/* Top edge */}
      <mesh position={[0, GATE_HEIGHT + 0.65, 0.65]}>
        <boxGeometry args={[GATE_WIDTH + 2.5, 0.08, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
      </mesh>

      {/* ── Sign panel on top beam ── */}
      <mesh ref={signRef} position={[0, GATE_HEIGHT + 2.2, 0]}>
        <boxGeometry args={[16, 3.5, 0.25]} />
        <meshStandardMaterial color="#060818" emissive={color} emissiveIntensity={0.9}
          roughness={0.5} metalness={0.4} />
      </mesh>

      {/* ── Glow volume around gate ── */}
      <mesh ref={glowRef} position={[0, GATE_HEIGHT / 2, 0]}>
        <boxGeometry args={[GATE_WIDTH + 6, GATE_HEIGHT + 6, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3}
          transparent opacity={0.08} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      {/* ── Ground glow strip (road surface illumination) ── */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GATE_WIDTH - 2, 8]} />
        <meshStandardMaterial color={color} emissive={color}
          emissiveIntensity={isActive ? 2 : 1} transparent opacity={0.25}
          depthWrite={false} />
      </mesh>

      {/* ── Pulsing beacon on top ── */}
      <mesh ref={beaconRef} position={[0, GATE_HEIGHT + 4.5, 0]}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>

      {/* ── Billboard labels ── */}
      <Billboard follow>
        <Text
          position={[0, GATE_HEIGHT + 2.3, 0.5]}
          fontSize={1.9}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#000010"
          letterSpacing={0.1}
        >
          {label}
        </Text>
        <Text
          position={[0, GATE_HEIGHT + 0.8, 0.5]}
          fontSize={1.0}
          color="rgba(180,210,255,0.75)"
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>
        {isActive && (
          <Text
            position={[0, -3, 0]}
            fontSize={1.0}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            ▶ PRESS E TO ENTER PIT STOP
          </Text>
        )}
      </Billboard>

      {/* ── Distance markers (chevrons on road) ── */}
      {[20, 40, 65].map(dz => (
        <mesh key={dz} position={[0, 0.05, dz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[GATE_WIDTH * 0.8, 1.2]} />
          <meshStandardMaterial color={color} emissive={color}
            emissiveIntensity={1.5 - dz / 60}
            transparent opacity={0.35 - dz / 200} depthWrite={false} />
        </mesh>
      ))}

    </group>
  );
}
