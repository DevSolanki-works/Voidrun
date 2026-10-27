"""
neural_network.py
Lightweight feedforward neural network for autonomous rocket evasion.
Matches the JavaScript architecture: 20 inputs -> 16 hidden (tanh) -> 4 outputs (tanh).
Zero external dependencies required.
"""

import math
import random

def tanh(x):
    # Clamped tanh to prevent overflow
    if x < -20:
        return -1.0
    if x > 20:
        return 1.0
    return math.tanh(x)

class NeuralNetwork:
    def __init__(self, input_size=20, hidden_size=16, output_size=4):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = output_size

        # Weight counts: (20 * 16 + 16) + (16 * 4 + 4) = 336 + 68 = 404 parameters
        self.w1 = [[random.uniform(-0.5, 0.5) for _ in range(hidden_size)] for _ in range(input_size)]
        self.b1 = [0.0 for _ in range(hidden_size)]
        self.w2 = [[random.uniform(-0.5, 0.5) for _ in range(output_size)] for _ in range(hidden_size)]
        self.b2 = [0.0 for _ in range(output_size)]

    def feedforward(self, inputs):
        # Hidden layer
        hidden = []
        for j in range(self.hidden_size):
            s = self.b1[j]
            for i in range(self.input_size):
                s += inputs[i] * self.w1[i][j]
            hidden.append(tanh(s))

        # Output layer
        outputs = []
        for k in range(self.output_size):
            s = self.b2[k]
            for j in range(self.hidden_size):
                s += hidden[j] * self.w2[j][k]
            outputs.append(tanh(s))

        return outputs

    def get_weights(self):
        weights = []
        for i in range(self.input_size):
            for j in range(self.hidden_size):
                weights.append(self.w1[i][j])
        weights.extend(self.b1)
        for j in range(self.hidden_size):
            for k in range(self.output_size):
                weights.append(self.w2[j][k])
        weights.extend(self.b2)
        return weights

    def set_weights(self, weights):
        idx = 0
        for i in range(self.input_size):
            for j in range(self.hidden_size):
                self.w1[i][j] = weights[idx]
                idx += 1
        for j in range(self.hidden_size):
            self.b1[j] = weights[idx]
            idx += 1
        for j in range(self.hidden_size):
            for k in range(self.output_size):
                self.w2[j][k] = weights[idx]
                idx += 1
        for k in range(self.output_size):
            self.b2[k] = weights[idx]
            idx += 1
