/**
 * GeneticAlgorithm.js
 * Neuroevolution engine: maintains a population of neural network controllers,
 * evaluates their fitness on rotating deterministic multi-threat episodes,
 * and evolves superior policies using Elitism, Tournament Selection, Crossover, and Mutation.
 */

import { NeuralNetwork } from './NeuralNetwork.js';
import { AgentController } from './AgentController.js';
import { GameSimulation } from '../engine/GameSimulation.js';
import { PRNG } from '../utils/PRNG.js';

export class GeneticAlgorithm {
  constructor(options = {}) {
    this.populationSize = options.populationSize || 36;
    this.mutationRate = options.mutationRate !== undefined ? options.mutationRate : 0.08;
    this.mutationMagnitude = options.mutationMagnitude !== undefined ? options.mutationMagnitude : 0.25;
    this.elitismCount = options.elitismCount !== undefined ? options.elitismCount : 2;
    this.tournamentSize = options.tournamentSize || 3;
    this.targetSurvivalTicks = options.targetSurvivalTicks || 0;
    this.personalBestBonus = 600;

    this.prng = new PRNG(options.seed || 42);

    // Population array: { id, network, controller, fitness, survivalTime, metrics }
    this.population = [];
    this.generation = 0;
    this.history = []; // [{ gen, bestFitness, avgFitness, bestSurvival }]

    this.bestGenome = null;
    this.bestFitnessAllTime = 0;
    this.bestSurvivalAllTime = 0;

    // Fitness weights breakdown for academic transparency
    this.weights = {
      survival: 1.0,        // Score per tick alive
      nearMissBonus: 120.0, // Tactical dodge reward
      waveBonus: 350.0,     // Wave progression milestone
      wallHugPenalty: 1.2,  // Penalty per tick spent near boundary
      wallHitPenalty: 100.0,// Collision with boundary
      jitterPenalty: 0.8    // Sudden thruster oscillation penalty
    };

    this.initPopulation();
  }

  initPopulation() {
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      const net = new NeuralNetwork(20, 16, 4);
      net.initRandom(this.prng);
      this.population.push({
        id: i,
        network: net,
        controller: new AgentController(net),
        fitness: 0,
        survivalTime: 0,
        metrics: {}
      });
    }
  }

  /**
   * Evaluates a single candidate over a deterministic simulation episode.
   * Runs headless at maximum CPU speed.
   */
  evaluateCandidate(candidate, evalSeed = 1000 + this.generation) {
    const sim = new GameSimulation({
      seed: evalSeed,
      maxShields: 1, // Single-life survival for rigorous evasion testing
      adaptiveMode: 'off',
      headless: true
    });

    let ticks = 0;
    const maxEvalTicks = 12000; // 200s evaluation cutoff cap to prevent infinite loops
    while (!sim.gameOver && ticks < maxEvalTicks) {
      sim.step(candidate.controller);
      ticks++;
    }

    const m = sim.rocket.metrics;
    const wave = sim.spawner.wave;

    // Academic Fitness Function:
    // Rewards survival and active evasion, penalizes boundary camping and erratic jitter
    let fitness =
      m.ticksAlive * this.weights.survival +
      m.nearMisses * this.weights.nearMissBonus +
      (wave - 1) * this.weights.waveBonus -
      m.wallHugTicks * this.weights.wallHugPenalty -
      m.wallCollisions * this.weights.wallHitPenalty -
      m.jitterScore * this.weights.jitterPenalty;

    // Give a clear fitness bump when a candidate beats the player's saved record.
    if (this.targetSurvivalTicks > 0 && ticks > this.targetSurvivalTicks) {
      fitness += this.personalBestBonus;
    }

    // Clamp fitness to positive minimum
    fitness = Math.max(1.0, fitness);

    candidate.fitness = fitness;
    candidate.survivalTime = m.ticksAlive / 60; // In seconds
    candidate.metrics = { ...m, wave, score: sim.score };

    return fitness;
  }

  /**
   * Evaluates all candidates on the same rotating seed for a fair, faster generation.
   * @param {Function|null} onProgress - Optional progress callback (index, total)
   */
  evaluateGeneration(onProgress = null) {
    // One shared seed keeps candidates directly comparable and makes training faster.
    // The challenge rotates every generation so the population cannot rely on one pattern.
    const seed = 1000 + this.generation * 7919;

    for (let i = 0; i < this.population.length; i++) {
      const candidate = this.population[i];

      this.evaluateCandidate(candidate, seed);

      if (onProgress) {
        onProgress(i + 1, this.population.length);
      }
    }

    // Sort population in descending order of fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    const bestCandidate = this.population[0];
    const totalFitness = this.population.reduce((sum, c) => sum + c.fitness, 0);
    const avgFitness = totalFitness / this.population.length;

    // Check all-time best
    if (bestCandidate.fitness > this.bestFitnessAllTime) {
      this.bestFitnessAllTime = bestCandidate.fitness;
      this.bestSurvivalAllTime = bestCandidate.survivalTime;
      this.bestGenome = bestCandidate.network.getWeights().slice();
    }

    const genRecord = {
      gen: this.generation,
      bestFitness: bestCandidate.fitness,
      avgFitness: avgFitness,
      bestSurvival: bestCandidate.survivalTime,
      bestWave: bestCandidate.metrics.wave || 1
    };
    this.history.push(genRecord);

    return genRecord;
  }

  /**
   * Produces next generation using Elitism, Tournament Selection, Crossover, and Mutation.
   */
  evolveNextGeneration() {
    const newPopulation = [];

    // 1. Elitism: preserve top performers unchanged
    for (let e = 0; e < this.elitismCount && e < this.population.length; e++) {
      const elite = this.population[e];
      const clonedNet = elite.network.clone();
      newPopulation.push({
        id: e,
        network: clonedNet,
        controller: new AgentController(clonedNet),
        fitness: 0,
        survivalTime: 0,
        metrics: {}
      });
    }

    // 2. Offspring generation
    while (newPopulation.length < this.populationSize) {
      const parentA = this.tournamentSelect();
      const parentB = this.tournamentSelect();

      const childNet = this.crossover(parentA.network, parentB.network);
      this.mutate(childNet);

      const id = newPopulation.length;
      newPopulation.push({
        id,
        network: childNet,
        controller: new AgentController(childNet),
        fitness: 0,
        survivalTime: 0,
        metrics: {}
      });
    }

    this.population = newPopulation;
    this.generation++;
  }

  /**
   * Tournament Selection: random sample of k candidates, pick fittest
   */
  tournamentSelect() {
    let best = null;
    for (let i = 0; i < this.tournamentSize; i++) {
      const idx = Math.floor(this.prng.next() * this.population.length);
      const candidate = this.population[idx];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    return best;
  }

  /**
   * Uniform / Arithmetic Crossover of network weight arrays
   */
  crossover(parentA, parentB) {
    const weightsA = parentA.getWeights();
    const weightsB = parentB.getWeights();
    const childWeights = new Float32Array(weightsA.length);

    for (let i = 0; i < weightsA.length; i++) {
      // 50% gene chance from either parent with slight arithmetic blend
      if (this.prng.next() < 0.5) {
        childWeights[i] = weightsA[i];
      } else {
        childWeights[i] = weightsB[i];
      }
    }

    const childNet = parentA.clone();
    childNet.setWeights(childWeights);
    return childNet;
  }

  /**
   * Gaussian Mutation applied to weight vector
   */
  mutate(network) {
    const weights = network.getWeights();
    for (let i = 0; i < weights.length; i++) {
      if (this.prng.next() < this.mutationRate) {
        // Additive Gaussian perturbation
        const delta = this.prng.gaussian(0, this.mutationMagnitude);
        weights[i] += delta;
      }
    }
    network.setWeights(weights);
  }

  /**
   * Resets entire training state
   */
  reset() {
    this.generation = 0;
    this.history = [];
    this.bestGenome = null;
    this.bestFitnessAllTime = 0;
    this.bestSurvivalAllTime = 0;
    this.initPopulation();
  }
}
