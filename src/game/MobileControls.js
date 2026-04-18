import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

const LOOK_SX        = 0.005;   // horizontal look sensitivity
const LOOK_SY        = 0.004;   // vertical look sensitivity
const JOYSTICK_R     = 56;      // max knob travel in px
const LEFT_ZONE_FRAC = 0.44;    // left portion of screen = joystick zone
const SPRINT_THRESH  = 0.80;    // joystick magnitude above this = sprint

const BTN_BASE = {
  background: 'rgba(0,0,0,0.80)',
  borderRadius: 10,
  fontSize: 11,
  fontFamily: '"Share Tech Mono", monospace',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
  letterSpacing: '0.02em',
  WebkitTapHighlightColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  padding: '0 4px',
};

// ── Hold button — sets a ref true while finger is held, false on release ────────
function HoldBtn({ color, w, h, flyRef, onStart, onEnd, children, style = {} }) {
  const [active, setActive] = useState(false);
  const activate   = () => { if (flyRef) flyRef.current = true;  onStart?.(); setActive(true);  };
  const deactivate = () => { if (flyRef) flyRef.current = false; onEnd?.();   setActive(false); };
  return (
    <button
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); activate(); }}
      onTouchEnd={e => { e.stopPropagation(); deactivate(); }}
      onTouchCancel={e => { e.stopPropagation(); deactivate(); }}
      style={{
        ...BTN_BASE,
        width: w, height: h,
        border: `2px solid ${color}`,
        color,
        textShadow: `0 0 8px ${color}`,
        background:  active ? `rgba(255,255,255,0.18)` : 'rgba(0,0,0,0.80)',
        boxShadow:   active ? `0 0 22px ${color}, inset 0 0 14px ${color}55` : `0 0 10px ${color}44`,
        transform:   active ? 'scale(0.93)' : 'scale(1)',
        transition:  'transform 0.06s, box-shadow 0.06s, background 0.06s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
function Btn({ color, w, h, onPress, children, style = {} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); setPressed(true); onPress?.(); }}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      style={{
        ...BTN_BASE,
        width: w, height: h,
        border: `2px solid ${color}`,
        color,
        textShadow: `0 0 8px ${color}`,
        background: pressed ? `rgba(255,255,255,0.18)` : 'rgba(0,0,0,0.80)',
        boxShadow:  pressed ? `0 0 22px ${color}, inset 0 0 14px ${color}55` : `0 0 10px ${color}44`,
        transform:  pressed ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 0.06s, box-shadow 0.06s, background 0.06s',
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
  mobileFlyUpRef,
  mobileFlyDownRef,
  onShoot,
  onPunch,
  onKick,
  onSpinKick,
  onUppercut,
  onDodgeLeft,
  onDodgeRight,
  onBulletTime,
  onInteract,
  blockRef,
  onBlockStart,
  onBlockEnd,
  canInteract,
  isFlying,
  isArchitect,
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
    if (paused) return;  // modal is open — don't hijack any touches
    if (e.target.tagName === 'BUTTON') return;

    for (const t of e.changedTouches) {
      const isLeft = t.clientX < window.innerWidth * LEFT_ZONE_FRAC;

      // In architect room, left-side joystick is blocked (dialogue mode — no movement)
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
  }, [paused, isArchitect, mobileJoystickRef, ringR]);

  // ── Touch move ───────────────────────────────────────────────────────────────
  const handleTouchMove = useCallback((e) => {
    if (paused) return;
    // Only block native scroll when joystick or camera look is active.
    // If neither is tracking this touch, let it scroll the modal naturally.
    const isTracked = [...e.changedTouches].some(t =>
      joyTouchRef.current?.id === t.identifier ||
      lookTouchRef.current?.id === t.identifier
    );
    if (isTracked) e.preventDefault();
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
  }, [paused, yawRef, pitchRef, mobileJoystickRef, mobileSprintRef]);

  // ── Touch end ────────────────────────────────────────────────────────────────
  const handleTouchEnd = useCallback((e) => {
    if (paused) return;
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
  }, [paused, mobileJoystickRef, mobileSprintRef]);

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

        {isFlying ? (
          /* ── Flying mode: fly up / fly down ─────────────────────────────── */
          <>
            <HoldBtn color="#00ffff" w={130} h={64} flyRef={mobileFlyUpRef}
              style={{ fontSize: 15, letterSpacing: '0.06em' }}>▲ FLY UP</HoldBtn>
            <HoldBtn color="#00aaff" w={130} h={64} flyRef={mobileFlyDownRef}
              style={{ fontSize: 15, letterSpacing: '0.06em' }}>▼ FLY DOWN</HoldBtn>
          </>
        ) : isArchitect ? (
          /* ── Architect room: no combat, just look around ─────────────────── */
          null
        ) : (
          /* ── Normal combat buttons ───────────────────────────────────────── */
          <>
            {/* Row 1: dodge + bullet time — compact height */}
            <div style={{ display: 'flex', gap: 5 }}>
              <Btn color="#ffaa00" w={58} h={36} onPress={onDodgeLeft}>◄ DGE</Btn>
              <Btn color="#ffaa00" w={58} h={36} onPress={onDodgeRight}>DGE ►</Btn>
              <Btn color="#aa88ff" w={42} h={36} onPress={onBulletTime}>BT</Btn>
            </div>
            {/* Row 2: strikes */}
            <div style={{ display: 'flex', gap: 5 }}>
              <Btn color="#00bbff" w={50} h={44} onPress={onPunch}>PUNCH</Btn>
              <Btn color="#00bbff" w={44} h={44} onPress={onKick}>KICK</Btn>
              <Btn color="#00bbff" w={44} h={44} onPress={onSpinKick}>SPIN</Btn>
              <Btn color="#ffcc44" w={50} h={44} onPress={onUppercut}>UPPER</Btn>
            </div>
            {/* Row 3: movement + fire */}
            <div style={{ display: 'flex', gap: 5 }}>
              <Btn color="#00ff41" w={56} h={58} onPress={() => { mobileJumpRef.current = true; }}>JUMP</Btn>
              <HoldBtn color="#00ffcc" w={60} h={58} flyRef={blockRef}
                onStart={onBlockStart} onEnd={onBlockEnd}>BLOCK</HoldBtn>
              <Btn color="#ff3300" w={70} h={58} onPress={onShoot}
                style={{ fontSize: 16 }}>FIRE</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
