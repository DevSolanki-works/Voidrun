/**
 * Baselines.js
 * Comparative baseline controllers for empirical academic evaluation:
 * 1. Random Policy: Uniform random throttle actions.
 * 2. Heuristic Rule-Based Policy: Classical Artificial Potential Field (repulsion from hazards and walls, center attraction).
 * 3. Evaluator: Benchmarks controllers across deterministic multi-seed trials.
 */

import { Vector } from '../engine/Vector.js';
import { GameSimulation } from '../engine/GameSimulation.js';

export class RandomController {
  constructor() {
    this.name = 'Random Baseline';
    this.throttle = new Vector(0, 0);
    this.changeCounter = 0;
  }

  act(sim) {
    this.changeCounter++;
    // Change throttle direction every ~8 ticks to avoid hyper-frequency noise
    if (this.changeCounter % 8 === 0) {
      this.throttle.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
    }
    return this.throttle;
  }
}

export class HeuristicRuleBasedController {
  constructor() {
    this.name = 'Rule-Based (Potential Fields)';
  }

  act(sim) {
    const rocket = sim.rocket;
    const arena = sim.arena;
    const threats = sim.threats;

    const force = new Vector(0, 0);

    // 1. Repulsion from hazards (inverse distance weighted)
    for (let i = 0; i < threats.length; i++) {
      const threat = threats[i];
      const dx = rocket.pos.x - threat.pos.x;
      const dy = rocket.pos.y - threat.pos.y;
      const dist = Math.hypot(dx, dy);

      // Danger zone cutoff (within 200px)
      if (dist < 200 && dist > 1) {
        const repelStrength = (200 - dist) / dist;
        force.x += (dx / dist) * repelStrength * 1.8;
        force.y += (dy / dist) * repelStrength * 1.8;
      }
    }

    // 2. Repulsion from walls (cushion within 70px)
    const wallMargin = 70;
    if (rocket.pos.x - arena.minX < wallMargin) {
      const dist = Math.max(1, rocket.pos.x - arena.minX);
      force.x += (wallMargin - dist) / wallMargin * 2.2;
    } else if (arena.maxX - rocket.pos.x < wallMargin) {
      const dist = Math.max(1, arena.maxX - rocket.pos.x);
      force.x -= (wallMargin - dist) / wallMargin * 2.2;
    }

    if (rocket.pos.y - arena.minY < wallMargin) {
      const dist = Math.max(1, rocket.pos.y - arena.minY);
      force.y += (wallMargin - dist) / wallMargin * 2.2;
    } else if (arena.maxY - rocket.pos.y < wallMargin) {
      const dist = Math.max(1, arena.maxY - rocket.pos.y);
      force.y -= (wallMargin - dist) / wallMargin * 2.2;
    }

    // 3. Gentle center attraction bias
    const toCenterX = arena.centerX - rocket.pos.x;
    const toCenterY = arena.centerY - rocket.pos.y;
    force.x += toCenterX * 0.003;
    force.y += toCenterY * 0.003;

    // Normalize and clamp to [-1, 1]
    force.clampMag(1.0);
    return force;
  }
}

export class BaselineEvaluator {
  /**
   * Evaluates controllers across multiple deterministic seeds until each run ends
   * @param {Array<{ name: string, controller: Object }>} policies
   * @param {Array<number>} seeds - List of evaluation seeds
   */
  static runBenchmark(policies, seeds = [5001, 5002, 5003, 5004, 5005]) {
    const results = [];

    for (const policy of policies) {
      const runs = [];

      for (const seed of seeds) {
        const sim = new GameSimulation({ seed, maxShields: 1, adaptiveMode: 'off', headless: true });
        let ticks = 0;

        while (!sim.gameOver) {
          sim.step(policy.controller);
          ticks++;
        }

        const metrics = sim.rocket.metrics;
        runs.push({
          seed,
          survivalTimeSec: ticks / 60,
          score: sim.score,
          nearMisses: metrics.nearMisses,
          wallCollisions: metrics.wallCollisions,
          wave: sim.spawner.wave
        });
      }

      // Aggregate averages
      const avgSurvival =
        runs.reduce((acc, r) => acc + r.survivalTimeSec, 0) / runs.length;
      const avgScore =
        runs.reduce((acc, r) => acc + r.score, 0) / runs.length;
      const avgNearMisses =
        runs.reduce((acc, r) => acc + r.nearMisses, 0) / runs.length;
      const avgWallCollisions =
        runs.reduce((acc, r) => acc + r.wallCollisions, 0) / runs.length;

      results.push({
        name: policy.name,
        trials: runs.length,
        avgSurvival: avgSurvival.toFixed(2),
        avgScore: Math.round(avgScore),
        avgNearMisses: avgNearMisses.toFixed(1),
        avgWallCollisions: avgWallCollisions.toFixed(1),
        runs
      });
    }

    return results;
  }
}
