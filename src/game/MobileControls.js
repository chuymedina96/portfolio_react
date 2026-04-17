import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

const LOOK_SX        = 0.005;   // horizontal look sensitivity
const LOOK_SY        = 0.004;   // vertical look sensitivity
const JOYSTICK_R     = 56;      // max knob travel in px
const LEFT_ZONE_FRAC = 0.44;    // left portion of screen = joystick zone
const SPRINT_THRESH  = 0.80;    // joystick magnitude above this = sprint

// ── Button ────────────────────────────────────────────────────────────────────
function Btn({ color, w, h, onPress, children, style = {} }) {
  return (
    <button
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); onPress?.(); }}
      style={{
        width: w, height: h,
        background: 'rgba(0,0,0,0.75)',
        border: `2px solid ${color}`,
        color,
        borderRadius: 10,
        fontSize: 12,
        fontFamily: '"Share Tech Mono", monospace',
        fontWeight: 'bold',
        textShadow: `0 0 8px ${color}`,
        boxShadow: `0 0 10px ${color}44`,
        cursor: 'pointer',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        letterSpacing: '0.04em',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MobileControls({
  yawRef,
  pitchRef,
  mobileJoystickRef,
  mobileJumpRef,
  mobileSprintRef,
  onShoot,
  onPunch,
  onKick,
  onSpinKick,
  onDodgeLeft,
  onDodgeRight,
  onBulletTime,
  onInteract,
  canInteract,
  paused,
}) {
  // Touch tracking
  const joyTouchRef  = useRef(null);   // { id, baseX, baseY }
  const lookTouchRef = useRef(null);   // { id, lastX, lastY }

  // Joystick DOM refs — updated directly, no setState on every move
  const joyRingRef = useRef();
  const joyKnobRef = useRef();
  const joyIdleRef = useRef();
  const [joyActive, setJoyActive] = useState(false);

  const ringR = JOYSTICK_R + 8;

  // ── Touch start ──────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (e.target.tagName === 'BUTTON') return;

    for (const t of e.changedTouches) {
      const isLeft = t.clientX < window.innerWidth * LEFT_ZONE_FRAC;

      if (isLeft && !joyTouchRef.current) {
        joyTouchRef.current = { id: t.identifier, baseX: t.clientX, baseY: t.clientY };
        mobileJoystickRef.current = { x: 0, y: 0 };

        // Show ring/knob at touch position directly
        setJoyActive(true);
        // Position ring (set next frame after it renders)
        requestAnimationFrame(() => {
          if (joyRingRef.current) {
            joyRingRef.current.style.left = `${t.clientX - ringR}px`;
            joyRingRef.current.style.top  = `${t.clientY - ringR}px`;
          }
          if (joyKnobRef.current) {
            joyKnobRef.current.style.left = `${t.clientX - 24}px`;
            joyKnobRef.current.style.top  = `${t.clientY - 24}px`;
          }
        });

      } else if (!isLeft && !lookTouchRef.current) {
        lookTouchRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
      }
    }
  }, [mobileJoystickRef, ringR]);

  // ── Touch move ───────────────────────────────────────────────────────────────
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {

      // Joystick — update via direct DOM, zero React re-renders
      if (joyTouchRef.current?.id === t.identifier) {
        const jt    = joyTouchRef.current;
        const dx    = t.clientX - jt.baseX;
        const dy    = t.clientY - jt.baseY;
        const dist  = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const c     = Math.min(dist, JOYSTICK_R);
        const nx    = Math.cos(angle) * c / JOYSTICK_R;
        const ny    = Math.sin(angle) * c / JOYSTICK_R;

        mobileJoystickRef.current = { x: nx, y: ny };
        if (mobileSprintRef) {
          mobileSprintRef.current = Math.sqrt(nx * nx + ny * ny) > SPRINT_THRESH;
        }

        // Direct DOM update — no setState, no re-render
        if (joyKnobRef.current) {
          joyKnobRef.current.style.left = `${jt.baseX + Math.cos(angle) * c - 24}px`;
          joyKnobRef.current.style.top  = `${jt.baseY + Math.sin(angle) * c - 24}px`;
        }
      }

      // Look / aim
      if (lookTouchRef.current?.id === t.identifier) {
        const lt = lookTouchRef.current;
        yawRef.current   -= (t.clientX - lt.lastX) * LOOK_SX;
        pitchRef.current  = THREE.MathUtils.clamp(
          pitchRef.current - (t.clientY - lt.lastY) * LOOK_SY, -0.50, 0.42
        );
        lt.lastX = t.clientX;
        lt.lastY = t.clientY;
      }
    }
  }, [yawRef, pitchRef, mobileJoystickRef, mobileSprintRef]);

  // ── Touch end ────────────────────────────────────────────────────────────────
  const handleTouchEnd = useCallback((e) => {
    for (const t of e.changedTouches) {
      if (joyTouchRef.current?.id === t.identifier) {
        joyTouchRef.current = null;
        mobileJoystickRef.current = { x: 0, y: 0 };
        if (mobileSprintRef) mobileSprintRef.current = false;
        setJoyActive(false);
      }
      if (lookTouchRef.current?.id === t.identifier) {
        lookTouchRef.current = null;
      }
    }
  }, [mobileJoystickRef, mobileSprintRef]);

  useEffect(() => {
    const opts = { passive: false };
    document.addEventListener('touchstart',  handleTouchStart,  opts);
    document.addEventListener('touchmove',   handleTouchMove,   opts);
    document.addEventListener('touchend',    handleTouchEnd,    opts);
    document.addEventListener('touchcancel', handleTouchEnd,    opts);
    return () => {
      document.removeEventListener('touchstart',  handleTouchStart,  opts);
      document.removeEventListener('touchmove',   handleTouchMove,   opts);
      document.removeEventListener('touchend',    handleTouchEnd,    opts);
      document.removeEventListener('touchcancel', handleTouchEnd,    opts);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (paused) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20,
      pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Joystick ─────────────────────────────────────────────────────── */}
      {/* Active ring — positioned by direct DOM updates */}
      <div
        ref={joyRingRef}
        style={{
          display: joyActive ? 'block' : 'none',
          position: 'absolute',
          width: ringR * 2, height: ringR * 2,
          borderRadius: '50%',
          border: '2px solid rgba(0,255,65,0.45)',
          background: 'rgba(0,255,65,0.07)',
          pointerEvents: 'none',
        }}
      />
      {/* Active knob */}
      <div
        ref={joyKnobRef}
        style={{
          display: joyActive ? 'block' : 'none',
          position: 'absolute',
          width: 48, height: 48,
          borderRadius: '50%',
          background: 'rgba(0,255,65,0.45)',
          border: '2px solid rgba(0,255,65,0.9)',
          pointerEvents: 'none',
        }}
      />
      {/* Idle hint */}
      <div
        ref={joyIdleRef}
        style={{
          display: joyActive ? 'none' : 'flex',
          position: 'absolute', bottom: 64, left: 28,
          width: ringR * 2, height: ringR * 2,
          borderRadius: '50%',
          border: '1.5px solid rgba(0,255,65,0.2)',
          background: 'rgba(0,255,65,0.04)',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(0,255,65,0.12)',
          border: '1.5px solid rgba(0,255,65,0.28)',
        }} />
      </div>

      {/* ── INTERACT button — center bottom, shown when near door/terminal ── */}
      {canInteract && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'all',
        }}>
          <Btn color="#00ff41" w={110} h={50} onPress={onInteract}
            style={{ fontSize: 14, letterSpacing: '0.08em' }}>
            [ E ] ENTER
          </Btn>
        </div>
      )}

      {/* ── Right-side action buttons ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', right: 12, bottom: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
        pointerEvents: 'all',
      }}>

        {/* Row 1: Dodge + Bullet Time */}
        <div style={{ display: 'flex', gap: 7 }}>
          <Btn color="#ffaa00" w={58} h={44} onPress={onDodgeLeft}>◀ DODGE</Btn>
          <Btn color="#ffaa00" w={58} h={44} onPress={onDodgeRight}>DODGE ▶</Btn>
          <Btn color="#aa88ff" w={50} h={44} onPress={onBulletTime}>BT</Btn>
        </div>

        {/* Row 2: Combat */}
        <div style={{ display: 'flex', gap: 7 }}>
          <Btn color="#00bbff" w={58} h={54} onPress={onPunch}>PUNCH</Btn>
          <Btn color="#00bbff" w={58} h={54} onPress={onKick}>KICK</Btn>
          <Btn color="#00bbff" w={58} h={54} onPress={onSpinKick}>SPIN</Btn>
        </div>

        {/* Row 3: Jump + Fire */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn color="#00ff41" w={72} h={68} onPress={() => { mobileJumpRef.current = true; }}>JUMP</Btn>
          <Btn color="#ff3300" w={84} h={68} onPress={onShoot}
            style={{ fontSize: 17, letterSpacing: '0.1em' }}>FIRE</Btn>
        </div>
      </div>
    </div>
  );
}
