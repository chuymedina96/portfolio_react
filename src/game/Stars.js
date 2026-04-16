import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_COUNT = 4000;

export default function Stars() {
  const meshRef = useRef();

  // Build instanced positions once
  const { positions, scales } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const scales    = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 400 + Math.random() * 1600;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      scales[i] = 0.3 + Math.random() * 1.4;
    }
    return { positions, scales };
  }, []);

  // Slowly rotate the star field for a living feel
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.005;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={STAR_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#b8d0ff"
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
