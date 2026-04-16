import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

const DW = 2.6;   // door width
const DH = 5.8;   // door height
const FT = 0.18;  // frame thickness

const LOCK_RED = '#ff2200';

export default function MatrixDoor({ position, color, label, sublabel, side, isActive, locked }) {
  const frameRef = useRef();
  const surfRef  = useRef();
  const glowRef  = useRef();
  const lockRef  = useRef();

  useFrame(({ clock }) => {
    const t  = clock.elapsedTime;
    const hz = isActive ? (locked ? 8 : 3.2) : 1.1;
    const p  = 0.5 + 0.5 * Math.sin(t * hz);

    if (frameRef.current) {
      frameRef.current.traverse(c => {
        if (c.isMesh && c.material) {
          c.material.emissiveIntensity = (isActive ? 5 : 1.8) + p * (isActive ? 3 : 1.2);
        }
      });
    }
    if (surfRef.current) {
      surfRef.current.material.emissiveIntensity = (isActive ? (locked ? 0.55 : 1.0) : 0.28) + p * 0.22;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (isActive ? 0.18 : 0.06) + p * (isActive ? 0.1 : 0.03);
    }
    // Lock body pulsing red
    if (lockRef.current) {
      lockRef.current.traverse(c => {
        if (c.isMesh && c.material?.emissive) {
          c.material.emissiveIntensity = 3 + p * (isActive ? 5 : 2);
        }
      });
    }
  });

  const pos    = [position.x, position.y, position.z];
  const rotY   = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  const c      = locked ? LOCK_RED : color;

  return (
    <group position={pos} rotation={[0, rotY, 0]}>

      {/* Door frame */}
      <group ref={frameRef}>
        <mesh position={[0,  DH / 2 + FT / 2, 0]}>
          <boxGeometry args={[DW + FT * 2, FT, 0.38]} />
          <meshStandardMaterial color="#040f04" emissive={c} emissiveIntensity={2} />
        </mesh>
        <mesh position={[0, -DH / 2 - FT / 2, 0]}>
          <boxGeometry args={[DW + FT * 2, FT, 0.38]} />
          <meshStandardMaterial color="#040f04" emissive={c} emissiveIntensity={2} />
        </mesh>
        <mesh position={[-DW / 2 - FT / 2, 0, 0]}>
          <boxGeometry args={[FT, DH + FT * 2, 0.38]} />
          <meshStandardMaterial color="#040f04" emissive={c} emissiveIntensity={2} />
        </mesh>
        <mesh position={[DW / 2 + FT / 2, 0, 0]}>
          <boxGeometry args={[FT, DH + FT * 2, 0.38]} />
          <meshStandardMaterial color="#040f04" emissive={c} emissiveIntensity={2} />
        </mesh>
        {/* Inner glow edges */}
        {[[0, DH/2, 0, [DW, 0.04, 0.04]], [0, -DH/2, 0, [DW, 0.04, 0.04]],
          [-DW/2, 0, 0, [0.04, DH, 0.04]], [DW/2, 0, 0, [0.04, DH, 0.04]]].map(([px, py, pz, dims], i) => (
          <mesh key={i} position={[px, py, 0.2]}>
            <boxGeometry args={dims} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={5} />
          </mesh>
        ))}
      </group>

      {/* Door surface */}
      <mesh ref={surfRef} position={[0, 0, 0.1]}>
        <boxGeometry args={[DW, DH, 0.1]} />
        <meshStandardMaterial
          color={locked ? '#0f0000' : '#020c03'}
          emissive={c}
          emissiveIntensity={0.28}
          roughness={0.55}
          metalness={0.35}
        />
      </mesh>

      {/* Padlock for locked doors */}
      {locked && (
        <group ref={lockRef} position={[0, 0.4, 0.22]}>
          {/* Shackle (U shape) */}
          <mesh position={[0, 0.38, 0]}>
            <torusGeometry args={[0.22, 0.055, 8, 12, Math.PI]} />
            <meshStandardMaterial color={LOCK_RED} emissive={LOCK_RED} emissiveIntensity={3} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Body */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.55, 0.45, 0.12]} />
            <meshStandardMaterial color="#1a0000" emissive={LOCK_RED} emissiveIntensity={3} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Keyhole */}
          <mesh position={[0, -0.02, 0.065]}>
            <circleGeometry args={[0.07, 8]} />
            <meshStandardMaterial color="#000000" emissive={LOCK_RED} emissiveIntensity={1} />
          </mesh>
        </group>
      )}

      {/* Handle (only on unlocked) */}
      {!locked && (
        <mesh position={[DW / 2 - 0.36, -0.18, 0.22]}>
          <cylinderGeometry args={[0.038, 0.038, 0.42, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} metalness={0.85} roughness={0.15} />
        </mesh>
      )}

      {/* Glow volume */}
      <mesh ref={glowRef}>
        <boxGeometry args={[DW + 1.8, DH + 1.8, 1.6]} />
        <meshStandardMaterial
          color={c} emissive={c} emissiveIntensity={0.35}
          transparent opacity={0.06} depthWrite={false} side={THREE.BackSide}
        />
      </mesh>

      {/* Point light */}
      <pointLight color={c} intensity={isActive ? 14 : 5} distance={20} position={[0, 0, 2.5]} />

      {/* Labels */}
      <Billboard follow>
        <Text
          position={[0, DH / 2 + 1.05, 0]}
          fontSize={0.52}
          color={c}
          anchorX="center" anchorY="middle"
          outlineWidth={0.022} outlineColor="#000"
          letterSpacing={0.07}
        >
          {label}
        </Text>
        <Text
          position={[0, DH / 2 + 0.45, 0]}
          fontSize={0.36}
          color={locked ? 'rgba(255,100,100,0.85)' : 'rgba(200,255,200,0.72)'}
          anchorX="center" anchorY="middle"
          letterSpacing={0.04}
        >
          {sublabel}
        </Text>
        {isActive && !locked && (
          <Text
            position={[0, -DH / 2 - 0.95, 0]}
            fontSize={0.4}
            color={color}
            anchorX="center" anchorY="middle"
            letterSpacing={0.06}
          >
            {'[ E ]  ENTER'}
          </Text>
        )}
        {isActive && locked && (
          <Text
            position={[0, -DH / 2 - 0.95, 0]}
            fontSize={0.38}
            color={LOCK_RED}
            anchorX="center" anchorY="middle"
            letterSpacing={0.06}
          >
            {'[ LOCKED ]'}
          </Text>
        )}
      </Billboard>

    </group>
  );
}
