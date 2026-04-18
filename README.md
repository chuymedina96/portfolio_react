# Portfolio Matrix — Interactive 3D Portfolio Game

A fully playable Matrix-themed first/third-person game built as a portfolio site. You play as Neo walking a neon-lit corridor, entering doors to explore resume, projects, and contact info — while surviving Agent Smith.

Built with **React 18**, **Three.js**, and **React Three Fiber**. No game engine. No physics library. Every system — gravity, combat, AI, animation — is hand-rolled.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Tech Stack](#tech-stack)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [How the Game Engine Works](#how-the-game-engine-works)
  - [Game Loop & Phase Machine](#game-loop--phase-machine)
  - [Scene System — Rooms & Doors](#scene-system--rooms--doors)
  - [Player (Neo) — Movement & Physics](#player-neo--movement--physics)
  - [Combat System](#combat-system)
  - [Animation System](#animation-system)
  - [Agent Smith AI](#agent-smith-ai)
  - [Bullet System](#bullet-system)
  - [Bullet-Time](#bullet-time)
  - [Mobile Controls](#mobile-controls)
  - [HUD & Portfolio Panels](#hud--portfolio-panels)
- [Portfolio Content](#portfolio-content)
- [Adding Features](#adding-features)
  - [Add a New Room](#add-a-new-room)
  - [Add a Combat Move](#add-a-combat-move)
  - [Add a New Enemy Behavior](#add-a-new-enemy-behavior)
  - [Add a Mobile Button](#add-a-mobile-button)
- [Performance Notes](#performance-notes)
- [Deployment](#deployment)

---

## Live Demo

[portfolio link here]

> Tip: Play in landscape on mobile. Desktop recommended for full combat.

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `three` | ^0.183.2 | 3D math, geometry, materials |
| `@react-three/fiber` | ^8.18.0 | React renderer for Three.js scenes |
| `@react-three/drei` | ^9.122.0 | Helpers: `Text`, `Billboard`, `AdaptiveDpr`, etc. |
| `@react-three/postprocessing` | ^3.0.4 | Post-processing effects |
| `framer-motion` | ^12.38.0 | UI animation |
| `gsap` | ^3.15.0 | Timeline animation toolkit |

> No physics engine (Cannon, Rapier, etc.) is used. Gravity, collision, knockback — all manual.

---

## Running Locally

**Requirements:** Node 20+

```bash
# Clone and install
git clone <your-repo-url>
cd portfolio_react
npm install

# Start dev server (hot reload)
npm run dev
# → http://localhost:3000

# Production build
npm run build

# Serve the production build locally
npm run start
```

The app loads `public/resumeData.json` at startup. Edit that file to change the portfolio content without touching any game code.

---

## Project Structure

```
src/
├── App.js                    # Root: fetches resumeData.json, lazy-loads game
├── game/
│   ├── MatrixGame.js         # ★ Main game — 2700+ lines, all state lives here
│   ├── PlayerCharacter.js    # Neo model, TPS camera, movement, collision
│   ├── AgentSmith.js         # Enemy AI state machine + body animation
│   ├── MatrixCorridor.js     # Corridor geometry (walls, floor, lights, rain)
│   ├── MatrixRoom.js         # Four portfolio rooms + Architect chamber
│   ├── MatrixDoor.js         # Door mesh with glow/lock animations
│   ├── MatrixBullet.js       # Enemy bullet physics & hit detection
│   ├── MatrixRain.js         # Matrix rain overlay (CSS canvas)
│   ├── MobileControls.js     # On-screen touch controls
│   ├── WakeUpSequence.js     # Opening typewriter cinematic
│   ├── HUD.js                # Portfolio panels (About, Resume, etc.)
│   ├── useControls.js        # Keyboard state hook
│   ├── useMobile.js          # Mobile device detection
│   ├── constants.js          # ★ All tunable game constants
│   └── MatrixGame.css        # All game styles
└── Components/               # Non-game React components (legacy portfolio UI)

public/
├── resumeData.json           # ★ Portfolio content — edit this file
├── images/                   # Portfolio images
└── Chuy's Résumé.pdf
```

The two most important files for understanding the game are `MatrixGame.js` (orchestrator) and `constants.js` (all the numbers).

---

## How the Game Engine Works

### Game Loop & Phase Machine

The game runs through three phases managed by a single `useState` in `MatrixGame`:

```
'intro'  →  WakeUpSequence (typewriter cinematic, skip on tap/keypress)
'tutorial' →  Controls tutorial modal
'playing'  →  Full game, Canvas mounted
```

Inside the Canvas, `useFrame` (React Three Fiber's per-frame hook) drives everything:

```js
// Simplified game loop structure in PlayerCharacter.js
useFrame(({ clock }, delta) => {
  const dt = delta * timeScaleRef.current;  // bullet-time scales this down

  applyGravity(dt);
  readInput(dt);         // keyboard + mobile joystick
  movePlayer(dt);        // velocity integration
  resolveBounds();       // wall/floor collision
  updateCamera();        // TPS camera follow
  updateAnimState();     // feed stateRef for NeoBody
});
```

The key architectural decision: **refs over state** for everything that changes every frame. `charPosRef`, `yawRef`, `pitchRef`, `stateRef`, `dodgeRef`, `timeScaleRef` are all refs. React `useState` is only called when the UI actually needs to re-render (health bar, ammo count, door prompts).

---

### Scene System — Rooms & Doors

All doors are defined in `constants.js`:

```js
// src/game/constants.js
export const MATRIX_DOORS = [
  { id: 'about',     position: new THREE.Vector3(-5.0, 2.9, -28),  label: '> KNOW THYSELF',          side: 'left',   locked: false },
  { id: 'locked-1',  position: new THREE.Vector3( 5.0, 2.9, -50),  label: '> SYSTEM_32',              side: 'right',  locked: true  },
  { id: 'resume',    position: new THREE.Vector3(-5.0, 2.9, -72),  label: '> FOLLOW THE CODE',        side: 'left',   locked: false },
  { id: 'portfolio', position: new THREE.Vector3(-5.0, 2.9, -94),  label: '> DOWN THE RABBIT HOLE',   side: 'left',   locked: false },
  { id: 'contact',   position: new THREE.Vector3(-5.0, 2.9, -138), label: '> THE ORACLE AWAITS',      side: 'left',   locked: false },
  { id: 'architect', position: new THREE.Vector3( 0,   2.9, -210), label: '> THE ARCHITECT',          side: 'center', locked: false },
  // ...
];

export const MATRIX_DOOR_DIST = 6;  // proximity radius to trigger "enter" prompt
```

Rooms are matched by door ID to a renderer in `MatrixRoom.js`:

```js
// src/game/MatrixRoom.js
const ROOM_MAP = {
  about:     AboutRoom,
  resume:    ResumeRoom,
  portfolio: PortfolioRoom,
  contact:   ContactRoom,
  architect: ArchitectRoom,
  'locked-2': RootAccessRoom,
};
```

Scene switching in `MatrixGame.js` sets `sceneId` which unmounts/mounts the appropriate room component and repositions the player at the entrance.

---

### Player (Neo) — Movement & Physics

All constants are in `PlayerCharacter.js` header:

```js
const WALK_SPD     = 7.0;   // units/sec
const RUN_SPD      = 14.5;  // units/sec (Shift held)
const GRAVITY      = 26;    // units/sec²
const JUMP_VEL     = 10.0;  // upward velocity on jump
const WALL_JUMP_VY = 9.5;   // wall-jump vertical component
const WALL_JUMP_VX = 11.0;  // wall-jump push-off force
const WALL_CD      = 0.35;  // seconds before re-jumping same wall
```

**Physics loop (simplified):**

```js
// gravity
jumpRef.current.vy -= GRAVITY * dt;

// wall detection — ray cast outward, detect near-wall
if (nearWall && Space pressed) {
  jumpRef.current.vy = WALL_JUMP_VY;
  jumpRef.current.vx = WALL_JUMP_VX * awayDir;
}

// bound clamping — no mesh collision, just box
pos.x = THREE.MathUtils.clamp(pos.x, bounds.xMin, bounds.xMax);
pos.z = THREE.MathUtils.clamp(pos.z, bounds.zMin, bounds.zMax);
pos.y = Math.max(pos.y, 0);  // floor
```

**Camera:** Third-person over-shoulder, shoulder offset toggles on aim.

```js
const CAM_DIST = 5.2;   // distance behind player
const CAM_H    = 2.6;   // height above player
const CAM_LOOK = 1.3;   // forward look-ahead bias
```

---

### Combat System

Combat state is tracked in `stateRef` (a ref, not React state) and cooldowns are tracked as separate refs:

```js
// MatrixGame.js — simplified structure
const punchCdRef    = useRef(0);   // punch cooldown timer
const kickCdRef     = useRef(0);
const spinKickCdRef = useRef(0);
const upperCdRef    = useRef(0);

// Decremented in the main useFrame loop:
punchCdRef.current = Math.max(0, punchCdRef.current - 0.05);
```

| Move | Key | Mobile | Damage | Range | Cooldown |
|---|---|---|---|---|---|
| Punch (jab/cross) | `J` | PUNCH | 34 HP | 2.6 units | 0.5s |
| Uppercut | `U` | UPPER | 58 HP | 2.8 units | 0.9s |
| Roundhouse kick | `K` | KICK | 45 HP | 2.6 units | 0.6s |
| Spinning hook kick | `L` | SPIN | 72 HP | 4.8 units | 1.05s |
| Block | `B` hold | BLOCK hold | — | — | — |
| Dodge left/right | `Q` / `R` | ◄DGE / DGE► | — | — | — |
| Shoot | Mouse click | FIRE | 28 HP | 58 u/s bullet | — |
| Bullet-Time | `Z` / `F` | BT | — | — | 8s |

**Hit detection** is distance + angle based — no mesh raycasting:

```js
// MatrixGame.js — handleMobilePunch (simplified)
const dx = agentPos.x - playerPos.x;
const dz = agentPos.z - playerPos.z;
const dist = Math.sqrt(dx*dx + dz*dz);
const angle = Math.abs(angleDiff(playerFacing, Math.atan2(dx, dz)));

if (dist < PUNCH_RANGE && angle < PUNCH_CONE) {
  agent.takeDamage(34);
}
```

---

### Animation System

Neo's body is a procedural voxel mesh in `NeoBody` (inside `PlayerCharacter.js`). There is no skeletal rig — every limb is a `useRef` to a `<group>` and rotated directly in `useFrame`:

```js
// PlayerCharacter.js — NeoBody useFrame (simplified)
const pAmp = -Math.PI * 0.92 * Math.sin(s.punchT * Math.PI);  // bell-curve punch arc

if (s.punching && s.altArm === 0) rArm.current.rotation.x = pAmp;  // jab
if (s.punching && s.altArm === 1) lArm.current.rotation.x = pAmp;  // cross
if (s.punching && s.altArm === 2) rArm.current.rotation.x = upperAmpX; // uppercut

if (blocking) {
  lArm.current.rotation.x = -1.15;   // guard up
  rArm.current.rotation.x = -1.0;
}
```

`stateRef.current` carries all animation flags:

```js
// Fields on stateRef.current
{
  moving, running, grounded, jumping, flying, crouching,
  punching, punchT, altArm,   // punch progress & which arm
  kicking, kickT, flyKick,    // kick progress
  spinKicking, spinKickT,
  dodging, dodgeDir,
  shooting, shootT,
  blocking,
}
```

---

### Agent Smith AI

`AgentSmith.js` runs its own `useFrame` state machine. The agent has one numeric `hp` ref and a string `phase` ref:

```
idle → approaching → melee / shooting → hit → (dead)
```

Key distances (all in world units):

```js
const PREFERRED_MIN = 2.8;   // too close — strafe away
const PREFERRED_MAX = 9.0;   // too far  — close in
const MELEE_RANGE   = 2.6;   // within this — punch
const SHOOT_RANGE   = 38;    // beyond this — fire bullet
const MELEE_CD      = 1.5;   // seconds between punches
const MELEE_DMG     = 18;    // damage dealt per punch to player
const MAX_HP        = 100;
```

The agent calls `onMeleePunch()` (passed as a prop) when it attacks, and `MatrixGame.js` handles the damage + screen shake on the player side. This keeps the AI decoupled from player HP.

**Knockback** is applied as a velocity impulse to the agent's position ref:

```js
// Spin kick knocks agent back 5 units over 0.4 seconds
agentRef.knockbackVel = 5.0;
agentRef.knockbackDir = directionAwayFromPlayer;
```

---

### Bullet System

Player bullets and agent bullets are separate arrays in `MatrixGame`'s state:

```js
const [bullets, setBullets]             = useState([]);  // agent → player
const [playerBullets, setPlayerBullets] = useState([]);  // player → agent
```

Each bullet is a data object `{ id, origin, direction }`. A `<MatrixBullet>` or `<PlayerBullet>` component renders it and moves it in `useFrame`:

```js
// MatrixBullet.js
pos.addScaledVector(direction, BULLET_SPD * dt * timeScaleRef.current);

// Hit check each frame
const distToPlayer = pos.distanceTo(playerPos);
if (distToPlayer < HIT_RADIUS) onHit();
if (age > MAX_AGE) onExpire();
```

Bullets are removed from the array when they expire or hit — no object pooling currently.

---

### Bullet-Time

Bullet-time works by scaling a single ref that every physics calculation multiplies:

```js
// MatrixGame.js
const timeScaleRef = useRef(1.0);

// Activation
timeScaleRef.current = 0.12;  // everything slows to 12% speed

// In PlayerCharacter.js and AgentSmith.js
const dt = delta * timeScaleRef.current;  // all movement uses this dt
```

The visual effect (CSS filter) and HUD countdown are React state because they only need to update when BT activates/deactivates.

---

### Mobile Controls

`MobileControls.js` is a single component that owns all touch input. It attaches `touchstart`, `touchmove`, `touchend` listeners to `document` and writes directly to refs — zero React re-renders during gameplay:

```
Left 44% of screen → joystick zone
  Touch start: anchor joystick ring at touch point
  Touch move:  compute normalized { x, y } → mobileJoystickRef

Right 56% of screen → look zone
  Touch move:  delta × sensitivity → yawRef, pitchRef
```

Buttons use `onTouchStart` / `onTouchEnd` instead of `onClick` to eliminate the 300ms tap delay. They write to the same refs that keyboard input does (`mobileJumpRef.current = true`), so `PlayerCharacter.js` reads one unified input layer.

**Sprint detection** is automatic — joystick magnitude above 80% triggers sprint:

```js
const SPRINT_THRESH = 0.80;
mobileSprintRef.current = Math.sqrt(nx*nx + ny*ny) > SPRINT_THRESH;
```

---

### HUD & Portfolio Panels

`HUD.js` renders the portfolio content panels (About, Resume, Portfolio, Contact). It receives `dockedStation` as a prop and picks the right panel from a map:

```js
const PANEL_MAP = {
  about:     <AboutPanel     data={resumeData.main}      />,
  resume:    <ResumePanel    data={resumeData.resume}    />,
  portfolio: <PortfolioPanel data={resumeData.portfolio} />,
  contact:   <ContactPanel   data={resumeData.main}      />,
};
```

Entering a door in the corridor sets `openDoor` state, which passes the door object as `dockedStation` to HUD. Pressing `E` or `Esc` clears `openDoor`.

---

## Portfolio Content

All portfolio content lives in **`public/resumeData.json`**. No code changes needed to update your name, job history, projects, or contact info.

```jsonc
{
  "main": {
    "name": "Your Name",
    "occupation": "Your Title",
    "bio": "Short bio paragraph...",
    "email": "you@example.com",
    "image": "me-pic.jpeg",           // → public/images/me-pic.jpeg
    "resumedownload": "./Resume.pdf", // → public/Resume.pdf
    "social": [
      { "name": "github",   "url": "https://github.com/..." },
      { "name": "linkedin", "url": "https://linkedin.com/in/..." }
    ]
  },
  "resume": {
    "education": [
      { "school": "...", "degree": "...", "graduated": "2020", "description": "..." }
    ],
    "work": [
      { "company": "...", "title": "...", "years": "2021–Present", "description": "..." }
    ],
    "skills": [
      { "name": "React" }, { "name": "Node.js" }, { "name": "Docker" }
    ]
  },
  "portfolio": {
    "projects": [
      {
        "title": "My Project",
        "category": "Web App",
        "image": "portfolio/project.jpg",   // → public/images/portfolio/project.jpg
        "url": "https://...",
        "github": "https://github.com/..."
      }
    ]
  }
}
```

---

## Adding Features

### Add a New Room

**1. Register the door in `constants.js`:**

```js
// src/game/constants.js
export const MATRIX_DOORS = [
  // ...existing doors...
  {
    id:       'blog',
    position: new THREE.Vector3(-5.0, 2.9, -250),
    label:    '> SIGNAL INTERCEPTED',
    sublabel: 'Blog',
    color:    '#00ccff',
    side:     'left',
    locked:   false,
  },
];
```

**2. Build the room component in `MatrixRoom.js`:**

```js
// src/game/MatrixRoom.js
function BlogRoom() {
  return (
    <>
      <ambientLight intensity={0.8} color="#001133" />
      {/* Your geometry here — floor, walls, props */}
      <mesh position={[0, 0, -35]}>
        <boxGeometry args={[18, 12, 70]} />
        <meshStandardMaterial color="#001122" side={THREE.BackSide} />
      </mesh>
    </>
  );
}
```

**3. Register it in ROOM_MAP:**

```js
const ROOM_MAP = {
  about:     AboutRoom,
  resume:    ResumeRoom,
  portfolio: PortfolioRoom,
  contact:   ContactRoom,
  architect: ArchitectRoom,
  blog:      BlogRoom,       // ← add this
};
```

**4. Add a HUD panel in `HUD.js`:**

```js
// HUD.js
const PANEL_MAP = {
  // ...
  blog: <BlogPanel data={resumeData.blog} />,
};
```

That's it — the door detection, scene switching, and panel rendering wire up automatically.

---

### Add a Combat Move

**1. Add a cooldown ref in `MatrixGame.js`:**

```js
const myMoveCdRef = useRef(0);
```

**2. Decrement it in the main game-loop `useFrame`:**

```js
myMoveCdRef.current = Math.max(0, myMoveCdRef.current - 0.05);
```

**3. Write a handler:**

```js
const handleMyMove = useCallback(() => {
  if (paused || dead || myMoveCdRef.current > 0) return;
  myMoveCdRef.current = 1.2;  // 1.2 second cooldown

  stateRef.current.myMove  = true;  // trigger animation
  stateRef.current.myMoveT = 0;

  // Hit detection — check distance + angle to each registered agent
  agentRegistryRef.current.forEach(agent => {
    const dist = charPosRef.current.distanceTo(agent.posRef.current);
    if (dist < 3.5) agent.takeDamage(55);
  });
}, [paused, dead]);
```

**4. Add the animation in `NeoBody` (`PlayerCharacter.js`):**

```js
// Inside NeoBody useFrame
if (s.myMove) {
  s.myMoveT += delta / 0.4;   // 0.4s duration
  const amp = Math.sin(s.myMoveT * Math.PI);
  // manipulate arm/leg refs however you want
  if (s.myMoveT >= 1) { s.myMove = false; s.myMoveT = 0; }
}
```

**5. Wire up the keyboard key and/or mobile button:**

```js
// MatrixGame.js keyboard handler
if (e.code === 'KeyM') handleMyMove();

// MobileControls.js — add a new Btn in the combat row
<Btn color="#ff88ff" w={50} h={44} onPress={onMyMove}>SMASH</Btn>
// and add onMyMove to MobileControls props
```

---

### Add a New Enemy Behavior

Agent Smith's state machine lives at the top of `AgentSmith.js`. States are just string values on a ref:

```js
// Add a new state: 'charging'
if (phase === 'approaching' && dist < 12 && Math.random() < 0.02) {
  phaseRef.current = 'charging';
  chargeTimerRef.current = 0;
}

if (phase === 'charging') {
  chargeTimerRef.current += dt;
  // sprint toward player at 3× speed
  const dir = playerPos.clone().sub(agentPos).normalize();
  agentPos.addScaledVector(dir, WALK_SPD * 3 * dt);

  if (chargeTimerRef.current > 1.0) {
    // deliver a heavy hit then return to normal
    onMeleePunch?.();
    phaseRef.current = 'idle';
  }
}
```

No registration needed — all changes stay within `AgentSmith.js`.

---

### Add a Mobile Button

**1. Add a callback prop to `MobileControls` in `MobileControls.js`:**

```js
export default function MobileControls({
  // ...existing props
  onMyMove,           // ← add this
}) {
```

**2. Add the button to the layout (inside the combat rows):**

```js
{/* Row 2: strikes */}
<div style={{ display: 'flex', gap: 5 }}>
  <Btn color="#00bbff" w={50} h={44} onPress={onPunch}>PUNCH</Btn>
  <Btn color="#00bbff" w={44} h={44} onPress={onKick}>KICK</Btn>
  <Btn color="#ff88ff" w={54} h={44} onPress={onMyMove}>SMASH</Btn>  {/* ← new */}
  {/* ... */}
</div>
```

**3. Pass the handler from `MatrixGame.js`:**

```js
<MobileControls
  // ...existing props
  onMyMove={handleMyMove}
/>
```

---

## Performance Notes

**The frame budget:** All game logic runs in `useFrame` which is tied to `requestAnimationFrame`. On mobile the target is 60 fps with DPR 0.75–1.0.

**Key patterns to preserve:**

- **Never call `setState` inside `useFrame`** unless you want a re-render every frame. Write to refs. Call setState only for discrete events (player takes damage, door opens).
- **Reuse Vector3 objects.** Module-level scratch vectors (`const _fwd = new THREE.Vector3()`) are used for math so no allocation happens per frame.
- **Direct DOM style writes** for the joystick knob position — `element.style.left = '...'` bypasses React entirely and is essential for smooth feel.
- **`Math.max(0, cd - 0.05)`** — all cooldown decrements are clamped to prevent floating-point residue from permanently blocking a move.

**The `timeScaleRef` contract:** Anything that moves must multiply `delta` by `timeScaleRef.current`. If you add a new moving object and forget this, it won't slow down during Bullet-Time.

---

## Deployment

The app is configured for Heroku but any Node static host works.

**Heroku:**
```bash
git push heroku master
# Heroku runs: npm install && npm run build && npm start
```

**Any static host (Vercel, Netlify, GitHub Pages):**
```bash
npm run build
# Upload the /build directory
```

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

The `npm start` script serves the `/build` directory on `$PORT` (defaults to 5000).

---

## License

MIT — fork it, learn from it, make your own portfolio game.
