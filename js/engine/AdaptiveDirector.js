/**
 * AdaptiveDirector.js
 * Rule-based Dynamic Arena Director.
 * Analyzes measurable player movement habits (edge camping, circular looping,
 * stationary stagnation, and side bias) and deploys telegraphed flushing waves.
 *
 * NOTE: This is an explicit rule-based game design system, NOT a machine learning model.
 * It is completely decoupled from the Neuroevolution Genetic Algorithm.
 */

import { Threat } from './Threat.js';
import { Vector } from './Vector.js';

export class AdaptiveDirector {
  constructor(arena, prng) {
    this.arena = arena;
    this.prng = prng;

    // Setting: 'off' | 'gentle' | 'strong'
    this.mode = 'gentle';

    // Rolling history buffer (approx 4 seconds at 60 FPS)
    this.historyCapacity = 240;
    this.posHistory = [];
    this.headingHistory = [];

    // Cooldown and telegraph state
    this.cooldownTicks = 0;
    this.telegraphTimer = 0;
    this.telegraphDuration = 0;
    this.pendingPattern = null;
    this.activeWarningMessage = '';

    // Active warning visuals for the renderer
    this.telegraphVisuals = null;
  }

  setMode(mode) {
    if (['off', 'gentle', 'strong'].includes(mode)) {
      this.mode = mode;
    }
  }

  reset() {
    this.posHistory = [];
    this.headingHistory = [];
    this.cooldownTicks = 0;
    this.telegraphTimer = 0;
    this.telegraphDuration = 0;
    this.pendingPattern = null;
    this.activeWarningMessage = '';
    this.telegraphVisuals = null;
  }

  /**
   * Updates habit trackers and evaluates whether an adaptive counter-measure is needed.
   * @param {Rocket} rocket
   * @param {number} activeThreatCount
   * @returns {Array<Threat>|null} newly spawned counter-measure threats when telegraph concludes
   */
  update(rocket, activeThreatCount = 0) {
    if (this.mode === 'off' || !rocket.alive) {
      this.telegraphVisuals = null;
      this.activeWarningMessage = '';
      return null;
    }

    // Record telemetry
    this.posHistory.push({ x: rocket.pos.x, y: rocket.pos.y });
    this.headingHistory.push(rocket.heading);
    if (this.posHistory.length > this.historyCapacity) {
      this.posHistory.shift();
      this.headingHistory.shift();
    }

    // Handle existing telegraph countdown
    if (this.telegraphTimer > 0) {
      this.telegraphTimer--;
      if (this.telegraphTimer <= 0) {
        // Execute the telegraphed attack pattern!
        const spawnedThreats = this.executePattern(this.pendingPattern, rocket.pos);
        this.pendingPattern = null;
        this.telegraphVisuals = null;
        this.activeWarningMessage = '';
        // Set cooldown: 6s in gentle mode, 4s in strong mode
        this.cooldownTicks = this.mode === 'strong' ? 240 : 360;
        return spawnedThreats;
      }
      return null;
    }

    // Cooldown decay
    if (this.cooldownTicks > 0) {
      this.cooldownTicks--;
      return null;
    }

    // Don't overwhelm if there are already too many threats
    const maxActiveCap = this.mode === 'strong' ? 14 : 10;
    if (activeThreatCount >= maxActiveCap) {
      return null;
    }

    // Need at least 90 ticks (~1.5s) of history to detect habits
    const minSample = this.mode === 'strong' ? 90 : 140;
    if (this.posHistory.length < minSample) {
      return null;
    }

    // Analyze habits
    const habits = this.analyzeHabits(rocket);

    if (habits.detected) {
      this.triggerPattern(habits.pattern, habits.reason);
    }

    return null;
  }

  /**
   * Rule-based habit analyzer inspecting spatial distribution and kinematics
   */
  analyzeHabits(rocket) {
    const samples = this.posHistory.slice(-150);
    const count = samples.length;

    // 1. Edge Camping Check (distance < 70px from any boundary)
    const edgeMargin = 70;
    let edgeCount = 0;
    let edgeSide = null;
    let leftCount = 0, rightCount = 0, topCount = 0, bottomCount = 0;

    for (const p of samples) {
      const isLeft = p.x - this.arena.minX < edgeMargin;
      const isRight = this.arena.maxX - p.x < edgeMargin;
      const isTop = p.y - this.arena.minY < edgeMargin;
      const isBottom = this.arena.maxY - p.y < edgeMargin;

      if (isLeft) leftCount++;
      if (isRight) rightCount++;
      if (isTop) topCount++;
      if (isBottom) bottomCount++;

      if (isLeft || isRight || isTop || isBottom) {
        edgeCount++;
      }
    }

    // 1a. Corner Camping Check (within corner margin of two intersecting boundaries)
    let cornerHits = 0;
    for (const p of samples) {
      const isL = p.x - this.arena.minX < 75;
      const isR = this.arena.maxX - p.x < 75;
      const isT = p.y - this.arena.minY < 75;
      const isB = this.arena.maxY - p.y < 75;
      if ((isL || isR) && (isT || isB)) {
        cornerHits++;
      }
    }
    const cornerThreshold = this.mode === 'strong' ? 0.45 : 0.6;
    if (cornerHits / count > cornerThreshold) {
      const isL = leftCount >= rightCount;
      const isT = topCount >= bottomCount;
      const cornerName = `${isT ? 'NORTH' : 'SOUTH'}-${isL ? 'WEST' : 'EAST'}`;
      return {
        detected: true,
        pattern: { type: 'CORNER_SWEEP', isLeft: isL, isTop: isT },
        reason: `Corner Camping Detected: Flushing ${cornerName} pocket`
      };
    }

    const edgeRatio = edgeCount / count;
    const edgeThreshold = this.mode === 'strong' ? 0.65 : 0.8;

    if (edgeRatio > edgeThreshold) {
      // Determine dominant edge side
      const maxSide = Math.max(leftCount, rightCount, topCount, bottomCount);
      if (maxSide === leftCount) edgeSide = 'left';
      else if (maxSide === rightCount) edgeSide = 'right';
      else if (maxSide === topCount) edgeSide = 'top';
      else edgeSide = 'bottom';

      return {
        detected: true,
        pattern: { type: 'EDGE_SWEEP', side: edgeSide },
        reason: `Edge Camping Detected: Flushing ${edgeSide.toUpperCase()} perimeter`
      };
    }

    // 2. Stationary / Idle Stagnation Check
    let totalMovement = 0;
    for (let i = 1; i < samples.length; i++) {
      totalMovement += Math.hypot(
        samples[i].x - samples[i - 1].x,
        samples[i].y - samples[i - 1].y
      );
    }
    const avgSpeed = totalMovement / count;
    const stationaryThreshold = this.mode === 'strong' ? 0.8 : 0.5;

    if (avgSpeed < stationaryThreshold) {
      return {
        detected: true,
        pattern: { type: 'STATIONARY_FLUSH', targetPos: { ...rocket.pos } },
        reason: 'Stationary Target Detected: Inward pinch flush initiated'
      };
    }

    // 3. Circling / Vortex Loop Check
    // Calculate accumulated angular change across recent headings
    const headingSamples = this.headingHistory.slice(-120);
    let totalAngularDelta = 0;
    for (let i = 1; i < headingSamples.length; i++) {
      let diff = headingSamples[i] - headingSamples[i - 1];
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      totalAngularDelta += diff;
    }

    // If angular delta > 2.5 full circles (5pi radians in consistent direction)
    const circleThreshold = this.mode === 'strong' ? Math.PI * 3.5 : Math.PI * 5.0;
    if (Math.abs(totalAngularDelta) > circleThreshold) {
      return {
        detected: true,
        pattern: { type: 'VORTEX_BREAKER', dir: totalAngularDelta > 0 ? 'cw' : 'ccw' },
        reason: 'Circular Looping Detected: Deploying diagonal vortex breaker'
      };
    }

    // 4. Quadrant / Side Bias Check (spending > 85% in one half of the arena)
    let leftHalf = 0, rightHalf = 0, topHalf = 0, bottomHalf = 0;
    for (const p of samples) {
      if (p.x < this.arena.centerX) leftHalf++;
      else rightHalf++;
      if (p.y < this.arena.centerY) topHalf++;
      else bottomHalf++;
    }

    const biasThreshold = this.mode === 'strong' ? 0.82 : 0.9;
    if (leftHalf / count > biasThreshold) {
      return {
        detected: true,
        pattern: { type: 'SIDE_PRESSURE', side: 'left' },
        reason: 'West Quadrant Bias: Directing cross-arena pressure'
      };
    }
    if (rightHalf / count > biasThreshold) {
      return {
        detected: true,
        pattern: { type: 'SIDE_PRESSURE', side: 'right' },
        reason: 'East Quadrant Bias: Directing cross-arena pressure'
      };
    }

    return { detected: false };
  }

  /**
   * Initiates a telegraphed pattern with clear visual and textual warning
   */
  triggerPattern(pattern, reasonText) {
    this.pendingPattern = pattern;
    // Telegraph duration: 2.8s for gentle, 2.0s for strong
    this.telegraphDuration = this.mode === 'strong' ? 120 : 168;
    this.telegraphTimer = this.telegraphDuration;
    this.activeWarningMessage = reasonText;

    // Setup visual telegraph boundaries / vectors for renderer
    this.telegraphVisuals = {
      type: pattern.type,
      side: pattern.side || null,
      timer: this.telegraphTimer,
      duration: this.telegraphDuration
    };
  }

  /**
   * Spawns non-unfair, designed attack patterns safely outside the arena bounds
   */
  executePattern(pattern, rocketPos) {
    const threats = [];
    const count = this.mode === 'strong' ? 4 : 3;

    switch (pattern.type) {
      case 'CORNER_SWEEP': {
        const isLeft = pattern.isLeft;
        const isTop = pattern.isTop;
        const cornerX = isLeft ? this.arena.minX + 20 : this.arena.maxX - 20;
        const cornerY = isTop ? this.arena.minY + 20 : this.arena.maxY - 20;

        // Vertical corridor threat
        const vy = isTop ? 4.2 : -4.2;
        const sy = isTop ? -35 : this.arena.height + 35;
        threats.push(new Threat(Date.now() + 50, cornerX, sy, 0, vy, 'medium', this.prng));

        // Horizontal corridor threat
        const vx = isLeft ? 4.2 : -4.2;
        const sx = isLeft ? -35 : this.arena.width + 35;
        threats.push(new Threat(Date.now() + 51, sx, cornerY, vx, 0, 'medium', this.prng));
        break;
      }

      case 'EDGE_SWEEP': {
        // Sweeps parallel along the camped edge to clear the corridor
        const side = pattern.side;
        for (let i = 0; i < count; i++) {
          let x, y, vx, vy;
          const offset = 40 + i * 45;

          if (side === 'left') {
            x = this.arena.minX + offset;
            y = -30;
            vx = 0.5;
            vy = 3.2;
          } else if (side === 'right') {
            x = this.arena.maxX - offset;
            y = -30;
            vx = -0.5;
            vy = 3.2;
          } else if (side === 'top') {
            x = -30;
            y = this.arena.minY + offset;
            vx = 3.2;
            vy = 0.5;
          } else {
            x = -30;
            y = this.arena.maxY - offset;
            vx = 3.2;
            vy = -0.5;
          }

          threats.push(new Threat(Date.now() + i, x, y, vx, vy, 'small', this.prng));
        }
        break;
      }

      case 'STATIONARY_FLUSH': {
        // Two converging hazards from opposite sides aimed through center
        threats.push(
          new Threat(Date.now() + 10, -30, this.arena.centerY - 50, 2.8, 0.4, 'medium', this.prng),
          new Threat(Date.now() + 11, this.arena.width + 30, this.arena.centerY + 50, -2.8, -0.4, 'medium', this.prng)
        );
        break;
      }

      case 'VORTEX_BREAKER': {
        // Diagonal crossfire cutting across typical circular orbits
        threats.push(
          new Threat(Date.now() + 20, -30, -30, 2.6, 2.6, 'medium', this.prng),
          new Threat(Date.now() + 21, this.arena.width + 30, this.arena.height + 30, -2.6, -2.6, 'medium', this.prng)
        );
        break;
      }

      case 'SIDE_PRESSURE': {
        // Cluster entering from the favored side to force migration
        const side = pattern.side;
        for (let i = 0; i < count; i++) {
          const spreadY = this.arena.minY + (this.arena.playHeight / (count + 1)) * (i + 1);
          const x = side === 'left' ? -30 : this.arena.width + 30;
          const vx = side === 'left' ? 3.0 : -3.0;
          threats.push(new Threat(Date.now() + 30 + i, x, spreadY, vx, 0.2 * (i - 1), 'medium', this.prng));
        }
        break;
      }
    }

    return threats;
  }
}
