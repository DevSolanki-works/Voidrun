/**
 * VisualEffects.js
 * Screen shake, flash overlays, starfield with parallax, and nebula gradients.
 */

export class VisualEffects {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    this.flashAlpha = 0;
    this.flashColor = '#ffffff';

    this.screenShakeSetting = 'on'; // 'on', 'reduced', 'off'
    this.flashSetting = 'on'; // 'on', 'off'

    // Generate static background stars
    this.stars = [];
    const starCount = 140;
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.2 ? 1.8 : Math.random() < 0.6 ? 1.2 : 0.7,
        alpha: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: Math.random() < 0.3 ? 0.3 : 0.7 // Parallax depth factor
      });
    }

    // Pre-create subtle offscreen nebula canvas for high rendering performance
    this.nebulaCanvas = document.createElement('canvas');
    this.nebulaCanvas.width = width;
    this.nebulaCanvas.height = height;
    this.renderNebula();
  }

  renderNebula() {
    const ctx = this.nebulaCanvas.getContext('2d');
    ctx.fillStyle = '#060608'; // Deep monochrome space black
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle monochrome stellar dust cloud
    const grad1 = ctx.createRadialGradient(
      this.width * 0.3,
      this.height * 0.35,
      30,
      this.width * 0.3,
      this.height * 0.35,
      350
    );
    grad1.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    grad1.addColorStop(0.5, 'rgba(200, 200, 210, 0.015)');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, this.width, this.height);

    // Secondary slate dust vignette
    const grad2 = ctx.createRadialGradient(
      this.width * 0.72,
      this.height * 0.65,
      20,
      this.width * 0.72,
      this.height * 0.65,
      320
    );
    grad2.addColorStop(0, 'rgba(160, 160, 175, 0.03)');
    grad2.addColorStop(0.6, 'rgba(100, 100, 115, 0.01)');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  setScreenShake(setting) {
    if (['on', 'reduced', 'off'].includes(setting)) {
      this.screenShakeSetting = setting;
    }
  }

  setFlash(setting) {
    if (['on', 'off'].includes(setting)) {
      this.flashSetting = setting;
    }
  }

  triggerShake(intensity = 8, duration = 16) {
    if (this.screenShakeSetting === 'off') return;
    const finalIntensity = this.screenShakeSetting === 'reduced' ? intensity * 0.45 : intensity;
    this.shakeIntensity = finalIntensity;
    this.shakeDuration = duration;
  }

  triggerFlash(color = '#ff3366', alpha = 0.35) {
    if (this.flashSetting === 'off') return;
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  update(rocketVel = null) {
    // Decay screen shake
    if (this.shakeDuration > 0) {
      const currentIntensity =
        this.shakeIntensity * (this.shakeDuration / 16);
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * currentIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * currentIntensity;
      this.shakeDuration--;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // Decay flash
    if (this.flashAlpha > 0) {
      this.flashAlpha -= 0.025;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }

    // Parallax stars
    const vx = rocketVel ? rocketVel.x : 0;
    const vy = rocketVel ? rocketVel.y : 0;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.x -= vx * s.layer * 0.15;
      s.y -= vy * s.layer * 0.15;

      // Wrap stars around boundaries
      if (s.x < 0) s.x += this.width;
      if (s.x > this.width) s.x -= this.width;
      if (s.y < 0) s.y += this.height;
      if (s.y > this.height) s.y -= this.height;
    }
  }

  renderBackground(ctx, ticks = 0) {
    // 1. Blit static pre-rendered nebula
    ctx.drawImage(this.nebulaCanvas, 0, 0);

    // 2. Render twinkling starfield
    ctx.save();
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const twinkle =
        s.alpha * (0.7 + 0.3 * Math.sin(ticks * s.twinkleSpeed + s.twinkleOffset));
      ctx.fillStyle = `rgba(220, 235, 255, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderPostEffects(ctx) {
    // Screen Flash
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }
}
