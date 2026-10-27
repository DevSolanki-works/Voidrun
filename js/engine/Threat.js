/**
 * Threat.js
 * Multi-directional dynamic hazards: meteors, space debris, and rogue asteroids.
 */

import { Vector } from './Vector.js';

export class Threat {
  constructor(id, x, y, vx, vy, type = 'medium', prng = null) {
    this.id = id;
    this.pos = new Vector(x, y);
    this.vel = new Vector(vx, vy);
    this.type = type;

    // Type characteristics
    switch (type) {
      case 'small':
        this.radius = prng ? prng.range(8, 12) : 10;
        this.baseColor = '#e4e4e7'; // Platinum / Silver
        this.glowColor = 'rgba(255, 255, 255, 0.3)';
        this.mass = 0.5;
        this.points = 15;
        break;
      case 'large':
        this.radius = prng ? prng.range(28, 38) : 32;
        this.baseColor = '#ef4444'; // Respected Crimson
        this.glowColor = 'rgba(239, 68, 68, 0.35)';
        this.mass = 3.0;
        this.points = 40;
        break;
      case 'seeker':
        this.radius = prng ? prng.range(13, 17) : 15;
        this.baseColor = '#a1a1aa'; // Titanium Slate
        this.glowColor = 'rgba(161, 161, 170, 0.4)';
        this.mass = 1.0;
        this.points = 25;
        this.isSeeker = true;
        break;
      case 'medium':
      default:
        this.radius = prng ? prng.range(16, 22) : 18;
        this.baseColor = '#f59e0b'; // Respected Amber
        this.glowColor = 'rgba(245, 158, 11, 0.35)';
        this.mass = 1.2;
        this.points = 20;
        break;
    }

    this.angle = prng ? prng.range(0, Math.PI * 2) : 0;
    this.rotSpeed = prng ? prng.range(-0.04, 0.04) : 0.02;

    // Generate craggy procedural polygon vertices
    const vertexCount = 8;
    this.vertices = [];
    for (let i = 0; i < vertexCount; i++) {
      const a = (i / vertexCount) * Math.PI * 2;
      const rJitter = prng ? prng.range(0.8, 1.2) : 1.0;
      this.vertices.push({
        x: Math.cos(a) * this.radius * rJitter,
        y: Math.sin(a) * this.radius * rJitter
      });
    }

    this.alive = true;
    this.nearMissAwarded = false; // Prevents scoring near-miss multiple times
  }

  update(dt = 1, targetPos = null) {
    if (!this.alive) return;

    // Slight homing / curve for 'seeker' threat type to force active evasion
    if (this.isSeeker && targetPos) {
      const toTarget = Vector.sub(targetPos, this.pos).normalize();
      // Gentle steering force (max 0.03 magnitude)
      this.vel.x += toTarget.x * 0.03 * dt;
      this.vel.y += toTarget.y * 0.03 * dt;
      this.vel.clampMag(4.5);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.angle += this.rotSpeed * dt;
  }

  /**
   * Checks if threat has traveled far beyond arena bounds and can be culled
   */
  isOutOfBounds(arenaWidth, arenaHeight, margin = 100) {
    return (
      this.pos.x < -margin ||
      this.pos.x > arenaWidth + margin ||
      this.pos.y < -margin ||
      this.pos.y > arenaHeight + margin
    );
  }
}
