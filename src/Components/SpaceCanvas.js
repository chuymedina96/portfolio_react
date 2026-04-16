import React, { useEffect, useRef } from 'react';

const SpaceCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let scrollY = 0;
    let time = 0;

    // ── Star layers ────────────────────────────────────────────
    const LAYERS = [
      { count: 160, parallax: 0.08, minSize: 0.3, maxSize: 1.2, minAlpha: 0.25, maxAlpha: 0.7 },
      { count:  80, parallax: 0.22, minSize: 1.0, maxSize: 2.2, minAlpha: 0.45, maxAlpha: 0.9 },
      { count:  30, parallax: 0.45, minSize: 1.8, maxSize: 3.5, minAlpha: 0.65, maxAlpha: 1.0 },
    ];
    const stars = [];

    const initStars = () => {
      stars.length = 0;
      LAYERS.forEach((layer, li) => {
        for (let i = 0; i < layer.count; i++) {
          stars.push({
            x:        Math.random() * canvas.width,
            baseY:    Math.random() * canvas.height * 4,
            size:     layer.minSize + Math.random() * (layer.maxSize - layer.minSize),
            alpha:    layer.minAlpha + Math.random() * (layer.maxAlpha - layer.minAlpha),
            phase:    Math.random() * Math.PI * 2,
            parallax: layer.parallax,
            layer:    li,
          });
        }
      });
    };

    // ── Shooting stars ─────────────────────────────────────────
    const shooters = [];
    let nextShooter = 0;

    const spawnShooter = () => {
      shooters.push({
        x:     Math.random() * canvas.width * 1.4 - canvas.width * 0.2,
        y:     -20,
        vx:    (Math.random() - 0.4) * 3,
        vy:    4 + Math.random() * 5,
        trail: 80 + Math.random() * 80,
        life:  1,
      });
    };

    // ── Nebula blobs ────────────────────────────────────────────
    const nebulas = [
      { cx: 0.15, cy: 0.20, r: 0.28, color: '0,212,255',   alpha: 0.06 },
      { cx: 0.75, cy: 0.55, r: 0.32, color: '155,95,255',  alpha: 0.055 },
      { cx: 0.45, cy: 0.80, r: 0.25, color: '0,100,200',   alpha: 0.05 },
      { cx: 0.88, cy: 0.12, r: 0.22, color: '255,107,53',  alpha: 0.03 },
    ];

    // ── Resize ─────────────────────────────────────────────────
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const onScroll = () => { scrollY = window.scrollY; };

    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    resize();

    // ── Draw ───────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Deep space base
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.9);
      bg.addColorStop(0,   '#0a0a22');
      bg.addColorStop(0.5, '#060614');
      bg.addColorStop(1,   '#020209');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula blobs
      nebulas.forEach(n => {
        const grd = ctx.createRadialGradient(
          W * n.cx, H * n.cy, 0,
          W * n.cx, H * n.cy, W * n.r,
        );
        const drift = Math.sin(time * 0.1 + n.cx * 5) * 0.01;
        grd.addColorStop(0,   `rgba(${n.color},${n.alpha + drift})`);
        grd.addColorStop(0.5, `rgba(${n.color},${(n.alpha + drift) * 0.4})`);
        grd.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      });

      // Stars
      stars.forEach(s => {
        const rawY = (s.baseY - scrollY * s.parallax) % (H * 4);
        const y    = ((rawY % H) + H) % H;
        const twinkle = s.alpha * (0.75 + 0.25 * Math.sin(time * 1.8 + s.phase));

        ctx.beginPath();
        ctx.arc(s.x, y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${twinkle})`;
        ctx.fill();

        // Bigger stars get a soft glow
        if (s.size > 2) {
          const glow = ctx.createRadialGradient(s.x, y, 0, s.x, y, s.size * 4);
          glow.addColorStop(0,   `rgba(180,220,255,${twinkle * 0.5})`);
          glow.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x, y, s.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Shooting stars
      time += 0.016;
      if (time > nextShooter) {
        spawnShooter();
        nextShooter = time + 2.5 + Math.random() * 4;
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x    += s.vx;
        s.y    += s.vy;
        s.life -= 0.018;
        if (s.life <= 0 || s.y > H + 40) { shooters.splice(i, 1); continue; }

        const grad = ctx.createLinearGradient(
          s.x, s.y,
          s.x - s.vx * (s.trail / s.vy),
          s.y - s.trail,
        );
        grad.addColorStop(0,   `rgba(255,255,255,${s.life})`);
        grad.addColorStop(0.4, `rgba(140,210,255,${s.life * 0.5})`);
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.trail / s.vy), s.y - s.trail);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        zIndex:        -1,
        pointerEvents: 'none',
      }}
    />
  );
};

export default SpaceCanvas;
