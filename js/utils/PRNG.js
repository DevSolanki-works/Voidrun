/**
 * PRNG.js
 * Seedable pseudo-random number generator (Mulberry32 algorithm)
 * Provides deterministic randomness for reproducible evaluations, seeds, and GA training.
 */

export class PRNG {
  constructor(seed = 1337) {
    this.initialSeed = seed;
    this.seed = seed >>> 0;
  }

  reset(seed = this.initialSeed) {
    this.initialSeed = seed;
    this.seed = seed >>> 0;
  }

  /**
   * Returns a float between 0 (inclusive) and 1 (exclusive)
   */
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Random float in range [min, max)
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Random integer in range [min, max]
   */
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Random choice from array
   */
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Normally distributed random value (Box-Muller transform)
   */
  gaussian(mean = 0, stdDev = 1) {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 <= 1e-7) u1 = this.next(); // avoid log(0)
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}
