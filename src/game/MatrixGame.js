import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';
import WakeUpSequence  from './WakeUpSequence';
import MatrixRain      from './MatrixRain';
import MatrixCorridor  from './MatrixCorridor';
import MatrixDoor      from './MatrixDoor';
import MatrixRoom      from './MatrixRoom';
import MatrixBullet    from './MatrixBullet';
import AgentSmith      from './AgentSmith';
import PlayerCharacter from './PlayerCharacter';
import HUD             from './HUD';
import { MATRIX_DOORS, MATRIX_DOOR_DIST, ROOM, KEY_POSITION } from './constants';

// ── Constants ─────────────────────────────────────────────────────────────────
const DODGE_SPD   = 18;
const DODGE_DUR   = 0.30;
const BT_DURATION = 5.0;
const BT_COOLDOWN = 8;
const BT_SCALE    = 0.12;
const PUNCH_RANGE = 2.6;
const PUNCH_DMG   = 34;    // 3 punches to kill

const COR_BOUNDS  = { xMin: -4.3, xMax: 4.3, zMin: -295, zMax: 1 };
const ROOM_BOUNDS = {
  xMin: -ROOM.halfW + 0.4,
  xMax:  ROOM.halfW - 0.4,
  zMin:  ROOM.exitZ - 2,
  zMax:  5,
};

// ── Red-pill key collectible ──────────────────────────────────────────────────
function KeyItem({ playerPosRef, onCollect, collected }) {
  const meshRef   = useRef();
  const doneRef   = useRef(false);

  useFrame(({ clock }) => {
    if (doneRef.current) return;
    if (collected) { doneRef.current = true; return; }
    const t = clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 2.2;
      meshRef.current.position.y = KEY_POSITION.y + Math.sin(t * 2.4) * 0.14;
    }
    // Auto-collect on proximity
    const p = playerPosRef.current;
    const d = Math.sqrt((p.x - KEY_POSITION.x) ** 2 + (p.z - KEY_POSITION.z) ** 2);
    if (d < 1.8) { doneRef.current = true; onCollect?.(); }
  });

  if (collected) return null;

  return (
    <group position={[KEY_POSITION.x, KEY_POSITION.y, KEY_POSITION.z]}>
      <group ref={meshRef}>
        {/* Red pill */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.10, 0.26, 6, 10]} />
          <meshStandardMaterial color="#cc0000" emissive="#ff2200" emissiveIntensity={3.2} />
        </mesh>
        <pointLight color="#ff2200" intensity={5} distance={8} decay={2} />
      </group>
      {/* Floor halo ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -KEY_POSITION.y + 0.02, 0]}>
        <ringGeometry args={[0.5, 0.7, 24]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={2}
          transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── ROOT ACCESS sky scene ─────────────────────────────────────────────────────
function SkyRoom() {
  const cloudsRef = useRef([]);
  const gridRef   = useRef();

  const clouds = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x:  (Math.random() - 0.5) * 110,
    y:  8 + Math.random() * 32,
    z:  -(Math.random() * 140 + 5),
    sx: 4 + Math.random() * 10,
    sy: 1.8 + Math.random() * 3.5,
    sz: 3 + Math.random() * 7,
    spd: 0.6 + Math.random() * 0.8,
  })), []);

  const stars = useMemo(() => {
    const arr = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 400;
      arr[i * 3 + 1] = 20 + Math.random() * 80;
      arr[i * 3 + 2] = -(Math.random() * 300 + 10);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Slow drift of clouds
    cloudsRef.current.forEach((c, i) => {
      if (!c) return;
      c.position.x = clouds[i].x + Math.sin(t * clouds[i].spd * 0.12 + i) * 6;
      c.position.y = clouds[i].y + Math.sin(t * clouds[i].spd * 0.08 + i * 2) * 1.5;
    });
    if (gridRef.current) {
      gridRef.current.material.emissiveIntensity = 0.18 + Math.sin(t * 0.7) * 0.06;
    }
  });

  return (
    <>
      <color attach="background" args={['#04031a']} />
      <fog   attach="fog"        args={['#04031a', 100, 280]} />
      <ambientLight color="#2244cc" intensity={1.8} />
      <directionalLight position={[20, 50, -30]} color="#6688ff" intensity={2.5} />
      <pointLight position={[0, 20, -30]} color="#00ff88" intensity={4} distance={80} />

      {/* Stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={stars} count={600} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.18} transparent opacity={0.9} sizeAttenuation />
      </points>

      {/* Matrix city grid far below */}
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -22, -70]}>
        <planeGeometry args={[500, 300, 60, 40]} />
        <meshStandardMaterial color="#001a00" emissive="#00ff41" emissiveIntensity={0.2} wireframe />
      </mesh>

      {/* Clouds */}
      {clouds.map((c, i) => (
        <mesh key={i} ref={el => { cloudsRef.current[i] = el; }}
          position={[c.x, c.y, c.z]}
          scale={[c.sx, c.sy, c.sz]}>
          <sphereGeometry args={[1, 5, 4]} />
          <meshStandardMaterial color="#c8d0ff" emissive="#3344aa"
            emissiveIntensity={0.3} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}

      {/* City silhouette towers on the horizon */}
      {[-40, -22, -8, 8, 22, 40, -55, 55].map((bx, i) => {
        const h = 12 + (i % 3) * 8;
        return (
          <mesh key={i} position={[bx, -22 + h / 2, -160 - (i % 4) * 20]}>
            <boxGeometry args={[4 + (i % 3) * 2, h, 4 + (i % 2) * 3]} />
            <meshStandardMaterial color="#050a14" emissive="#0033ff" emissiveIntensity={0.15} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Scene (inside Canvas) ─────────────────────────────────────────────────────
function Scene({
  charPosRef, yawRef, pitchRef, dodgeRef, crouchRef, timeScaleRef, stateRef,
  agentRegistryRef, flyingRef,
  onNearDoor, nearDoor, openDoor, onCatch, onShoot, paused, sceneId,
  isNearTerminal, isNearExit, onNearTerminal, onNearExit, onExitRoom,
  agentKey, onAgentSpawn, onAgentDead,
  hasKey, onCollectKey,
}) {
  const inCorridor = sceneId === 'corridor';
  const roomId     = inCorridor ? null : sceneId.replace('room-', '');
  const isRootRoom = roomId === 'locked-2';
  const bounds     = inCorridor ? COR_BOUNDS : ROOM_BOUNDS;

  const registerAgent = useCallback((reg) => {
    agentRegistryRef.current.push(reg);
    return () => {
      agentRegistryRef.current = agentRegistryRef.current.filter(r => r !== reg);
    };
  }, [agentRegistryRef]);

  return (
    <>
      {inCorridor ? (
        <>
          <ambientLight color="#e8e4dc" intensity={2.4} />
          <color attach="background" args={['#d5d2c9']} />
          <fog   attach="fog"        args={['#d5d2c9', 30, 280]} />
          <MatrixCorridor />
          {MATRIX_DOORS.map(d => (
            <MatrixDoor key={d.id} {...d} isActive={nearDoor?.id === d.id} />
          ))}
          {/* Red-pill key collectible */}
          <KeyItem playerPosRef={charPosRef} onCollect={onCollectKey} collected={hasKey} />
          {/* Single agent — remounts with new key when previous dies */}
          <AgentSmith key={agentKey} spawnOffset={{ z: 22 }} spawnDelay={4500} shootInterval={3200}
            playerPosRef={charPosRef} dodgeRef={dodgeRef} timeScaleRef={timeScaleRef}
            onCatch={onCatch} onShoot={onShoot} onRegister={registerAgent}
            onSpawn={onAgentSpawn} onDead={onAgentDead}
            paused={paused} bounds={COR_BOUNDS} />
        </>
      ) : isRootRoom ? (
        <>
          <SkyRoom />
          {/* No agent in the sky — Neo is free */}
        </>
      ) : (
        <>
          <MatrixRoom
            roomId={roomId}
            playerPosRef={charPosRef}
            isNearTerminal={isNearTerminal}
            isNearExit={isNearExit}
            onNearTerminal={onNearTerminal}
            onNearExit={onNearExit}
            onExitReached={onExitRoom}
          />
          {/* Solo agent per room */}
          <AgentSmith key={agentKey} spawnOffset={{ z: 3 }} spawnDelay={4000} shootInterval={3400}
            playerPosRef={charPosRef} dodgeRef={dodgeRef} timeScaleRef={timeScaleRef}
            onCatch={onCatch} onShoot={onShoot} onRegister={registerAgent}
            onSpawn={onAgentSpawn} onDead={onAgentDead}
            paused={paused} bounds={ROOM_BOUNDS} />
        </>
      )}

      {/* Neo — the playable character */}
      <PlayerCharacter
        charPosRef={charPosRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        dodgeRef={dodgeRef}
        crouchRef={crouchRef}
        stateRef={stateRef}
        flyingRef={flyingRef}
        bounds={isRootRoom ? { xMin: -80, xMax: 80, zMin: -200, zMax: 10 } : bounds}
        paused={paused}
        onNearDoor={onNearDoor}
        sceneId={sceneId}
      />

      <AdaptiveDpr pixelated />
    </>
  );
}

// ── Overlays ──────────────────────────────────────────────────────────────────
// Red screen flash when Neo is grabbed
function CaughtOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, pointerEvents: 'none',
      background: 'rgba(0,255,65,0.09)',
      animation: 'mxFlash 0.12s ease-in-out 5 alternate',
    }} />
  );
}

// Fires once when an agent spawns (not on contact)
function AgentSpawnAlert() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 503, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,65,0.07)',
        animation: 'mxFlash 0.15s ease-in-out 3 alternate' }} />
      <div style={{
        position: 'absolute', top: '22%', left: '50%',
        transform: 'translate(-50%,-50%)',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'clamp(0.9rem, 2.5vw, 1.6rem)',
        color: '#00ff41', textShadow: '0 0 30px #00ff41',
        letterSpacing: '0.28em', animation: 'mxTextIn 0.25s ease',
        whiteSpace: 'nowrap',
      }}>▶  AGENT INCOMING</div>
    </div>
  );
}

// Neo HP bar — bottom-left corner
function NeoHealthBar({ hp, maxHp = 100 }) {
  const ratio = Math.max(0, hp / maxHp);
  const hsl   = `hsl(${ratio * 115}, 100%, 45%)`;
  return (
    <div style={{
      position: 'fixed', bottom: 22, left: 20, zIndex: 15,
      pointerEvents: 'none',
      fontFamily: '"Share Tech Mono", monospace',
    }}>
      <div style={{ fontSize: '0.58rem', color: 'rgba(200,255,200,0.55)', letterSpacing: '0.15em', marginBottom: 4 }}>
        NEO  {hp} / {maxHp}
      </div>
      <div style={{ width: 130, height: 7, background: 'rgba(0,0,0,0.55)', borderRadius: 3, border: '1px solid rgba(0,255,65,0.2)' }}>
        <div style={{
          height: '100%', width: `${ratio * 100}%`,
          background: hsl,
          borderRadius: 3,
          boxShadow: `0 0 6px ${hsl}`,
          transition: 'width 0.15s ease, background 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// "SIMULATION TERMINATED" death screen
function DeathScreen({ onRestart }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
      fontFamily: '"Share Tech Mono", monospace',
    }}>
      <div style={{ fontSize: 'clamp(1.2rem, 4vw, 2.4rem)', color: '#ff2200',
        textShadow: '0 0 40px #ff2200', letterSpacing: '0.25em' }}>
        SIMULATION TERMINATED
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,100,100,0.6)', letterSpacing: '0.18em' }}>
        NEO HAS BEEN ELIMINATED
      </div>
      <button onClick={onRestart} style={{
        marginTop: 12,
        background: 'transparent', border: '1px solid #00ff41',
        color: '#00ff41', fontFamily: 'inherit',
        fontSize: '0.85rem', letterSpacing: '0.2em',
        padding: '10px 32px', cursor: 'pointer',
        textShadow: '0 0 10px #00ff41',
        boxShadow: '0 0 12px rgba(0,255,65,0.2)',
      }}>[ RESTART ]</button>
    </div>
  );
}

function HitOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 502, pointerEvents: 'none',
      background: 'rgba(255,50,0,0.32)',
      animation: 'mxFlash 0.1s ease-in-out 3 alternate',
    }} />
  );
}

function PunchHitOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 501, pointerEvents: 'none',
      background: 'rgba(255,200,0,0.18)',
      animation: 'mxFlash 0.08s ease-in-out 2 alternate',
    }} />
  );
}

function KickImpactOverlay() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 504, pointerEvents: 'none' }}>
      {/* Full white flash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(255,255,255,0.42)',
        animation: 'mxFlash 0.06s ease-out 1',
      }} />
      {/* Green ring burst from center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 0, height: 0,
        border: '0px solid #00ff41',
        borderRadius: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'kickRing 0.28s ease-out forwards',
        boxShadow: '0 0 30px #00ff41',
        pointerEvents: 'none',
      }} />
      {/* IMPACT text */}
      <div style={{
        position: 'absolute', top: '44%', left: '50%',
        transform: 'translate(-50%,-50%)',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'clamp(1.4rem, 4vw, 2.8rem)',
        color: '#00ff41', textShadow: '0 0 30px #00ff41, 0 0 60px #00ff41',
        letterSpacing: '0.3em', fontWeight: 'bold',
        animation: 'kickText 0.32s ease-out forwards',
        whiteSpace: 'nowrap',
      }}>IMPACT</div>
    </div>
  );
}

function BulletTimeOverlay({ timeLeft, maxTime }) {
  const pct = timeLeft / maxTime;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 6, pointerEvents: 'none' }}>
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(0,200,255,0.12)' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: 'linear-gradient(90deg, #0055ff, #00aaff, #00ffcc)',
          boxShadow: '0 0 14px #00ccff, 0 0 30px #0066ff',
          transition: 'width 0.1s linear',
        }} />
      </div>
      {/* Label */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        fontFamily: '"Share Tech Mono", monospace', fontSize: '0.78rem',
        letterSpacing: '0.28em', color: '#00ddff',
        textShadow: '0 0 20px #00aaff, 0 0 50px #0055ff',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>◈ BULLET TIME &nbsp; {timeLeft.toFixed(1)}s</div>
      {/* Chromatic aberration border glow */}
      <div style={{
        position: 'absolute', inset: 0,
        boxShadow: 'inset 8px 0 40px rgba(220,0,0,0.14), inset -8px 0 40px rgba(0,40,220,0.14)',
      }} />
      {/* Blue radial vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 28%, rgba(0,60,220,0.14) 100%)',
        boxShadow: 'inset 0 0 140px rgba(0,120,255,0.20)',
      }} />
      {/* Scan lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,160,255,0.025) 3px, rgba(0,160,255,0.025) 4px)',
      }} />
    </div>
  );
}

function KeyCollectedOverlay() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 510, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(200,0,0,0.12)',
        animation: 'mxFlash 0.2s ease-in-out 4 alternate' }} />
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        transform: 'translate(-50%,-50%)',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'clamp(1rem, 3vw, 1.9rem)',
        color: '#ff4422', textShadow: '0 0 40px #ff2200, 0 0 80px #cc0000',
        letterSpacing: '0.24em', animation: 'mxTextIn 0.3s ease',
        whiteSpace: 'nowrap', textAlign: 'center',
      }}>
        ● RED PILL ACQUIRED<br />
        <span style={{ fontSize: '0.65em', color: 'rgba(255,150,100,0.75)', letterSpacing: '0.18em' }}>
          LOCKED DOORS NOW ACCESSIBLE
        </span>
      </div>
    </div>
  );
}

function FlyingHUD() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 7, pointerEvents: 'none',
    }}>
      {/* Top label */}
      <div style={{
        position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
        fontFamily: '"Share Tech Mono", monospace', fontSize: '0.72rem',
        letterSpacing: '0.26em', color: '#6688ff',
        textShadow: '0 0 20px #4466ff, 0 0 40px #2244cc',
        whiteSpace: 'nowrap', animation: 'btPulse 1.2s ease-in-out infinite alternate',
      }}>◈ ROOT ACCESS — NEO IS FREE</div>
      {/* Subtle blue vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(30,40,160,0.12) 100%)',
        boxShadow: 'inset 0 0 100px rgba(40,60,200,0.15)',
      }} />
      {/* Controls hint bottom */}
      <div style={{
        position: 'absolute', bottom: 38, left: '50%', transform: 'translateX(-50%)',
        fontFamily: '"Share Tech Mono", monospace', fontSize: '0.58rem',
        color: 'rgba(100,120,255,0.5)', letterSpacing: '0.12em',
        whiteSpace: 'nowrap',
      }}>SPACE FLY UP · CTRL FLY DOWN · WASD MOVE</div>
    </div>
  );
}

function AccessDeniedOverlay() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 501, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,0,0,0.1)',
        animation: 'mxFlash 0.08s ease-in-out 6 alternate' }} />
      <div style={{
        position: 'absolute', top: '48%', left: '50%',
        transform: 'translate(-50%,-50%)',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'clamp(1.2rem, 3.5vw, 2.4rem)',
        color: '#ff2200', textShadow: '0 0 40px #ff2200',
        letterSpacing: '0.25em', animation: 'mxTextIn 0.2s ease',
      }}>ACCESS DENIED</div>
    </div>
  );
}

function BulletWarnOverlay({ angle }) {
  // Convert world angle to screen edge arrow
  const deg = (angle * 180 / Math.PI + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const R = 42; // % from center
  const cx = 50 + R * Math.sin(rad);
  const cy = 50 - R * Math.cos(rad);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 503, pointerEvents: 'none' }}>
      {/* Red vignette pulse on the incoming side */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at ${cx}% ${cy}%, rgba(255,30,0,0.35) 0%, transparent 55%)`,
        animation: 'mxFlash 0.18s ease-in-out 3 alternate',
      }} />
      {/* DODGE label */}
      <div style={{
        position: 'absolute',
        left: `${cx}%`, top: `${cy}%`,
        transform: 'translate(-50%,-50%)',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: '0.72rem', letterSpacing: '0.18em',
        color: '#ff3300', textShadow: '0 0 12px #ff2200',
        animation: 'btPulse 0.18s ease-in-out infinite alternate',
        whiteSpace: 'nowrap',
      }}>!! DODGE !!</div>
    </div>
  );
}

function NearAgentPrompt() {
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
      fontFamily: '"Share Tech Mono", monospace', fontSize: '0.8rem',
      color: '#ffdd00', letterSpacing: '0.2em',
      textShadow: '0 0 12px #ffaa00',
      animation: 'btPulse 0.6s ease-in-out infinite alternate',
      pointerEvents: 'none', zIndex: 12,
    }}>[ J ]  STRIKE AGENT</div>
  );
}

function FadeOverlay({ active }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800, background: '#000',
      pointerEvents: active ? 'all' : 'none',
      opacity: active ? 1 : 0, transition: 'opacity 0.45s ease',
    }} />
  );
}

function BTCooldownBar({ coolRef, maxCD }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setPct(coolRef.current > 0 ? coolRef.current / maxCD : 0);
    }, 100);
    return () => clearInterval(id);
  }, [coolRef, maxCD]);

  if (pct <= 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 46, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: '"Share Tech Mono", monospace', fontSize: '0.62rem',
      color: 'rgba(0,180,255,0.55)', letterSpacing: '0.12em',
      pointerEvents: 'none', zIndex: 10,
    }}>
      <span>BT</span>
      <div style={{ width: 80, height: 3, background: 'rgba(0,0,0,0.4)', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${(1 - pct) * 100}%`,
          background: '#0088cc', borderRadius: 2, transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MatrixGame({ resumeData }) {
  const [phase,    setPhase]    = useState('intro');
  const [sceneId,  setSceneId]  = useState('corridor');
  const [fading,   setFading]   = useState(false);
  const [nearDoor, setNearDoor] = useState(null);
  const [openDoor, setOpenDoor] = useState(null);
  const [nearTerminal,  setNearTerminal]  = useState(false);
  const [isNearExit,    setIsNearExit]    = useState(false);
  const [bullets,  setBullets]  = useState([]);
  const [caught,   setCaught]   = useState(false);
  const [hit,      setHit]      = useState(false);
  const [btActive, setBtActive] = useState(false);
  const [btLeft,   setBtLeft]   = useState(0);
  const [dodgeFlash,    setDodgeFlash]    = useState(false);
  const [punchFlash,    setPunchFlash]    = useState(false);
  const [kickFlash,     setKickFlash]     = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const [nearAgent,     setNearAgent]     = useState(false);
  const [bulletWarn,    setBulletWarn]    = useState(null);
  const [agentAlert,    setAgentAlert]    = useState(false);
  const [agentKey,      setAgentKey]      = useState(0);   // remount = new agent
  const [neoHp,         setNeoHp]         = useState(100);
  const [dead,          setDead]          = useState(false);
  const [hasKey,        setHasKey]        = useState(false);
  const [keyCollected,  setKeyCollected]  = useState(false);
  const [isFlying,      setIsFlying]      = useState(false);
  const bulletWarnRef = useRef(null);
  const neoHpRef      = useRef(100);
  const flyingRef     = useRef(false);

  // Shared refs
  const charPosRef      = useRef(new THREE.Vector3(0, 0, -8));
  const yawRef          = useRef(0);
  const pitchRef        = useRef(0);
  const crouchRef       = useRef(false);
  const dodgeRef        = useRef({ active: false, vel: new THREE.Vector3(), t: 0 });
  const timeScaleRef    = useRef(1);
  const stateRef        = useRef({
    moving: false, running: false,
    jumping: false, grounded: true,
    punching: false, punchT: 0,
    altArm: 0,          // 0=right jab, 1=left cross
    kicking: false, kickT: 0, flyKick: false,
    dodging: false, dodgeDir: 0,
    crouching: false,
  });
  const agentRegistryRef  = useRef([]);
  const btTimerRef        = useRef(0);
  const btCoolRef         = useRef(0);
  const bulletIdRef       = useRef(0);
  const corridorReturnZ   = useRef(-50);
  const currentRoomId     = useRef(null);
  const punchCdRef        = useRef(0);
  const kickCdRef         = useRef(0);
  const comboCdRef        = useRef(0);  // window to chain next punch

  // ── Check for nearby agents each frame (for prompt) ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const p = charPosRef.current;
      let found = false;
      for (const a of agentRegistryRef.current) {
        const ap = a.posRef.current;
        const d  = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
        if (d < PUNCH_RANGE + 0.5) { found = true; break; }
      }
      setNearAgent(found);
    }, 120);
    return () => clearInterval(id);
  }, []);

  // ── BT ticker ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!btActive) return;
    const id = setInterval(() => {
      btTimerRef.current -= 0.1;
      setBtLeft(Math.max(0, btTimerRef.current));
      if (btTimerRef.current <= 0) {
        clearInterval(id);
        setBtActive(false);
        timeScaleRef.current = 1;
        btCoolRef.current = BT_COOLDOWN;
      }
    }, 100);
    return () => clearInterval(id);
  }, [btActive]);

  useEffect(() => {
    const id = setInterval(() => {
      if (btCoolRef.current > 0) btCoolRef.current = Math.max(0, btCoolRef.current - 0.1);
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (openDoor) document.exitPointerLock?.(); }, [openDoor]);

  // ── Room transitions ──────────────────────────────────────────────────────
  const enterRoom = useCallback((door) => {
    if (fading) return;
    if (door?.locked && !hasKey) {
      setLockedAttempt(true);
      setTimeout(() => setLockedAttempt(false), 1500);
      return;
    }
    corridorReturnZ.current = door.position.z - 4;
    currentRoomId.current   = door.id;
    setFading(true);
    setTimeout(() => {
      setSceneId(`room-${door.id}`);
      // Root access: Neo spawns in the sky
      if (door.isRootAccess) {
        charPosRef.current.set(0, 18, -10);
        flyingRef.current = true;
        setIsFlying(true);
      } else {
        charPosRef.current.set(0, 0, 4);
        flyingRef.current = false;
        setIsFlying(false);
      }
      yawRef.current   = 0;
      pitchRef.current = 0;
      setNearDoor(null);
      setTimeout(() => setFading(false), 100);
    }, 480);
  }, [fading, hasKey]);

  const exitRoom = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setSceneId('corridor');
      flyingRef.current = false;
      setIsFlying(false);
      charPosRef.current.set(0, 0, corridorReturnZ.current);
      yawRef.current   = 0;
      pitchRef.current = 0;
      setNearTerminal(false);
      setIsNearExit(false);
      setTimeout(() => setFading(false), 100);
    }, 480);
  }, [fading]);

  // ── Key handlers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = e => {

      // ── E: interact ────────────────────────────────────────────────────
      if (e.code === 'KeyE') {
        if (openDoor) {
          setOpenDoor(null);
        } else if (sceneId === 'corridor' && nearDoor) {
          enterRoom(nearDoor);  // enterRoom handles locked/key check internally
        } else if (nearTerminal && sceneId !== 'corridor') {
          const roomDoor = MATRIX_DOORS.find(d => d.id === currentRoomId.current);
          setOpenDoor({
            id: currentRoomId.current,
            label:    roomDoor?.label    ?? '> TERMINAL',
            sublabel: roomDoor?.sublabel ?? 'Data',
          });
        }
      }
      if (e.code === 'Escape' && openDoor) setOpenDoor(null);

      // ── Dodge: Q (left) | R (right) ────────────────────────────────────
      const triggerDodge = (dirFn) => {
        if (dodgeRef.current.active) return;
        const yaw   = yawRef.current;
        const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
        // BT boost: dodge 2.5x farther when world is in slow motion
        const boost = btActive ? 2.5 : 1.0;
        const dir   = dirFn(fwd, right);
        if (dir.lengthSq() > 0) {
          dir.normalize().multiplyScalar(DODGE_SPD * boost);
          dodgeRef.current = { active: true, vel: dir, t: DODGE_DUR };
          stateRef.current.dodging  = true;
          stateRef.current.dodgeDir = dir.x < 0 ? -1 : 1;
          setDodgeFlash(true);
          setTimeout(() => setDodgeFlash(false), 200);
        }
      };

      if (e.code === 'KeyQ')               triggerDodge((_, right) => right.clone().negate());
      if (e.code === 'KeyR' && !e.ctrlKey) triggerDodge((_, right) => right.clone());

      // ── J: punch (jab → cross alternating, combo chains) ──────────────────
      if (e.code === 'KeyJ' && punchCdRef.current <= 0 && !stateRef.current.kicking) {
        const p   = charPosRef.current;
        let hit   = false;
        for (const agent of agentRegistryRef.current) {
          const ap   = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < PUNCH_RANGE) {
            agent.takeDamage(PUNCH_DMG);
            // Knockback: push agent away from player
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, 2.2);
            hit = true;
            break;
          }
        }
        // Alternate arm: jab / cross
        stateRef.current.altArm   = stateRef.current.altArm === 0 ? 1 : 0;
        stateRef.current.punching = true;
        stateRef.current.punchT   = 0;
        punchCdRef.current        = comboCdRef.current > 0 ? 0.28 : 0.42;  // faster in combo
        comboCdRef.current        = 0.55;  // reset combo window
        if (hit) {
          setPunchFlash(true);
          setTimeout(() => setPunchFlash(false), 140);
        }
      }

      // ── K: roundhouse / flying kick ────────────────────────────────────────
      if (e.code === 'KeyK' && kickCdRef.current <= 0 && !stateRef.current.punching) {
        const isSprinting = stateRef.current.running;
        // Flying kick while sprinting: longer range + player lunges forward
        const KICK_RANGE = isSprinting ? 5.2 : 3.6;
        const KICK_DMG   = isSprinting ? 67  : 50;
        const KICK_KB    = isSprinting ? 6.5 : 4.0;

        const p   = charPosRef.current;
        let hit   = false;
        for (const agent of agentRegistryRef.current) {
          const ap   = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < KICK_RANGE) {
            agent.takeDamage(KICK_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, KICK_KB);
            hit = true;
            break;
          }
        }
        stateRef.current.kicking  = true;
        stateRef.current.kickT    = 0;
        stateRef.current.flyKick  = isSprinting;
        kickCdRef.current = isSprinting ? 0.85 : 0.60;
        if (hit) {
          setKickFlash(true);
          setTimeout(() => setKickFlash(false), 340);
          // Brief freeze-frame on kick connect — even without BT
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {           // only if not already in BT
            timeScaleRef.current = 0.04;
            setTimeout(() => { timeScaleRef.current = prevScale; }, 90);
          }
        }
      }

      // ── Z / F: bullet time ──────────────────────────────────────────────
      if ((e.code === 'KeyZ' || e.code === 'KeyF') && !btActive && btCoolRef.current <= 0) {
        btTimerRef.current   = BT_DURATION;
        setBtLeft(BT_DURATION);
        setBtActive(true);
        timeScaleRef.current = BT_SCALE;
      }
    };

    const onKeyUp = e => {
      // Tick punch cd
      if (e.code === 'KeyJ') { /* handled by cd timer */ }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearDoor, openDoor, sceneId, nearTerminal, btActive, enterRoom]);

  // Tick combat cooldowns
  useEffect(() => {
    const id = setInterval(() => {
      if (punchCdRef.current  > 0) punchCdRef.current  -= 0.05;
      if (kickCdRef.current   > 0) kickCdRef.current   -= 0.05;
      if (comboCdRef.current  > 0) comboCdRef.current  -= 0.05;
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Bullets ───────────────────────────────────────────────────────────────
  const spawnBullet = useCallback((origin, direction) => {
    const id = ++bulletIdRef.current;
    setBullets(prev => [...prev.slice(-9), { id, origin: origin.clone(), direction: direction.clone() }]);
  }, []);

  const removeBullet = useCallback((id) => {
    setBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const damageNeo = useCallback((amount) => {
    const next = Math.max(0, neoHpRef.current - amount);
    neoHpRef.current = next;
    setNeoHp(next);
    if (next <= 0) setDead(true);
  }, []);

  const handleBulletHit = useCallback((id) => {
    removeBullet(id);
    if (!dodgeRef.current.active) {
      setHit(true);
      setTimeout(() => setHit(false), 340);
      damageNeo(20);
    }
  }, [removeBullet, damageNeo]);

  const handleBulletNear = useCallback((angle) => {
    if (bulletWarnRef.current) return;
    bulletWarnRef.current = setTimeout(() => { bulletWarnRef.current = null; setBulletWarn(null); }, 800);
    setBulletWarn({ angle });
  }, []);

  const handleCatch = useCallback(() => {
    if (dodgeRef.current.active) return;
    setCaught(true);
    setTimeout(() => setCaught(false), 900);
    damageNeo(25);
  }, [damageNeo]);

  const handleAgentSpawn = useCallback(() => {
    setAgentAlert(true);
    setTimeout(() => setAgentAlert(false), 2400);
  }, []);

  const handleAgentDead = useCallback(() => {
    // Wait 3s then respawn a fresh agent
    setTimeout(() => setAgentKey(k => k + 1), 3000);
  }, []);

  const handleCollectKey = useCallback(() => {
    setHasKey(true);
    setKeyCollected(true);
    setTimeout(() => setKeyCollected(false), 3200);
  }, []);

  const handleRestart = useCallback(() => {
    neoHpRef.current = 100;
    setNeoHp(100);
    setDead(false);
    flyingRef.current = false;
    setIsFlying(false);
    setAgentKey(k => k + 1);
    setBullets([]);
  }, []);

  const paused = !!openDoor || dead;

  if (phase === 'intro') return <WakeUpSequence onDone={() => setPhase('playing')} />;

  const canvasFilter = btActive
    ? 'saturate(0.5) contrast(1.14) brightness(0.95)'
    : 'none';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#010e03' }}>
      <Canvas
        camera={{ position: [0, 2.5, 5], fov: 75, near: 0.08, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 1.5]}
        style={{ filter: canvasFilter, transition: 'filter 0.25s ease', pointerEvents: paused ? 'none' : 'auto' }}
      >
        <Scene
          charPosRef={charPosRef}
          yawRef={yawRef} pitchRef={pitchRef}
          dodgeRef={dodgeRef} crouchRef={crouchRef}
          timeScaleRef={timeScaleRef} stateRef={stateRef}
          agentRegistryRef={agentRegistryRef}
          flyingRef={flyingRef}
          onNearDoor={d => setNearDoor(d)}
          nearDoor={nearDoor} openDoor={openDoor}
          onCatch={handleCatch} onShoot={spawnBullet}
          paused={paused} sceneId={sceneId}
          isNearTerminal={nearTerminal} isNearExit={isNearExit}
          onNearTerminal={v => { setNearTerminal(v); if (v) setIsNearExit(false); }}
          onNearExit={v => setIsNearExit(v)}
          onExitRoom={exitRoom}
          agentKey={agentKey}
          onAgentSpawn={handleAgentSpawn}
          onAgentDead={handleAgentDead}
          hasKey={hasKey}
          onCollectKey={handleCollectKey}
        />
        {bullets.map(b => (
          <MatrixBullet
            key={b.id} id={b.id}
            origin={b.origin} direction={b.direction}
            playerPosRef={charPosRef}
            crouchRef={crouchRef}
            dodgeRef={dodgeRef}
            timeScaleRef={timeScaleRef}
            onExpire={removeBullet}
            onHit={handleBulletHit}
            onNear={handleBulletNear}
          />
        ))}
      </Canvas>

      <MatrixRain opacity={0.07} timeScaleRef={timeScaleRef} />

      <HUD
        nearStation={
          sceneId === 'corridor'
            ? nearDoor
            : (nearTerminal
                ? { ...MATRIX_DOORS.find(d => d.id === currentRoomId.current), label: '> TERMINAL ACCESS' }
                : null)
        }
        dockedStation={openDoor}
        onUndock={() => setOpenDoor(null)}
        resumeData={resumeData}
        mode="matrix"
        stations={MATRIX_DOORS.filter(d => !d.locked)}
      />

      {/* Prompts */}
      {nearDoor && !openDoor && sceneId === 'corridor' && (
        <div style={{
          position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)',
          fontFamily: '"Share Tech Mono", monospace', fontSize: '0.8rem',
          color: nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color,
          letterSpacing: '0.18em',
          textShadow: `0 0 16px ${nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color}`,
          animation: 'btPulse 0.9s ease-in-out infinite alternate',
          pointerEvents: 'none', zIndex: 20, textTransform: 'uppercase',
        }}>
          {nearDoor.locked
            ? (hasKey
                ? `[ E ]  UNLOCK  ${nearDoor.label.replace('> ', '')}`
                : '[ LOCKED ]  FIND THE RED PILL')
            : `[ E ]  ENTER  ${nearDoor.sublabel.toUpperCase()}`}
        </div>
      )}

      {nearTerminal && !openDoor && sceneId !== 'corridor' && (
        <div style={{
          position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)',
          fontFamily: '"Share Tech Mono", monospace', fontSize: '0.8rem',
          color: '#00ff41', letterSpacing: '0.18em', textShadow: '0 0 16px #00ff41',
          animation: 'btPulse 0.9s ease-in-out infinite alternate',
          pointerEvents: 'none', zIndex: 20,
        }}>[ E ]  ACCESS TERMINAL</div>
      )}

      {nearAgent   && !openDoor && <NearAgentPrompt />}
      {bulletWarn  && !openDoor && <BulletWarnOverlay angle={bulletWarn.angle} />}
      {agentAlert  && !openDoor && <AgentSpawnAlert />}

      {/* Effects */}
      {btActive      && <BulletTimeOverlay timeLeft={btLeft} maxTime={BT_DURATION} />}
      {caught        && <CaughtOverlay />}
      {hit           && <HitOverlay />}
      {punchFlash    && <PunchHitOverlay />}
      {kickFlash     && <KickImpactOverlay />}
      {lockedAttempt && <AccessDeniedOverlay />}

      {/* HUD bars */}
      {!openDoor && <NeoHealthBar hp={neoHp} />}
      {dead      && <DeathScreen onRestart={handleRestart} />}
      {dodgeFlash    && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 499, pointerEvents: 'none',
          background: 'rgba(0,220,255,0.08)',
          animation: 'mxFlash 0.14s ease-out 2 alternate',
        }} />
      )}
      <FadeOverlay active={fading} />
      <BTCooldownBar coolRef={btCoolRef} maxCD={BT_COOLDOWN} />

      {/* Controls */}
      {!openDoor && (
        <div style={{
          position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          fontFamily: '"Share Tech Mono", monospace', fontSize: '0.60rem',
          color: 'rgba(80,80,80,0.55)', letterSpacing: '0.1em',
          pointerEvents: 'none', zIndex: 10, textAlign: 'center', whiteSpace: 'nowrap',
        }}>
          CLICK·MOUSE · WASD MOVE · SHIFT SPRINT · SPACE JUMP/WALL-JUMP · Q DODGE-L · R DODGE-R · CTRL DUCK · J PUNCH · K KICK · Z/F BULLET-TIME · E INTERACT
        </div>
      )}

      <style>{`
        @keyframes mxFlash  { from{opacity:1} to{opacity:0} }
        @keyframes mxTextIn { from{opacity:0;transform:translate(-50%,-50%) scale(1.25)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes btPulse  { from{opacity:0.65} to{opacity:1} }
        @keyframes kickRing { 0%{width:0;height:0;border-width:8px;opacity:1} 100%{width:340px;height:340px;border-width:2px;opacity:0} }
        @keyframes kickText { 0%{opacity:1;transform:translate(-50%,-50%) scale(1.4)} 60%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.85)} }
      `}</style>
    </div>
  );
}
