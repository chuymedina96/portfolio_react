import React, { useMemo } from 'react';
import * as THREE from 'three';

const CLOUD_COUNT = 18;

export default function Nebula() {
  const clouds = useMemo(() => {
    return Array.from({ length: CLOUD_COUNT }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 600,
        (Math.random() - 0.5) * 1200,
      ],
      scale: 60 + Math.random() * 180,
      color: ['#0a2a6a', '#1a0a4a', '#0a3a4a', '#2a0a2a', '#0a1a4a'][i % 5],
      opacity: 0.04 + Math.random() * 0.06,
      rotation: Math.random() * Math.PI * 2,
    }));
  }, []);

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh
          key={i}
          position={c.position}
          rotation={[c.rotation, c.rotation * 0.5, 0]}
        >
          <sphereGeometry args={[c.scale, 8, 8]} />
          <meshStandardMaterial
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      ))}
    </group>
  );
}
