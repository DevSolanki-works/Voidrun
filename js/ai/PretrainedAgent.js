/**
 * PretrainedAgent.js
 * Multi-checkpoint neuroevolution models evolved across 1000 generations.
 * Ships pre-trained checkpoints for Gen 100, Gen 500, and Gen 1000.
 */

import { CHECKPOINTS } from './PretrainedCheckpoints.js';

export const PRETRAINED_GENOME_100 = CHECKPOINTS.gen100.weights;
export const PRETRAINED_GENOME_500 = CHECKPOINTS.gen500.weights;
export const PRETRAINED_GENOME_1000 = CHECKPOINTS.gen1000.weights;

export { CHECKPOINTS };

// Default demonstration agent corresponds to Apex Checkpoint (Gen 1000)
export const PRETRAINED_GENOME = PRETRAINED_GENOME_1000;

export const PRETRAINED_METADATA = {
  generations: CHECKPOINTS.gen1000.generation,
  populationSize: 36,
  bestFitness: CHECKPOINTS.gen1000.bestFitness,
  bestSurvivalSec: CHECKPOINTS.gen1000.bestSurvivalSec,
  modelTopology: CHECKPOINTS.gen1000.modelTopology,
  evalSeeds: 'Deterministic Multi-Seed (Generalization Verified)',
  trainedAt: CHECKPOINTS.gen1000.trainedAt
};
