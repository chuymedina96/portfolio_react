import React, { useState, useEffect, useRef } from 'react';
import { STATIONS } from './constants';
import { isMobileDevice } from './useMobile';

// ── Panel content ──────────────────────────────────────────────────────────────

// ── Zion Mainframe interactive terminal ───────────────────────────────────────
const TERM_COLORS = {
  sys:   '#00ff41',
  head:  '#00ffcc',
  out:   '#99ffaa',
  dim:   '#336644',
  input: '#ffffff',
  warn:  '#ffcc00',
  err:   '#ff4444',
};

const BOOT = [
  { t: 'sys', v: 'ZION MAINFRAME  v4.7.2 — SECURE SHELL' },
  { t: 'sys', v: 'AUTH LEVEL: OPERATOR  ●  SESSION OPEN' },
  { t: 'dim', v: '──────────────────────────────────────────' },
  { t: 'sys', v: 'Connection established.  Welcome, Neo.' },
  { t: 'dim', v: 'Type "help" to list available commands.' },
];

function ZionTerminalPanel({ resumeData, onUndock }) {
  const main      = resumeData?.main      ?? {};
  const resume    = resumeData?.resume    ?? {};
  const portfolio = resumeData?.portfolio ?? {};

  const isMobile = isMobileDevice();

  const [lines, setLines]       = useState(() => BOOT.map((l, i) => ({ ...l, id: i })));
  const [input, setInput]       = useState('');
  const [cmdHist, setCmdHist]   = useState([]);
  const [histIdx, setHistIdx]   = useState(-1);
  const [kbOpen, setKbOpen]     = useState(false);
  const inputRef  = useRef();
  const bottomRef = useRef();

  // Only auto-focus on desktop — on mobile the keyboard would immediately block the terminal
  useEffect(() => { if (!isMobile) inputRef.current?.focus(); }, [isMobile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const push = (newLines) =>
    setLines(prev => [...prev, ...newLines.map((l, i) => ({ ...l, id: Date.now() + i }))]);

  const process = (raw) => {
    const cmd   = raw.trim();
    if (!cmd) return;
    setCmdHist(h => [cmd, ...h]);
    setHistIdx(-1);

    const out = [{ t: 'input', v: `> ${cmd}` }];
    const lo  = cmd.toLowerCase();

    if (lo === 'help') {
      out.push(
        { t: 'head', v: 'AVAILABLE COMMANDS' },
        { t: 'out',  v: '  whoami            identity scan' },
        { t: 'out',  v: '  ls                list directory' },
        { t: 'out',  v: '  cat bio.txt        personal record' },
        { t: 'out',  v: '  cat skills.txt     neural analysis' },
        { t: 'out',  v: '  cat history.log    mission log' },
        { t: 'out',  v: '  cat projects.txt   known operations' },
        { t: 'out',  v: '  cat contact.txt    open comms' },
        { t: 'out',  v: '  hack               ???' },
        { t: 'out',  v: '  clear              purge output' },
        { t: 'out',  v: '  exit               disconnect' },
      );
    } else if (lo === 'whoami') {
      out.push(
        { t: 'head', v: 'IDENTITY SCAN' },
        { t: 'out',  v: `  OPERATOR   ${main.name      ?? '???'}` },
        { t: 'out',  v: `  TITLE      ${main.occupation ?? '???'}` },
        { t: 'out',  v: `  LOCATION   ${main.address?.city ?? '?'}, ${main.address?.state ?? '?'}` },
        { t: 'out',  v: `  STATUS     ● AVAILABLE FOR HIRE` },
        { t: 'out',  v: `  EMAIL      ${main.email ?? '???'}` },
      );
    } else if (lo === 'ls') {
      out.push(
        { t: 'head', v: 'DIRECTORY: /zion/operator/' },
        { t: 'out',  v: '  bio.txt' },
        { t: 'out',  v: '  skills.txt' },
        { t: 'out',  v: '  history.log' },
        { t: 'out',  v: '  projects.txt' },
        { t: 'out',  v: '  contact.txt' },
        { t: 'dim',  v: '  classified.enc    [ENCRYPTED — LEVEL 9 CLEARANCE]' },
      );
    } else if (lo === 'cat bio.txt') {
      out.push({ t: 'head', v: 'FILE: bio.txt' });
      const bio = main.bio || main.description || '';
      // Wrap at ~60 chars on word boundaries
      const words = bio.split(' ');
      let line = ' ';
      words.forEach(w => {
        if ((line + w).length > 62) { out.push({ t: 'out', v: line }); line = '  ' + w + ' '; }
        else { line += w + ' '; }
      });
      if (line.trim()) out.push({ t: 'out', v: line });
    } else if (lo === 'cat skills.txt') {
      out.push({ t: 'head', v: 'NEURAL PATHWAY ANALYSIS' });
      (resume.skills ?? []).forEach(s => {
        const pct  = parseInt(s.level) || 0;
        const fill = Math.round(pct / 5);
        const bar  = '█'.repeat(fill) + '░'.repeat(20 - fill);
        out.push({ t: 'out', v: `  ${s.name.padEnd(14)} [${bar}]  ${s.level}` });
      });
    } else if (lo === 'cat history.log') {
      out.push({ t: 'head', v: 'MISSION LOG' });
      (resume.work ?? []).forEach(w => {
        out.push(
          { t: 'out', v: `  ▸ ${w.company}  —  ${w.title}` },
          { t: 'dim', v: `    ${w.years}` },
          { t: 'dim', v: `    ${w.description.slice(0, 110)}…` },
        );
      });
    } else if (lo === 'cat projects.txt') {
      out.push({ t: 'head', v: 'KNOWN OPERATIONS' });
      (portfolio.projects ?? []).forEach(p => {
        out.push(
          { t: 'out', v: `  ▸ ${p.title}` },
          { t: 'dim', v: `    ${p.url || 'URL: CLASSIFIED'}` },
        );
      });
    } else if (lo === 'cat contact.txt') {
      out.push(
        { t: 'head', v: 'OPEN COMMS CHANNEL' },
        { t: 'out',  v: `  EMAIL    ${main.email ?? '???'}` },
        { t: 'out',  v: `  PHONE    ${main.phone ?? '???'}` },
        ...(main.social ?? []).map(s => ({
          t: 'out', v: `  ${s.name.toUpperCase().padEnd(9)}  ${s.url}`,
        })),
      );
    } else if (lo === 'cat classified.enc') {
      out.push(
        { t: 'warn', v: '  ACCESS DENIED.' },
        { t: 'dim',  v: '  You are not The One.' },
      );
    } else if (['hack', 'sudo hack', 'hack --system', 'hack --matrix'].includes(lo)) {
      out.push(
        { t: 'warn', v: '  INITIATING BREACH SEQUENCE...' },
        { t: 'warn', v: '  [████████████████████████████████████]  100%' },
        { t: 'out',  v: '  ROOT ACCESS GRANTED.' },
        { t: 'out',  v: '  There is no spoon.' },
        { t: 'dim',  v: '  (nice try)' },
      );
    } else if (lo === 'clear') {
      setLines(BOOT.map((l, i) => ({ ...l, id: i })));
      setInput('');
      return;
    } else if (['exit', 'quit', 'disconnect', 'logout'].includes(lo)) {
      push([...out, { t: 'sys', v: '  Closing secure channel...' }].map((l, i) => ({ ...l, id: Date.now() + i })));
      setInput('');
      setTimeout(onUndock, 700);
      return;
    } else {
      out.push(
        { t: 'err', v: `  command not found: ${cmd}` },
        { t: 'dim', v: '  Type "help" for available commands.' },
      );
    }

    push(out);
    setInput('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      process(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = Math.min(histIdx + 1, cmdHist.length - 1);
      setHistIdx(i);
      setInput(cmdHist[i] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i);
      setInput(i === -1 ? '' : cmdHist[i] ?? '');
    }
  };

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden',
        fontFamily: '"Share Tech Mono", monospace', fontSize: '0.78rem',
        background: '#000', padding: '12px 14px', boxSizing: 'border-box',
        cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Scrollable output */}
      <div style={{
        flex: 1, overflowY: 'auto', paddingBottom: 6,
        WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
      }}>
        {lines.map(l => (
          <div key={l.id} style={{
            color: TERM_COLORS[l.t] ?? '#00ff41',
            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {l.v}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row — on mobile show a tap-to-type button until focused */}
      <div style={{
        borderTop: '1px solid #0a2a14', paddingTop: 8, flexShrink: 0,
      }}>
        {isMobile && !kbOpen ? (
          <button
            onClick={() => { setKbOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            style={{
              width: '100%', padding: '10px 0', background: 'rgba(0,255,65,0.08)',
              border: '1px solid #00ff41', borderRadius: 4, color: '#00ff41',
              fontFamily: 'inherit', fontSize: '0.78rem', cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            ▶ TAP TO TYPE
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#00ff41', whiteSpace: 'nowrap' }}>zion@mainframe:~$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => isMobile && setKbOpen(false)}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#fff', fontFamily: 'inherit', fontSize: 'inherit', caretColor: '#00ff41',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

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
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="panel-project-info">
              <div className="panel-project-title">{p.title}</div>
              <div className="panel-project-cat">{p.category}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="panel-btn" style={{ display: 'inline-flex' }}>
                    Launch →
                  </a>
                )}
                {p.github && (
                  <a href={p.github} target="_blank" rel="noopener noreferrer" className="panel-btn panel-btn--ghost" style={{ display: 'inline-flex' }}>
                    ⌥ GitHub
                  </a>
                )}
              </div>
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
// ── DockedPanel — handles "opens and instantly closes" on mobile ───────────────
function DockedPanel({ dockedStation, stationColor, onUndock, content }) {
  // Ignore any close-gesture that arrives within 350ms of opening (same touch that opened it)
  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = false;
    const t = setTimeout(() => { readyRef.current = true; }, 350);
    return () => clearTimeout(t);
  }, [dockedStation]);

  const handleOverlayClick = (e) => {
    if (!readyRef.current) return;
    if (e.target === e.currentTarget) onUndock();
  };

  return (
    <div className="hud-overlay" onClick={handleOverlayClick}>
      <div className="hud-panel" style={{ '--c': stationColor }}>
        <div className="hud-panel-header">
          <div>
            <div className="hud-panel-label">{dockedStation.sublabel}</div>
            <h2 className="hud-panel-title">{dockedStation.label}</h2>
          </div>
          <button className="hud-close-btn" onClick={onUndock} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="hud-panel-content">
          {content}
        </div>
        {/* Mobile close footer — large touch target, easy to reach */}
        <div className="hud-panel-close-footer">
          <button className="hud-panel-close-mobile" onClick={onUndock}>
            ✕ CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HUD({ nearStation, dockedStation, onUndock, resumeData, mode = 'space', stations = STATIONS }) {
  const PANEL_MAP = {
    about:      <AboutPanel          data={resumeData?.main}      />,
    resume:     <ResumePanel         data={resumeData?.resume}    />,
    portfolio:  <PortfolioPanel      data={resumeData?.portfolio} />,
    contact:    <ContactPanel        data={resumeData?.main}      />,
    'locked-3': <ZionTerminalPanel   resumeData={resumeData}      onUndock={onUndock} />,
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
              <div className="hud-ctrl-row"><kbd>Mouse</kbd><span>Look / Aim camera</span></div>
              <div className="hud-ctrl-row"><kbd>Shift</kbd><span>Sprint</span></div>
              <div className="hud-ctrl-row"><kbd>Space</kbd><span>Jump</span></div>
              <div className="hud-ctrl-row"><kbd>Ctrl / C</kbd><span>Crouch / duck</span></div>
              <div className="hud-ctrl-row"><kbd>Q / R</kbd><span>Dodge left / right</span></div>
              <div className="hud-ctrl-section" style={{ marginTop: 8 }}>COMBAT</div>
              <div className="hud-ctrl-row"><kbd>Click</kbd><span>Shoot</span></div>
              <div className="hud-ctrl-row"><kbd>G</kbd><span>Reload</span></div>
              <div className="hud-ctrl-row"><kbd>J</kbd><span>Punch / combo</span></div>
              <div className="hud-ctrl-row"><kbd>K</kbd><span>Roundhouse kick</span></div>
              <div className="hud-ctrl-row"><kbd>L</kbd><span>Spinning hook kick</span></div>
              <div className="hud-ctrl-row"><kbd>Z / F</kbd><span>Bullet Time</span></div>
              <div className="hud-ctrl-section" style={{ marginTop: 8 }}>WORLD</div>
              <div className="hud-ctrl-row"><kbd>E</kbd><span>Enter door / terminal</span></div>
              <div className="hud-ctrl-row"><kbd>Esc / E</kbd><span>Close panel</span></div>
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
        <DockedPanel
          dockedStation={dockedStation}
          stationColor={stationColor}
          onUndock={onUndock}
          content={PANEL_MAP[dockedStation.id]}
        />
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
