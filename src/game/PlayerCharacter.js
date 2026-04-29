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
const PUNCH_DUR      = 0.26;
const KICK_DUR       = 0.38;
const SPIN_KICK_DUR  = 0.68;

const _fwd    = new THREE.Vector3();
const _right  = new THREE.Vector3();
const _camOff = new THREE.Vector3();
const _Y      = new THREE.Vector3(0, 1, 0);
const _lookAt = new THREE.Vector3();

// ── Neo body ───────────────────────────────────────────────────────────────────
// Intentionally blocky / voxel style but with Neo's distinctive silhouette:
// long trench coat, round wire glasses, slicked hair, tall lean build
function NeoBody({ stateRef, blockRef }) {
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
    const blocking = blockRef?.current ?? false;

    // Walk legs
    if (lLeg.current && !s.kicking && !s.spinKicking) lLeg.current.rotation.x =  Math.sin(wf) * wa;
    if (rLeg.current && !s.kicking && !s.spinKicking) rLeg.current.rotation.x = -Math.sin(wf) * wa;

    // Jab / cross / uppercut (alternate arms): altArm 0=right jab, 1=left cross, 2=right uppercut
    const pAmp      = -Math.PI * 0.92 * Math.sin(s.punchT * Math.PI);
    const upperAmpX =  Math.PI * 0.95 * Math.sin(s.punchT * Math.PI); // upward arc
    const upperAmpZ = -0.55       * Math.sin(s.punchT * Math.PI);      // inward twist

    if (lArm.current) {
      const flyTgtX  = s.flying ? Math.PI * 0.28 : 0;
      const flyTgtZ  = s.flying ? 0.9 : 0;
      const rhGuardX = (s.kicking && !s.flyKick) ? -Math.PI * 0.55 : 0;
      const tgt = s.spinKicking ? lArm.current.rotation.x
        : blocking            ? -1.15                           // guard: left arm up
        : s.flying            ? flyTgtX
        : (s.punching && s.altArm === 2) ? -0.65               // uppercut: left arm guard raise
        : (s.punching && s.altArm === 1) ? pAmp
        : (s.kicking && !s.flyKick)      ? rhGuardX
        : -Math.sin(wf) * wa * 0.5;
      lArm.current.rotation.x = THREE.MathUtils.lerp(lArm.current.rotation.x, tgt, 0.18);
      const tgtZ = s.spinKicking ? lArm.current.rotation.z
        : blocking ? 0.45
        : s.flying ? flyTgtZ : (s.kicking && s.flyKick) ? 0.45 : (s.kicking ? 0.35 : 0);
      lArm.current.rotation.z = THREE.MathUtils.lerp(lArm.current.rotation.z, tgtZ, 0.18);
    }
    if (rArm.current) {
      const kickSpread = (s.kicking && s.flyKick) ? Math.PI * 0.35 : 0;
      const flyTgtX    = s.flying ? Math.PI * 0.28 : 0;
      const rhKickTgt  = (s.kicking && !s.flyKick) ? Math.PI * 0.45 : kickSpread;
      const tgt = s.spinKicking ? rArm.current.rotation.x
        : blocking                       ? -1.0                 // guard: right arm up
        : s.flying                       ? flyTgtX
        : s.kicking                      ? rhKickTgt
        : (s.punching && s.altArm === 2) ? upperAmpX            // uppercut: upward swing
        : (s.punching && s.altArm === 0) ? pAmp
        : Math.sin(wf) * wa * 0.5;
      rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, tgt, 0.18);
      const tgtZ = s.spinKicking ? rArm.current.rotation.z
        : blocking                       ? -0.42
        : s.flying                       ? -0.9
        : (s.kicking && s.flyKick)       ? -0.45
        : s.kicking                      ? -0.55
        : (s.punching && s.altArm === 2) ? upperAmpZ            // uppercut: inward twist
        : 0;
      rArm.current.rotation.z = THREE.MathUtils.lerp(rArm.current.rotation.z, tgtZ, 0.18);
      if (s.shooting) {
        const sAmp = -Math.PI * 0.7 * Math.sin((s.shootT || 0) * Math.PI);
        rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, sAmp, 0.4);
      }
    }

    // Roundhouse kick — chamber to side → horizontal sweep → retract
    if (kickR.current) {
      if (s.kicking) {
        const kp = s.kickT;
        let kx, kz, ky, bodyY;

        if (kp < 0.28) {
          // Chamber: knee lifts up and out to the right side
          const p = kp / 0.28;
          kz    = -p * 1.05;                // swing leg outward
          kx    = -p * 0.45;               // slight raise
          ky    =  p * 0.25;               // subtle depth rotation
          bodyY =  p * 0.5;                // body pivots to load kick
        } else if (kp < 0.68) {
          // Sweep: leg whips horizontally from the outside in, rising to near-horizontal
          const p = (kp - 0.28) / 0.40;
          kz    = THREE.MathUtils.lerp(-1.05,  0.55, p); // sweep inward past centre
          kx    = THREE.MathUtils.lerp(-0.45, -Math.PI * 0.80, p); // rise as it sweeps
          ky    = THREE.MathUtils.lerp( 0.25, -0.18, p);
          bodyY = THREE.MathUtils.lerp( 0.50,  1.05, p); // follow-through rotation
        } else {
          // Retract: snap leg back
          const p = (kp - 0.68) / 0.32;
          kz    = THREE.MathUtils.lerp( 0.55, 0, p);
          kx    = THREE.MathUtils.lerp(-Math.PI * 0.80, 0, p);
          ky    = THREE.MathUtils.lerp(-0.18, 0, p);
          bodyY = THREE.MathUtils.lerp( 1.05, 0, p);
        }

        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, kx, 0.38);
        kickR.current.rotation.z = THREE.MathUtils.lerp(kickR.current.rotation.z, kz, 0.38);
        kickR.current.rotation.y = THREE.MathUtils.lerp(kickR.current.rotation.y, ky, 0.30);
        if (tilt.current) tilt.current.rotation.y = THREE.MathUtils.lerp(tilt.current.rotation.y, bodyY, 0.28);
        if (rLeg.current) rLeg.current.rotation.x = 0;
      } else {
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, 0, 0.14);
        kickR.current.rotation.z = THREE.MathUtils.lerp(kickR.current.rotation.z, 0, 0.14);
        kickR.current.rotation.y = THREE.MathUtils.lerp(kickR.current.rotation.y, 0, 0.14);
      }
    }

    // ── Spinning hook kick ───────────────────────────────────────────────────────
    if (s.spinKicking && kickR.current && tilt.current) {
      const sp = s.spinKickT;

      // Full-body spin: wind-up (counter-rotation), then sweep 1.15 rotations
      if (sp < 0.10) {
        const p = sp / 0.10;
        tilt.current.rotation.y = THREE.MathUtils.lerp(tilt.current.rotation.y, 0.30, 0.30);
      } else {
        const p    = (sp - 0.10) / 0.90;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        tilt.current.rotation.y = 0.30 - ease * 2.3 * Math.PI;
      }

      // Kicking leg: rise and hook across body
      if (sp < 0.28) {
        const p = sp / 0.28;
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, -p * 0.55, 0.32);
        kickR.current.rotation.z = THREE.MathUtils.lerp(kickR.current.rotation.z, -p * 0.60, 0.32);
        kickR.current.rotation.y = THREE.MathUtils.lerp(kickR.current.rotation.y,  p * 0.30, 0.28);
      } else if (sp < 0.74) {
        const p = (sp - 0.28) / 0.46;
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, -0.55 - p * Math.PI * 0.72, 0.42);
        kickR.current.rotation.z = THREE.MathUtils.lerp(kickR.current.rotation.z, -0.60 + p * 1.50, 0.42); // hook sweeps inward
        kickR.current.rotation.y = THREE.MathUtils.lerp(kickR.current.rotation.y,  0.30 - p * 0.55, 0.32);
      } else {
        kickR.current.rotation.x = THREE.MathUtils.lerp(kickR.current.rotation.x, 0, 0.16);
        kickR.current.rotation.z = THREE.MathUtils.lerp(kickR.current.rotation.z, 0, 0.16);
        kickR.current.rotation.y = THREE.MathUtils.lerp(kickR.current.rotation.y, 0, 0.16);
      }

      // Arms fly wide for spinning momentum, pull in at follow-through
      const armAmp = sp < 0.75 ? 1.0 : (1 - (sp - 0.75) / 0.25);
      if (lArm.current) {
        lArm.current.rotation.x = THREE.MathUtils.lerp(lArm.current.rotation.x, Math.PI * 0.18 * armAmp, 0.22);
        lArm.current.rotation.z = THREE.MathUtils.lerp(lArm.current.rotation.z, 1.0 * armAmp, 0.22);
      }
      if (rArm.current) {
        rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, Math.PI * 0.18 * armAmp, 0.22);
        rArm.current.rotation.z = THREE.MathUtils.lerp(rArm.current.rotation.z, -1.0 * armAmp, 0.22);
      }

      if (rLeg.current) rLeg.current.rotation.x = 0;
    }

    // Body lean: dodge = sideways, crouch = lean back (Matrix bullet-dodge)
    if (tilt.current) {
      const tz = s.dodging   ? s.dodgeDir * 0.38 : 0;
      const tx = s.flying    ? 0.28
               : blocking    ? -0.18                  // block: slight forward hunch
               : s.crouching ? 0.65
               : s.kicking   ? -0.22
               : !s.grounded ? -0.14
               : 0;
      const lerpZ = s.dodging ? 0.32 : 0.14;
      const lerpX = s.crouching ? 0.22 : 0.14;
      tilt.current.rotation.z = THREE.MathUtils.lerp(tilt.current.rotation.z, tz, lerpZ);
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, tx, lerpX);
      // Reset y when neither kick type is active
      if (!s.kicking && !s.spinKicking) {
        tilt.current.rotation.y = THREE.MathUtils.lerp(tilt.current.rotation.y, 0, 0.12);
      }
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
  blockRef,
  bounds,
  paused,
  onNearDoor,
  sceneId,
  cameraForwardRef,
  mobileJoystickRef,
  mobileJumpRef,
  mobileSprintRef,
  mobileFlyUpRef,
  mobileFlyDownRef,
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
      if (!document.pointerLockElement && !paused) gl.domElement.requestPointerLock?.();
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
    const dt    = Math.min(delta, 0.05);
    const k     = keys.current;
    const yaw   = yawRef.current;
    const pitch = pitchRef.current;
    const pos   = charPosRef.current;
    const j     = jumpRef.current;

    const mj = mobileJoystickRef?.current;
    const mjMag = mj ? Math.sqrt(mj.x * mj.x + mj.y * mj.y) : 0;
    const isSprinting = k.ShiftLeft || k.ShiftRight || (mobileSprintRef?.current ?? false);
    const isMoving    = !paused && (
      k.KeyW || k.KeyS || k.KeyA || k.KeyD ||
      k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight ||
      mjMag > 0.06
    );

    // ── XZ movement ────────────────────────────────────────────────────────────
    if (!paused) {
      _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const spd = isSprinting ? RUN_SPD : WALK_SPD;

      if (k.KeyW || k.ArrowUp)    pos.addScaledVector(_fwd,    spd       * dt);
      if (k.KeyS || k.ArrowDown)  pos.addScaledVector(_fwd,   -spd * 0.55 * dt);
      if (k.KeyA || k.ArrowLeft)  pos.addScaledVector(_right, -spd * 0.75 * dt);
      if (k.KeyD || k.ArrowRight) pos.addScaledVector(_right,  spd * 0.75 * dt);

      // Mobile joystick input — joystick.y is screen-down = backward, so negate for forward
      if (mobileJoystickRef?.current) {
        const mj = mobileJoystickRef.current;
        if (Math.abs(mj.x) > 0.06 || Math.abs(mj.y) > 0.06) {
          pos.addScaledVector(_fwd,   -mj.y * spd * dt);
          pos.addScaledVector(_right,  mj.x * spd * dt);
        }
      }
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

    // ── Mobile jump trigger ────────────────────────────────────────────────────
    if (mobileJumpRef?.current && !flyingRef?.current) {
      mobileJumpRef.current = false;
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
    }

    // ── Flying mode (ROOT ACCESS) ───────────────────────────────────────────────
    const isFlying = flyingRef?.current ?? false;
    stateRef.current.flying = isFlying;

    if (isFlying) {
      const flySpd = 20;
      if (!paused) {
        if (k.Space || mobileFlyUpRef?.current)                              pos.y += flySpd * dt;
        if (k.ControlLeft || k.ControlRight || mobileFlyDownRef?.current)    pos.y -= flySpd * dt;
      }
      pos.y = THREE.MathUtils.clamp(pos.y, -10, 130);
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
    // Spin kick animation countdown
    if (stateRef.current.spinKicking) {
      stateRef.current.spinKickT += dt / SPIN_KICK_DUR;
      if (stateRef.current.spinKickT >= 1) {
        stateRef.current.spinKicking = false;
        stateRef.current.spinKickT   = 0;
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

    // ── TPS Camera — right-shoulder over-the-shoulder aiming ───────────────────
    _camOff.set(0, 0, CAM_DIST);
    _camOff.applyAxisAngle(_Y, yaw);
    const pitchAdj = pitch * 1.6;

    // Right-shoulder offset: camera shifts right so Neo's body is left of center.
    // Crosshair stays at screen center → aim is to the right of Neo, agents visible.
    const shoulderX =  Math.cos(yaw) * 0.65;
    const shoulderZ = -Math.sin(yaw) * 0.65;

    const camYMin = bounds.yMin != null ? bounds.yMin + 0.3 : 0.3;
    const camYMax = bounds.yMax != null ? bounds.yMax - 0.5 : 150;

    state.camera.position.set(
      THREE.MathUtils.clamp(pos.x + _camOff.x + shoulderX, bounds.xMin + 0.5, bounds.xMax - 0.5),
      THREE.MathUtils.clamp(pos.y + CAM_H + pitchAdj * 0.4, camYMin, camYMax),
      THREE.MathUtils.clamp(pos.z + _camOff.z + shoulderZ, bounds.zMin + 0.5, bounds.zMax - 0.5)
    );
    const aimX = -Math.sin(yaw) * Math.cos(pitch);
    const aimY =  Math.sin(pitch);
    const aimZ = -Math.cos(yaw) * Math.cos(pitch);
    _lookAt.set(
      state.camera.position.x + aimX * 20,
      state.camera.position.y + aimY * 20,
      state.camera.position.z + aimZ * 20,
    );
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
      <NeoBody stateRef={stateRef} blockRef={blockRef} />
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.52, 12]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}
