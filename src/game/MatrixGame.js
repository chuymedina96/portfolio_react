import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, Text, Billboard } from '@react-three/drei';
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
import { MATRIX_DOORS, ROOM, KEY_POSITION } from './constants';
import './MatrixGame.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const DODGE_SPD   = 22;   // higher launch speed — deceleration does the rest
const DODGE_DUR   = 0.50; // longer window so the eased deceleration feels graceful
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
        <meshStandardMaterial
          color="#ff2200"
          emissive="#ff2200"
          emissiveIntensity={2}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Player bullet ─────────────────────────────────────────────────────────────
function PlayerBullet({ id, origin, direction, agentRegistryRef, timeScaleRef, onExpire, onAgentHit }) {
  const groupRef = useRef();
  const posRef   = useRef(origin.clone());
  const velRef   = useRef(direction.clone().normalize().multiplyScalar(58));
  const lifeRef  = useRef(2.0);
  const doneRef  = useRef(false);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(posRef.current);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      velRef.current.clone().normalize()
    );
    groupRef.current.quaternion.copy(q);
  }, []);

  useFrame((_, delta) => {
    if (doneRef.current) return;
    const ts = timeScaleRef?.current ?? 1;
    const dt = delta * ts;
    lifeRef.current -= delta;
    if (lifeRef.current <= 0) {
      doneRef.current = true;
      onExpire(id);
      return;
    }

    posRef.current.addScaledVector(velRef.current, dt);
    if (groupRef.current) groupRef.current.position.copy(posRef.current);

    const p = posRef.current;
    for (const agent of (agentRegistryRef?.current ?? [])) {
      const ap = agent.posRef.current;
      const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.y - (ap.y + 1.4)) ** 2 + (p.z - ap.z) ** 2);
      if (dist < 1.0 && !doneRef.current) {
        agent.takeDamage(28);
        doneRef.current = true;
        onAgentHit?.();
        onExpire(id);
        return;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#00ff41" intensity={5} distance={7} decay={2} />
      <mesh>
        <sphereGeometry args={[0.11, 6, 4]} />
        <meshStandardMaterial color="#eeffee" emissive="#00ff41" emissiveIntensity={22} />
      </mesh>
      <mesh position={[0, 0, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.08, 1.8, 4]} />
        <meshStandardMaterial color="#00cc33" emissive="#00ff41" emissiveIntensity={9}
          transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── ROOT ACCESS city scene ────────────────────────────────────────────────────
function Building({ x, z, w, h, d, seed }) {
  const bColor = ['#050a0e', '#060c10', '#04080d', '#070b0f'][seed % 4];
  return (
    <group position={[x, h / 2, z]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bColor} roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Window grid overlay on front face */}
      <mesh position={[0, 0, d / 2 + 0.06]}>
        <planeGeometry args={[w * 0.82, h * 0.88]} />
        <meshStandardMaterial
          color="#000a00"
          emissive="#00ff41"
          emissiveIntensity={0.07 + (seed % 3) * 0.03}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>
      {/* Roof trim */}
      <mesh position={[0, h / 2 + 0.07, 0]}>
        <boxGeometry args={[w + 0.1, 0.14, d + 0.1]} />
        <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

function CityRoom() {
  const rainRef    = useRef();
  const frameCount = useRef(0);

  const BLDGS = useMemo(() => [
    // Near intro buildings
    [-20, -25,  8, 24, 10, 0],
    [ 20, -30,  9, 30,  9, 1],
    [-11, -45,  6, 38,  7, 2],
    [ 11, -42,  7, 35,  8, 3],
    // Mid towers — corridors at x=0±6 and x=±20
    [-26, -70, 10, 62, 12, 0],
    [-13, -62,  7, 52,  9, 2],
    [ 14, -75,  8, 58, 10, 1],
    [ 27, -68, 11, 68, 13, 3],
    // Elevated bridge (fly under it at y<16 or over at y>20)
    [  0, -88, 34,  5,  8, 2],
    // Dense district
    [-24, -105, 11, 50, 14, 1],
    [ -8,  -98,  7, 74,  9, 0],
    [  9, -112,  8, 70, 11, 3],
    [ 25, -104, 12, 58, 15, 2],
    // Background mega-towers
    [-40, -148, 16, 92, 18, 0],
    [ -4, -152, 13,115, 15, 1],
    [ 40, -142, 15, 82, 17, 2],
    // Side "canyon" walls
    [-58, -95, 20, 28, 90, 3],
    [ 58, -95, 20, 28, 90, 0],
  ], []);

  const rainPos = useMemo(() => {
    const arr = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 130;
      arr[i * 3 + 1] = Math.random() * 90;
      arr[i * 3 + 2] = -(Math.random() * 200 + 5);
    }
    return arr;
  }, []);

  const stars = useMemo(() => {
    const arr = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 350;
      arr[i * 3 + 1] = 55 + Math.random() * 40;
      arr[i * 3 + 2] = -(Math.random() * 250 + 10);
    }
    return arr;
  }, []);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 2 !== 0) return;
    const geo = rainRef.current?.geometry?.attributes?.position;
    if (!geo) return;
    for (let i = 0; i < 1200; i++) {
      geo.array[i * 3 + 1] -= 0.55;
      if (geo.array[i * 3 + 1] < -5) geo.array[i * 3 + 1] = 88 + Math.random() * 10;
    }
    geo.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={['#010507']} />
      <fog attach="fog" args={['#010507', 70, 230]} />
      <ambientLight color="#0d1a0d" intensity={1.4} />
      <directionalLight position={[-8, 50, -100]} color="#1a3320" intensity={1.8} />
      <pointLight position={[0, 2, -50]} color="#00ff41" intensity={6} distance={100} decay={2} />
      <pointLight position={[-22, 8, -70]} color="#002244" intensity={5} distance={80} decay={2} />
      <pointLight position={[22, 6, -90]} color="#003322" intensity={4} distance={80} decay={2} />
      <pointLight position={[0, 30, -120]} color="#00ff41" intensity={3} distance={120} decay={2} />

      {BLDGS.map(([bx, bz, bw, bh, bd, bs], i) => (
        <Building key={i} x={bx} z={bz} w={bw} h={bh} d={bd} seed={bs} />
      ))}

      {/* Street grid far below */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -90]}>
        <planeGeometry args={[280, 220, 28, 18]} />
        <meshStandardMaterial color="#030805" emissive="#00ff41" emissiveIntensity={0.08} wireframe />
      </mesh>

      {/* Rain */}
      <points ref={rainRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={rainPos}
            count={1200}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#88cc88" size={0.06} transparent opacity={0.28} sizeAttenuation />
      </points>

      {/* Stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={stars}
            count={300}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.14} transparent opacity={0.75} sizeAttenuation />
      </points>
    </>
  );
}

// ── Scene (inside Canvas) ─────────────────────────────────────────────────────
function Scene({
  charPosRef, yawRef, pitchRef, dodgeRef, crouchRef, timeScaleRef, stateRef,
  agentRegistryRef, flyingRef,
  onNearDoor, nearDoor, onCatch, onShoot, paused, sceneId,
  isNearTerminal, isNearExit, onNearTerminal, onNearExit, onExitRoom,
  agentKey, onAgentSpawn, onAgentDead,
  hasKey, onCollectKey,
  agentEnabled, cameraForwardRef,
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
          <ambientLight color="#e8e4dc" intensity={1.8} />
          <color attach="background" args={['#d5d2c9']} />
          <fog attach="fog" args={['#d5d2c9', 20, 180]} />
          <MatrixCorridor />
          {MATRIX_DOORS.map(d => (
            <MatrixDoor key={d.id} {...d} isActive={nearDoor?.id === d.id} />
          ))}

          {/* Signs poking into the corridor — readable as player walks toward each door */}
          {MATRIX_DOORS.map(d => {
            const cx    = d.side === 'left' ? -3.8 : 3.8;
            const color = d.locked ? '#ff2200' : d.color;
            const name  = d.locked
              ? (d.isRootAccess ? 'ROOT ACCESS' : 'RESTRICTED')
              : d.sublabel.toUpperCase();
            return (
              <group key={`sign-${d.id}`} position={[cx, 5.2, d.position.z]}>
                {/* Backing plate */}
                <mesh position={[0, 0, 0]}>
                  <planeGeometry args={[2.0, 0.52]} />
                  <meshStandardMaterial color="#000" transparent opacity={0.72} depthWrite={false} />
                </mesh>
                {/* Colour accent strip at top */}
                <mesh position={[0, 0.22, 0.01]}>
                  <planeGeometry args={[2.0, 0.06]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                </mesh>
                <Billboard follow={true}>
                  <Text
                    position={[0, -0.02, 0.02]}
                    fontSize={0.22}
                    color={color}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.018}
                    outlineColor="#000"
                    letterSpacing={0.08}
                  >
                    {name}
                  </Text>
                </Billboard>
              </group>
            );
          })}

          <KeyItem playerPosRef={charPosRef} onCollect={onCollectKey} collected={hasKey} />
          {agentEnabled && (
            <AgentSmith
              key={agentKey}
              spawnOffset={{ z: 22 }}
              spawnDelay={3000}
              shootInterval={3800}
              firstShotDelay={400}
              playerPosRef={charPosRef}
              dodgeRef={dodgeRef}
              timeScaleRef={timeScaleRef}
              onCatch={onCatch}
              onShoot={onShoot}
              onRegister={registerAgent}
              onSpawn={onAgentSpawn}
              onDead={onAgentDead}
              paused={paused}
              bounds={COR_BOUNDS}
            />
          )}
        </>
      ) : isRootRoom ? (
        <>
          <CityRoom />
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
          {agentEnabled && (
            <AgentSmith
              key={agentKey}
              spawnOffset={{ z: 3 }}
              spawnDelay={4500}
              shootInterval={4200}
              playerPosRef={charPosRef}
              dodgeRef={dodgeRef}
              timeScaleRef={timeScaleRef}
              onCatch={onCatch}
              onShoot={onShoot}
              onRegister={registerAgent}
              onSpawn={onAgentSpawn}
              onDead={onAgentDead}
              paused={paused}
              bounds={ROOM_BOUNDS}
            />
          )}
        </>
      )}

      <PlayerCharacter
        charPosRef={charPosRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        dodgeRef={dodgeRef}
        crouchRef={crouchRef}
        stateRef={stateRef}
        flyingRef={flyingRef}
        bounds={isRootRoom ? { xMin: -70, xMax: 70, zMin: -210, zMax: 12 } : bounds}
        paused={paused}
        onNearDoor={onNearDoor}
        sceneId={sceneId}
        cameraForwardRef={cameraForwardRef}
      />

      <AdaptiveDpr pixelated />
    </>
  );
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function CaughtOverlay() {
  return <div className="mx-overlay mx-caught" />;
}

function AgentSpawnAlert() {
  return (
    <div className="mx-overlay mx-agent-alert">
      <div className="mx-agent-alert__flash" />
      <div className="mx-agent-alert__text">▶  AGENT INCOMING</div>
    </div>
  );
}

function NeoHealthBar({ hp, maxHp = 100 }) {
  const ratio = Math.max(0, hp / maxHp);
  const hsl   = `hsl(${ratio * 115}, 100%, 45%)`;
  return (
    <div className="mx-health">
      <div className="mx-health__label">NEO  {hp} / {maxHp}</div>
      <div className="mx-health__track">
        <div
          className="mx-health__fill"
          style={{ width: `${ratio * 100}%`, background: hsl, boxShadow: `0 0 6px ${hsl}` }}
        />
      </div>
    </div>
  );
}

function DeathScreen({ onRestart }) {
  return (
    <div className="mx-death">
      <div className="mx-death__title">SIMULATION TERMINATED</div>
      <div className="mx-death__subtitle">NEO HAS BEEN ELIMINATED</div>
      <button className="mx-death__btn" onClick={onRestart}>[ RESTART ]</button>
    </div>
  );
}

function HitOverlay() {
  return <div className="mx-overlay mx-hit" />;
}

function PunchHitOverlay() {
  return <div className="mx-overlay mx-punch-hit" />;
}

function KickImpactOverlay() {
  return (
    <div className="mx-overlay mx-kick">
      <div className="mx-kick__flash" />
      <div className="mx-kick__ring" />
      <div className="mx-kick__text">IMPACT</div>
    </div>
  );
}

function BulletTimeOverlay({ timeLeft, maxTime }) {
  const pct = timeLeft / maxTime;
  return (
    <div className="mx-overlay mx-bt">
      <div className="mx-bt__bar-track">
        <div className="mx-bt__bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mx-bt__label">◈ BULLET TIME &nbsp; {timeLeft.toFixed(1)}s</div>
      <div className="mx-bt__vignette-side" />
      <div className="mx-bt__vignette-radial" />
      <div className="mx-bt__scanlines" />
    </div>
  );
}

function KeyCollectedOverlay() {
  return (
    <div className="mx-overlay mx-key-collected">
      <div className="mx-key-collected__flash" />
      <div className="mx-key-collected__text">
        ● RED PILL ACQUIRED
        <br />
        <span className="mx-key-collected__sub">LOCKED DOORS NOW ACCESSIBLE</span>
      </div>
    </div>
  );
}

function FlyingHUD() {
  return (
    <div className="mx-overlay mx-flying">
      <div className="mx-flying__title">◈ ROOT ACCESS — NEO IS FREE</div>
      <div className="mx-flying__vignette" />
      <div className="mx-flying__hint">SPACE FLY UP · CTRL FLY DOWN · WASD MOVE</div>
    </div>
  );
}

function AccessDeniedOverlay() {
  return (
    <div className="mx-overlay mx-access-denied">
      <div className="mx-access-denied__flash" />
      <div className="mx-access-denied__text">ACCESS DENIED</div>
    </div>
  );
}

function BulletWarnOverlay({ angle }) {
  const deg = (angle * 180 / Math.PI + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const R = 42;
  const cx = 50 + R * Math.sin(rad);
  const cy = 50 - R * Math.cos(rad);

  return (
    <div className="mx-overlay mx-bullet-warn">
      <div
        className="mx-bullet-warn__gradient"
        style={{ background: `radial-gradient(ellipse at ${cx}% ${cy}%, rgba(255,30,0,0.35) 0%, transparent 55%)` }}
      />
      <div
        className="mx-bullet-warn__label"
        style={{ left: `${cx}%`, top: `${cy}%` }}
      >
        !! DODGE !!
      </div>
    </div>
  );
}

function NearAgentPrompt() {
  return <div className="mx-near-agent">[ J ]  STRIKE AGENT</div>;
}

function FadeOverlay({ active }) {
  return (
    <div
      className="mx-fade"
      style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'all' : 'none' }}
    />
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
    <div className="mx-bt-cd">
      <span>BT</span>
      <div className="mx-bt-cd__track">
        <div className="mx-bt-cd__fill" style={{ width: `${(1 - pct) * 100}%` }} />
      </div>
    </div>
  );
}

// ── How-to-play tutorial modal ────────────────────────────────────────────────
function TutorialModal({ onStart }) {
  useEffect(() => {
    const onKey = e => { if (e.code === 'Enter' || e.code === 'Space') onStart(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const Row = ({ k, desc }) => (
    <div className="mx-tutorial__row">
      <span className="mx-tutorial__key">{k}</span>
      <span className="mx-tutorial__desc">{desc}</span>
    </div>
  );

  return (
    <div className="mx-tutorial">
      <div className="mx-tutorial__panel">
        <div className="mx-tutorial__eyebrow">// SYSTEM BRIEFING</div>
        <div className="mx-tutorial__title">WELCOME TO THE MATRIX</div>
        <div className="mx-tutorial__subtitle">
          You are Neo. Walk the corridor, enter doors to explore my portfolio,<br />
          and survive the Agents.
        </div>

        <div className="mx-tutorial__divider" />

        <div className="mx-tutorial__section-title">// MOVEMENT</div>
        <div className="mx-tutorial__grid">
          <Row k="W A S D"      desc="Move" />
          <Row k="MOUSE"        desc="Look around" />
          <Row k="SHIFT"        desc="Sprint" />
          <Row k="SPACE"        desc="Jump" />
          <Row k="CTRL"         desc="Crouch / duck" />
          <Row k="Q / E"        desc="Dodge left / right" />
        </div>

        <div className="mx-tutorial__divider" />

        <div className="mx-tutorial__section-title">// COMBAT</div>
        <div className="mx-tutorial__grid">
          <Row k="CLICK"        desc="Shoot (green tracer)" />
          <Row k="J"            desc="Punch (combo on repeat)" />
          <Row k="K"            desc="Roundhouse kick" />
          <Row k="L"            desc="Spinning hook kick" />
          <Row k="Z / F"        desc="Bullet Time — slow motion" />
        </div>

        <div className="mx-tutorial__divider" />

        <div className="mx-tutorial__section-title">// INTERACT</div>
        <div className="mx-tutorial__grid">
          <Row k="E"            desc="Enter door / access terminal" />
          <Row k="E / ESC"      desc="Close modal" />
          <Row k="RED PILL"     desc="Pick up to unlock locked doors" />
        </div>

        <div className="mx-tutorial__tip">
          <strong>TIP:</strong> When an Agent appears and fires at you, activate{' '}
          <strong>Bullet Time (Z)</strong> — watch the bullet slow down, then dodge{' '}
          out of the way with <strong>Q</strong> or <strong>E</strong>.{' '}
          Shoot back with <strong>CLICK</strong> to deal damage.
        </div>

        <button className="mx-tutorial__start" onClick={onStart}>
          [ ENTER THE MATRIX ]
        </button>
      </div>
    </div>
  );
}

// ── Corridor door list HUD ────────────────────────────────────────────────────
function CorridorDoorList({ charPosRef, hasKey }) {
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const id = setInterval(() => {
      const z = charPosRef.current.z;
      let closest = -1;
      let closestDist = Infinity;
      MATRIX_DOORS.forEach((d, i) => {
        const dist = Math.abs(z - d.position.z);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      setActiveIdx(closest);
    }, 120);
    return () => clearInterval(id);
  }, [charPosRef]);

  return (
    <div className="mx-door-list">
      {MATRIX_DOORS.map((door, i) => {
        const isActive  = i === activeIdx;
        const isLocked  = door.locked;
        const color     = isLocked ? (hasKey ? '#ff6644' : '#ff2200') : door.color;
        return (
          <React.Fragment key={door.id}>
            {i > 0 && <span className="mx-door-list__sep">›</span>}
            <div
              className={`mx-door-list__item${isActive ? ' mx-door-list__item--active' : ''}${isLocked ? ' mx-door-list__item--locked' : ''}`}
              style={{ '--c': color }}
            >
              <span className="mx-door-list__icon">{isLocked ? '▣' : '◆'}</span>
              <span className="mx-door-list__name">
                {isLocked ? (door.isRootAccess ? 'ROOT ACCESS' : 'RESTRICTED') : door.sublabel.toUpperCase()}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Reticle ───────────────────────────────────────────────────────────────────
function Reticle({ shooting, hit }) {
  return (
    <div className={`mx-reticle${shooting ? ' mx-reticle--shooting' : ''}`}>
      <div className="mx-reticle__line mx-reticle__line--t" />
      <div className="mx-reticle__line mx-reticle__line--b" />
      <div className="mx-reticle__line mx-reticle__line--l" />
      <div className="mx-reticle__line mx-reticle__line--r" />
      <div className="mx-reticle__dot" />
      {hit && <div className="mx-reticle__hit">×</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MatrixGame({ resumeData }) {
  const [phase, setPhase] = useState('intro');
  const [sceneId, setSceneId] = useState('corridor');
  const [fading, setFading] = useState(false);
  const [nearDoor, setNearDoor] = useState(null);
  const [openDoor, setOpenDoor] = useState(null);
  const [nearTerminal, setNearTerminal] = useState(false);
  const [isNearExit, setIsNearExit] = useState(false);
  const [bullets, setBullets] = useState([]);
  const [caught, setCaught] = useState(false);
  const [hit, setHit] = useState(false);
  const [btActive, setBtActive] = useState(false);
  const [btLeft, setBtLeft] = useState(0);
  const [dodgeFlash, setDodgeFlash] = useState(false);
  const [punchFlash, setPunchFlash] = useState(false);
  const [kickFlash, setKickFlash] = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const [nearAgent, setNearAgent] = useState(false);
  const [bulletWarn, setBulletWarn] = useState(null);
  const [agentAlert, setAgentAlert] = useState(false);
  const [agentKey, setAgentKey] = useState(0);
  const [neoHp, setNeoHp] = useState(100);
  const [dead, setDead] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyCollected, setKeyCollected] = useState(false);
  const [isFlying, setIsFlying] = useState(false);

  const [agentEnabled, setAgentEnabled] = useState(false);
  const [playerBullets, setPlayerBullets] = useState([]);
  const [shootCooldown, setShootCooldown] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);

  const paused = !!openDoor || dead;

  const bulletWarnRef = useRef(null);
  const neoHpRef      = useRef(100);
  const flyingRef     = useRef(false);
  const cameraForwardRef  = useRef(new THREE.Vector3(0, 0, -1));
  const playerBulletIdRef = useRef(0);
  const shootCdRef        = useRef(0);
  const hasVisitedRoomRef = useRef(false);

  const charPosRef    = useRef(new THREE.Vector3(0, 0, -8));
  const yawRef        = useRef(0);
  const pitchRef      = useRef(0);
  const crouchRef     = useRef(false);
  const dodgeRef      = useRef({ active: false, vel: new THREE.Vector3(), t: 0 });
  const timeScaleRef  = useRef(1);
  const stateRef      = useRef({
    moving: false,
    running: false,
    jumping: false,
    grounded: true,
    punching: false,
    punchT: 0,
    altArm: 0,
    kicking: false,
    kickT: 0,
    flyKick: false,
    spinKicking: false,
    spinKickT: 0,
    dodging: false,
    dodgeDir: 0,
    crouching: false,
    shooting: false,
    shootT: 0,
  });

  const agentRegistryRef = useRef([]);
  const btTimerRef       = useRef(0);
  const btCoolRef        = useRef(0);
  const bulletIdRef      = useRef(0);
  const corridorReturnZ  = useRef(-50);
  const currentRoomId    = useRef(null);
  const punchCdRef       = useRef(0);
  const kickCdRef        = useRef(0);
  const spinKickCdRef    = useRef(0);
  const comboCdRef       = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const p = charPosRef.current;
      let found = false;
      for (const a of agentRegistryRef.current) {
        const ap = a.posRef.current;
        const d = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
        if (d < PUNCH_RANGE + 0.5) {
          found = true;
          break;
        }
      }
      setNearAgent(found);
    }, 120);
    return () => clearInterval(id);
  }, []);

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

  const modalWasOpenRef = useRef(false);
  useEffect(() => {
    if (openDoor) {
      modalWasOpenRef.current = true;
      document.exitPointerLock?.();
    } else if (modalWasOpenRef.current) {
      modalWasOpenRef.current = false;
      setTimeout(() => document.querySelector('canvas')?.requestPointerLock(), 80);
    }
  }, [openDoor]);

  // Release pointer lock on death so the restart button is immediately clickable
  useEffect(() => {
    if (dead) document.exitPointerLock?.();
  }, [dead]);

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

    if (!hasVisitedRoomRef.current) {
      hasVisitedRoomRef.current = true;
      setTimeout(() => setAgentEnabled(true), 4000);
    }
  }, [fading]);

  useEffect(() => {
    const onKeyDown = e => {
      if (e.code === 'KeyE') {
        if (openDoor) {
          setOpenDoor(null);
        } else if (sceneId === 'corridor' && nearDoor) {
          enterRoom(nearDoor);
        } else if (nearTerminal && sceneId !== 'corridor') {
          const roomDoor = MATRIX_DOORS.find(d => d.id === currentRoomId.current);
          setOpenDoor({
            id: currentRoomId.current,
            label: roomDoor?.label ?? '> TERMINAL',
            sublabel: roomDoor?.sublabel ?? 'Data',
          });
        }
      }

      if (e.code === 'Escape' && openDoor) setOpenDoor(null);

      const triggerDodge = (dirFn) => {
        if (dodgeRef.current.active) return;
        const yaw   = yawRef.current;
        const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const boost = btActive ? 2.5 : 1.0;
        const dir   = dirFn(fwd, right);

        if (dir.lengthSq() > 0) {
          dir.normalize().multiplyScalar(DODGE_SPD * boost);
          dodgeRef.current = { active: true, vel: dir, t: DODGE_DUR, tMax: DODGE_DUR };
          stateRef.current.dodging = true;
          stateRef.current.dodgeDir = dir.x < 0 ? -1 : 1;
          setDodgeFlash(true);
          setTimeout(() => setDodgeFlash(false), 200);
        }
      };

      if (e.code === 'KeyQ') triggerDodge((_, right) => right.clone().negate());
      if (e.code === 'KeyR' && !e.ctrlKey) triggerDodge((_, right) => right.clone());

      if (e.code === 'KeyJ' && punchCdRef.current <= 0 && !stateRef.current.kicking) {
        const p = charPosRef.current;
        let hitAgent = false;

        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < PUNCH_RANGE) {
            agent.takeDamage(PUNCH_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, 2.2);
            hitAgent = true;
            break;
          }
        }

        stateRef.current.altArm = stateRef.current.altArm === 0 ? 1 : 0;
        stateRef.current.punching = true;
        stateRef.current.punchT = 0;
        punchCdRef.current = comboCdRef.current > 0 ? 0.22 : 0.35;
        comboCdRef.current = 0.60;

        if (hitAgent) {
          setPunchFlash(true);
          setTimeout(() => setPunchFlash(false), 140);
        }
      }

      if (e.code === 'KeyK' && kickCdRef.current <= 0 && !stateRef.current.punching) {
        const isSprinting = stateRef.current.running;
        const KICK_RANGE = isSprinting ? 5.2 : 3.6;
        const KICK_DMG   = isSprinting ? 67 : 50;
        const KICK_KB    = isSprinting ? 6.5 : 4.0;

        const p = charPosRef.current;
        let hitAgent = false;

        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < KICK_RANGE) {
            agent.takeDamage(KICK_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, KICK_KB);
            hitAgent = true;
            break;
          }
        }

        stateRef.current.kicking = true;
        stateRef.current.kickT = 0;
        stateRef.current.flyKick = isSprinting;
        kickCdRef.current = isSprinting ? 0.75 : 0.50;

        if (hitAgent) {
          setKickFlash(true);
          setTimeout(() => setKickFlash(false), 340);
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {
            timeScaleRef.current = 0.04;
            setTimeout(() => {
              timeScaleRef.current = prevScale;
            }, 90);
          }
        }
      }

      if (e.code === 'KeyL' && spinKickCdRef.current <= 0 && !stateRef.current.punching && !stateRef.current.kicking && !stateRef.current.spinKicking) {
        const SPIN_RANGE = 4.8;
        const SPIN_DMG   = 72;
        const SPIN_KB    = 6.0;
        let hitAgent = false;
        const p = charPosRef.current;
        for (const agent of agentRegistryRef.current) {
          const ap = agent.posRef.current;
          const dist = Math.sqrt((p.x - ap.x) ** 2 + (p.z - ap.z) ** 2);
          if (dist < SPIN_RANGE) {
            agent.takeDamage(SPIN_DMG);
            const kbDir = new THREE.Vector3(ap.x - p.x, 0, ap.z - p.z).normalize();
            agent.knockback?.(kbDir, SPIN_KB);
            hitAgent = true;
            break;
          }
        }
        stateRef.current.spinKicking  = true;
        stateRef.current.spinKickT    = 0;
        spinKickCdRef.current         = 1.05;
        if (hitAgent) {
          setKickFlash(true);
          setTimeout(() => setKickFlash(false), 420);
          const prevScale = timeScaleRef.current;
          if (prevScale >= 0.8) {
            timeScaleRef.current = 0.03;
            setTimeout(() => { timeScaleRef.current = prevScale; }, 120);
          }
        }
      }

      if ((e.code === 'KeyZ' || e.code === 'KeyF') && !btActive && btCoolRef.current <= 0) {
        btTimerRef.current = BT_DURATION;
        setBtLeft(BT_DURATION);
        setBtActive(true);
        timeScaleRef.current = BT_SCALE;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearDoor, openDoor, sceneId, nearTerminal, btActive, enterRoom]);

  useEffect(() => {
    const id = setInterval(() => {
      if (punchCdRef.current > 0) punchCdRef.current -= 0.05;
      if (kickCdRef.current > 0) kickCdRef.current -= 0.05;
      if (spinKickCdRef.current > 0) spinKickCdRef.current -= 0.05;
      if (comboCdRef.current > 0) comboCdRef.current -= 0.05;
      if (shootCdRef.current > 0) shootCdRef.current -= 0.05;
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (!document.pointerLockElement) return;
      if (paused || dead) return;
      if (shootCdRef.current > 0) return;

      shootCdRef.current = 0.32;
      setShootCooldown(true);
      setTimeout(() => setShootCooldown(false), 320);

      const origin = charPosRef.current.clone();
      origin.y += 1.4;
      // Compute aim direction from yaw + pitch (TPS camera forward points at Neo's back, not forward)
      const yaw   = yawRef.current;
      const pitch = pitchRef.current;
      const dir   = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      ).normalize();
      const id = ++playerBulletIdRef.current;

      pitchRef.current = Math.min(pitchRef.current + 0.018, 0.42);

      setPlayerBullets(prev => [...prev.slice(-6), { id, origin, direction: dir }]);
      stateRef.current.shooting = true;
      stateRef.current.shootT = 0;
      setTimeout(() => {
        stateRef.current.shooting = false;
      }, 280);
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [paused, dead]);

  const spawnBullet = useCallback((origin, direction) => {
    const id = ++bulletIdRef.current;
    setBullets(prev => [...prev.slice(-8), { id, origin: origin.clone(), direction: direction.clone() }]);
  }, []);

  const removeBullet = useCallback((id) => {
    setBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const removePlayerBullet = useCallback((id) => {
    setPlayerBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  const handlePlayerBulletHit = useCallback(() => {
    setHitMarker(true);
    setTimeout(() => setHitMarker(false), 280);
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
    bulletWarnRef.current = setTimeout(() => {
      bulletWarnRef.current = null;
      setBulletWarn(null);
    }, 800);
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
    setTimeout(() => document.querySelector('canvas')?.requestPointerLock(), 80);
  }, []);

  if (phase === 'intro') return <WakeUpSequence onDone={() => setPhase('tutorial')} />;
  if (phase === 'tutorial') return <TutorialModal onStart={() => setPhase('playing')} />;

  const canvasFilter = btActive
    ? 'saturate(0.5) contrast(1.14) brightness(0.95)'
    : 'none';

  return (
    <div className="mx-root">
      <Canvas
        camera={{ position: [0, 2.5, 5], fov: 75, near: 0.08, far: 380 }}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 1.2]}
        style={{
          filter: canvasFilter,
          transition: 'filter 0.25s ease',
          pointerEvents: paused ? 'none' : 'auto'
        }}
      >
        <Scene
          charPosRef={charPosRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          dodgeRef={dodgeRef}
          crouchRef={crouchRef}
          timeScaleRef={timeScaleRef}
          stateRef={stateRef}
          agentRegistryRef={agentRegistryRef}
          flyingRef={flyingRef}
          onNearDoor={d => setNearDoor(d)}
          nearDoor={nearDoor}
          openDoor={openDoor}
          onCatch={handleCatch}
          onShoot={spawnBullet}
          paused={paused}
          sceneId={sceneId}
          isNearTerminal={nearTerminal}
          isNearExit={isNearExit}
          onNearTerminal={v => {
            setNearTerminal(v);
            if (v) setIsNearExit(false);
          }}
          onNearExit={v => setIsNearExit(v)}
          onExitRoom={exitRoom}
          agentKey={agentKey}
          onAgentSpawn={handleAgentSpawn}
          onAgentDead={handleAgentDead}
          hasKey={hasKey}
          onCollectKey={handleCollectKey}
          agentEnabled={agentEnabled}
          cameraForwardRef={cameraForwardRef}
        />

        {bullets.map(b => (
          <MatrixBullet
            key={b.id}
            id={b.id}
            origin={b.origin}
            direction={b.direction}
            playerPosRef={charPosRef}
            crouchRef={crouchRef}
            dodgeRef={dodgeRef}
            timeScaleRef={timeScaleRef}
            onExpire={removeBullet}
            onHit={handleBulletHit}
            onNear={handleBulletNear}
          />
        ))}

        {playerBullets.map(b => (
          <PlayerBullet
            key={b.id}
            id={b.id}
            origin={b.origin}
            direction={b.direction}
            agentRegistryRef={agentRegistryRef}
            timeScaleRef={timeScaleRef}
            onExpire={removePlayerBullet}
            onAgentHit={handlePlayerBulletHit}
          />
        ))}
      </Canvas>

      <MatrixRain opacity={0.07} timeScaleRef={timeScaleRef} />

      <HUD
        nearStation={
          sceneId === 'corridor'
            ? nearDoor
            : (
              nearTerminal
                ? { ...MATRIX_DOORS.find(d => d.id === currentRoomId.current), label: '> TERMINAL ACCESS' }
                : null
            )
        }
        dockedStation={openDoor}
        onUndock={() => setOpenDoor(null)}
        resumeData={resumeData}
        mode="matrix"
        stations={MATRIX_DOORS.filter(d => !d.locked)}
      />

      {nearDoor && !openDoor && sceneId === 'corridor' && (
        <div
          className="mx-door-prompt"
          style={{
            color: nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color,
            textShadow: `0 0 16px ${nearDoor.locked ? (hasKey ? '#ffaa00' : '#ff2200') : nearDoor.color}`,
          }}
        >
          {nearDoor.locked
            ? (hasKey
              ? `[ E ]  UNLOCK  ${nearDoor.label.replace('> ', '')}`
              : '[ LOCKED ]  FIND THE RED PILL')
            : `[ E ]  ENTER  ${nearDoor.sublabel.toUpperCase()}`}
        </div>
      )}

      {nearTerminal && !openDoor && sceneId !== 'corridor' && (
        <div className="mx-terminal-prompt">[ E ]  ACCESS TERMINAL</div>
      )}

      {nearAgent && !openDoor && <NearAgentPrompt />}
      {bulletWarn && !openDoor && <BulletWarnOverlay angle={bulletWarn.angle} />}
      {agentAlert && !openDoor && <AgentSpawnAlert />}

      {sceneId === 'corridor' && !openDoor && (
        <CorridorDoorList charPosRef={charPosRef} hasKey={hasKey} />
      )}

      {btActive && <BulletTimeOverlay timeLeft={btLeft} maxTime={BT_DURATION} />}
      {isFlying && <FlyingHUD />}
      {keyCollected && <KeyCollectedOverlay />}
      {caught && <CaughtOverlay />}
      {hit && <HitOverlay />}
      {punchFlash && <PunchHitOverlay />}
      {kickFlash && <KickImpactOverlay />}
      {lockedAttempt && <AccessDeniedOverlay />}

      {!openDoor && <NeoHealthBar hp={neoHp} />}

      {!openDoor && !isFlying && (
        <Reticle shooting={shootCooldown} hit={hitMarker} />
      )}

      {dead && <DeathScreen onRestart={handleRestart} />}

      {dodgeFlash && <div className="mx-overlay mx-dodge-flash" />}

      <FadeOverlay active={fading} />
      <BTCooldownBar coolRef={btCoolRef} maxCD={BT_COOLDOWN} />

      {hasKey && !openDoor && <div className="mx-key-indicator">● RED PILL</div>}

      {!openDoor && (
        <div className="mx-controls-hint">
          {isFlying
            ? 'WASD MOVE · SPACE FLY UP · CTRL FLY DOWN · Z/F BULLET-TIME'
            : 'CLICK SHOOT · WASD MOVE · SHIFT SPRINT · SPACE JUMP · Q/R DODGE · CTRL DUCK · J PUNCH · K ROUNDHOUSE · L SPIN HOOK · Z/F BT · E INTERACT'}
        </div>
      )}

    </div>
  );
}