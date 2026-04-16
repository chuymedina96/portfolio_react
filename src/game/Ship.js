import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls } from './useControls';
import { STATIONS, DOCK_DISTANCE } from './constants';

const BASE_SPEED  = 6;    // always-on forward (relaxed cruise)
const BOOST_SPEED = 18;   // W held
const SLOW_SPEED  = 1;    // S held
const TURN_RATE   = 0.55; // radians/sec mouse turn (much less twitchy)
const KEY_TURN    = 1.1;  // keyboard turn rate
const CAM_LAG     = 5;    // camera spring stiffness

// Module-level reusable objects — never re-allocated per frame
const _fwd    = new THREE.Vector3();
const _camOff = new THREE.Vector3();
const _camTgt = new THREE.Vector3();
const _look   = new THREE.Vector3();
const _yawQ   = new THREE.Quaternion();
const _yawE   = new THREE.Euler(0, 0, 0, 'YXZ');

// ── Ship visual mesh ──────────────────────────────────────────────────────────
// Inner group rotated so +Y (cylinder axis) becomes -Z (Three.js forward).
// Camera sits behind at +Z → sees engines glowing. Nose at -Z → points away.
const ShipMesh = () => (
  <group rotation={[-Math.PI / 2, 0, 0]}>

    {/* ── Fuselage ── */}
    <mesh>
      <cylinderGeometry args={[0.28, 0.58, 4.0, 10]} />
      <meshStandardMaterial color="#0c1230" emissive="#001535"
        roughness={0.35} metalness={0.85} />
    </mesh>

    {/* Nose cone (at +Y → world -Z forward) */}
    <mesh position={[0, 2.35, 0]}>
      <coneGeometry args={[0.28, 1.6, 10]} />
      <meshStandardMaterial color="#132060" emissive="#002870"
        roughness={0.25} metalness={0.9} />
    </mesh>

    {/* ── Cockpit (visible from behind, slightly forward) ── */}
    <mesh position={[0, 0.9, 0.38]}>
      <sphereGeometry args={[0.28, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.6}
        transparent opacity={0.55} roughness={0} metalness={0} />
    </mesh>

    {/* ── Wings ── */}
    {/* Left */}
    <mesh position={[-1.25, -0.15, 0]} rotation={[0, 0, 0.2]}>
      <boxGeometry args={[2.1, 0.07, 1.1]} />
      <meshStandardMaterial color="#0c1230" emissive="#001535"
        roughness={0.3} metalness={0.9} />
    </mesh>
    {/* Right */}
    <mesh position={[1.25, -0.15, 0]} rotation={[0, 0, -0.2]}>
      <boxGeometry args={[2.1, 0.07, 1.1]} />
      <meshStandardMaterial color="#0c1230" emissive="#001535"
        roughness={0.3} metalness={0.9} />
    </mesh>

    {/* Wing edge accent strips */}
    <mesh position={[-2.25, -0.3, 0]}>
      <boxGeometry args={[0.1, 0.04, 0.9]} />
      <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.5} />
    </mesh>
    <mesh position={[2.25, -0.3, 0]}>
      <boxGeometry args={[0.1, 0.04, 0.9]} />
      <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.5} />
    </mesh>

    {/* ── Engine pods (at -Y → world +Z → visible from behind camera) ── */}
    <mesh position={[-1.45, -0.72, 0]}>
      <cylinderGeometry args={[0.15, 0.22, 1.1, 10]} />
      <meshStandardMaterial color="#080e22" emissive="#1a0040"
        roughness={0.5} metalness={0.75} />
    </mesh>
    <mesh position={[1.45, -0.72, 0]}>
      <cylinderGeometry args={[0.15, 0.22, 1.1, 10]} />
      <meshStandardMaterial color="#080e22" emissive="#1a0040"
        roughness={0.5} metalness={0.75} />
    </mesh>
    {/* Center engine */}
    <mesh position={[0, -2.1, 0]}>
      <cylinderGeometry args={[0.22, 0.35, 0.8, 10]} />
      <meshStandardMaterial color="#080e22" emissive="#001535"
        roughness={0.5} metalness={0.75} />
    </mesh>

    {/* ── Engine exhaust cones (point toward camera = visible!) ── */}
    <mesh position={[0, -2.6, 0]}>
      <coneGeometry args={[0.35, 0.9, 12]} />
      <meshStandardMaterial color="#ff6b35" emissive="#ff4400" emissiveIntensity={4}
        transparent opacity={0.92} />
    </mesh>
    <mesh position={[-1.45, -1.3, 0]}>
      <coneGeometry args={[0.18, 0.55, 10]} />
      <meshStandardMaterial color="#9b5fff" emissive="#8800ff" emissiveIntensity={4}
        transparent opacity={0.88} />
    </mesh>
    <mesh position={[1.45, -1.3, 0]}>
      <coneGeometry args={[0.18, 0.55, 10]} />
      <meshStandardMaterial color="#9b5fff" emissive="#8800ff" emissiveIntensity={4}
        transparent opacity={0.88} />
    </mesh>

    {/* Inner flame cores */}
    <mesh position={[0, -2.65, 0]}>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshStandardMaterial color="#fff8e0" emissive="#fff0a0" emissiveIntensity={6}
        transparent opacity={0.9} />
    </mesh>
    <mesh position={[-1.45, -1.38, 0]}>
      <sphereGeometry args={[0.09, 7, 7]} />
      <meshStandardMaterial color="#d8c0ff" emissive="#c090ff" emissiveIntensity={5}
        transparent opacity={0.9} />
    </mesh>
    <mesh position={[1.45, -1.38, 0]}>
      <sphereGeometry args={[0.09, 7, 7]} />
      <meshStandardMaterial color="#d8c0ff" emissive="#c090ff" emissiveIntensity={5}
        transparent opacity={0.9} />
    </mesh>

    {/* ── Engine point lights (illuminate ship from behind) ── */}
    <pointLight position={[0,    -2.8, 0]} color="#ff5500" intensity={8}  distance={18} />
    <pointLight position={[-1.4, -1.5, 0]} color="#9900ff" intensity={5}  distance={10} />
    <pointLight position={[ 1.4, -1.5, 0]} color="#9900ff" intensity={5}  distance={10} />

    {/* ── Nav lights ── */}
    <mesh position={[-2.6, -0.3, 0]}>
      <sphereGeometry args={[0.075, 6, 6]} />
      <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={6} />
    </mesh>
    <mesh position={[2.6, -0.3, 0]}>
      <sphereGeometry args={[0.075, 6, 6]} />
      <meshStandardMaterial color="#33ff33" emissive="#00ff00" emissiveIntensity={6} />
    </mesh>

    {/* ── Hull accent lines ── */}
    <mesh position={[0, 0, 0.35]}>
      <boxGeometry args={[0.06, 3.6, 0.04]} />
      <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.2}
        transparent opacity={0.6} />
    </mesh>

  </group>
);

// ── Ship controller ───────────────────────────────────────────────────────────
export default function Ship({ onNearStation }) {
  const groupRef   = useRef();
  const yawRef     = useRef(0);
  const pitchRef   = useRef(0);
  const speedRef   = useRef(BASE_SPEED);
  const mouseRef   = useRef({ x: 0, y: 0 });
  const nearRef    = useRef(null);   // track last-notified station to avoid spam
  const keys       = useControls();
  const flameRef1  = useRef();
  const flameRef2  = useRef();
  const flameRef3  = useRef();

  useEffect(() => {
    const onMove = e => {
      // Map cursor to [-1, 1] where center = 0
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((state, delta) => {
    const ship = groupRef.current;
    if (!ship) return;
    const k  = keys.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const dt = Math.min(delta, 0.05); // clamp for tab-unfocus spikes

    // ── Rotation ───────────────────────────────────────────────
    // Mouse position acts as a continuous turn rate input
    yawRef.current   -= mx * TURN_RATE  * dt;
    pitchRef.current -= my * TURN_RATE * 0.6 * dt;

    // Keyboard turn as well
    if (k.KeyA || k.ArrowLeft)  yawRef.current += KEY_TURN * dt;
    if (k.KeyD || k.ArrowRight) yawRef.current -= KEY_TURN * dt;
    if (k.KeyW)                 pitchRef.current -= KEY_TURN * 0.4 * dt;
    if (k.KeyS)                 pitchRef.current += KEY_TURN * 0.4 * dt;

    // Clamp pitch so you can't flip upside-down
    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.1, 1.1);

    ship.rotation.order = 'YXZ';
    ship.rotation.y = yawRef.current;
    ship.rotation.x = pitchRef.current;
    ship.rotation.z = -mx * 0.32;   // lean into horizontal turn

    // ── Speed ─────────────────────────────────────────────────
    const boost = (k.ShiftLeft || k.ShiftRight);
    let targetSpeed = BASE_SPEED;
    if ((k.KeyW || k.ArrowUp))   targetSpeed = boost ? BOOST_SPEED * 1.4 : BOOST_SPEED;
    if ((k.KeyS || k.ArrowDown)) targetSpeed = SLOW_SPEED;
    speedRef.current += (targetSpeed - speedRef.current) * dt * 4;

    // ── Move forward along ship's local -Z ────────────────────
    // Only use yaw for the movement direction (ship always flies "level" on pitch)
    // Full pitch movement makes it feel sickening on long trips
    _yawE.set(pitchRef.current * 0.5, yawRef.current, 0, 'YXZ');
    _yawQ.setFromEuler(_yawE);
    _fwd.set(0, 0, -1).applyQuaternion(_yawQ);
    ship.position.addScaledVector(_fwd, speedRef.current * dt);

    // ── Animate engine flames ──────────────────────────────────
    const t = state.clock.elapsedTime;
    const flicker = 0.85 + Math.sin(t * 40) * 0.08 + Math.sin(t * 27) * 0.07;
    const speedScale = 0.7 + (speedRef.current / BASE_SPEED) * 0.5;
    if (flameRef1.current) flameRef1.current.scale.setScalar(flicker * speedScale);
    if (flameRef2.current) flameRef2.current.scale.setScalar(flicker * speedScale * 0.85);
    if (flameRef3.current) flameRef3.current.scale.setScalar(flicker * speedScale * 0.85);

    // ── Camera spring ─────────────────────────────────────────
    // Camera follows yaw ONLY (not pitch) — stays horizon-level, feels stable
    _yawE.set(0, yawRef.current, 0);
    _yawQ.setFromEuler(_yawE);
    _camOff.set(0, 2.8, 11).applyQuaternion(_yawQ);
    _camTgt.copy(ship.position).add(_camOff);
    state.camera.position.lerp(_camTgt, Math.min(dt * CAM_LAG, 1));

    // Look at a point 18 units ahead in ship's flight direction
    _yawE.set(pitchRef.current * 0.3, yawRef.current, 0);
    _yawQ.setFromEuler(_yawE);
    _look.set(0, 0, -18).applyQuaternion(_yawQ).add(ship.position);
    _look.y += 0.5;
    state.camera.lookAt(_look);

    // ── Proximity (only notify on change — no spam re-renders) ─
    let closest   = null;
    let closestD  = Infinity;
    for (let i = 0; i < STATIONS.length; i++) {
      const d = ship.position.distanceTo(STATIONS[i].position);
      if (d < DOCK_DISTANCE && d < closestD) {
        closestD = d;
        closest  = STATIONS[i];
      }
    }
    if (closest?.id !== nearRef.current?.id) {
      nearRef.current = closest;
      onNearStation && onNearStation(closest);
    }
  });

  return (
    <group ref={groupRef}>
      <ShipMesh />
      {/* Animated flame refs attached via primitive workaround */}
    </group>
  );
}
