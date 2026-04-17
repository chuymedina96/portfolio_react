import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// ── Matrix Reloaded — bright white institutional corridor ─────────────────────
const WALL_X  = 5;
const CEIL_Y  = 8;
const SEG_LEN = 100;
// 3 segments covers z=0 → z=-300, which passes all 7 doors (last at z=-192)
const SEGS    = 3;
const TOTAL   = SEGS * SEG_LEN;

const W  = '#f0ede7';
const F  = '#d5d2c8';
const C  = '#f6f4ef';
const TR = '#c2bfb7';
const L  = '#fffef4';

// Sparse seam lines — 1 every 12 units instead of every 3.8
// Visual effect intact at game camera distances, 3× fewer meshes
const SEAM_SPACING = 12;
const SEAMS_PER_SEG = Math.floor(SEG_LEN / SEAM_SPACING);
const SEAM_OFFSETS  = Array.from({ length: SEAMS_PER_SEG }, (_, i) =>
  -SEG_LEN / 2 + (i + 0.5) * SEAM_SPACING
);

// ── Wall — main slab + sparse panel seams ─────────────────────────────────────
function WallFace({ zC, side }) {
  const x  = side === 'left' ? -WALL_X : WALL_X;
  const nx = side === 'left' ? 1 : -1;

  return (
    <group>
      <mesh position={[x, CEIL_Y / 2, zC]}>
        <boxGeometry args={[0.16, CEIL_Y + 0.24, SEG_LEN]} />
        <meshStandardMaterial color={W} roughness={0.92} metalness={0.01} />
      </mesh>

      {/* Sparse panel seam lines */}
      {SEAM_OFFSETS.map((relZ, i) => (
        <mesh key={i} position={[x + nx * 0.082, CEIL_Y / 2, zC + relZ]}>
          <boxGeometry args={[0.009, CEIL_Y, 0.04]} />
          <meshStandardMaterial color={TR} roughness={0.88} />
        </mesh>
      ))}

      {/* Crown molding — single mesh per wall */}
      <mesh position={[x + nx * 0.075, CEIL_Y - 0.22, zC]}>
        <boxGeometry args={[0.16, 0.42, SEG_LEN + 0.1]} />
        <meshStandardMaterial color={TR} roughness={0.86} />
      </mesh>

      {/* Baseboard — single mesh per wall */}
      <mesh position={[x + nx * 0.075, 0.13, zC]}>
        <boxGeometry args={[0.16, 0.25, SEG_LEN + 0.1]} />
        <meshStandardMaterial color={TR} roughness={0.86} />
      </mesh>
    </group>
  );
}

// ── Ceiling — single light panel + 1 point light per segment ─────────────────
function CeilingLight({ zC }) {
  const pz = zC;
  return (
    <group>
      {/* Glowing panel strip */}
      <mesh position={[0, CEIL_Y - 0.015, pz]}>
        <boxGeometry args={[2.4, 0.03, SEG_LEN * 0.7]} />
        <meshStandardMaterial color={L} emissive={L} emissiveIntensity={2.6} />
      </mesh>
      {/* Single fill light per segment — was 3 */}
      <pointLight
        position={[0, CEIL_Y - 0.6, pz]}
        color={L}
        intensity={10}
        distance={SEG_LEN * 0.75}
        decay={2}
      />
    </group>
  );
}

// ── Floor — single plane, no grout lines ──────────────────────────────────────
// Grout lines are invisible at game camera distance; removing 150+ meshes
function CorridorFloor({ zC }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zC]}>
      <planeGeometry args={[WALL_X * 2, SEG_LEN]} />
      <meshStandardMaterial color={F} roughness={0.87} metalness={0.05} />
    </mesh>
  );
}

// ── One corridor segment ───────────────────────────────────────────────────────
function CorridorSeg({ zC }) {
  return (
    <group>
      <CorridorFloor zC={zC} />

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEIL_Y, zC]}>
        <planeGeometry args={[WALL_X * 2, SEG_LEN]} />
        <meshStandardMaterial color={C} roughness={0.91} />
      </mesh>

      <WallFace zC={zC} side="left" />
      <WallFace zC={zC} side="right" />
      <CeilingLight zC={zC} />
    </group>
  );
}

// ── Door accent lights — static, no per-frame update ─────────────────────────
// Unlocked = gentle green, locked = dim red. Static intensity keeps GPU load low.
const DOOR_LIGHTS = [
  { z: -35,  x: -3.8, color: '#00ff41', intensity: 2.8 },
  { z: -62,  x:  3.8, color: '#ff2200', intensity: 1.8 },
  { z: -88,  x: -3.8, color: '#33ff88', intensity: 2.8 },
  { z: -114, x: -3.8, color: '#00ffcc', intensity: 2.8 },
  { z: -140, x:  3.8, color: '#ff2200', intensity: 1.8 },
  { z: -166, x: -3.8, color: '#88ff44', intensity: 2.8 },
  { z: -192, x:  3.8, color: '#ff2200', intensity: 1.8 },
];

// Only animate the 4 locked-door lights (subtle flicker) — not all 7
function LockedDoorFlicker() {
  const lightsRef  = useRef([]);
  const frameCount = useRef(0);

  useFrame(({ clock }) => {
    frameCount.current++;
    if (frameCount.current % 6 !== 0) return; // every 6th frame ≈ 10 Hz
    const t = clock.elapsedTime;
    lightsRef.current.forEach((light, i) => {
      if (!light) return;
      light.intensity = 1.6 + Math.sin(t * 8 + i * 2.1) * 0.5;
    });
  });

  const lockedDoors = DOOR_LIGHTS.filter(d => d.intensity < 2);
  return (
    <>
      {lockedDoors.map((d, i) => (
        <pointLight
          key={i}
          ref={el => { lightsRef.current[i] = el; }}
          position={[d.x, 3.0, d.z]}
          color={d.color}
          intensity={d.intensity}
          distance={12}
          decay={2}
        />
      ))}
    </>
  );
}

// ── Full corridor ──────────────────────────────────────────────────────────────
export default function MatrixCorridor() {
  // Static unlocked-door lights — no animation, zero runtime cost
  const unlockedDoors = DOOR_LIGHTS.filter(d => d.intensity >= 2);

  return (
    <group>
      {Array.from({ length: SEGS }).map((_, i) => (
        <CorridorSeg key={i} zC={-(i * SEG_LEN) - SEG_LEN / 2} />
      ))}

      {/* End wall */}
      <mesh position={[0, CEIL_Y / 2, -TOTAL - 0.5]}>
        <boxGeometry args={[WALL_X * 2 + 0.4, CEIL_Y + 0.3, 0.5]} />
        <meshStandardMaterial color={W} roughness={0.9} />
      </mesh>

      {/* Static green accent lights for unlocked doors */}
      {unlockedDoors.map((d, i) => (
        <pointLight key={i} position={[d.x, 3.0, d.z]}
          color={d.color} intensity={d.intensity} distance={12} decay={2} />
      ))}

      {/* Animated flicker only for locked (red) doors */}
      <LockedDoorFlicker />
    </group>
  );
}
