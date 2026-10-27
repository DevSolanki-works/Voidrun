/**
 * Rocket.js
 * Player-controlled or AI-guided spacecraft.
 * Features realistic 2D arcade inertia, thruster physics, and collision metrics.
 */

import { Vector } from './Vector.js';

export class Rocket {
  constructor(x, y, maxShields = 3) {
    this.initialPos = new Vector(x, y);
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.acc = new Vector(0, 0);

    this.radius = 12; // Hitbox radius
    this.maxSpeed = 3.2;
    this.thrustPower = 0.25;
    this.friction = 0.92; // Velocity damping per tick
    this.controlMode = 'ai'; // 'human' or 'ai'

    this.heading = -Math.PI / 2; // Default facing UP
    this.targetHeading = -Math.PI / 2;

    this.maxShields = maxShields;
    this.shields = maxShields;
    this.invulnerableTimer = 0; // Invulnerability frames after hit
    this.alive = true;

    // Movement intention [-1, 1] for x and y
    this.throttle = new Vector(0, 0);
    this.prevThrottle = new Vector(0, 0);

    // Behavioral metrics tracked for GA Fitness evaluation
    this.metrics = {
      ticksAlive: 0,
      nearMisses: 0,
      wallCollisions: 0,
      wallHugTicks: 0,
      jitterScore: 0,
      distanceTraveled: 0
    };
  }

  reset(x = this.initialPos.x, y = this.initialPos.y, maxShields = this.maxShields, gen = null) {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.acc.set(0, 0);
    this.heading = -Math.PI / 2;
    this.targetHeading = -Math.PI / 2;
    this.maxShields = maxShields;
    this.shields = maxShields;
    this.invulnerableTimer = 0;
    this.alive = true;
    this.throttle.set(0, 0);
    this.prevThrottle.set(0, 0);
    this.setControlMode(this.controlMode, gen);

    this.metrics = {
      ticksAlive: 0,
      nearMisses: 0,
      wallCollisions: 0,
      wallHugTicks: 0,
      jitterScore: 0,
      distanceTraveled: 0
    };
  }

  /**
   * Sets control mode: 'human' provides high-acceleration, agile arcade physics,
   * while 'ai' preserves the exact dynamics used for neural network training.
   */
  /**
   * Sets control mode: 'human' provides high-acceleration, agile arcade physics,
   * while 'ai' provides calibrated progressive physics based on generation.
   */
  setControlMode(mode = 'human', gen = null) {
    this.controlMode = mode;
    if (mode === 'human') {
      this.thrustPower = 0.58;
      this.maxSpeed = 5.2;
      this.friction = 0.93;
    } else {
      const digits = String(gen || '').replace(/[^\d]/g, '');
      const g = digits.length > 0 ? parseInt(digits, 10) : 1000;
      if (g >= 10000) {
        // Singularity Master (Gen 10,000): peak precision micro-agility to out-maneuver late-wave fast seekers
        this.thrustPower = 0.35;
        this.maxSpeed = 4.0;
        this.friction = 0.92;
      } else if (g >= 1000) {
        // Apex Master (Gen 1000): agile evasion
        this.thrustPower = 0.29;
        this.maxSpeed = 3.6;
        this.friction = 0.92;
      } else if (g >= 500) {
        // Advanced Pilot (Gen 500)
        this.thrustPower = 0.26;
        this.maxSpeed = 3.3;
        this.friction = 0.92;
      } else {
        // Novice (Gen 100 / Untrained)
        this.thrustPower = 0.24;
        this.maxSpeed = 3.0;
        this.friction = 0.92;
      }
    }
  }

  /**
   * Applies an instantaneous velocity impulse (e.g. from a punchy keypress or D-pad tap)
   */
  applyImpulse(ix, iy) {
    if (!this.alive) return;
    this.vel.x += ix;
    this.vel.y += iy;
    this.vel.clampMag(this.maxSpeed);
    if (this.vel.magSq() > 0.1) {
      this.targetHeading = this.vel.heading();
    }
  }

  /**
   * Applies continuous or discrete directional thrust
   * @param {number} x - Thrust along X axis [-1.0, 1.0]
   * @param {number} y - Thrust along Y axis [-1.0, 1.0]
   */
  setThrottle(x, y) {
    // Track jitter (sudden sharp reversals in control input)
    const djX = Math.abs(x - this.prevThrottle.x);
    const djY = Math.abs(y - this.prevThrottle.y);
    if (djX > 1.2 || djY > 1.2) {
      this.metrics.jitterScore += 1;
    }
    this.prevThrottle.set(this.throttle.x, this.throttle.y);

    this.throttle.x = Math.max(-1, Math.min(1, x));
    this.throttle.y = Math.max(-1, Math.min(1, y));
  }

  update(arena) {
    if (!this.alive) return;

    this.metrics.ticksAlive++;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer--;
    }

    // Apply thrust force from throttle
    if (this.throttle.magSq() > 0.001) {
      this.acc.x = this.throttle.x * this.thrustPower;
      this.acc.y = this.throttle.y * this.thrustPower;
    } else {
      this.acc.set(0, 0);
    }

    this.vel.add(this.acc);
    this.vel.clampMag(this.maxSpeed);
    this.vel.mult(this.friction);

    const prevX = this.pos.x;
    const prevY = this.pos.y;

    this.pos.add(this.vel);

    const stepDist = Math.hypot(this.pos.x - prevX, this.pos.y - prevY);
    this.metrics.distanceTraveled += stepDist;

    // Arena boundary enforcement
    const hitWall = arena.constrainEntity(this.pos, this.radius, this.vel);
    if (hitWall) {
      this.metrics.wallCollisions++;
    }

    // Wall-hug detection (within 40px of edge)
    const wallDists = arena.getWallDistances(this.pos);
    const minWallDist = Math.min(
      wallDists.left,
      wallDists.right,
      wallDists.top,
      wallDists.bottom
    );
    if (minWallDist < 45) {
      this.metrics.wallHugTicks++;
    }

    // Smooth heading rotation towards movement or throttle
    if (this.vel.magSq() > 0.1) {
      this.targetHeading = this.vel.heading();
    } else if (this.throttle.magSq() > 0.1) {
      this.targetHeading = this.throttle.heading();
    }

    // Angular lerp
    let diff = this.targetHeading - this.heading;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.heading += diff * 0.2;
  }

  takeDamage() {
    if (this.invulnerableTimer > 0 || !this.alive) return false;

    this.shields--;
    this.invulnerableTimer = 60; // 1 second invulnerability flash

    if (this.shields <= 0) {
      this.alive = false;
      this.shields = 0;
    }
    return true;
  }
}
