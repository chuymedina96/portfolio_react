import React, { useState, useEffect, lazy, Suspense } from 'react';
import './space.css';
import './game.css';

const MatrixGame = lazy(() => import('./game/MatrixGame'));

export default function App() {
  const [resumeData, setResumeData] = useState(null);

  useEffect(() => {
    fetch('/resumeData.json')
      .then(r => r.json())
      .then(setResumeData)
      .catch(console.error);
  }, []);

  const loading = (
    <div style={{
      position: 'fixed', inset: 0, background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Share Tech Mono", monospace',
      color: '#00ff41',
    }}>
      <div style={{ fontSize: '0.9rem', letterSpacing: '.28em', marginBottom: 20, textTransform: 'uppercase', textShadow: '0 0 12px #00ff41' }}>
        Loading
      </div>
      <div style={{ width: 180, height: 2, background: 'rgba(0,255,65,.12)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%', background: '#00ff41',
          boxShadow: '0 0 10px #00ff41',
          animation: 'mxLoad 1.1s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes mxLoad {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(600%); }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!resumeData && loading}
      {resumeData && (
        <Suspense fallback={loading}>
          <MatrixGame resumeData={resumeData} />
        </Suspense>
      )}
    </div>
  );
}
