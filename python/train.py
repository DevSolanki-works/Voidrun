"""
train.py
CLI experiment runner for training Neuroevolution controllers offline.
Usage:
    python python/train.py --generations 25 --pop-size 30 --output checkpoints/best_agent.json
"""

import argparse
import json
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from python.genetic_algorithm import GeneticAlgorithm

def main():
    parser = argparse.ArgumentParser(description="Train VOIDRUN Neuro-controllers via Genetic Algorithm")
    parser.add_argument('--generations', type=int, default=20, help="Number of generations to evolve")
    parser.add_argument('--pop-size', type=int, default=30, help="Population size per generation")
    parser.add_argument('--mut-rate', type=float, default=0.08, help="Mutation probability per weight")
    parser.add_argument('--output', type=str, default="python/best_agent.json", help="Path to save trained weights")
    args = parser.parse_args()

    print("=" * 65)
    print(" VOIDRUN: Evasion Protocol — Genetic Algorithm Trainer (Python)")
    print(" Project: Multi-Threat Evasion using Genetic Algorithms in 2D Arenas")
    print("=" * 65)
    print(f"Population: {args.pop_size} | Mutation Rate: {args.mut_rate} | Generations: {args.generations}")
    print("-" * 65)

    ga = GeneticAlgorithm(population_size=args.pop_size, mutation_rate=args.mut_rate)

    for g in range(1, args.generations + 1):
        result = ga.evolve_generation()
        print(f"Gen {g:3d} | Best Fit: {result['best_fitness']:8.1f} | Avg Fit: {result['avg_fitness']:8.1f} | Best Survival: {result['survival_seconds']:5.1f}s")

    os.makedirs(os.path.dirname(args.output), exist_ok=True) if os.path.dirname(args.output) else None
    with open(args.output, 'w') as f:
        json.dump({
            'generation': ga.generation,
            'fitness': ga.best_individual.fitness,
            'survival_seconds': ga.best_individual.survival_ticks / 60.0,
            'weights': ga.best_individual.network.get_weights()
        }, f, indent=2)

    print("-" * 65)
    print(f"Training Complete! Saved apex controller to: {args.output}")
    print("=" * 65)

if __name__ == '__main__':
    main()
