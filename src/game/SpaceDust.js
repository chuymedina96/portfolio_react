import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 800;
const SPREAD = 35;   // radius of dust cloud around ship
const STREAM = 60;   // Z-depth of the stream (how far ahead/behind)

// Gives a real sense of speed — particles fly past the camera
export default function SpaceDust() {
  const ref = useRef();

  // Random particle offsets in a cylinder around the forward axis
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds    = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * SPREAD;
      positions[i * 3]     = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      positions[i * 3 + 2] = (Math.random() - 0.5) * STREAM;
      speeds[i] = 0.4 + Math.random() * 0.6;
    }
    return { positions, speeds };
  }, []);

  const posArr = useRef(positions.slice());

  useFrame(({ camera }) => {
    if (!ref.current) return;
    const arr = posArr.current;
    const attr = ref.current.geometry.attributes.position;

    for (let i = 0; i < COUNT; i++) {
      // Move each particle along +Z (toward camera = flying past)
      arr[i * 3 + 2] += speeds[i] * 0.8;

      // Wrap — when it passes behind the camera, reset to front
      if (arr[i * 3 + 2] > STREAM / 2) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random() * SPREAD;
        arr[i * 3]     = Math.cos(angle) * radius;
        arr[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
        arr[i * 3 + 2] = -STREAM / 2;
      }
    }

    attr.array.set(arr);
    attr.needsUpdate = true;

    // Follow the camera so particles always surround the player
    ref.current.position.copy(camera.position);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={posArr.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#88aaff"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}
