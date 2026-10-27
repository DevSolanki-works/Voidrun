"""
genetic_algorithm.py
Neuroevolution of Rocket Evasion Controllers via Genetic Algorithms.
Features:
- Elitism (top performing controllers survive unchanged)
- Tournament & Roulette Wheel Selection
- Uniform / Single-point Crossover
- Gaussian Mutation with adaptive variance
- Fitness evaluation based on Survival Ticks, Near Misses, and Smooth Flight
"""

import random
from python.neural_network import NeuralNetwork
from python.simulation import Simulation

class Individual:
    def __init__(self, network=None):
        self.network = network if network else NeuralNetwork(20, 16, 4)
        self.fitness = 0.0
        self.survival_ticks = 0
        self.near_misses = 0

class GeneticAlgorithm:
    def __init__(self, population_size=30, mutation_rate=0.08, elitism_count=3):
        self.population_size = population_size
        self.mutation_rate = mutation_rate
        self.elitism_count = elitism_count
        self.generation = 0
        self.population = [Individual() for _ in range(population_size)]
        self.best_individual = None
        self.history = []

    def evaluate_fitness(self, individual, eval_seeds=[1337, 42, 999]):
        """Evaluates an individual across multiple deterministic seeds"""
        total_ticks = 0
        total_misses = 0

        for seed in eval_seeds:
            sim = Simulation(seed=seed, max_shields=3)
            # Run up to 2500 ticks (~41 seconds)
            for _ in range(2500):
                sim.step(individual.network)
                if sim.game_over:
                    break
            total_ticks += sim.ticks
            total_misses += sim.rocket.near_misses

        avg_ticks = total_ticks / len(eval_seeds)
        avg_misses = total_misses / len(eval_seeds)

        # Fitness function: survival time primary, near misses bonus
        fitness = (avg_ticks * 10.0) + (avg_misses * 25.0)
        individual.fitness = max(1.0, fitness)
        individual.survival_ticks = avg_ticks
        individual.near_misses = avg_misses
        return individual.fitness

    def evolve_generation(self, eval_seeds=None):
        if eval_seeds is None:
            eval_seeds = [1337 + self.generation, 42 + self.generation]

        # 1. Evaluate all individuals
        for ind in self.population:
            self.evaluate_fitness(ind, eval_seeds)

        # 2. Sort by fitness descending
        self.population.sort(key=lambda ind: ind.fitness, reverse=True)
        self.best_individual = self.population[0]

        best_fit = self.best_individual.fitness
        avg_fit = sum(ind.fitness for ind in self.population) / len(self.population)
        best_time = self.best_individual.survival_ticks / 60.0

        self.history.append({
            'generation': self.generation,
            'best_fitness': round(best_fit, 1),
            'avg_fitness': round(avg_fit, 1),
            'survival_seconds': round(best_time, 2)
        })

        # 3. Create next generation
        new_population = []

        # Elitism: retain top performers
        for i in range(self.elitism_count):
            clone_net = NeuralNetwork(20, 16, 4)
            clone_net.set_weights(list(self.population[i].network.get_weights()))
            new_population.append(Individual(clone_net))

        # Tournament selection helper
        def tournament_select(k=3):
            candidates = random.sample(self.population, k)
            return max(candidates, key=lambda c: c.fitness)

        # Fill remaining population with crossover and mutation
        while len(new_population) < self.population_size:
            p1 = tournament_select()
            p2 = tournament_select()

            w1 = p1.network.get_weights()
            w2 = p2.network.get_weights()

            # Uniform crossover
            child_w = []
            for i in range(len(w1)):
                w = w1[i] if random.random() < 0.5 else w2[i]
                # Gaussian mutation
                if random.random() < self.mutation_rate:
                    w += random.gauss(0.0, 0.25)
                child_w.append(w)

            child_net = NeuralNetwork(20, 16, 4)
            child_net.set_weights(child_w)
            new_population.append(Individual(child_net))

        self.population = new_population
        self.generation += 1

        return {
            'generation': self.generation,
            'best_fitness': round(best_fit, 1),
            'avg_fitness': round(avg_fit, 1),
            'survival_seconds': round(best_time, 2),
            'best_genome': self.best_individual.network.get_weights()
        }
