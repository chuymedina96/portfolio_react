import React, { useState } from 'react';

const ShipIcon = () => (
  <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 100 }}>
    <path d="M40 4 L54 52 L54 82 L40 90 L26 82 L26 52 Z" fill="#0d1535" stroke="#00d4ff" strokeWidth="1.5"/>
    <path d="M40 4 L50 30 L40 35 L30 30 Z" fill="#162050" stroke="#00d4ff" strokeWidth="1"/>
    <ellipse cx="40" cy="46" rx="8" ry="12" fill="#0a1428" stroke="#00d4ff" strokeWidth="1"/>
    <ellipse cx="40" cy="43" rx="5" ry="8" fill="#00d4ff" opacity="0.2"/>
    <path d="M27 55 L7 78 L16 90 L25 70 Z" fill="#0d1535" stroke="#00d4ff" strokeWidth="1"/>
    <path d="M53 55 L73 78 L64 90 L55 70 Z" fill="#0d1535" stroke="#00d4ff" strokeWidth="1"/>
    <ellipse cx="40" cy="94" rx="9" ry="5" fill="#ff6b35" opacity="0.9"/>
    <ellipse cx="40" cy="95" rx="4" ry="3" fill="#fff" opacity="0.7"/>
    <ellipse cx="23" cy="84" rx="5" ry="3" fill="#9b5fff" opacity="0.8"/>
    <ellipse cx="57" cy="84" rx="5" ry="3" fill="#9b5fff" opacity="0.8"/>
    <circle cx="7" cy="81" r="2" fill="#ff4444" opacity="0.9"/>
    <circle cx="73" cy="81" r="2" fill="#44ff44" opacity="0.9"/>
  </svg>
);

const CarIcon = () => (
  <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 120, height: 60 }}>
    <rect x="10" y="28" width="100" height="18" rx="2" fill="#0c1230" stroke="#ff6b35" strokeWidth="1.5"/>
    <path d="M25 28 L35 14 L85 14 L95 28Z" fill="#0c1230" stroke="#ff6b35" strokeWidth="1.5"/>
    <rect x="38" y="16" width="44" height="11" rx="1" fill="#ff6b35" opacity="0.2" stroke="#ff6b35" strokeWidth="0.5"/>
    <rect x="8" y="36" width="14" height="4" rx="1" fill="#ff0022" opacity="0.9"/>
    <rect x="98" y="36" width="14" height="4" rx="1" fill="#fff8cc" opacity="0.9"/>
    <circle cx="28" cy="46" r="8" fill="#060810" stroke="#1a2a4a" strokeWidth="1.5"/>
    <circle cx="28" cy="46" r="5" fill="#1a2a4a" stroke="#00d4ff" strokeWidth="1"/>
    <circle cx="92" cy="46" r="8" fill="#060810" stroke="#1a2a4a" strokeWidth="1.5"/>
    <circle cx="92" cy="46" r="5" fill="#1a2a4a" stroke="#00d4ff" strokeWidth="1"/>
    <line x1="10" y1="46" x2="110" y2="46" stroke="#00d4ff" strokeWidth="0.5" opacity="0.3"/>
    <rect x="11" y="45" width="98" height="1.5" rx="0.75" fill="#00d4ff" opacity="0.4"/>
    <rect x="56" y="42" width="8" height="3" rx="1" fill="#ff6b35" opacity="0.8"/>
    <rect x="60" y="42" width="4" height="5" rx="0.5" fill="#ff6b35" opacity="0.6"/>
  </svg>
);

export default function ModeSelect({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  const [chosen,  setChosen]  = useState(null);

  const pick = mode => {
    setChosen(mode);
    setTimeout(() => onSelect(mode), 650);
  };

  return (
    <div className="mode-select">
      {/* Animated background stars */}
      <div className="mode-bg-stars" />

      <div className="mode-header">
        <div className="mode-pre">Jesus Medina · Portfolio</div>
        <h1 className="mode-title">
          Choose Your <span>Experience</span>
        </h1>
        <p className="mode-sub">Two ways to explore the portfolio. Pick your ride.</p>
      </div>

      <div className="mode-cards">

        {/* ── Space card ── */}
        <button
          className={`mode-card mode-card--space
            ${hovered === 'space' ? 'mode-card--hovered' : ''}
            ${chosen  === 'space' ? 'mode-card--chosen'  : ''}
            ${chosen  && chosen !== 'space' ? 'mode-card--faded' : ''}`}
          onClick={() => pick('space')}
          onMouseEnter={() => setHovered('space')}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="mode-card-glow" />
          <div className="mode-card-icon"><ShipIcon /></div>
          <div className="mode-card-badge">MODE 01</div>
          <h2 className="mode-card-title">Space Explorer</h2>
          <p className="mode-card-desc">
            Pilot a spaceship through a 3D galaxy. Fly to holographic space stations to explore my bio, resume, and projects.
          </p>
          <div className="mode-card-tags">
            <span>WASD + Mouse</span>
            <span>Free Flight</span>
            <span>3D Space</span>
          </div>
          <div className="mode-card-cta">
            <span>Launch</span>
            <span className="mode-card-arrow">→</span>
          </div>
          <div className="mode-card-corner mode-card-corner--tl" />
          <div className="mode-card-corner mode-card-corner--tr" />
          <div className="mode-card-corner mode-card-corner--bl" />
          <div className="mode-card-corner mode-card-corner--br" />
        </button>

        <div className="mode-or">
          <div className="mode-or-line" />
          <span>OR</span>
          <div className="mode-or-line" />
        </div>

        {/* ── Race card ── */}
        <button
          className={`mode-card mode-card--race
            ${hovered === 'race' ? 'mode-card--hovered' : ''}
            ${chosen  === 'race' ? 'mode-card--chosen'  : ''}
            ${chosen  && chosen !== 'race' ? 'mode-card--faded' : ''}`}
          onClick={() => pick('race')}
          onMouseEnter={() => setHovered('race')}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="mode-card-glow" />
          <div className="mode-card-icon"><CarIcon /></div>
          <div className="mode-card-badge" style={{ color: '#ff6b35', borderColor: 'rgba(255,107,53,.35)' }}>MODE 02</div>
          <h2 className="mode-card-title" style={{ color: '#ff6b35' }}>Midnight Drive</h2>
          <p className="mode-card-desc">
            Race a neon-lit supercar down a cyberpunk highway. Pull into glowing pit stops to browse my experience.
          </p>
          <div className="mode-card-tags">
            <span style={{ borderColor: 'rgba(255,107,53,.3)', color: 'rgba(255,107,53,.8)' }}>WASD + Mouse</span>
            <span style={{ borderColor: 'rgba(255,107,53,.3)', color: 'rgba(255,107,53,.8)' }}>On Rails</span>
            <span style={{ borderColor: 'rgba(255,107,53,.3)', color: 'rgba(255,107,53,.8)' }}>Neon Highway</span>
          </div>
          <div className="mode-card-cta" style={{ color: '#ff6b35', borderColor: 'rgba(255,107,53,.4)' }}>
            <span>Drive</span>
            <span className="mode-card-arrow">→</span>
          </div>
          <div className="mode-card-corner mode-card-corner--tl" style={{ borderColor: 'rgba(255,107,53,.4)' }} />
          <div className="mode-card-corner mode-card-corner--tr" style={{ borderColor: 'rgba(255,107,53,.4)' }} />
          <div className="mode-card-corner mode-card-corner--bl" style={{ borderColor: 'rgba(255,107,53,.4)' }} />
          <div className="mode-card-corner mode-card-corner--br" style={{ borderColor: 'rgba(255,107,53,.4)' }} />
        </button>

      </div>

      <p className="mode-footer">Use WASD to move · Mouse to steer · E to dock · Esc to undock</p>
    </div>
  );
}
