import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

// ── Matrix Reloaded — bright white institutional corridor ─────────────────────
const WALL_X  = 5;
const CEIL_Y  = 8;
const SEG_LEN = 100;
const TOTAL   = 290;
const SEGS    = Math.ceil(TOTAL / SEG_LEN);

// Color palette — warm off-white like the movie
const W  = '#f0ede7';   // wall
const F  = '#d8d5cc';   // floor
const C  = '#f6f4ef';   // ceiling
const TR = '#c2bfb7';   // trim / seam lines
const L  = '#fffef4';   // ceiling light color
const LD = '#fff8e0';   // dim light tint

const SEAM_Z     = 3.8;   // panel seam interval (Z)
const TILE_Z     = 2.0;   // floor tile interval
const TILE_X     = 1.8;   // floor tile width
const SEAMS_PER_SEG = Math.ceil(SEG_LEN / SEAM_Z);
const H_TILES       = Math.ceil(SEG_LEN / TILE_Z);

// Pre-compute wall seam offsets (relative to segment center)
const SEAM_OFFSETS = Array.from({ length: SEAMS_PER_SEG }, (_, i) =>
  -SEG_LEN / 2 + i * SEAM_Z
);
// Pre-compute floor tile Z offsets
const H_TILE_OFFS = Array.from({ length: H_TILES }, (_, i) =>
  -SEG_LEN / 2 + i * TILE_Z
);
// Floor tile vertical positions
const V_TILE_XS = [-WALL_X + TILE_X / 2];
for (let x = -WALL_X + TILE_X; x < WALL_X; x += TILE_X) V_TILE_XS.push(x);

// ── Wall with panel seams ──────────────────────────────────────────────────────
function WallFace({ zC, side }) {
  const x  = side === 'left' ? -WALL_X : WALL_X;
  const nx = side === 'left' ? 1 : -1;

  return (
    <group>
      {/* Main wall surface */}
      <mesh position={[x, CEIL_Y / 2, zC]}>
        <boxGeometry args={[0.16, CEIL_Y + 0.24, SEG_LEN]} />
        <meshStandardMaterial color={W} roughness={0.92} metalness={0.01} />
      </mesh>

      {/* Vertical panel seam lines */}
      {SEAM_OFFSETS.map((relZ, i) => (
        <mesh key={i} position={[x + nx * 0.082, CEIL_Y / 2, zC + relZ]}>
          <boxGeometry args={[0.008, CEIL_Y, 0.036]} />
          <meshStandardMaterial color={TR} roughness={0.88} />
        </mesh>
      ))}

      {/* Crown molding */}
      <mesh position={[x + nx * 0.075, CEIL_Y - 0.22, zC]}>
        <boxGeometry args={[0.16, 0.42, SEG_LEN + 0.1]} />
        <meshStandardMaterial color={TR} roughness={0.86} />
      </mesh>

      {/* Baseboard */}
      <mesh position={[x + nx * 0.075, 0.13, zC]}>
        <boxGeometry args={[0.16, 0.25, SEG_LEN + 0.1]} />
        <meshStandardMaterial color={TR} roughness={0.86} />
      </mesh>
    </group>
  );
}

// ── Ceiling with recessed light panels ────────────────────────────────────────
function CeilingLights({ zC }) {
  // 3 evenly spaced panels per segment
  const spacing = SEG_LEN / 3;
  return (
    <group>
      {[0, 1, 2].map(i => {
        const pz = zC - SEG_LEN / 2 + spacing * 0.5 + i * spacing;
        return (
          <group key={i}>
            {/* Recessed trough */}
            <mesh position={[0, CEIL_Y + 0.01, pz]}>
              <boxGeometry args={[3.2, 0.06, spacing * 0.75]} />
              <meshStandardMaterial color={C} roughness={0.95} />
            </mesh>
            {/* Glowing light panel */}
            <mesh position={[0, CEIL_Y - 0.015, pz]}>
              <boxGeometry args={[2.2, 0.025, spacing * 0.65]} />
              <meshStandardMaterial color={L} emissive={L} emissiveIntensity={2.8} />
            </mesh>
            {/* Flanking accent strips */}
            <mesh position={[-2.2, CEIL_Y - 0.015, pz]}>
              <boxGeometry args={[0.55, 0.02, spacing * 0.55]} />
              <meshStandardMaterial color={LD} emissive={LD} emissiveIntensity={1.4} transparent opacity={0.75} />
            </mesh>
            <mesh position={[2.2, CEIL_Y - 0.015, pz]}>
              <boxGeometry args={[0.55, 0.02, spacing * 0.55]} />
              <meshStandardMaterial color={LD} emissive={LD} emissiveIntensity={1.4} transparent opacity={0.75} />
            </mesh>
            {/* Fill light */}
            <pointLight
              position={[0, CEIL_Y - 0.5, pz]}
              color={L}
              intensity={8}
              distance={SEG_LEN * 0.55}
              decay={2}
            />
          </group>
        );
      })}
    </group>
  );
}

// ── Floor tiles ────────────────────────────────────────────────────────────────
function FloorTiles({ zC }) {
  return (
    <group>
      {/* Floor base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zC]}>
        <planeGeometry args={[WALL_X * 2, SEG_LEN]} />
        <meshStandardMaterial color={F} roughness={0.87} metalness={0.05} />
      </mesh>
      {/* Horizontal tile grout lines */}
      {H_TILE_OFFS.map((relZ, i) => (
        <mesh key={i} position={[0, 0.002, zC + relZ]}>
          <boxGeometry args={[WALL_X * 2, 0.001, 0.022]} />
          <meshStandardMaterial color={TR} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* Vertical tile grout lines */}
      {[-3, -1.5, 0, 1.5, 3].map(gx => (
        <mesh key={gx} position={[gx, 0.002, zC]}>
          <boxGeometry args={[0.022, 0.001, SEG_LEN]} />
          <meshStandardMaterial color={TR} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ── One corridor segment ───────────────────────────────────────────────────────
function CorridorSeg({ zC }) {
  return (
    <group>
      <FloorTiles zC={zC} />

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEIL_Y, zC]}>
        <planeGeometry args={[WALL_X * 2, SEG_LEN]} />
        <meshStandardMaterial color={C} roughness={0.91} />
      </mesh>

      <WallFace zC={zC} side="left" />
      <WallFace zC={zC} side="right" />
      <CeilingLights zC={zC} />
    </group>
  );
}

// ── Colored accent lights near each door ──────────────────────────────────────
// Unlocked doors glow green, locked glow red — adds dramatic atmosphere
const DOOR_LIGHTS = [
  { z: -42,  x: -3.8, color: '#00ff41', locked: false },
  { z: -62,  x:  3.8, color: '#ff2200', locked: true  },
  { z: -84,  x: -3.8, color: '#33ff88', locked: false },
  { z: -106, x:  3.8, color: '#ff2200', locked: true  },
  { z: -128, x: -3.8, color: '#00ffcc', locked: false },
  { z: -152, x:  3.8, color: '#ff2200', locked: true  },
  { z: -174, x: -3.8, color: '#88ff44', locked: false },
];

function DoorAccentLights() {
  const lightsRef = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lightsRef.current.forEach((light, i) => {
      if (!light) return;
      const base = DOOR_LIGHTS[i].locked ? 2.5 : 3.5;
      // Locked doors flicker menacingly; unlocked doors pulse gently
      const flicker = DOOR_LIGHTS[i].locked
        ? base + Math.sin(t * 18 + i) * 0.8 + Math.sin(t * 37 + i * 3) * 0.4
        : base + Math.sin(t * 1.8 + i) * 0.6;
      light.intensity = flicker;
    });
  });

  return (
    <>
      {DOOR_LIGHTS.map((d, i) => (
        <pointLight
          key={i}
          ref={el => { lightsRef.current[i] = el; }}
          position={[d.x, 3.0, d.z]}
          color={d.color}
          intensity={d.locked ? 2.5 : 3.5}
          distance={14}
          decay={2}
        />
      ))}
    </>
  );
}

// ── Full corridor ──────────────────────────────────────────────────────────────
export default function MatrixCorridor() {
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

      <DoorAccentLights />
    </group>
  );
}
