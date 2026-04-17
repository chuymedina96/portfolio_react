import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls } from './useControls';
import { MATRIX_DOORS, MATRIX_DOOR_DIST } from './constants';

const WALK_SPD      = 7.0;
const RUN_SPD       = 14.5;
const GRAVITY       = 26;
const JUMP_VEL      = 10.0;
const WALL_JUMP_VY  = 9.5;
const WALL_JUMP_VX  = 11.0;   // push-off force
const WALL_CD       = 0.35;   // seconds before same wall can be re-jumped
const CAM_DIST      = 5.2;
const CAM_H         = 2.6;
const CAM_LOOK      = 1.3;
const PUNCH_DUR     = 0.26;
const KICK_DUR      = 0.38;

const _fwd    = new THREE.Vector3();
const _right  = new THREE.Vector3();
const _camOff = new THREE.Vector3();
const _Y      = new THREE.Vector3(0, 1, 0);
const _lookAt = new THREE.Vector3();

// ── Neo body ───────────────────────────────────────────────────────────────────
// Intentionally blocky / voxel style but with Neo's distinctive silhouette:
// long trench coat, round wire glasses, slicked hair, tall lean build
function NeoBody({ stateRef }) {
  const lLeg    = useRef(), rLeg = useRef();
  const lArm    = useRef(), rArm = useRef();
  const kickR   = useRef();
  const tilt    = useRef();
  const coatBot = useRef();   // lower coat flap sway
  const bodyGrp = useRef();

  useFrame(({ clock }, delta) => {
    const s  = stateRef.current;
    const t  = clock.elapsedTime;
    const wf = t * (s.running ? 14 : 9);
    const wa = s.moving ? (s.running ? 0.55 : 0.40) : 0;

    // Walk legs
    if (lLeg.current && !s.kicking) lLeg.current.rotation.x  =  Math.sin(wf) * wa;
    if (rLeg.current && !s.kicking) rLeg.current.rotation.x  = -Math.sin(wf) * wa;

    // Jab / cross (alternate arms)
    const pAmp = -Math.PI * 0.92 * Math.sin(s.punchT * Math.PI);
    if (lArm.current) {
      // Flying: arms spread wide like Neo soaring
      const flyTgtX = s.flying ? Math.PI * 0.28 : 0;
      const flyTgtZ = s.flying ? 0.9 : 0;
      const tgt = s.flying ? flyTgtX : (s.punching && s.altArm === 1) ? pAmp : -Math.sin(wf) * wa * 0.5;
      lArm.current.rotation.x = THREE.MathUtils.lerp(lArm.current.rotation.x, tgt, 0.12);
      lArm.current.rotation.z = THREE.MathUtils.lerp(lArm.current.rotation.z,
        s.flying ? flyTgtZ : (s.kicking && s.flyKick) ? 0.45 : 0, 0.12);
    }
    if (rArm.current) {
      // During flying kick, both arms spread wide for balance
      const kickSpread = (s.kicking && s.flyKick) ? Math.PI * 0.35 : 0;
      const flyTgtX = s.flying ? Math.PI * 0.28 : 0;
      const tgt = s.flying ? flyTgtX
        : s.kicking ? kickSpread
        : (s.punching && s.altArm === 0) ? pAmp : Math.sin(wf) * wa * 0.5;
      rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, tgt, 0.12);
      rArm.current.rotation.z = THREE.MathUtils.lerp(
        rArm.current.rotation.z,
        s.flying ? -0.9 : (s.kicking && s.flyKick) ? -0.45 : 0,
        0.12
      );
      if (s.shooting) {
        const sAmp = -Math.PI * 0.7 * Math.sin((s.shootT || 0) * Math.PI);
        rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, sAmp, 0.4);
      }
    }

    // Roundhouse kick — big sweep up to near-horizontal, hold, snap back
    if (kickR.current) {
      if (s.kicking) {
        const kp = s.kickT;
        // Phase 0→0.45: sweep up to near-horizontal (−105°)
        // Phase 0.45→0.6: brief hold at apex (freeze-frame feel)
        // Phase 0.6→1: snap back
        let kAng;
        if (kp < 0.45)      kAng = -(kp / 0.45) * Math.PI * 1.05;
        else if (kp < 0.60) kAng = -Math.PI * 1.05;
        else                kAng = -(1 - kp) / 0.4 * Math.PI * 1.05;
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, kAng, 0.28);
        if (rLeg.current) rLeg.current.rotation.x = 0;
      } else {
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, 0, 0.14);
      }
    }

    // Body lean: dodge = sideways, crouch = lean back (Matrix bullet-dodge)
    if (tilt.current) {
      const tz = s.dodging   ? s.dodgeDir * 0.72 : 0;
      const tx = s.flying    ? 0.28
               : s.crouching ? 0.65
               : s.kicking   ? -0.28
               : !s.grounded ? -0.14
               : 0;
      // Snap into dodge lean fast; ease out gently when dodge ends
      const lerpZ = s.dodging ? 0.32 : 0.14;
      const lerpX = s.crouching ? 0.22 : 0.14;
      tilt.current.rotation.z = THREE.MathUtils.lerp(tilt.current.rotation.z, tz, lerpZ);
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, tx, lerpX);
    }

    // Crouch: lower body
    if (bodyGrp.current) {
      bodyGrp.current.position.y = THREE.MathUtils.lerp(
        bodyGrp.current.position.y, s.crouching ? -0.52 : 0, 0.18
      );
    }

    // Coat sway
    if (coatBot.current) {
      const sway = s.running ? Math.sin(wf * 0.5) * 0.14 : s.moving ? Math.sin(wf * 0.5) * 0.07 : 0;
      coatBot.current.rotation.x = THREE.MathUtils.lerp(coatBot.current.rotation.x, sway, 0.1);
    }
  });

  // Neo's colour palette
  const coat = { color: '#080808', roughness: 0.55, metalness: 0.35 };
  const skin = { color: '#b09880', roughness: 0.72 };

  return (
    <group ref={tilt}>
      <group ref={bodyGrp}>

        {/* ── Upper body ─────────────────────────────────────────────────── */}
        {/* Coat upper — wide lapels, tall collar */}
        <mesh position={[0, 1.54, 0]}>
          <boxGeometry args={[0.88, 1.06, 0.52]} />
          <meshStandardMaterial {...coat} />
        </mesh>
        {/* Lapel left */}
        <mesh position={[-0.30, 1.82, 0.27]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.14, 0.42, 0.06]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.5} />
        </mesh>
        {/* Lapel right */}
        <mesh position={[0.30, 1.82, 0.27]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[0.14, 0.42, 0.06]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.5} />
        </mesh>
        {/* Stand-up collar */}
        <mesh position={[0, 2.06, -0.02]}>
          <boxGeometry args={[0.62, 0.22, 0.56]} />
          <meshStandardMaterial {...coat} />
        </mesh>

        {/* ── Lower coat (sways when running) ────────────────────────────── */}
        <group ref={coatBot}>
          {/* Main lower coat body */}
          <mesh position={[0, 0.40, 0.01]}>
            <boxGeometry args={[0.94, 1.22, 0.54]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          {/* Front split — left panel */}
          <mesh position={[-0.24, -0.12, 0.28]}>
            <boxGeometry args={[0.34, 0.95, 0.08]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          {/* Front split — right panel */}
          <mesh position={[0.24, -0.12, 0.28]}>
            <boxGeometry args={[0.34, 0.95, 0.08]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          {/* Coat hem (bottom edge) */}
          <mesh position={[0, -0.60, 0.01]}>
            <boxGeometry args={[0.96, 0.06, 0.56]} />
            <meshStandardMaterial color="#111" roughness={0.4} metalness={0.4} />
          </mesh>
        </group>

        {/* ── Head ───────────────────────────────────────────────────────── */}
        {/* Face — lean angular shape */}
        <mesh position={[0, 2.30, 0]}>
          <boxGeometry args={[0.46, 0.55, 0.44]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        {/* Slicked-back hair — darker top, narrow profile */}
        <mesh position={[0, 2.60, -0.04]}>
          <boxGeometry args={[0.47, 0.12, 0.50]} />
          <meshStandardMaterial color="#090909" roughness={0.9} />
        </mesh>
        {/* Hair front sweep */}
        <mesh position={[0, 2.56, 0.17]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.46, 0.08, 0.18]} />
          <meshStandardMaterial color="#090909" roughness={0.9} />
        </mesh>

        {/* Neo's ROUND wire-frame glasses — two oval lenses + thin bridge */}
        {/* Left lens rim */}
        <mesh position={[-0.13, 2.28, 0.24]}>
          <torusGeometry args={[0.072, 0.012, 6, 12]} />
          <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Left lens tint */}
        <mesh position={[-0.13, 2.28, 0.245]}>
          <circleGeometry args={[0.062, 12]} />
          <meshStandardMaterial color="#050a05" emissive="#003300" emissiveIntensity={1.2}
            transparent opacity={0.82} metalness={0.8} roughness={0.05} />
        </mesh>
        {/* Right lens rim */}
        <mesh position={[0.13, 2.28, 0.24]}>
          <torusGeometry args={[0.072, 0.012, 6, 12]} />
          <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Right lens tint */}
        <mesh position={[0.13, 2.28, 0.245]}>
          <circleGeometry args={[0.062, 12]} />
          <meshStandardMaterial color="#050a05" emissive="#003300" emissiveIntensity={1.2}
            transparent opacity={0.82} metalness={0.8} roughness={0.05} />
        </mesh>
        {/* Nose bridge */}
        <mesh position={[0, 2.28, 0.245]}>
          <boxGeometry args={[0.10, 0.012, 0.012]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Temple arms (side arms of glasses) */}
        <mesh position={[-0.24, 2.28, 0.16]} rotation={[0, 0.45, 0]}>
          <boxGeometry args={[0.14, 0.01, 0.01]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.24, 2.28, 0.16]} rotation={[0, -0.45, 0]}>
          <boxGeometry args={[0.14, 0.01, 0.01]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* ── Arms ───────────────────────────────────────────────────────── */}
        <group ref={lArm} position={[-0.54, 1.90, 0]}>
          <mesh position={[0, -0.38, 0]}>
            <boxGeometry args={[0.25, 0.80, 0.27]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          {/* Fist / hand */}
          <mesh position={[0, -0.84, 0]}>
            <boxGeometry args={[0.21, 0.19, 0.21]} />
            <meshStandardMaterial color="#b09880" roughness={0.7} />
          </mesh>
        </group>

        <group ref={rArm} position={[0.54, 1.90, 0]}>
          <mesh position={[0, -0.38, 0]}>
            <boxGeometry args={[0.25, 0.80, 0.27]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          <mesh position={[0, -0.84, 0]}>
            <boxGeometry args={[0.21, 0.19, 0.21]} />
            <meshStandardMaterial color="#b09880" roughness={0.7} />
          </mesh>
          {/* Gun — simple blocky pistol */}
          <mesh position={[0, -1.02, -0.14]} rotation={[-0.1, 0, 0]}>
            <boxGeometry args={[0.10, 0.18, 0.32]} />
            <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.96, -0.28]} rotation={[-0.1, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 0.22]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>

        {/* ── Legs ───────────────────────────────────────────────────────── */}
        <group ref={lLeg} position={[-0.20, 1.02, 0]}>
          <mesh position={[0, -0.52, 0]}>
            <boxGeometry args={[0.27, 1.06, 0.28]} />
            <meshStandardMaterial {...coat} />
          </mesh>
          {/* Boot */}
          <mesh position={[0, -1.11, 0.05]}>
            <boxGeometry args={[0.29, 0.17, 0.38]} />
            <meshStandardMaterial color="#060606" roughness={0.35} metalness={0.6} />
          </mesh>
        </group>

        {/* Right leg: kickR sub-group so it pivots at hip */}
        <group ref={rLeg} position={[0.20, 1.02, 0]}>
          <group ref={kickR}>
            <mesh position={[0, -0.52, 0]}>
              <boxGeometry args={[0.27, 1.06, 0.28]} />
              <meshStandardMaterial {...coat} />
            </mesh>
            {/* Combat boot — slightly chunkier for kick impact */}
            <mesh position={[0, -1.11, 0.05]}>
              <boxGeometry args={[0.31, 0.19, 0.44]} />
              <meshStandardMaterial color="#060606" roughness={0.3} metalness={0.65} />
            </mesh>
          </group>
        </group>

        {/* ── Matrix green rim on shoulders ──────────────────────────────── */}
        {[-0.46, 0.46].map((sx, i) => (
          <mesh key={i} position={[sx, 2.08, 0]}>
            <boxGeometry args={[0.06, 0.04, 0.50]} />
            <meshStandardMaterial color="#00ff41" emissive="#00ff41"
              emissiveIntensity={1.0} transparent opacity={0.50} />
          </mesh>
        ))}

      </group>
    </group>
  );
}

// ── Main player controller + TPS camera ───────────────────────────────────────
export default function PlayerCharacter({
  charPosRef,
  yawRef,
  pitchRef,
  dodgeRef,
  crouchRef,
  stateRef,
  flyingRef,
  bounds,
  paused,
  onNearDoor,
  sceneId,
  cameraForwardRef,
}) {
  const { gl } = useThree();
  const keys    = useControls();
  const groupRef = useRef();
  // jumpRef now tracks Y velocity, X impulse from wall jump, and wall contact state
  const jumpRef = useRef({ vy: 0, vx: 0, grounded: true, wallContact: 0, wallCd: 0 });
  const nearRef = useRef(null);

  // Pointer lock
  useEffect(() => {
    const onMove = e => {
      if (!document.pointerLockElement) return;
      yawRef.current  -= e.movementX * 0.0022;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * 0.0016, -0.50, 0.42
      );
    };
    const onClick = () => {
      if (!document.pointerLockElement && !paused) gl.domElement.requestPointerLock();
    };
    document.addEventListener('mousemove', onMove);
    gl.domElement.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('mousemove', onMove);
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [gl, paused, yawRef, pitchRef]);

  // Jump / wall-jump on Space (disabled when flying — handled in useFrame)
  useEffect(() => {
    const onKey = e => {
      if (e.code !== 'Space' || paused) return;
      if (flyingRef?.current) return;
      const j = jumpRef.current;

      if (j.grounded) {
        j.vy = JUMP_VEL;
        j.grounded = false;
        stateRef.current.jumping  = true;
        stateRef.current.grounded = false;
      } else if (j.wallContact !== 0 && j.wallCd <= 0) {
        j.vy = WALL_JUMP_VY;
        j.vx = -j.wallContact * WALL_JUMP_VX;
        j.wallCd = WALL_CD;
        stateRef.current.jumping = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, stateRef, flyingRef]);

  useFrame((state, delta) => {
    const dt  = Math.min(delta, 0.05);
    const k   = keys.current;
    const yaw = yawRef.current;
    const pos = charPosRef.current;
    const j   = jumpRef.current;

    const isSprinting = k.ShiftLeft || k.ShiftRight;
    const isMoving    = !paused && (k.KeyW || k.KeyS || k.KeyA || k.KeyD ||
                                    k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight);

    // ── XZ movement ────────────────────────────────────────────────────────────
    if (!paused) {
      _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const spd = isSprinting ? RUN_SPD : WALK_SPD;

      if (k.KeyW || k.ArrowUp)    pos.addScaledVector(_fwd,    spd       * dt);
      if (k.KeyS || k.ArrowDown)  pos.addScaledVector(_fwd,   -spd * 0.55 * dt);
      if (k.KeyA || k.ArrowLeft)  pos.addScaledVector(_right, -spd * 0.75 * dt);
      if (k.KeyD || k.ArrowRight) pos.addScaledVector(_right,  spd * 0.75 * dt);
    }

    // ── Dodge impulse — exponential deceleration for smooth Matrix-style glide ──
    if (dodgeRef.current.active) {
      // Decay velocity: half-life ≈ 0.18s  (1 - 3.8*dt per frame)
      const decay = Math.max(0, 1 - dt * 3.8);
      dodgeRef.current.vel.multiplyScalar(decay);
      dodgeRef.current.t -= dt;

      const speed = dodgeRef.current.vel.length();
      if (dodgeRef.current.t <= 0 || speed < 0.8) {
        dodgeRef.current.active = false;
        dodgeRef.current.vel.set(0, 0, 0);
        stateRef.current.dodging = false;
      } else {
        pos.addScaledVector(dodgeRef.current.vel, dt);
      }
    }

    // ── Wall-jump X impulse (decays) ────────────────────────────────────────────
    if (Math.abs(j.vx) > 0.1) {
      pos.x += j.vx * dt;
      j.vx  *= (1 - dt * 7.0);   // drag: ~0 in ~0.4s
    } else {
      j.vx = 0;
    }

    // ── Flying mode (ROOT ACCESS) ───────────────────────────────────────────────
    const isFlying = flyingRef?.current ?? false;
    stateRef.current.flying = isFlying;

    if (isFlying) {
      const flySpd = 14;
      if (!paused) {
        if (k.Space)                             pos.y += flySpd * dt;
        if (k.ControlLeft || k.ControlRight)     pos.y -= flySpd * dt;
      }
      pos.y = THREE.MathUtils.clamp(pos.y, -10, 80);
      j.vy      = 0;
      j.grounded = false;
    } else {
      // ── Normal gravity + jump ─────────────────────────────────────────────────
      if (!j.grounded) j.vy -= GRAVITY * dt;
      pos.y = Math.max(0, pos.y + j.vy * dt);
      if (pos.y <= 0) {
        pos.y = 0;
        j.vy  = 0;
        if (!j.grounded) j.grounded = true;
      }
    }

    // Wall-jump cooldown
    if (j.wallCd > 0) j.wallCd -= dt;

    // ── Bounds + wall contact detection ────────────────────────────────────────
    const prevX = pos.x;
    pos.x = THREE.MathUtils.clamp(pos.x, bounds.xMin, bounds.xMax);
    pos.z = THREE.MathUtils.clamp(pos.z, bounds.zMin, bounds.zMax);

    // Detect which wall we're touching (only when airborne for wall-jump)
    if (!j.grounded) {
      if (pos.x <= bounds.xMin + 0.12)       j.wallContact = -1;
      else if (pos.x >= bounds.xMax - 0.12)  j.wallContact =  1;
      else                                    j.wallContact =  0;
    } else {
      j.wallContact = 0;
    }

    // ── Crouch ─────────────────────────────────────────────────────────────────
    crouchRef.current = (k.ControlLeft || k.ControlRight || k.KeyC) && j.grounded;

    // ── Animation state ────────────────────────────────────────────────────────
    stateRef.current.moving    = isMoving;
    stateRef.current.running   = isSprinting;
    stateRef.current.grounded  = j.grounded;
    stateRef.current.jumping   = !j.grounded;
    stateRef.current.crouching = crouchRef.current;

    // Punch animation countdown
    if (stateRef.current.punching) {
      stateRef.current.punchT += dt / PUNCH_DUR;
      if (stateRef.current.punchT >= 1) {
        stateRef.current.punching = false;
        stateRef.current.punchT   = 0;
      }
    }
    // Kick animation countdown
    if (stateRef.current.kicking) {
      stateRef.current.kickT += dt / KICK_DUR;
      if (stateRef.current.kickT >= 1) {
        stateRef.current.kicking = false;
        stateRef.current.kickT   = 0;
      }
    }
    // Shoot animation tick
    if (stateRef.current.shooting) {
      stateRef.current.shootT = Math.min(1, (stateRef.current.shootT || 0) + dt / 0.28);
    }

    // ── Character mesh ─────────────────────────────────────────────────────────
    if (groupRef.current) {
      groupRef.current.position.copy(pos);
      groupRef.current.rotation.y = yaw + Math.PI;
    }

    // ── TPS Camera ─────────────────────────────────────────────────────────────
    _camOff.set(0, 0, CAM_DIST);
    _camOff.applyAxisAngle(_Y, yaw);
    const pitchAdj = pitchRef.current * 1.6;
    state.camera.position.set(
      pos.x + _camOff.x,
      pos.y + CAM_H + pitchAdj * 0.4,
      pos.z + _camOff.z
    );
    _lookAt.set(pos.x, pos.y + CAM_LOOK + pitchAdj, pos.z);
    state.camera.lookAt(_lookAt);
    if (cameraForwardRef?.current) state.camera.getWorldDirection(cameraForwardRef.current);

    // ── Door proximity ──────────────────────────────────────────────────────────
    if (sceneId === 'corridor' && onNearDoor) {
      let closest = null, minDz = MATRIX_DOOR_DIST;
      for (const door of MATRIX_DOORS) {
        const dz = Math.abs(pos.z - door.position.z);
        if (dz < minDz) { minDz = dz; closest = door; }
      }
      if (closest?.id !== nearRef.current?.id) {
        nearRef.current = closest;
        onNearDoor(closest);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <NeoBody stateRef={stateRef} />
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.52, 12]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}
