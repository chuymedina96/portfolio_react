import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls } from './useControls';
import { RACE_STATIONS, RACE_DOCK_DISTANCE } from './constants';

const BASE_SPEED  = 12;
const BOOST_SPEED = 28;
const SLOW_SPEED  = 2;
const STEER_RATE  = 1.4;   // how fast mouse steers
const STEER_LIMIT = 0.55;  // max steering angle (radians)
const CAM_LAG     = 6;

const _fwd    = new THREE.Vector3();
const _camOff = new THREE.Vector3();
const _camTgt = new THREE.Vector3();
const _look   = new THREE.Vector3();
const _yawE   = new THREE.Euler(0, 0, 0, 'YXZ');
const _yawQ   = new THREE.Quaternion();

// ── Car mesh ─────────────────────────────────────────────────────────────────
// Nose faces -Z (same as spaceship convention).
// Taillights / exhaust face +Z → visible from behind camera.
const CarMesh = () => {
  const wheelPositions = [
    [-1.85, 0, -2.1],  // front-left
    [ 1.85, 0, -2.1],  // front-right
    [-1.85, 0,  2.1],  // rear-left
    [ 1.85, 0,  2.1],  // rear-right
  ];

  return (
    <group>
      {/* ── Main chassis ── */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[3.4, 0.45, 6.8]} />
        <meshStandardMaterial color="#0c1230" emissive="#001030"
          roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Low front splitter */}
      <mesh position={[0, 0.22, -3.55]}>
        <boxGeometry args={[3.8, 0.12, 0.55]} />
        <meshStandardMaterial color="#0c1230" emissive="#00d4ff" emissiveIntensity={0.4}
          roughness={0.2} metalness={0.95} />
      </mesh>

      {/* ── Cabin ── */}
      <mesh position={[0, 0.96, -0.4]}>
        <boxGeometry args={[2.5, 0.68, 3.2]} />
        <meshStandardMaterial color="#080f25" emissive="#001025"
          roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Windshield glass */}
      <mesh position={[0, 1.08, -1.95]} rotation={[0.38, 0, 0]}>
        <planeGeometry args={[2.3, 1.1]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.35}
          transparent opacity={0.38} side={THREE.DoubleSide} />
      </mesh>

      {/* Rear window */}
      <mesh position={[0, 1.08, 1.2]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[2.3, 1.0]} />
        <meshStandardMaterial color="#00d4ff" emissive="#004488" emissiveIntensity={0.2}
          transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Rear spoiler ── */}
      <mesh position={[0, 1.65, 2.7]}>
        <boxGeometry args={[3.2, 0.1, 0.8]} />
        <meshStandardMaterial color="#0c1230" emissive="#001030"
          roughness={0.2} metalness={0.95} />
      </mesh>
      <mesh position={[-1.3, 1.3, 2.7]}>
        <boxGeometry args={[0.1, 0.7, 0.15]} />
        <meshStandardMaterial color="#0c1230" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[1.3, 1.3, 2.7]}>
        <boxGeometry args={[0.1, 0.7, 0.15]} />
        <meshStandardMaterial color="#0c1230" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* ── Side skirts ── */}
      <mesh position={[-1.75, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.2, 6.2]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[1.75, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.2, 6.2]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.5} />
      </mesh>

      {/* ── Underglow ── */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[3.1, 0.04, 6.4]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff"
          emissiveIntensity={2.5} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <pointLight position={[0, -0.1, 0]} color="#00d4ff" intensity={4} distance={10} />

      {/* ── Wheels ── */}
      {wheelPositions.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          {/* Tyre */}
          <mesh>
            <cylinderGeometry args={[0.52, 0.52, 0.38, 18]} />
            <meshStandardMaterial color="#060810" roughness={0.95} metalness={0.1} />
          </mesh>
          {/* Rim */}
          <mesh>
            <cylinderGeometry args={[0.34, 0.34, 0.41, 10]} />
            <meshStandardMaterial color="#1a2a4a" emissive="#001a3a"
              roughness={0.15} metalness={0.98} />
          </mesh>
          {/* Rim glow center */}
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.43, 8]} />
            <meshStandardMaterial color="#00d4ff" emissive="#00d4ff"
              emissiveIntensity={2.5} />
          </mesh>
        </group>
      ))}

      {/* ── Headlights (front) ── */}
      <mesh position={[-1.1, 0.5, -3.45]}>
        <boxGeometry args={[0.65, 0.22, 0.05]} />
        <meshStandardMaterial color="#fffacc" emissive="#fffacc" emissiveIntensity={5} />
      </mesh>
      <mesh position={[1.1, 0.5, -3.45]}>
        <boxGeometry args={[0.65, 0.22, 0.05]} />
        <meshStandardMaterial color="#fffacc" emissive="#fffacc" emissiveIntensity={5} />
      </mesh>
      <pointLight position={[0, 0.5, -4.5]} color="#fffacc" intensity={10} distance={20} />

      {/* ── Taillights (rear, visible from behind = camera side) ── */}
      <mesh position={[-1.1, 0.5, 3.45]}>
        <boxGeometry args={[0.75, 0.2, 0.05]} />
        <meshStandardMaterial color="#ff0022" emissive="#ff0022" emissiveIntensity={6} />
      </mesh>
      <mesh position={[1.1, 0.5, 3.45]}>
        <boxGeometry args={[0.75, 0.2, 0.05]} />
        <meshStandardMaterial color="#ff0022" emissive="#ff0022" emissiveIntensity={6} />
      </mesh>
      <pointLight position={[0, 0.5, 3.8]} color="#ff0022" intensity={5} distance={14} />

      {/* ── Exhaust ── */}
      <mesh position={[-0.65, 0.28, 3.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.35, 8]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.6} metalness={0.9} />
      </mesh>
      <mesh position={[0.65, 0.28, 3.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.35, 8]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.6} metalness={0.9} />
      </mesh>
      <mesh position={[-0.65, 0.28, 3.82]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={4}
          transparent opacity={0.85} />
      </mesh>
      <mesh position={[0.65, 0.28, 3.82]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={4}
          transparent opacity={0.85} />
      </mesh>
    </group>
  );
};

// ── Car controller ────────────────────────────────────────────────────────────
export default function RaceCar({ onNearStation }) {
  const groupRef  = useRef();
  const steerRef  = useRef(0);  // current yaw (steering)
  const speedRef  = useRef(BASE_SPEED);
  const mouseRef  = useRef({ x: 0 });
  const nearRef   = useRef(null);
  const keys      = useControls();

  useEffect(() => {
    const onMove = e => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((state, delta) => {
    const car = groupRef.current;
    if (!car) return;
    const k  = keys.current;
    const mx = mouseRef.current.x;
    const dt = Math.min(delta, 0.05);

    // ── Steering ───────────────────────────────────────────────
    // Mouse X = continuous steer rate; auto-centers when mouse near center
    steerRef.current += mx * STEER_RATE * dt;
    steerRef.current *= (1 - 2.2 * dt); // spring back to center
    steerRef.current += (k.KeyA || k.ArrowLeft)  ?  KEY_STEER * dt : 0;
    steerRef.current += (k.KeyD || k.ArrowRight) ? -KEY_STEER * dt : 0;
    steerRef.current = THREE.MathUtils.clamp(steerRef.current, -STEER_LIMIT, STEER_LIMIT);

    car.rotation.y = steerRef.current;
    car.rotation.z = -steerRef.current * 0.18; // slight body roll

    // ── Speed ─────────────────────────────────────────────────
    let targetSpd = BASE_SPEED;
    if (k.KeyW || k.ArrowUp)   targetSpd = (k.ShiftLeft || k.ShiftRight) ? BOOST_SPEED * 1.3 : BOOST_SPEED;
    if (k.KeyS || k.ArrowDown) targetSpd = SLOW_SPEED;
    speedRef.current += (targetSpd - speedRef.current) * dt * 4;

    // ── Move ──────────────────────────────────────────────────
    _yawE.set(0, steerRef.current, 0);
    _yawQ.setFromEuler(_yawE);
    _fwd.set(0, 0, -1).applyQuaternion(_yawQ);
    car.position.addScaledVector(_fwd, speedRef.current * dt);

    // ── Camera (high angle, behind car) ───────────────────────
    _yawE.set(0, steerRef.current * 0.5, 0); // camera lags behind steering
    _yawQ.setFromEuler(_yawE);
    _camOff.set(0, 5, 13).applyQuaternion(_yawQ);
    _camTgt.copy(car.position).add(_camOff);
    state.camera.position.lerp(_camTgt, Math.min(dt * CAM_LAG, 1));

    _look.copy(car.position).addScaledVector(_fwd, 12);
    _look.y += 0.8;
    state.camera.lookAt(_look);

    // ── Proximity (no spam) ───────────────────────────────────
    let closest  = null;
    let closestD = Infinity;
    for (let i = 0; i < RACE_STATIONS.length; i++) {
      const d = car.position.distanceTo(RACE_STATIONS[i].position);
      if (d < RACE_DOCK_DISTANCE && d < closestD) {
        closestD = d;
        closest  = RACE_STATIONS[i];
      }
    }
    if (closest?.id !== nearRef.current?.id) {
      nearRef.current = closest;
      onNearStation && onNearStation(closest);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.52, 0]}>
      <CarMesh />
    </group>
  );
}

const KEY_STEER = 1.0;
