import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BULLET_SPD  = 44;
const WARN_RADIUS = 6.5;   // units from player that triggers dodge warning
const HIT_RADIUS  = 0.50;  // tighter hitbox (was 0.65)

export default function MatrixBullet({ id, origin, direction, playerPosRef, crouchRef, dodgeRef, timeScaleRef, onExpire, onHit, onNear }) {
  const groupRef  = useRef();
  const posRef    = useRef(origin.clone());
  const velRef    = useRef(direction.clone().normalize().multiplyScalar(BULLET_SPD));
  const lifeRef   = useRef(3.5);
  const doneRef   = useRef(false);
  const warnedRef = useRef(false);

  // Orient the group so the trail faces back along velocity
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(posRef.current);
      // Rotate so local +Z aligns with velocity
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        velRef.current.clone().normalize()
      );
      groupRef.current.quaternion.copy(q);
    }
  }, []);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    const ts = timeScaleRef?.current ?? 1;
    const dt = delta * ts;
    lifeRef.current -= delta; // real-time lifetime

    if (lifeRef.current <= 0) {
      doneRef.current = true;
      onExpire(id);
      return;
    }

    posRef.current.addScaledVector(velRef.current, dt);
    if (groupRef.current) groupRef.current.position.copy(posRef.current);

    // Proximity detection
    const p = playerPosRef.current;
    const dx = posRef.current.x - p.x;
    const dz = posRef.current.z - p.z;
    const dy = posRef.current.y - (p.y ?? 0);
    const radial = Math.sqrt(dx * dx + dz * dz);

    // Warn when bullet enters danger radius (fire once per bullet)
    if (!warnedRef.current && radial < WARN_RADIUS) {
      warnedRef.current = true;
      // angle: direction bullet is coming FROM (atan2 from bullet→player flipped)
      onNear?.(Math.atan2(-dx, -dz));
    }

    // Hit detection — skip entirely while dodging (dodge = full invincibility)
    const dodging    = dodgeRef?.current?.active ?? false;
    const crouching  = crouchRef?.current ?? false;
    // Crouching: ceiling at 0.68 — bullets aimed at body (y≈1.1) clear a ducking player
    const hitCeiling = crouching ? 0.68 : 2.1;

    if (!dodging && radial < HIT_RADIUS && dy < hitCeiling && dy > -0.4 && !doneRef.current) {
      doneRef.current = true;
      onHit(id);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Core — bright emissive sphere, no pointLight (expensive per-bullet) */}
      <mesh>
        <sphereGeometry args={[0.09, 5, 4]} />
        <meshStandardMaterial color="#ffffaa" emissive="#ffee00" emissiveIntensity={18} />
      </mesh>
      {/* Single trail cone along -Z */}
      <mesh position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.07, 1.4, 4]} />
        <meshStandardMaterial color="#ff7700" emissive="#ff4400" emissiveIntensity={6}
          transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
