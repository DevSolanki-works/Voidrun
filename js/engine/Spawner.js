/**
 * Spawner.js
 * Multi-directional dynamic threat spawning engine.
 * Employs deterministic PRNG, progressive wave difficulty, and safe grace periods.
 */

import { Threat } from './Threat.js';

export class Spawner {
  constructor(arena, prng) {
    this.arena = arena;
    this.prng = prng;

    this.nextThreatId = 1;
    this.spawnTimer = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.ticksElapsed = 0;

    // Difficulty curve parameters
    this.difficulty = 'standard'; // 'relaxed', 'standard', 'intense'
    this.baseSpawnInterval = 55; // Ticks between spawns (at 60 FPS, ~0.9 sec)
    this.minSpawnInterval = 18;
    this.speedMultiplier = 1.0;
    this.maxConcurrentThreats = 8;

    this.gracePeriodTicks = 90; // 1.5s initial grace period
    this.isUntrainedDemo = false;
  }

  setDifficulty(diff) {
    if (['relaxed', 'standard', 'intense'].includes(diff)) {
      this.difficulty = diff;
    }
  }

  reset(isUntrainedDemo = false) {
    this.nextThreatId = 1;
    this.spawnTimer = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.ticksElapsed = 0;
    this.speedMultiplier = 1.0;
    this.isUntrainedDemo = isUntrainedDemo;
  }

  update(activeThreats, rocketPos) {
    this.ticksElapsed++;
    this.waveTimer++;

    // Difficulty scaling factors
    const speedFactor = this.difficulty === 'relaxed' ? 0.82 : this.difficulty === 'intense' ? 1.25 : 1.0;
    const intervalFactor = this.difficulty === 'relaxed' ? 1.25 : this.difficulty === 'intense' ? 0.8 : 1.0;
    const maxThreatFactor = this.difficulty === 'relaxed' ? 0.8 : this.difficulty === 'intense' ? 1.3 : 1.0;

    // Wave progression every ~900 ticks (15 seconds at 60 FPS)
    const waveLength = 900;
    if (this.waveTimer >= waveLength) {
      this.wave++;
      this.waveTimer = 0;
      this.speedMultiplier = Math.min(2.2, (1.0 + (this.wave - 1) * 0.15) * speedFactor);
      this.maxConcurrentThreats = Math.min(28, Math.floor((8 + (this.wave - 1) * 2) * maxThreatFactor));
    } else if (this.ticksElapsed === 1) {
      this.speedMultiplier = speedFactor;
      this.maxConcurrentThreats = Math.floor(8 * maxThreatFactor);
    }

    // In untrained demo, shorten grace period so AI engages immediately and dies quickly
    const effectiveGrace = this.isUntrainedDemo ? 15 : this.gracePeriodTicks;
    if (this.ticksElapsed < effectiveGrace) {
      return null;
    }

    // Dynamic spawn interval based on current wave & difficulty
    let currentInterval = Math.max(
      Math.floor(this.minSpawnInterval * intervalFactor),
      Math.floor((this.baseSpawnInterval - (this.wave - 1) * 3) * intervalFactor)
    );
    if (this.isUntrainedDemo) {
      currentInterval = Math.min(currentInterval, 24);
    }

    this.spawnTimer++;
    if (
      this.spawnTimer >= currentInterval &&
      activeThreats.length < this.maxConcurrentThreats
    ) {
      this.spawnTimer = 0;
      return this.spawnThreat(rocketPos);
    }

    return null;
  }

  /**
   * Spawns a single threat from one of four arena edges or diagonals,
   * targeted across the playing field.
   */
  spawnThreat(rocketPos) {
    const id = this.nextThreatId++;
    const edge = this.prng.choice(['top', 'bottom', 'left', 'right', 'corner']);

    let x, y, vx, vy;
    const margin = 40;
    const speedBase = this.isUntrainedDemo
      ? this.prng.range(3.6, 4.4)
      : this.prng.range(2.0, 3.6) * this.speedMultiplier;

    // Target a point across the arena, near center or biased toward rocket
    let targetX, targetY;
    if (this.isUntrainedDemo && rocketPos) {
      // In untrained demo, target the rocket directly so it cannot survive by luck
      targetX = rocketPos.x + this.prng.range(-15, 15);
      targetY = rocketPos.y + this.prng.range(-15, 15);
    } else {
      targetX = this.prng.choice([
        this.arena.centerX + this.prng.range(-150, 150),
        rocketPos ? rocketPos.x + this.prng.range(-100, 100) : this.arena.centerX
      ]);
      targetY = this.prng.choice([
        this.arena.centerY + this.prng.range(-150, 150),
        rocketPos ? rocketPos.y + this.prng.range(-100, 100) : this.arena.centerY
      ]);
    }

    switch (edge) {
      case 'top':
        x = this.prng.range(this.arena.minX, this.arena.maxX);
        y = -margin;
        break;
      case 'bottom':
        x = this.prng.range(this.arena.minX, this.arena.maxX);
        y = this.arena.height + margin;
        break;
      case 'left':
        x = -margin;
        y = this.prng.range(this.arena.minY, this.arena.maxY);
        break;
      case 'right':
        x = this.arena.width + margin;
        y = this.prng.range(this.arena.minY, this.arena.maxY);
        break;
      case 'corner':
      default:
        x = this.prng.choice([-margin, this.arena.width + margin]);
        y = this.prng.choice([-margin, this.arena.height + margin]);
        break;
    }

    // Velocity towards target point
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    vx = (dx / dist) * speedBase;
    vy = (dy / dist) * speedBase;

    // Add slight angular perturbation
    const jitter = this.prng.range(-0.25, 0.25);
    const cosJ = Math.cos(jitter);
    const sinJ = Math.sin(jitter);
    const jvx = vx * cosJ - vy * sinJ;
    const jvy = vx * sinJ + vy * cosJ;

    // Determine threat type based on wave
    let type = 'medium';
    const roll = this.prng.next();
    if (this.wave >= 2 && roll < 0.25) {
      type = 'small'; // Fast shrapnel
    } else if (this.wave >= 3 && roll < 0.45) {
      type = 'large'; // Heavy asteroid
    } else if (this.wave >= 4 && roll < 0.6) {
      type = 'seeker'; // Slight magnetic curvature
    }

    return new Threat(id, x, y, jvx, jvy, type, this.prng);
  }

  /**
   * Spawns a high-speed targeted threat along the wall corridor
   * directly sweeping through an arena corner so entities cannot camp there.
   */
  spawnCornerFlushThreat(rocketPos) {
    const id = this.nextThreatId++;
    const isLeft = rocketPos.x < this.arena.centerX;
    const isTop = rocketPos.y < this.arena.centerY;

    // Spawn along the wall directly aligned with the corner so the threat sweeps the perimeter
    let spawnX, spawnY;
    const margin = 35;

    // Choose either vertical or horizontal corridor sweep right into the corner
    const useVertical = this.prng.next() < 0.5;
    if (useVertical) {
      // Move vertically along rocket's X coordinate straight into the corner
      spawnX = rocketPos.x;
      spawnY = isTop ? this.arena.height + margin : -margin;
    } else {
      // Move horizontally along rocket's Y coordinate straight into the corner
      spawnX = isLeft ? this.arena.width + margin : -margin;
      spawnY = rocketPos.y;
    }

    const dx = rocketPos.x - spawnX;
    const dy = rocketPos.y - spawnY;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 4.8;

    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    return new Threat(id, spawnX, spawnY, vx, vy, 'medium', this.prng);
  }
}
