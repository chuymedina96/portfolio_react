import React, { useState } from 'react';
import { STATIONS } from './constants';

// ── Panel content ──────────────────────────────────────────────────────────────

function AboutPanel({ data }) {
  if (!data) return <p style={{ color: 'var(--text-dim)' }}>Loading...</p>;
  const { name, bio, address, phone, email, resumedownload, social = [] } = data;
  return (
    <div className="panel-body">
      <div className="panel-profile-row">
        <img src={`images/${data.image}`} alt={name} className="panel-avatar" />
        <div>
          <h2 className="panel-h2">{name}</h2>
          <div className="panel-badge">● Available for hire</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '.88rem', marginTop: 8, lineHeight: 1.6 }}>{bio}</p>
        </div>
      </div>
      <div className="panel-info-grid">
        <div className="panel-info-item"><span className="panel-info-label">Location</span><span>{address?.city}, {address?.state}</span></div>
        <div className="panel-info-item"><span className="panel-info-label">Phone</span><span>{phone}</span></div>
        <div className="panel-info-item"><span className="panel-info-label">Email</span><span>{email}</span></div>
        <div className="panel-info-item">
          <span className="panel-info-label">Links</span>
          <span>{social.map(s => <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>{s.name}</a>)}</span>
        </div>
      </div>
      <a href={resumedownload} className="panel-btn" download>↓ Download Resume</a>
    </div>
  );
}

function ResumePanel({ data }) {
  if (!data) return <p style={{ color: 'var(--text-dim)' }}>Loading...</p>;
  const { education = [], work = [], skills = [] } = data;
  return (
    <div className="panel-body panel-scroll">
      <h3 className="panel-section-head">Education</h3>
      {education.map(e => (
        <div key={e.school} className="panel-timeline-item">
          <div className="panel-tl-company">{e.school}</div>
          <div className="panel-tl-role">{e.degree} — {e.graduated}</div>
          <div className="panel-tl-desc">{e.description}</div>
        </div>
      ))}

      <h3 className="panel-section-head" style={{ marginTop: 28 }}>Experience</h3>
      {work.map(w => (
        <div key={w.company + w.years} className="panel-timeline-item">
          <div className="panel-tl-company">{w.company}</div>
          <div className="panel-tl-role">{w.title} — <span style={{ opacity: .7 }}>{w.years}</span></div>
          <div className="panel-tl-desc">{w.description}</div>
        </div>
      ))}

      <h3 className="panel-section-head" style={{ marginTop: 28 }}>Skills</h3>
      <div className="panel-skills">
        {skills.map(s => (
          <div key={s.name} className="panel-skill-chip">{s.name}</div>
        ))}
      </div>
    </div>
  );
}

function PortfolioPanel({ data }) {
  const projects = data?.projects || [];
  return (
    <div className="panel-body">
      <div className="panel-projects">
        {projects.map(p => (
          <div key={p.title} className="panel-project-card">
            <img src={`images/portfolio/${p.image}`} alt={p.title}
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="panel-project-info">
              <div className="panel-project-title">{p.title}</div>
              <div className="panel-project-cat">{p.category}</div>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="panel-btn" style={{ marginTop: 10, display: 'inline-flex' }}>
                  Launch →
                </a>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '.8rem' }}>
            No projects loaded yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ContactPanel({ data }) {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    window.open(`mailto:${data?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${name}: ${message}`)}`);
  };

  return (
    <div className="panel-body">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--neon-cyan)', marginBottom: 20, opacity: .7 }}>
        &gt; Initiating secure transmission...
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="panel-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="panel-input" type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="panel-input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
        <textarea className="panel-input" placeholder="Message..." rows={5}
          style={{ resize: 'none' }} value={message} onChange={e => setMessage(e.target.value)} required />
        <button type="submit" className="panel-btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
          ▶ Transmit Message
        </button>
      </form>
    </div>
  );
}

// ── Main HUD ───────────────────────────────────────────────────────────────────
export default function HUD({ nearStation, dockedStation, onUndock, resumeData, mode = 'space', stations = STATIONS }) {
  const PANEL_MAP = {
    about:     <AboutPanel     data={resumeData?.main}      />,
    resume:    <ResumePanel    data={resumeData?.resume}    />,
    portfolio: <PortfolioPanel data={resumeData?.portfolio} />,
    contact:   <ContactPanel   data={resumeData?.main}      />,
  };

  const stationColor = dockedStation
    ? stations.find(s => s.id === dockedStation.id)?.color || '#00d4ff'
    : '#00d4ff';

  const isMatrix = mode === 'matrix';

  return (
    <div className={isMatrix ? 'matrix-hud' : ''}>
      {/* ── Controls legend ── */}
      {!dockedStation && (
        <div className="hud-controls">
          {isMatrix ? (
            <>
              <div className="hud-ctrl-section">MOVE</div>
              <div className="hud-ctrl-row"><kbd>W A S D</kbd><span>Move</span></div>
              <div className="hud-ctrl-row"><kbd>Mouse</kbd><span>Look / Aim</span></div>
              <div className="hud-ctrl-row"><kbd>Shift</kbd><span>Sprint</span></div>
              <div className="hud-ctrl-row"><kbd>Space</kbd><span>Jump / Wall Jump</span></div>
              <div className="hud-ctrl-section" style={{ marginTop: 8 }}>COMBAT</div>
              <div className="hud-ctrl-row"><kbd>J</kbd><span>Punch / Combo</span></div>
              <div className="hud-ctrl-row"><kbd>K</kbd><span>Roundhouse Kick</span></div>
              <div className="hud-ctrl-row"><kbd>Q</kbd><span>Dodge Left</span></div>
              <div className="hud-ctrl-row"><kbd>R</kbd><span>Dodge Right</span></div>
              <div className="hud-ctrl-row"><kbd>Ctrl / C</kbd><span>Duck (avoid bullets)</span></div>
              <div className="hud-ctrl-row"><kbd>Z / F</kbd><span>Bullet Time</span></div>
              <div className="hud-ctrl-section" style={{ marginTop: 8 }}>WORLD</div>
              <div className="hud-ctrl-row"><kbd>E</kbd><span>Enter / Access</span></div>
              <div className="hud-ctrl-row"><kbd>Esc / E</kbd><span>Close Panel</span></div>
            </>
          ) : (
            <>
              <div className="hud-ctrl-row"><kbd>W A S D</kbd><span>Fly</span></div>
              <div className="hud-ctrl-row"><kbd>Mouse</kbd><span>Steer</span></div>
              <div className="hud-ctrl-row"><kbd>Shift</kbd><span>Boost</span></div>
              <div className="hud-ctrl-row"><kbd>Q / E</kbd><span>Roll</span></div>
              <div className="hud-ctrl-row"><kbd>E</kbd><span>Dock</span></div>
            </>
          )}
        </div>
      )}

      {/* ── Map (star map / system map) ── */}
      {!dockedStation && (
        <div className="hud-starmap">
          <div className="hud-starmap-title">{isMatrix ? 'SYSTEM MAP' : 'STAR MAP'}</div>
          {stations.map(s => (
            <div key={s.id} className={`hud-starmap-node${nearStation?.id === s.id ? ' active' : ''}`}
              style={{ '--c': s.color }}>
              <div className="hud-starmap-dot" />
              <span>{s.sublabel || s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Near-station prompt ── */}
      {nearStation && !dockedStation && (
        <div className="hud-dock-prompt" style={{ '--c': nearStation.color ?? '#00d4ff' }}>
          <div className="hud-dock-name">{nearStation.label}</div>
          <div className="hud-dock-sub">{nearStation.sublabel}</div>
          <div className="hud-dock-cta">Press <kbd>E</kbd> to dock</div>
        </div>
      )}

      {/* ── Docked panel ── */}
      {dockedStation && (
        <div className="hud-overlay" onClick={e => { if (e.target === e.currentTarget) onUndock(); }}>
          <div className="hud-panel" style={{ '--c': stationColor }}>
            <div className="hud-panel-header">
              <div>
                <div className="hud-panel-label">{dockedStation.sublabel}</div>
                <h2 className="hud-panel-title">{dockedStation.label}</h2>
              </div>
              <button className="hud-close-btn" onClick={onUndock} aria-label="Undock">
                ✕
              </button>
            </div>
            <div className="hud-panel-content">
              {PANEL_MAP[dockedStation.id]}
            </div>
          </div>
        </div>
      )}

      {/* ── Crosshair ── */}
      {!dockedStation && (
        <div className="hud-crosshair">
          <div className="hud-ch-h" />
          <div className="hud-ch-v" />
          <div className="hud-ch-dot" />
        </div>
      )}
    </div>
  );
}
