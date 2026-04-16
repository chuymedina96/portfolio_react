import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import Ship          from './Ship';
import Stars         from './Stars';
import Nebula        from './Nebula';
import Station       from './Station';
import SpaceDust     from './SpaceDust';
import RouteBeacons  from './RouteBeacons';
import HUD           from './HUD';
import { STATIONS }  from './constants';

function Scene({ onNearStation, nearStation }) {
  const handleNear = useCallback(s => onNearStation(s), [onNearStation]);

  return (
    <>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.06} />
      <directionalLight position={[200, 300, 100]} intensity={0.35} color="#8899ff" />

      {/* ── Environment ── */}
      <color attach="background" args={['#020209']} />
      <fog   attach="fog"        args={['#020209', 400, 1600]} />

      <Stars />
      <Nebula />
      <SpaceDust />
      <RouteBeacons />

      {/* ── Player ship ── */}
      <Ship onNearStation={handleNear} />

      {/* ── Portfolio stations ── */}
      {STATIONS.map(s => (
        <Station
          key={s.id}
          {...s}
          isActive={nearStation?.id === s.id}
        />
      ))}

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function SpaceGame({ resumeData }) {
  const [nearStation,   setNearStation]   = useState(null);
  const [dockedStation, setDockedStation] = useState(null);

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'KeyE' && nearStation && !dockedStation) {
        setDockedStation(nearStation);
      } else if ((e.code === 'KeyE' || e.code === 'Escape') && dockedStation) {
        setDockedStation(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nearStation, dockedStation]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ fov: 68, near: 0.5, far: 2000, position: [0, 2.8, 11] }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 1.5]}
      >
        <Scene onNearStation={setNearStation} nearStation={nearStation} />
      </Canvas>

      <HUD
        nearStation={nearStation}
        dockedStation={dockedStation}
        onUndock={() => setDockedStation(null)}
        resumeData={resumeData}
      />
    </div>
  );
}
