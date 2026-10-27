// One celebratory moment: a short particle burst when a block is done.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function burst(x, y) {
  if (reduced()) return;
  const c = document.getElementById('fx');
  const ctx = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue('--lane').trim(), css.getPropertyValue('--spirit').trim(), css.getPropertyValue('--ok').trim()];
  const parts = Array.from({ length: 46 }, () => {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, r: 2 + Math.random() * 3, c: colors[(Math.random() * 3) | 0], life: 1 };
  });
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.022;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    if (alive) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}
