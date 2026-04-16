import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Fog } from '@react-three/drei';
import RaceCar   from './RaceCar';
import Road      from './Road';
import PitStop   from './PitStop';
import Stars     from './Stars';
import HUD       from './HUD';
import { RACE_STATIONS } from './constants';

function Scene({ onNearStation, nearStation }) {
  const handleNear = useCallback(s => onNearStation(s), [onNearStation]);

  return (
    <>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.05} />
      <directionalLight position={[0, 50, -200]} intensity={0.2} color="#5566aa" />

      {/* ── Environment ── */}
      <color attach="background" args={['#020209']} />
      <fog   attach="fog"        args={['#020209', 80, 500]} />

      {/* Starfield in the distance */}
      <Stars />

      {/* Road + lamps */}
      <Road />

      {/* Player car */}
      <RaceCar onNearStation={handleNear} />

      {/* Pit stops */}
      {RACE_STATIONS.map(s => (
        <PitStop
          key={s.id}
          {...s}
          isActive={nearStation?.id === s.id}
        />
      ))}

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function RaceGame({ resumeData }) {
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
        camera={{ fov: 65, near: 0.5, far: 1000, position: [0, 5, 13] }}
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
        mode="race"
      />
    </div>
  );
}
