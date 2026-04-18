import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WALK_SPD      = 7.8;
const STRAFE_SPD    = 3.6;
const PREFERRED_MIN = 2.2;  // melee range — agent steps in to punch, not back away
const PREFERRED_MAX = 9;    // closes in if farther than this
const MELEE_RANGE   = 2.6;  // distance to land a punch on Neo
const MELEE_CD      = 1.5;  // seconds between melee attacks
const MELEE_DMG     = 18;
const CATCH_D       = 1.9;
const CATCH_CD      = 4500;
const SHOOT_RANGE   = 38;
const MAX_HP        = 100;
const DEATH_DUR     = 1.0;

const _dir = new THREE.Vector3();
const _pv  = new THREE.Vector3();

// ── Animated body ─────────────────────────────────────────────────────────────
function AgentBody({ moving = true, hitFlashRef, deadRef, deathTRef }) {
  const lLeg = useRef(), rLeg = useRef();
  const lArm = useRef(), rArm = useRef();
  const bodyRef = useRef();
  const matsRef = useRef([]);   // all materials for flash effect

  useFrame(({ clock }, delta) => {
    if (!bodyRef.current) return;

    // Death fall animation
    if (deadRef.current) {
      deathTRef.current = Math.min(1, deathTRef.current + delta / DEATH_DUR);
      bodyRef.current.rotation.x = deathTRef.current * Math.PI * 0.42;
      bodyRef.current.position.y = -deathTRef.current * 0.8;
      // fade
      matsRef.current.forEach(m => {
        if (m) { m.transparent = true; m.opacity = Math.max(0, 1 - deathTRef.current * 1.4); }
      });
      return;
    }

    // Walk animation
    const t = clock.elapsedTime * (moving ? 5.5 : 1.5);
    const a = moving ? 0.58 : 0.08;
    if (lLeg.current) lLeg.current.rotation.x  =  Math.sin(t) * a;
    if (rLeg.current) rLeg.current.rotation.x  = -Math.sin(t) * a;
    if (lArm.current) lArm.current.rotation.x  = -Math.sin(t) * a * 0.65;
    if (rArm.current) rArm.current.rotation.x  =  Math.sin(t) * a * 0.65;

    // Hit flash
    if (hitFlashRef.current > 0) {
      hitFlashRef.current -= delta;
      const fi = hitFlashRef.current > 0 ? 3.5 : 0;
      matsRef.current.forEach(m => { if (m?.emissive) m.emissiveIntensity = fi; });
    }
  });

  const suit = { color: '#2a2a2a', roughness: 0.55, metalness: 0.35, emissive: new THREE.Color('#080808'), emissiveIntensity: 0 };
  const sht  = { color: '#dddddd', roughness: 0.85 };
  const shoe = { color: '#111111', roughness: 0.4, metalness: 0.5 };

  const matRef = (mat) => { matsRef.current.push(mat); };

  return (
    <group ref={bodyRef}>
      {/* Torso */}
      <mesh position={[0, 1.52, 0]}>
        <boxGeometry args={[0.76, 1.0, 0.45]} />
        <meshStandardMaterial ref={matRef} {...suit} emissive="#ff2200" emissiveIntensity={0} />
      </mesh>
      {/* Shirt */}
      <mesh position={[0, 1.96, 0.17]}>
        <boxGeometry args={[0.26, 0.18, 0.06]} />
        <meshStandardMaterial {...sht} />
      </mesh>
      {/* Tie */}
      <mesh position={[0, 1.62, 0.24]}>
        <boxGeometry args={[0.085, 0.55, 0.03]} />
        <meshStandardMaterial color="#1a0000" roughness={0.9} />
      </mesh>
      {/* Shoulder rim lights */}
      <mesh position={[-0.42, 2.05, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.45]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.2} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.42, 2.05, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.45]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.2} transparent opacity={0.6} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.28, 0]}>
        <boxGeometry args={[0.5, 0.54, 0.46]} />
        <meshStandardMaterial ref={matRef} color="#a8a098" roughness={0.78} emissive="#ff2200" emissiveIntensity={0} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 2.60, -0.01]}>
        <boxGeometry args={[0.52, 0.13, 0.47]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>
      {/* Sunglasses */}
      {[[-0.13, 0], [0.13, 0]].map(([gx], i) => (
        <mesh key={i} position={[gx, 2.30, 0.24]}>
          <boxGeometry args={[0.17, 0.09, 0.03]} />
          <meshStandardMaterial color="#0a0a0a" emissive="#001500" emissiveIntensity={2.2} metalness={0.92} roughness={0.08} />
        </mesh>
      ))}
      <mesh position={[0, 2.30, 0.24]}>
        <boxGeometry args={[0.05, 0.025, 0.02]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Earpiece */}
      <mesh position={[0.26, 2.2, 0.07]}>
        <boxGeometry args={[0.04, 0.055, 0.04]} />
        <meshStandardMaterial color="#f0f0f0" emissive="#ffffff" emissiveIntensity={0.8} />
      </mesh>

      {/* Arms */}
      <group ref={lArm} position={[-0.5, 1.88, 0]}>
        <mesh position={[0, -0.38, 0]}><boxGeometry args={[0.24, 0.78, 0.24]} /><meshStandardMaterial ref={matRef} {...suit} emissive="#ff2200" emissiveIntensity={0} /></mesh>
      </group>
      <group ref={rArm} position={[0.5, 1.88, 0]}>
        <mesh position={[0, -0.38, 0]}><boxGeometry args={[0.24, 0.78, 0.24]} /><meshStandardMaterial ref={matRef} {...suit} emissive="#ff2200" emissiveIntensity={0} /></mesh>
      </group>

      {/* Legs */}
      <group ref={lLeg} position={[-0.2, 1.02, 0]}>
        <mesh position={[0, -0.52, 0]}><boxGeometry args={[0.28, 1.04, 0.28]} /><meshStandardMaterial ref={matRef} {...suit} emissive="#ff2200" emissiveIntensity={0} /></mesh>
        <mesh position={[0, -1.1, 0.06]}><boxGeometry args={[0.3, 0.18, 0.38]} /><meshStandardMaterial {...shoe} /></mesh>
      </group>
      <group ref={rLeg} position={[0.2, 1.02, 0]}>
        <mesh position={[0, -0.52, 0]}><boxGeometry args={[0.28, 1.04, 0.28]} /><meshStandardMaterial ref={matRef} {...suit} emissive="#ff2200" emissiveIntensity={0} /></mesh>
        <mesh position={[0, -1.1, 0.06]}><boxGeometry args={[0.3, 0.18, 0.38]} /><meshStandardMaterial {...shoe} /></mesh>
      </group>
    </group>
  );
}

// ── 3-D health bar (floats above head) ────────────────────────────────────────
function AgentHealthBar({ hpRef, deadRef }) {
  const fillRef = useRef();
  const groupRef = useRef();

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    // Billboard: always face camera
    groupRef.current.quaternion.copy(camera.quaternion);

    if (deadRef.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;

    if (!fillRef.current) return;
    const ratio = Math.max(0, hpRef.current / MAX_HP);
    // Scale X, anchor left: position.x shifts so left edge stays fixed
    fillRef.current.scale.x = Math.max(0.001, ratio);
    fillRef.current.position.x = -(1 - ratio) * 0.66;
    // Colour: green → yellow → red
    const m = fillRef.current.material;
    if (m) {
      m.color.setHSL(ratio * 0.32, 1, 0.48);
      m.emissive.setHSL(ratio * 0.32, 1, 0.22);
    }
  });

  return (
    <group ref={groupRef} position={[0, 3.6, 0]}>
      {/* Track / background */}
      <mesh>
        <boxGeometry args={[1.4, 0.16, 0.05]} />
        <meshStandardMaterial color="#0a0a0a" transparent opacity={0.82} />
      </mesh>
      {/* HP fill — starts full width; scale.x shrinks it */}
      <mesh ref={fillRef} position={[0, 0, 0.03]}>
        <boxGeometry args={[1.32, 0.12, 0.05]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={0.8} />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[1.44, 0.20, 0.03]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={0.4}
          transparent opacity={0.35} wireframe />
      </mesh>
      {/* AGENT label indicator strip */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.6, 0.04, 0.01]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

// ── Controller ────────────────────────────────────────────────────────────────
export default function AgentSmith({
  spawnOffset,
  spawnDelay = 4000,
  shootInterval = 2800,
  firstShotDelay,
  playerPosRef,
  dodgeRef,
  timeScaleRef,
  onCatch,
  onShoot,
  onRegister,
  onSpawn,
  onDead,
  onMeleePunch,   // called when agent lands a melee hit on Neo
  paused,
  bounds,
}) {
  const groupRef     = useRef();
  const posRef       = useRef(new THREE.Vector3(spawnOffset?.x ?? 0, 0, spawnOffset?.z ?? 25));
  const activeRef    = useRef(false);
  const lastCatch    = useRef(-Infinity);
  const shootTimer   = useRef(firstShotDelay !== undefined ? firstShotDelay : shootInterval * 0.5 + Math.random() * 1200);
  const meleeTimer   = useRef(MELEE_CD * 0.5);
  const movingRef    = useRef(false);

  const hpRef        = useRef(MAX_HP);
  const hitFlashRef  = useRef(0);
  const stunRef      = useRef(0);
  const deadRef      = useRef(false);
  const deathTRef    = useRef(0);
  const doneRef      = useRef(false);
  const knockbackRef = useRef({ vel: new THREE.Vector3(), t: 0 });

  // Register with parent so player can punch this agent
  useEffect(() => {
    if (!onRegister) return;
    const registration = {
      posRef,
      takeDamage(amount) {
        if (deadRef.current) return;
        hpRef.current -= amount;
        hitFlashRef.current = 0.25;
        stunRef.current = 0.30;
        if (hpRef.current <= 0) deadRef.current = true;
      },
      knockback(dir, force) {
        if (deadRef.current) return;
        knockbackRef.current.vel.copy(dir).multiplyScalar(force);
        knockbackRef.current.t = 0.22;
      },
    };
    const cleanup = onRegister(registration);
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [onRegister]);

  useEffect(() => {
    const t = setTimeout(() => {
      activeRef.current = true;
      onSpawn?.();
    }, spawnDelay);
    return () => clearTimeout(t);
  }, [spawnDelay, onSpawn]);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (!activeRef.current) { g.visible = false; return; }
    g.visible = true;

    // Death cleanup: hide after animation done, notify parent
    if (deadRef.current) {
      if (deathTRef.current >= 1 && !doneRef.current) {
        doneRef.current = true;
        g.visible = false;
        onDead?.(posRef.current.clone());
      }
      return;
    }

    if (paused) return;

    const ts  = timeScaleRef?.current ?? 1;
    const dt  = Math.min(delta, 0.05) * ts;

    if (stunRef.current > 0) {
      stunRef.current -= dt;
      return;
    }

    const p   = playerPosRef.current;
    const pos = posRef.current;

    const dx     = p.x - pos.x;
    const dz     = p.z - pos.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);

    movingRef.current = dist2D > 1.5;

    // Knockback impulse
    const kb = knockbackRef.current;
    if (kb.t > 0) {
      kb.t -= dt;
      pos.addScaledVector(kb.vel, dt);
      if (kb.t <= 0) kb.vel.set(0, 0, 0);
    } else {
      if (dist2D > PREFERRED_MIN) {
        // Always close in — agent charges toward Neo
        const urgency = dist2D > PREFERRED_MAX ? 1.3 : 0.85;
        const spd = WALK_SPD * urgency;
        pos.x += (dx / dist2D) * spd * dt;
        pos.z += (dz / dist2D) * spd * dt;
      } else {
        // In melee range — orbit/circle while looking for opening
        const sd = clock.elapsedTime % 2.8 > 1.4 ? 1 : -1;
        const perpX = -dz / dist2D;
        const perpZ =  dx / dist2D;
        pos.x += perpX * STRAFE_SPD * dt * sd;
        pos.z += perpZ * STRAFE_SPD * dt * sd;
      }
    }

    if (bounds) {
      pos.x = THREE.MathUtils.clamp(pos.x, bounds.xMin + 0.3, bounds.xMax - 0.3);
      pos.z = THREE.MathUtils.clamp(pos.z, bounds.zMin + 0.2, bounds.zMax - 0.2);
    }

    g.position.copy(pos);
    g.rotation.y = Math.atan2(dx, dz);

    // Melee punch — lands when close enough and cooldown elapsed
    meleeTimer.current -= dt;
    if (dist2D < MELEE_RANGE && meleeTimer.current <= 0) {
      meleeTimer.current = MELEE_CD * (0.85 + Math.random() * 0.3);
      onMeleePunch?.(MELEE_DMG);
    }

    // Catch check (grab) — only after melee is available
    const now    = clock.elapsedTime * 1000;
    const dodging = dodgeRef?.current?.active ?? false;
    if (dist2D < CATCH_D && !dodging && now - lastCatch.current > CATCH_CD) {
      lastCatch.current = now;
      pos.set((Math.random() - 0.5) * 4, 0, p.z + 28);
      onCatch?.();
    }

    // Shoot — only fires at mid-long range (agent prefers melee when close)
    if (dist2D >= PREFERRED_MAX * 0.7 && dist2D < SHOOT_RANGE) {
      shootTimer.current -= dt * 1000;
      if (shootTimer.current <= 0) {
        shootTimer.current = shootInterval * (0.9 + Math.random() * 0.4);
        _pv.set(p.x, (p.y ?? 0) + 1.1, p.z);
        _dir.copy(_pv).sub(pos.clone().setY(2.2)).normalize();
        onShoot?.(pos.clone().setY(2.2), _dir);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <AgentBody
        moving={movingRef.current}
        hitFlashRef={hitFlashRef}
        deadRef={deadRef}
        deathTRef={deathTRef}
      />
      <AgentHealthBar hpRef={hpRef} deadRef={deadRef} />
    </group>
  );
}
