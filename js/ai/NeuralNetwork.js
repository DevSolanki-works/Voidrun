/**
 * NeuralNetwork.js
 * Lightweight Feedforward Neural Network (Multi-Layer Perceptron) for Neuroevolution.
 * Features fast matrix operations, activation functions, and flat weight vector serialization.
 */

export class NeuralNetwork {
  constructor(inputSize = 20, hiddenSize = 16, outputSize = 4) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    // Weights matrices and bias vectors
    // W1: hiddenSize x inputSize
    // B1: hiddenSize
    // W2: outputSize x hiddenSize
    // B2: outputSize
    this.totalWeights =
      hiddenSize * inputSize + hiddenSize + outputSize * hiddenSize + outputSize;

    this.w1 = new Float32Array(hiddenSize * inputSize);
    this.b1 = new Float32Array(hiddenSize);
    this.w2 = new Float32Array(outputSize * hiddenSize);
    this.b2 = new Float32Array(outputSize);

    this.initRandom();
  }

  /**
   * Xavier / Glorot uniform initialization
   */
  initRandom(prng = null) {
    const limit1 = Math.sqrt(6 / (this.inputSize + this.hiddenSize));
    for (let i = 0; i < this.w1.length; i++) {
      this.w1[i] = prng
        ? prng.range(-limit1, limit1)
        : (Math.random() * 2 - 1) * limit1;
    }
    for (let i = 0; i < this.b1.length; i++) {
      this.b1[i] = 0.0;
    }

    const limit2 = Math.sqrt(6 / (this.hiddenSize + this.outputSize));
    for (let i = 0; i < this.w2.length; i++) {
      this.w2[i] = prng
        ? prng.range(-limit2, limit2)
        : (Math.random() * 2 - 1) * limit2;
    }
    for (let i = 0; i < this.b2.length; i++) {
      this.b2[i] = 0.0;
    }
  }

  /**
   * Forward pass: inputs -> hidden (tanh) -> outputs (tanh / clamped)
   * @param {Array<number>} inputs
   * @returns {Float32Array} outputs of size outputSize
   */
  forward(inputs) {
    const hidden = new Float32Array(this.hiddenSize);
    const outputs = new Float32Array(this.outputSize);

    // Input to Hidden
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = this.b1[i];
      const offset = i * this.inputSize;
      for (let j = 0; j < this.inputSize; j++) {
        sum += this.w1[offset + j] * inputs[j];
      }
      // Tanh activation
      hidden[i] = Math.tanh(sum);
    }

    // Hidden to Output
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.b2[i];
      const offset = i * this.hiddenSize;
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += this.w2[offset + j] * hidden[j];
      }
      // Sigmoid-like or Tanh for normalized thruster activation [0, 1]
      // Using standard logistic sigmoid for distinct motor thrusters
      outputs[i] = 1 / (1 + Math.exp(-sum));
    }

    return outputs;
  }

  /**
   * Flattens all network weights and biases into a single 1D Float32Array
   */
  getWeights() {
    const flat = new Float32Array(this.totalWeights);
    let ptr = 0;

    flat.set(this.w1, ptr);
    ptr += this.w1.length;

    flat.set(this.b1, ptr);
    ptr += this.b1.length;

    flat.set(this.w2, ptr);
    ptr += this.w2.length;

    flat.set(this.b2, ptr);
    return flat;
  }

  /**
   * Restores network weights from a flat array
   */
  setWeights(flat) {
    if (flat.length !== this.totalWeights) {
      throw new Error(
        `Weight array length mismatch: expected ${this.totalWeights}, got ${flat.length}`
      );
    }
    let ptr = 0;

    this.w1.set(flat.subarray(ptr, ptr + this.w1.length));
    ptr += this.w1.length;

    this.b1.set(flat.subarray(ptr, ptr + this.b1.length));
    ptr += this.b1.length;

    this.w2.set(flat.subarray(ptr, ptr + this.w2.length));
    ptr += this.w2.length;

    this.b2.set(flat.subarray(ptr, ptr + this.b2.length));
  }

  clone() {
    const copy = new NeuralNetwork(
      this.inputSize,
      this.hiddenSize,
      this.outputSize
    );
    copy.setWeights(this.getWeights());
    return copy;
  }
}
