import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

const DW = 2.6;
const DH = 5.8;
const FT = 0.18;
const LOCK_RED = '#ff2200';

export default function MatrixDoor({ position, color, label, sublabel, side, isActive, locked }) {
  // Store material refs directly — no traverse() needed every frame
  const edgeMatsRef = useRef([]);
  const surfMatRef  = useRef();
  const glowMatRef  = useRef();
  const lockMatsRef = useRef([]);
  const frameCount  = useRef(0);

  useFrame(({ clock }) => {
    // Inactive non-locked doors: slow pulse at 10 Hz — no need for 60 Hz
    // Active doors: full rate. Locked inactive: 10 Hz flicker.
    frameCount.current++;
    const skip = isActive ? 1 : 4;
    if (frameCount.current % skip !== 0) return;

    const t  = clock.elapsedTime;
    const hz = isActive ? (locked ? 8 : 3.2) : 1.1;
    const p  = 0.5 + 0.5 * Math.sin(t * hz);

    const edgeIntensity = (isActive ? 5 : 1.8) + p * (isActive ? 3 : 1.2);
    edgeMatsRef.current.forEach(m => { if (m) m.emissiveIntensity = edgeIntensity; });

    if (surfMatRef.current) {
      surfMatRef.current.emissiveIntensity = (isActive ? (locked ? 0.55 : 1.0) : 0.28) + p * 0.22;
    }
    if (glowMatRef.current) {
      glowMatRef.current.opacity = (isActive ? 0.18 : 0.06) + p * (isActive ? 0.1 : 0.03);
    }
    if (locked) {
      const lockInt = 3 + p * (isActive ? 5 : 2);
      lockMatsRef.current.forEach(m => { if (m?.emissive) m.emissiveIntensity = lockInt; });
    }
  });

  const pos  = [position.x, position.y, position.z];
  const rotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  const c    = locked ? LOCK_RED : color;

  return (
    <group position={pos} rotation={[0, rotY, 0]}>

      {/* Door frame — 4 border slabs */}
      <mesh position={[0, DH / 2 + FT / 2, 0]}>
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

      {/* Inner glow edges — direct material refs, no traverse */}
      {[[0, DH/2, [DW, 0.04, 0.04]], [0, -DH/2, [DW, 0.04, 0.04]],
        [-DW/2, 0, [0.04, DH, 0.04]], [DW/2, 0, [0.04, DH, 0.04]]].map(([px, py, dims], i) => (
        <mesh key={i} position={[px, py, 0.2]}>
          <boxGeometry args={dims} />
          <meshStandardMaterial ref={el => { edgeMatsRef.current[i] = el; }}
            color={c} emissive={c} emissiveIntensity={2} />
        </mesh>
      ))}

      {/* Door surface */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[DW, DH, 0.1]} />
        <meshStandardMaterial ref={surfMatRef}
          color={locked ? '#0f0000' : '#020c03'}
          emissive={c} emissiveIntensity={0.28}
          roughness={0.55} metalness={0.35}
        />
      </mesh>

      {/* Padlock */}
      {locked && (
        <group position={[0, 0.4, 0.22]}>
          <mesh position={[0, 0.38, 0]}>
            <torusGeometry args={[0.22, 0.055, 8, 10, Math.PI]} />
            <meshStandardMaterial ref={el => { lockMatsRef.current[0] = el; }}
              color={LOCK_RED} emissive={LOCK_RED} emissiveIntensity={3}
              metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.55, 0.45, 0.12]} />
            <meshStandardMaterial ref={el => { lockMatsRef.current[1] = el; }}
              color="#1a0000" emissive={LOCK_RED} emissiveIntensity={3}
              metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.02, 0.065]}>
            <circleGeometry args={[0.07, 8]} />
            <meshStandardMaterial color="#000000" emissive={LOCK_RED} emissiveIntensity={1} />
          </mesh>
        </group>
      )}

      {/* Handle */}
      {!locked && (
        <mesh position={[DW / 2 - 0.36, -0.18, 0.22]}>
          <cylinderGeometry args={[0.038, 0.038, 0.42, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5}
            metalness={0.85} roughness={0.15} />
        </mesh>
      )}

      {/* Glow volume */}
      <mesh>
        <boxGeometry args={[DW + 1.8, DH + 1.8, 1.6]} />
        <meshStandardMaterial ref={glowMatRef}
          color={c} emissive={c} emissiveIntensity={0.35}
          transparent opacity={0.06} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      {/* One point light per door — static intensity based on isActive prop */}
      <pointLight color={c} intensity={isActive ? 14 : 4}
        distance={18} position={[0, 0, 2.5]} />

      {/* ── Labels — on the door face at eye level ───────────────────────────
           Door group center = world y 2.9.
           Local y=1.1  → world y≈4.0  (upper panel)
           Local y=0.0  → world y≈2.9  (eye level)
           Local y=-1.1 → world y≈1.8  (lower panel, still in view)
           Text lives at z=0.35 so it floats visibly in front of the door face.
           Dark backing plate provides contrast against the bright corridor walls.
      ─────────────────────────────────────────────────────────────────────── */}
      <group position={[0, 0, 0.35]}>
        {/* Dark backdrop for contrast — sized to contain all text */}
        <mesh position={[0, 0, -0.04]}>
          <planeGeometry args={[DW - 0.1, 2.8]} />
          <meshStandardMaterial color="#000000" transparent opacity={0.72} depthWrite={false} />
        </mesh>

        {/* Thin colour divider line */}
        <mesh position={[0, 0.62, -0.02]}>
          <planeGeometry args={[DW - 0.4, 0.025]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={3} />
        </mesh>

        <Billboard follow={false}>
          {/* Main label — large, always visible */}
          <Text
            position={[0, 1.05, 0]}
            fontSize={0.54}
            color={c}
            anchorX="center" anchorY="middle"
            outlineWidth={0.032} outlineColor="#000000"
            letterSpacing={0.06}
            maxWidth={DW - 0.2}
          >
            {label}
          </Text>

          {/* Sublabel */}
          <Text
            position={[0, 0.35, 0]}
            fontSize={0.38}
            color={locked ? '#ff8888' : 'rgba(220,255,220,0.9)'}
            anchorX="center" anchorY="middle"
            outlineWidth={0.024} outlineColor="#000000"
            letterSpacing={0.04}
          >
            {sublabel}
          </Text>

          {/* Action / status prompt — always shown so player always knows state */}
          <Text
            position={[0, -0.55, 0]}
            fontSize={0.42}
            color={isActive ? (locked ? '#ff3300' : color) : 'rgba(180,180,180,0.6)'}
            anchorX="center" anchorY="middle"
            outlineWidth={0.026} outlineColor="#000000"
            letterSpacing={0.07}
          >
            {isActive
              ? (locked ? '[ LOCKED ]' : '[ E ]  ENTER')
              : (locked ? 'ACCESS DENIED' : sublabel.toUpperCase())}
          </Text>
        </Billboard>
      </group>

    </group>
  );
}
