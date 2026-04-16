import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATIONS } from './constants';

// Small blinking waypoint beacons along the path between stations
const origin = new THREE.Vector3(0, 0, 0);

function lerp3(a, b, t) {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

// Build beacon positions: 4 evenly-spaced points between each pair
function buildBeaconPositions() {
  const waypoints = [origin, ...STATIONS.map(s => s.position)];
  const positions = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (let t = 0.15; t < 1; t += 0.22) {
      positions.push({ pos: lerp3(waypoints[i], waypoints[i + 1], t), idx: i });
    }
  }
  return positions;
}

const BEACONS = buildBeaconPositions();
const COLORS  = ['#00d4ff', '#9b5fff', '#00ff9d', '#ff6b35'];

export default function RouteBeacons() {
  const refs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const b = BEACONS[i];
      const phase = (i * 0.4) + t * 1.8;
      const bright = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase));
      m.material.emissiveIntensity = bright * 3;
      m.material.opacity = 0.35 + bright * 0.45;
    });
  });

  return (
    <>
      {BEACONS.map((b, i) => (
        <mesh
          key={i}
          ref={el => (refs.current[i] = el)}
          position={b.pos.toArray()}
        >
          <octahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            color={COLORS[b.idx % COLORS.length]}
            emissive={COLORS[b.idx % COLORS.length]}
            emissiveIntensity={2}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </>
  );
}
