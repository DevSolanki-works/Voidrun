/**
 * Arena.js
 * Encapsulates the bounded 2D playfield, boundaries, and spatial constraints.
 */

export class Arena {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.padding = 24; // Visual inner boundary inset
    this.centerX = width / 2;
    this.centerY = height / 2;
  }

  get minX() {
    return this.padding;
  }

  get maxX() {
    return this.width - this.padding;
  }

  get minY() {
    return this.padding;
  }

  get maxY() {
    return this.height - this.padding;
  }

  get playWidth() {
    return this.maxX - this.minX;
  }

  get playHeight() {
    return this.maxY - this.minY;
  }

  /**
   * Clamps an entity position within the boundary.
   * Returns true if a boundary collision occurred.
   */
  constrainEntity(pos, radius, vel = null) {
    let collided = false;

    if (pos.x - radius < this.minX) {
      pos.x = this.minX + radius;
      if (vel) vel.x = Math.max(0, -vel.x * 0.4);
      collided = true;
    } else if (pos.x + radius > this.maxX) {
      pos.x = this.maxX - radius;
      if (vel) vel.x = Math.min(0, -vel.x * 0.4);
      collided = true;
    }

    if (pos.y - radius < this.minY) {
      pos.y = this.minY + radius;
      if (vel) vel.y = Math.max(0, -vel.y * 0.4);
      collided = true;
    } else if (pos.y + radius > this.maxY) {
      pos.y = this.maxY - radius;
      if (vel) vel.y = Math.min(0, -vel.y * 0.4);
      collided = true;
    }

    return collided;
  }

  /**
   * Distance to closest wall from position
   */
  getWallDistances(pos) {
    return {
      left: Math.max(0, pos.x - this.minX),
      right: Math.max(0, this.maxX - pos.x),
      top: Math.max(0, pos.y - this.minY),
      bottom: Math.max(0, this.maxY - pos.y)
    };
  }

  /**
   * Returns normalized wall distances [0, 1] for neural network
   */
  getNormalizedWallDistances(pos) {
    const d = this.getWallDistances(pos);
    return [
      Math.min(1, d.left / this.playWidth),
      Math.min(1, d.right / this.playWidth),
      Math.min(1, d.top / this.playHeight),
      Math.min(1, d.bottom / this.playHeight)
    ];
  }
}
