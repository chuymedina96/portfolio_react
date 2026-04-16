import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ROAD_WIDTH   = 18;
const SEG_LENGTH   = 150;
const TOTAL_LENGTH = 1200;
const NUM_SEGS     = Math.ceil(TOTAL_LENGTH / SEG_LENGTH);

// Dashes on center line
const DASH_COUNT   = 8;
const DASH_LEN     = 6;

function RoadSegment({ z }) {
  return (
    <group position={[0, 0, z]}>
      {/* ── Road surface ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, SEG_LENGTH]} />
        <meshStandardMaterial color="#06080f" roughness={0.92} metalness={0.08} />
      </mesh>

      {/* ── Left neon edge ── */}
      <mesh position={[-(ROAD_WIDTH / 2), 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, SEG_LENGTH]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={3} />
      </mesh>
      {/* Gutter left */}
      <mesh position={[-(ROAD_WIDTH / 2) - 1.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, SEG_LENGTH]} />
        <meshStandardMaterial color="#030508" roughness={1} />
      </mesh>

      {/* ── Right neon edge ── */}
      <mesh position={[(ROAD_WIDTH / 2), 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, SEG_LENGTH]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={3} />
      </mesh>
      {/* Gutter right */}
      <mesh position={[(ROAD_WIDTH / 2) + 1.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, SEG_LENGTH]} />
        <meshStandardMaterial color="#030508" roughness={1} />
      </mesh>

      {/* ── Center dashes ── */}
      {Array.from({ length: DASH_COUNT }).map((_, i) => {
        const dz = -SEG_LENGTH / 2 + (i / DASH_COUNT) * SEG_LENGTH + SEG_LENGTH / (DASH_COUNT * 2);
        return (
          <mesh key={i} position={[0, 0.03, dz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, DASH_LEN]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff"
              emissiveIntensity={1.2} transparent opacity={0.45} />
          </mesh>
        );
      })}

      {/* ── Ambient road light (subtle glow from edge strips) ── */}
      <pointLight position={[-(ROAD_WIDTH / 2), 0.5, 0]} color="#00d4ff" intensity={0.8} distance={20} />
      <pointLight position={[ (ROAD_WIDTH / 2), 0.5, 0]} color="#00d4ff" intensity={0.8} distance={20} />
    </group>
  );
}

// Streetlamp poles on both sides every ~50 units
function StreetLamps({ z }) {
  const SPACING = 50;
  const count   = Math.floor(SEG_LENGTH / SPACING);
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const lz = -SEG_LENGTH / 2 + i * SPACING + 25;
        return [-(ROAD_WIDTH / 2 + 3), (ROAD_WIDTH / 2 + 3)].map((x, side) => (
          <group key={`${i}-${side}`} position={[x, 0, z + lz]}>
            {/* Pole */}
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 6, 6]} />
              <meshStandardMaterial color="#1a2040" roughness={0.5} metalness={0.8} />
            </mesh>
            {/* Arm */}
            <mesh position={[side === 0 ? 1.2 : -1.2, 6.2, 0]}
              rotation={[0, 0, side === 0 ? -0.4 : 0.4]}>
              <cylinderGeometry args={[0.06, 0.06, 2.6, 6]} />
              <meshStandardMaterial color="#1a2040" roughness={0.5} metalness={0.8} />
            </mesh>
            {/* Light head */}
            <mesh position={[side === 0 ? 2.1 : -2.1, 6.5, 0]}>
              <boxGeometry args={[0.5, 0.18, 0.5]} />
              <meshStandardMaterial color="#9b5fff" emissive="#9b5fff" emissiveIntensity={4} />
            </mesh>
            <pointLight
              position={[side === 0 ? 2.1 : -2.1, 6.2, 0]}
              color="#7b3fff" intensity={2.5} distance={22}
            />
          </group>
        ));
      })}
    </>
  );
}

export default function Road() {
  return (
    <group>
      {/* Ground plane extending into the distance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -TOTAL_LENGTH / 2]}>
        <planeGeometry args={[500, TOTAL_LENGTH + 200]} />
        <meshStandardMaterial color="#030408" roughness={1} />
      </mesh>

      {Array.from({ length: NUM_SEGS }).map((_, i) => {
        const z = -(i * SEG_LENGTH) - SEG_LENGTH / 2;
        return (
          <React.Fragment key={i}>
            <RoadSegment z={z} />
            <StreetLamps z={z} />
          </React.Fragment>
        );
      })}
    </group>
  );
}
