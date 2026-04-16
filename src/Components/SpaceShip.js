import React, { useEffect, useRef, useState } from 'react';

const SpaceShip = () => {
  const wrapRef  = useRef(null);
  const lastY    = useRef(0);
  const tiltTimer = useRef(null);
  const [tilt, setTilt] = useState('tilt-none');

  useEffect(() => {
    const onScroll = () => {
      const y     = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;

      if (Math.abs(delta) < 2) return;
      setTilt(delta < 0 ? 'tilt-down' : 'tilt-up');

      clearTimeout(tiltTimer.current);
      tiltTimer.current = setTimeout(() => setTilt('tilt-none'), 180);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(tiltTimer.current);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`spaceship-wrapper ${tilt}`} aria-hidden="true">
      <svg viewBox="0 0 80 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Engine flames */}
        <ellipse className="flame-main" cx="40" cy="152" rx="11" ry="8" fill="#ff6b35"/>
        <ellipse className="flame-core" cx="40" cy="154" rx="5"  ry="4" fill="#fff" opacity="0.75"/>
        <ellipse className="flame-side" cx="22" cy="138" rx="6"  ry="4" fill="#9b5fff"/>
        <ellipse className="flame-side" cx="58" cy="138" rx="6"  ry="4" fill="#9b5fff"/>

        {/* Main fuselage */}
        <path d="M40 8 L54 72 L54 128 L40 140 L26 128 L26 72 Z"
              fill="#0d1535" stroke="#00d4ff" strokeWidth="1.4"/>

        {/* Nose cone */}
        <path d="M40 8 L50 42 L40 48 L30 42 Z"
              fill="#162050" stroke="#00d4ff" strokeWidth="1"/>

        {/* Cockpit */}
        <ellipse cx="40" cy="70" rx="10" ry="16" fill="#0a1428" stroke="#00d4ff" strokeWidth="1"/>
        <ellipse cx="40" cy="67" rx="6"  ry="11" fill="#00d4ff" opacity="0.12"/>
        <ellipse cx="38" cy="63" rx="3"  ry="6"  fill="#00d4ff" opacity="0.28"/>

        {/* Left wing */}
        <path d="M27 78 L5 108 L14 124 L26 104 Z"
              fill="#0d1535" stroke="#00d4ff" strokeWidth="1"/>
        <line x1="9"  y1="112" x2="24" y2="90" stroke="#00d4ff" strokeWidth="0.5" opacity="0.55"/>

        {/* Right wing */}
        <path d="M53 78 L75 108 L66 124 L54 104 Z"
              fill="#0d1535" stroke="#00d4ff" strokeWidth="1"/>
        <line x1="71" y1="112" x2="56" y2="90" stroke="#00d4ff" strokeWidth="0.5" opacity="0.55"/>

        {/* Left engine pod */}
        <rect x="15" y="115" width="13" height="26" rx="6.5" fill="#080f25" stroke="#9b5fff" strokeWidth="1"/>

        {/* Right engine pod */}
        <rect x="52" y="115" width="13" height="26" rx="6.5" fill="#080f25" stroke="#9b5fff" strokeWidth="1"/>

        {/* Center engine */}
        <rect x="33" y="125" width="14" height="26" rx="7" fill="#080f25" stroke="#00d4ff" strokeWidth="1"/>

        {/* Fuselage detail lines */}
        <line x1="26" y1="90" x2="26" y2="116" stroke="#00d4ff" strokeWidth="0.5" opacity="0.35"/>
        <line x1="54" y1="90" x2="54" y2="116" stroke="#00d4ff" strokeWidth="0.5" opacity="0.35"/>
        <line x1="35" y1="52" x2="35" y2="75"  stroke="#00d4ff" strokeWidth="0.4" opacity="0.3"/>
        <line x1="45" y1="52" x2="45" y2="75"  stroke="#00d4ff" strokeWidth="0.4" opacity="0.3"/>

        {/* Wingtip weapons */}
        <circle className="weapon-glow" cx="5"  cy="110" r="2.5" fill="#ff6b35"/>
        <circle className="weapon-glow" cx="75" cy="110" r="2.5" fill="#ff6b35"/>

        {/* Nose sensors */}
        <circle cx="40" cy="22" r="2.2" fill="#00d4ff" opacity="0.9"/>
        <circle cx="36" cy="33" r="1.2" fill="#00d4ff" opacity="0.5"/>
        <circle cx="44" cy="33" r="1.2" fill="#00d4ff" opacity="0.5"/>
      </svg>
    </div>
  );
};

export default SpaceShip;
