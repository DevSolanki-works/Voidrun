/**
 * GameSimulation.js
 * Headless, deterministic 2D game simulation.
 * Can be run at 60 FPS with visual rendering or at ultra-high speed (headless)
 * for fast batch genetic algorithm evaluations.
 */

import { Arena } from './Arena.js';
import { Rocket } from './Rocket.js';
import { Spawner } from './Spawner.js';
import { AdaptiveDirector } from './AdaptiveDirector.js';
import { ParticleSystem } from './ParticleSystem.js';
import { PRNG } from '../utils/PRNG.js';

export class GameSimulation {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.seed = options.seed || 1337;
    this.maxShields = options.maxShields !== undefined ? options.maxShields : 3;
    this.difficulty = options.difficulty || 'standard';
    this.adaptiveMode = options.adaptiveMode || 'gentle';
    this.headless = options.headless === true;
    this.controlMode = options.controlMode || 'ai';
    this.gen = options.gen || null;

    this.prng = new PRNG(this.seed);
    this.arena = new Arena(this.width, this.height);
    this.rocket = new Rocket(this.arena.centerX, this.arena.centerY, this.maxShields);
    this.rocket.setControlMode(this.controlMode, this.gen);
    this.spawner = new Spawner(this.arena, this.prng);
    this.spawner.setDifficulty(this.difficulty);
    this.director = new AdaptiveDirector(this.arena, this.prng);
    this.director.setMode(this.adaptiveMode);
    this.particles = new ParticleSystem(400);

    this.threats = [];
    this.score = 0;
    this.ticks = 0;
    this.gameOver = false;
    this.gameOverReason = '';
    this.lastCollidedThreat = null;
    this.isUntrainedDemo = options.isUntrainedDemo || false;
    this.cornerCampTicks = 0;

    // Callbacks for audio / visual event hooks
    this.onCollision = null;
    this.onNearMiss = null;
    this.onWaveAdvance = null;
    this.previousWave = 1;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    if (this.spawner) this.spawner.setDifficulty(diff);
  }

  setAdaptiveMode(mode) {
    this.adaptiveMode = mode;
    if (this.director) this.director.setMode(mode);
  }

  reset(seed = this.seed, maxShields = this.maxShields, isUntrainedDemo = this.isUntrainedDemo, controlMode = this.controlMode, gen = this.gen) {
    this.seed = seed;
    this.maxShields = maxShields;
    this.isUntrainedDemo = isUntrainedDemo;
    this.controlMode = controlMode;
    this.gen = gen;
    this.cornerCampTicks = 0;
    this.prng.reset(this.seed);

    this.rocket.reset(this.arena.centerX, this.arena.centerY, this.maxShields, this.gen);
    this.rocket.setControlMode(this.controlMode, this.gen);
    this.spawner.reset(this.isUntrainedDemo);
    this.spawner.setDifficulty(this.difficulty);
    this.director.reset();
    this.director.setMode(this.adaptiveMode);
    this.particles.clear();
    this.threats = [];

    this.score = 0;
    this.ticks = 0;
    this.gameOver = false;
    this.gameOverReason = '';
    this.lastCollidedThreat = null;
    this.previousWave = 1;
  }

  /**
   * Advances the simulation by exactly one deterministic tick.
   * @param {Object|null} controller - Optional AgentController providing throttle
   */
  step(controller = null) {
    if (this.gameOver) return this.getStatus();

    this.ticks++;

    // Let controller decide throttle if provided
    if (controller && typeof controller.act === 'function') {
      const throttle = controller.act(this);
      this.rocket.setThrottle(throttle.x, throttle.y);
    }

    // Emit thruster particles when rocket is accelerating
    if (!this.headless && this.rocket.throttle.magSq() > 0.05) {
      this.particles.emitThruster(
        this.rocket.pos,
        this.rocket.heading,
        this.rocket.throttle.mag()
      );
    }

    // 1. Update Rocket
    this.rocket.update(this.arena);

    // 2. Spawn and update threats
    const newThreat = this.spawner.update(this.threats, this.rocket.pos);
    if (newThreat) {
      this.threats.push(newThreat);
    }

    // 2b. Adaptive Director check (rule-based dynamic habit counter-measures)
    if (this.director && !this.headless) {
      const directorThreats = this.director.update(this.rocket, this.threats.length);
      if (directorThreats && directorThreats.length > 0) {
        this.threats.push(...directorThreats);
      }
    }

    // 2c. Corner camping detection (prevents lucky corner survival and quickly eliminates untrained agents)
    const rx = this.rocket.pos.x;
    const ry = this.rocket.pos.y;
    const nearLeft = rx - this.arena.minX < 80;
    const nearRight = this.arena.maxX - rx < 80;
    const nearTop = ry - this.arena.minY < 80;
    const nearBottom = this.arena.maxY - ry < 80;
    const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom);

    if (inCorner) {
      this.cornerCampTicks = (this.cornerCampTicks || 0) + 1;
      const flushThreshold = this.isUntrainedDemo ? 15 : 90;
      if (this.cornerCampTicks >= flushThreshold && this.threats.length < (this.isUntrainedDemo ? 6 : 14)) {
        this.cornerCampTicks = 0;
        const flushThreat = this.spawner.spawnCornerFlushThreat(this.rocket.pos);
        if (flushThreat) {
          this.threats.push(flushThreat);
        }
      }
    } else {
      if (this.cornerCampTicks > 0) this.cornerCampTicks--;
    }

    // Check wave progression event
    if (this.spawner.wave > this.previousWave) {
      this.score += 500; // Wave bonus
      this.previousWave = this.spawner.wave;
      if (this.onWaveAdvance) this.onWaveAdvance(this.spawner.wave);
    }

    // 3. Update threats and handle collisions
    let eventCollision = false;
    let eventNearMiss = false;

    for (let i = this.threats.length - 1; i >= 0; i--) {
      const threat = this.threats[i];
      threat.update(1, this.rocket.pos);

      // Despawn out of bounds threats
      if (threat.isOutOfBounds(this.arena.width, this.arena.height)) {
        this.threats.splice(i, 1);
        continue;
      }

      // Check collision with rocket
      const dx = threat.pos.x - this.rocket.pos.x;
      const dy = threat.pos.y - this.rocket.pos.y;
      const distSq = dx * dx + dy * dy;
      const combinedRadius = this.rocket.radius + threat.radius;

      if (distSq <= combinedRadius * combinedRadius) {
        // Impact!
        const tookDamage = this.rocket.takeDamage();
        if (tookDamage) {
          eventCollision = true;
          this.lastCollidedThreat = threat.type;
          this.particles.emitExplosion(
            this.rocket.pos.x,
            this.rocket.pos.y,
            30,
            threat.baseColor
          );
          if (this.onCollision) this.onCollision(threat);

          if (!this.rocket.alive) {
            this.gameOver = true;
            this.gameOverReason = `Destroyed by ${threat.type.toUpperCase()} hazard`;
            break;
          }
        }
      } else if (!threat.nearMissAwarded) {
        // Check near miss threshold (within ~40px danger radius)
        const nearMissDist = combinedRadius + 36;
        if (distSq <= nearMissDist * nearMissDist) {
          threat.nearMissAwarded = true;
          this.rocket.metrics.nearMisses++;
          this.score += 150; // Tactical evasion reward
          eventNearMiss = true;
          this.particles.emitNearMiss(threat.pos.x, threat.pos.y);
          if (this.onNearMiss) this.onNearMiss();
        }
      }
    }

    // 4. Update particles
    if (!this.headless) this.particles.update();

    // 5. Score accrual
    this.score += 1;

    return {
      gameOver: this.gameOver,
      score: this.score,
      wave: this.spawner.wave,
      ticks: this.ticks,
      collision: eventCollision,
      nearMiss: eventNearMiss
    };
  }

  getStatus() {
    return {
      gameOver: this.gameOver,
      gameOverReason: this.gameOverReason,
      score: this.score,
      wave: this.spawner.wave,
      ticks: this.ticks,
      survivalTimeSec: (this.ticks / 60).toFixed(2),
      shields: this.rocket.shields,
      maxShields: this.rocket.maxShields,
      metrics: { ...this.rocket.metrics },
      directorWarning: this.director ? this.director.activeWarningMessage : '',
      directorVisuals: this.director ? this.director.telegraphVisuals : null,
      directorMode: this.director ? this.director.mode : 'off'
    };
  }
}
