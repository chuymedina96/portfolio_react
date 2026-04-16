import React, { useState, useEffect } from 'react';
import MatrixRain from './MatrixRain';

const MESSAGES = [
  { text: 'Wake up, Neo\u2026',                     color: '#00ff41', pause: 1500 },
  { text: 'The Matrix has you\u2026',                color: '#00cc33', pause: 1500 },
  { text: 'Follow the white rabbit.',               color: '#aaffaa', pause: 1800 },
  { text: 'Knock, knock, Neo.',                     color: '#00ff41', pause: 2400 },
  { text: '',                                        color: '',        pause: 0    },
  { text: '> LOCATING OPERATOR\u2026',               color: '#00ff41', pause: 700  },
  { text: '> SIMULATION INITIALIZING\u2026',         color: '#66ff66', pause: 600  },
  { text: '> LOADING PORTFOLIO MATRIX v2.0\u2026',  color: '#aaffaa', pause: 900  },
];
const CHAR_MS = 68;

export default function WakeUpSequence({ onDone }) {
  const [lines,   setLines]   = useState([]);
  const [current, setCurrent] = useState('');
  const [msgIdx,  setMsgIdx]  = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [finished, setFinished] = useState(false);

  // Skip on any keydown / click
  useEffect(() => {
    const skip = () => { if (!finished) { setFinished(true); onDone(); } };
    window.addEventListener('keydown', skip);
    window.addEventListener('click',   skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click',   skip);
    };
  }, [finished, onDone]);

  // Typewriter state machine
  useEffect(() => {
    if (finished) return;
    const msg = MESSAGES[msgIdx];
    if (!msg) { setFinished(true); setTimeout(onDone, 400); return; }

    if (!msg.text) {
      const t = setTimeout(() => setMsgIdx(i => i + 1), 400);
      return () => clearTimeout(t);
    }

    if (charIdx < msg.text.length) {
      const t = setTimeout(() => {
        setCurrent(msg.text.slice(0, charIdx + 1));
        setCharIdx(i => i + 1);
      }, CHAR_MS);
      return () => clearTimeout(t);
    }

    // Line complete — commit and advance
    const t = setTimeout(() => {
      setLines(prev => [...prev, { text: msg.text, color: msg.color }]);
      setCurrent('');
      setCharIdx(0);
      setMsgIdx(i => i + 1);
    }, msg.pause);
    return () => clearTimeout(t);
  }, [msgIdx, charIdx, finished]);

  const activeColor = MESSAGES[msgIdx]?.color || '#00ff41';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'center',
      padding: '0 12vw', zIndex: 1000,
    }}>
      <MatrixRain opacity={0.18} />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 'clamp(1rem, 2.4vw, 1.45rem)',
            color: line.color,
            textShadow: `0 0 16px ${line.color}`,
            marginBottom: 14,
            letterSpacing: '0.04em',
            opacity: 0.72,
          }}>
            {line.text}
          </div>
        ))}

        {current && (
          <div style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 'clamp(1rem, 2.4vw, 1.45rem)',
            color: activeColor,
            textShadow: `0 0 22px ${activeColor}`,
            marginBottom: 14,
            letterSpacing: '0.04em',
          }}>
            {current}
            <span style={{ animation: 'wuBlink 0.65s step-end infinite' }}>_</span>
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 26, right: 26, zIndex: 10,
        fontFamily: 'monospace', fontSize: '0.72rem',
        color: 'rgba(0,255,65,0.38)', letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        PRESS ANY KEY TO SKIP
      </div>

      <style>{`
        @keyframes wuBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
