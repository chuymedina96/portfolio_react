import { useEffect, useRef } from 'react';

const CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*<>/\\|{}[]';
const FS = 13; // font size

export default function MatrixRain({ opacity = 0.12 }) {
  const ref = useRef();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let id;
    let drops = [];

    const init = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.floor(canvas.width / FS);
      drops = Array.from({ length: cols }, () => -(Math.random() * 50));
    };
    init();
    window.addEventListener('resize', init);

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FS}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FS;
        if (y < 0) { drops[i] += 0.35; continue; }

        // Bright head
        ctx.fillStyle = '#ccffcc';
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FS, y);

        // Green body one step behind
        if (y - FS >= 0) {
          ctx.fillStyle = '#00ff41';
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FS, y - FS);
        }

        drops[i] += 0.48;
        if (drops[i] * FS > canvas.height && Math.random() > 0.975) {
          drops[i] = -(Math.random() * 18);
        }
      }
      id = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', init);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        opacity, pointerEvents: 'none', zIndex: 5,
      }}
    />
  );
}
