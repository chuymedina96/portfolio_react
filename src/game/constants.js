import * as THREE from 'three';

// ── Space game stations ───────────────────────────────────────────────────────
export const STATIONS = [
  {
    id:       'about',
    position: new THREE.Vector3(0, 0, -220),
    label:    'COMMANDER',
    sublabel: 'About Me',
    color:    '#00d4ff',
  },
  {
    id:       'resume',
    position: new THREE.Vector3(-180, 40, -480),
    label:    'MISSION LOG',
    sublabel: 'Resume & Skills',
    color:    '#9b5fff',
  },
  {
    id:       'portfolio',
    position: new THREE.Vector3(200, -30, -700),
    label:    'SPACE DOCK',
    sublabel: 'Projects',
    color:    '#00ff9d',
  },
  {
    id:       'contact',
    position: new THREE.Vector3(20, 80, -960),
    label:    'OPEN COMMS',
    sublabel: 'Contact',
    color:    '#ff6b35',
  },
];

export const DOCK_DISTANCE = 38;

// ── Race game pit stops ───────────────────────────────────────────────────────
export const RACE_STATIONS = [
  {
    id:       'about',
    position: new THREE.Vector3(0, 0, -180),
    label:    'COMMANDER',
    sublabel: 'About Me',
    color:    '#00d4ff',
  },
  {
    id:       'resume',
    position: new THREE.Vector3(0, 0, -420),
    label:    'MISSION LOG',
    sublabel: 'Resume & Skills',
    color:    '#9b5fff',
  },
  {
    id:       'portfolio',
    position: new THREE.Vector3(0, 0, -660),
    label:    'SPACE DOCK',
    sublabel: 'Projects',
    color:    '#00ff9d',
  },
  {
    id:       'contact',
    position: new THREE.Vector3(0, 0, -900),
    label:    'OPEN COMMS',
    sublabel: 'Contact',
    color:    '#ff6b35',
  },
];

export const RACE_DOCK_DISTANCE = 30;

// ── Matrix game doors ─────────────────────────────────────────────────────────
// 7 doors: 4 unlocked (each a unique 3D environment), 3 locked
export const MATRIX_DOORS = [
  {
    id:       'about',
    position: new THREE.Vector3(-5.0, 2.9, -35),
    label:    '> KNOW THYSELF',
    sublabel: 'About Me',
    color:    '#00ff41',
    side:     'left',
    locked:   false,
  },
  {
    id:       'locked-1',
    position: new THREE.Vector3(5.0, 2.9, -62),
    label:    '> SYSTEM_32',
    sublabel: 'RESTRICTED',
    color:    '#ff2200',
    side:     'right',
    locked:   true,
  },
  {
    id:       'resume',
    position: new THREE.Vector3(-5.0, 2.9, -88),
    label:    '> FOLLOW THE CODE',
    sublabel: 'Resume & Skills',
    color:    '#33ff88',
    side:     'left',
    locked:   false,
  },
  {
    id:       'portfolio',
    position: new THREE.Vector3(-5.0, 2.9, -114),
    label:    '> DOWN THE RABBIT HOLE',
    sublabel: 'Projects',
    color:    '#00ffcc',
    side:     'left',
    locked:   false,
  },
  {
    id:       'locked-3',
    position: new THREE.Vector3(5.0, 2.9, -140),
    label:    '> ZION MAINFRAME',
    sublabel: 'CLASSIFIED',
    color:    '#ff2200',
    side:     'right',
    locked:   true,
  },
  {
    id:       'contact',
    position: new THREE.Vector3(-5.0, 2.9, -166),
    label:    '> THE ORACLE AWAITS',
    sublabel: 'Contact',
    color:    '#88ff44',
    side:     'left',
    locked:   false,
  },
  {
    id:           'locked-2',
    position:     new THREE.Vector3(5.0, 2.9, -192),
    label:        '> ROOT ACCESS',
    sublabel:     'ACCESS DENIED',
    color:        '#ff2200',
    side:         'right',
    locked:       true,
    isRootAccess: true,
  },
];

export const MATRIX_DOOR_DIST = 18;

// Red pill collectible — between contact and root access doors
export const KEY_POSITION = new THREE.Vector3(0, 0.35, -178);

// Room config — bigger for immersive open environments
export const ROOM = {
  halfW:     9,
  height:    12,
  depth:     70,
  terminalZ: -32,
  exitZ:     -58,
};
