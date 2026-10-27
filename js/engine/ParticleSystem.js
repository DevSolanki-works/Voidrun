/**
 * ParticleSystem.js
 * Particle physics engine for engine plumes, explosion blasts, and near-miss shockwaves.
 */

export class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 2;
    this.maxLife = 30;
    this.life = 0;
    this.color = '#ffffff';
    this.active = false;
    this.shape = 'circle'; // 'circle' or 'ring'
  }

  init(x, y, vx, vy, size, maxLife, color, shape = 'circle') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.maxLife = maxLife;
    this.life = maxLife;
    this.color = color;
    this.shape = shape;
    this.active = true;
  }

  update() {
    if (!this.active) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life--;
    if (this.life <= 0) {
      this.active = false;
    }
  }
}

export class ParticleSystem {
  constructor(poolSize = 400) {
    this.pool = Array.from({ length: poolSize }, () => new Particle());
  }

  spawn(x, y, vx, vy, size, life, color, shape = 'circle') {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].init(x, y, vx, vy, size, life, color, shape);
        return;
      }
    }
  }

  /**
   * Spawns dynamic thruster plume particles opposite to rocket heading
   */
  emitThruster(pos, heading, intensity = 1.0) {
    const spread = (Math.random() - 0.5) * 0.5;
    const speed = 2.5 + Math.random() * 2.0;
    const angle = heading + Math.PI + spread;

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const colors = ['#ffffff', '#e4e4e7', '#f59e0b', '#d4d4d8'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 2 + Math.random() * 3 * intensity;
    const life = 12 + Math.floor(Math.random() * 10);

    // Emitter offset behind rocket
    const offsetDist = 12;
    const ox = pos.x - Math.cos(heading) * offsetDist;
    const oy = pos.y - Math.sin(heading) * offsetDist;

    this.spawn(ox, oy, vx, vy, size, life, color);
  }

  /**
   * Spawns an explosion burst
   */
  emitExplosion(x, y, count = 35, mainColor = '#ef4444') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 2 + Math.random() * 4;
      const life = 25 + Math.floor(Math.random() * 20);
      const colors = [mainColor, '#f59e0b', '#ffffff', '#71717a'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.spawn(x, y, vx, vy, size, life, color);
    }
    // Shockwave ring
    this.spawn(x, y, 0, 0, 8, 20, mainColor, 'ring');
  }

  /**
   * Near-miss evasion spark / ring
   */
  emitNearMiss(x, y) {
    this.spawn(x, y, 0, 0, 14, 18, '#ffffff', 'ring');
  }

  update() {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update();
      }
    }
  }

  render(ctx) {
    ctx.save();
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const progress = p.life / p.maxLife; // 1 to 0
      ctx.globalAlpha = Math.max(0, progress);

      if (p.shape === 'ring') {
        const radius = p.size + (1 - progress) * 25;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * progress;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
