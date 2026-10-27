/**
 * AgentController.js
 * Bridges the GameSimulation state with the NeuralNetwork policy.
 * Computes 20 normalized observation features (position, velocity, boundaries,
 * 8-ray proximity radar, and nearest hazard vectors) and produces throttle forces.
 */

import { NeuralNetwork } from './NeuralNetwork.js';
import { Vector } from '../engine/Vector.js';

export class AgentController {
  constructor(network = null) {
    this.network = network || new NeuralNetwork(20, 16, 4);
    this.lastSensorData = {
      radarDistances: new Array(8).fill(1.0),
      nearestThreat: null,
      inputs: new Float32Array(20),
      outputs: new Float32Array(4)
    };
  }

  /**
   * Reads simulation state, extracts features, queries network, and returns throttle Vector
   * @param {GameSimulation} sim
   * @returns {Vector} throttle force [-1.0, 1.0] for X and Y
   */
  act(sim) {
    const inputs = this.extractInputs(sim);
    const outputs = this.network.forward(inputs);

    // Save for visualization
    this.lastSensorData.inputs = inputs;
    this.lastSensorData.outputs = outputs;

    // Output mapping:
    // out[0]: Left, out[1]: Right, out[2]: Up, out[3]: Down
    // Activation values range [0, 1]
    const throttleX = outputs[1] - outputs[0];
    const throttleY = outputs[3] - outputs[2];

    return new Vector(throttleX, throttleY);
  }

  extractInputs(sim) {
    const rocket = sim.rocket;
    const arena = sim.arena;
    const threats = sim.threats;
    const inputs = new Float32Array(20);

    // 1 & 2. Rocket Position normalized to [-1, 1] relative to arena center
    inputs[0] = (rocket.pos.x - arena.centerX) / (arena.playWidth / 2);
    inputs[1] = (rocket.pos.y - arena.centerY) / (arena.playHeight / 2);

    // 3 & 4. Rocket Velocity normalized to [-1, 1]
    inputs[2] = rocket.vel.x / rocket.maxSpeed;
    inputs[3] = rocket.vel.y / rocket.maxSpeed;

    // 5-8. Normalized Wall Clearances [0, 1]
    const wallDists = arena.getNormalizedWallDistances(rocket.pos);
    inputs[4] = wallDists[0]; // Left
    inputs[5] = wallDists[1]; // Right
    inputs[6] = wallDists[2]; // Top
    inputs[7] = wallDists[3]; // Bottom

    // 9-16. 8-Directional Proximity Radar Scan [0, 1] (0 = obstacle at hull, 1 = clear)
    const radarRange = 180;
    const radarDistances = new Array(8).fill(1.0);
    const angles = 8;

    for (let i = 0; i < angles; i++) {
      const theta = (i / angles) * Math.PI * 2;
      const rayDirX = Math.cos(theta);
      const rayDirY = Math.sin(theta);
      let closestHitDist = radarRange;

      // Check distance to arena walls along this ray
      if (rayDirX < 0) {
        const d = (rocket.pos.x - arena.minX) / -rayDirX;
        if (d > 0 && d < closestHitDist) closestHitDist = d;
      } else if (rayDirX > 0) {
        const d = (arena.maxX - rocket.pos.x) / rayDirX;
        if (d > 0 && d < closestHitDist) closestHitDist = d;
      }
      if (rayDirY < 0) {
        const d = (rocket.pos.y - arena.minY) / -rayDirY;
        if (d > 0 && d < closestHitDist) closestHitDist = d;
      } else if (rayDirY > 0) {
        const d = (arena.maxY - rocket.pos.y) / rayDirY;
        if (d > 0 && d < closestHitDist) closestHitDist = d;
      }

      // Check proximity to all active threats along ray cone
      for (let t = 0; t < threats.length; t++) {
        const threat = threats[t];
        const tdx = threat.pos.x - rocket.pos.x;
        const tdy = threat.pos.y - rocket.pos.y;

        // Project threat onto ray
        const proj = tdx * rayDirX + tdy * rayDirY;
        if (proj > 0 && proj < closestHitDist) {
          // Perpendicular distance from ray
          const perpDistSq = tdx * tdx + tdy * tdy - proj * proj;
          const threatRadiusSq = (threat.radius + 12) * (threat.radius + 12);
          if (perpDistSq <= threatRadiusSq) {
            const hitDist = Math.max(0, proj - threat.radius);
            if (hitDist < closestHitDist) closestHitDist = hitDist;
          }
        }
      }

      radarDistances[i] = Math.max(0, Math.min(1, closestHitDist / radarRange));
      inputs[8 + i] = radarDistances[i];
    }
    this.lastSensorData.radarDistances = radarDistances;

    // 17-20. Nearest Threat Vector
    let nearestThreat = null;
    let minDistSq = Infinity;

    for (let t = 0; t < threats.length; t++) {
      const threat = threats[t];
      const dx = threat.pos.x - rocket.pos.x;
      const dy = threat.pos.y - rocket.pos.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearestThreat = threat;
      }
    }

    if (nearestThreat) {
      const dist = Math.sqrt(minDistSq);
      const maxSensoryDist = 350;
      inputs[16] = (nearestThreat.pos.x - rocket.pos.x) / maxSensoryDist;
      inputs[17] = (nearestThreat.pos.y - rocket.pos.y) / maxSensoryDist;
      inputs[18] = Math.min(1.0, dist / maxSensoryDist);
      inputs[19] = (nearestThreat.vel.x - rocket.vel.x) / 8.0;

      this.lastSensorData.nearestThreat = {
        x: nearestThreat.pos.x,
        y: nearestThreat.pos.y,
        radius: nearestThreat.radius,
        dist
      };
    } else {
      inputs[16] = 0;
      inputs[17] = 0;
      inputs[18] = 1.0;
      inputs[19] = 0;
      this.lastSensorData.nearestThreat = null;
    }

    return inputs;
  }
}
