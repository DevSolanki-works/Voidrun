/**
 * PretrainedAgent.js
 * Multi-checkpoint neuroevolution models evolved across 1000 generations.
 * Ships pre-trained checkpoints for Gen 100, Gen 500, and Gen 1000.
 */

import { CHECKPOINTS, PRETRAINED_GENOME_100, PRETRAINED_GENOME_500, PRETRAINED_GENOME_1000 } from './PretrainedCheckpoints.js';

export { CHECKPOINTS, PRETRAINED_GENOME_100, PRETRAINED_GENOME_500, PRETRAINED_GENOME_1000 };

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
