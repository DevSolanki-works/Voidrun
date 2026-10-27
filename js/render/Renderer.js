/**
 * Renderer.js
 * Primary Canvas 2D rendering engine for VOIDRUN.
 * Draws space backdrop, arena grid, threats, rocket geometry, sensors, and effects.
 */

import { VisualEffects } from './VisualEffects.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.vfx = new VisualEffects(this.width, this.height);
    this.aiViewMode = 'insight'; // 'game' (polished gameplay) or 'insight' (AI observation overlay)
  }

  get showSensors() {
    return this.aiViewMode === 'insight';
  }

  set showSensors(val) {
    this.aiViewMode = val ? 'insight' : 'game';
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(simulation, sensorData = null) {
    const ctx = this.ctx;
    const rocket = simulation.rocket;
    const arena = simulation.arena;

    // Apply screen shake
    ctx.save();
    ctx.translate(this.vfx.shakeOffsetX, this.vfx.shakeOffsetY);

    // 1. Clear & Background
    this.vfx.renderBackground(ctx, simulation.ticks);

    // 2. Arena Boundary & Grid
    this.renderArena(ctx, arena, simulation.ticks);

    // 2b. Adaptive Director Warning / Telegraph Overlay (if charging an attack)
    if (simulation.director && simulation.director.telegraphTimer > 0) {
      this.renderDirectorTelegraph(ctx, arena, simulation.director, simulation.ticks);
    }

    // 3. AI Insight Overlay (strictly active when in 'insight' view mode)
    if (this.aiViewMode === 'insight' && sensorData && rocket.alive) {
      this.renderAIInsight(ctx, rocket, arena, sensorData, simulation.ticks);
    }

    // 4. Particle System
    simulation.particles.render(ctx);

    // 5. Threats (Meteors & Debris)
    for (let i = 0; i < simulation.threats.length; i++) {
      this.renderThreat(ctx, simulation.threats[i]);
    }

    // 6. Rocket
    if (rocket.alive || rocket.shields > 0) {
      this.renderRocket(ctx, rocket, simulation.ticks);
    }

    // 7. Initial Grace Period or Wave Notifications
    if (simulation.ticks < simulation.spawner.gracePeriodTicks) {
      this.renderGraceOverlay(ctx, simulation);
    }

    // 8. Screen Flash / Post-effects
    this.vfx.renderPostEffects(ctx);

    ctx.restore();

    // Update VFX animations
    this.vfx.update(rocket.vel);
  }

  renderArena(ctx, arena, ticks) {
    ctx.save();

    // Subtle arena grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = arena.minX; x <= arena.maxX; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, arena.minY);
      ctx.lineTo(x, arena.maxY);
      ctx.stroke();
    }
    for (let y = arena.minY; y <= arena.maxY; y += step) {
      ctx.beginPath();
      ctx.moveTo(arena.minX, y);
      ctx.lineTo(arena.maxX, y);
      ctx.stroke();
    }

    // Danger zone perimeter pulse
    const pulse = 0.5 + 0.5 * Math.sin(ticks * 0.05);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + pulse * 0.08})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      arena.minX,
      arena.minY,
      arena.playWidth,
      arena.playHeight
    );

    // High-precision corner brackets
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    const bLen = 16;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(arena.minX, arena.minY + bLen);
    ctx.lineTo(arena.minX, arena.minY);
    ctx.lineTo(arena.minX + bLen, arena.minY);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(arena.maxX - bLen, arena.minY);
    ctx.lineTo(arena.maxX, arena.minY);
    ctx.lineTo(arena.maxX, arena.minY + bLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(arena.minX, arena.maxY - bLen);
    ctx.lineTo(arena.minX, arena.maxY);
    ctx.lineTo(arena.minX + bLen, arena.maxY);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(arena.maxX - bLen, arena.maxY);
    ctx.lineTo(arena.maxX, arena.maxY);
    ctx.lineTo(arena.maxX, arena.maxY - bLen);
    ctx.stroke();

    ctx.restore();
  }

  renderThreat(ctx, threat) {
    ctx.save();
    ctx.translate(threat.pos.x, threat.pos.y);
    ctx.rotate(threat.angle);

    // Hazard rim glow
    ctx.shadowColor = threat.baseColor;
    ctx.shadowBlur = 10;

    // Procedural craggy body
    ctx.fillStyle = '#111528';
    ctx.strokeStyle = threat.baseColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    const verts = threat.vertices;
    if (verts && verts.length > 0) {
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, threat.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Internal surface crater
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(threat.radius * 0.25, -threat.radius * 0.2, threat.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Core glow dot
    ctx.fillStyle = threat.baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderRocket(ctx, rocket, ticks) {
    ctx.save();
    ctx.translate(rocket.pos.x, rocket.pos.y);
    ctx.rotate(rocket.heading);

    // Invulnerability flashing
    if (rocket.invulnerableTimer > 0 && Math.floor(ticks / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Engine Thrust Flame
    const isThrusting = rocket.throttle.magSq() > 0.05;
    if (isThrusting) {
      const flameLen = 14 + Math.random() * 8 * rocket.throttle.mag();
      const grad = ctx.createLinearGradient(0, 0, -flameLen, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, '#e4e4e7');
      grad.addColorStop(0.75, '#f59e0b');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - flameLen, 0);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Rocket Hull
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 6;

    // Main fuselage
    ctx.fillStyle = '#141417';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(16, 0);       // Nose
    ctx.lineTo(-10, -11);    // Left wingtip
    ctx.lineTo(-6, -4);      // Left engine mount
    ctx.lineTo(-8, 0);       // Center thruster exhaust
    ctx.lineTo(-6, 4);       // Right engine mount
    ctx.lineTo(-10, 11);     // Right wingtip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing accents (Subtle titanium silver)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-9, -9);
    ctx.moveTo(-2, 5);
    ctx.lineTo(-9, 9);
    ctx.stroke();

    // Clean White Cockpit Canopy
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(3, 0, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shield bubble if recently hit or shielded
    if (rocket.invulnerableTimer > 0) {
      const shieldAlpha = 0.3 + 0.3 * Math.sin(ticks * 0.3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${shieldAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, rocket.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * AI Insight Visibility Mode:
   * Visualizes the controller's exact inputs (8-ray radar, nearest hazard vector,
   * 180px sensory horizon, boundary clearances) and resultant chosen throttle action vector.
   */
  renderAIInsight(ctx, rocket, arena, sensorData, ticks) {
    if (!sensorData) return;

    ctx.save();
    const rX = rocket.pos.x;
    const rY = rocket.pos.y;

    // 1. Sensory Horizon Circle (180px max radar inspection limit)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(rX, rY, 180, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('180px SENSORY HORIZON', rX - 60, rY - 186);

    // 2. 8 Directional Radar Rays
    if (sensorData.radarDistances) {
      const angles = 8;
      for (let i = 0; i < angles; i++) {
        const theta = (i / angles) * Math.PI * 2;
        const distNorm = sensorData.radarDistances[i]; // [0, 1]
        const rayMaxRange = 180;
        const rayLen = distNorm * rayMaxRange;

        let strokeStyle, fillStyle;
        if (distNorm < 0.3) {
          strokeStyle = 'rgba(239, 68, 68, 0.95)'; // Imminent danger - crimson
          fillStyle = '#ef4444';
        } else if (distNorm < 0.65) {
          strokeStyle = 'rgba(245, 158, 11, 0.85)'; // Caution - warm amber
          fillStyle = '#f59e0b';
        } else {
          strokeStyle = 'rgba(255, 255, 255, 0.35)'; // Clear - silver white
          fillStyle = '#ffffff';
        }

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = distNorm < 0.3 ? 2 : 1;
        ctx.setLineDash([3, 3]);

        const endX = rX + Math.cos(theta) * rayLen;
        const endY = rY + Math.sin(theta) * rayLen;

        ctx.beginPath();
        ctx.moveTo(rX, rY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Contact node at ray tip if an obstacle interrupts it
        if (distNorm < 0.98) {
          ctx.fillStyle = fillStyle;
          ctx.beginPath();
          ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.setLineDash([]);

    // 3. Nearest Threat Vector & Intercept Target
    if (sensorData.nearestThreat) {
      const nt = sensorData.nearestThreat;
      // Danger connection line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rX, rY);
      ctx.lineTo(nt.x, nt.y);
      ctx.stroke();

      // Threat target halo
      const pulse = 1 + 0.15 * Math.sin(ticks * 0.15);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nt.x, nt.y, (nt.radius + 6) * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Distance tag
      ctx.fillStyle = '#ef4444';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`PRIMARY HAZARD (${Math.round(nt.dist)}px)`, nt.x + 12, nt.y - 8);
    }

    // 4. Action / Chosen Movement Throttle Vector
    const tx = rocket.throttle.x;
    const ty = rocket.throttle.y;
    const throttleMag = Math.hypot(tx, ty);

    if (throttleMag > 0.05) {
      const arrowLen = Math.min(50, throttleMag * 45);
      const angle = Math.atan2(ty, tx);
      const aX = rX + Math.cos(angle) * arrowLen;
      const aY = rY + Math.sin(angle) * arrowLen;

      // Glow line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(rX, rY);
      ctx.lineTo(aX, aY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Arrowhead
      const headLen = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(aX, aY);
      ctx.lineTo(
        aX - headLen * Math.cos(angle - Math.PI / 6),
        aY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        aX - headLen * Math.cos(angle + Math.PI / 6),
        aY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Action label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`THROTTLE: [${tx.toFixed(2)}, ${ty.toFixed(2)}]`, aX + 8, aY + 4);
    }

    ctx.restore();
  }

  /**
   * Renders Adaptive Arena Director telegraph warnings and entry vectors
   */
  renderDirectorTelegraph(ctx, arena, director, ticks) {
    if (!director || director.telegraphTimer <= 0) return;

    ctx.save();
    const visuals = director.telegraphVisuals;
    const pulse = 0.5 + 0.5 * Math.sin(ticks * 0.2);
    const remainingSec = (director.telegraphTimer / 60).toFixed(1);

    // Flashing warning perimeter on the side under pressure
    if (visuals && visuals.side) {
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (visuals.side === 'left') {
        ctx.moveTo(arena.minX + 2, arena.minY);
        ctx.lineTo(arena.minX + 2, arena.maxY);
      } else if (visuals.side === 'right') {
        ctx.moveTo(arena.maxX - 2, arena.minY);
        ctx.lineTo(arena.maxX - 2, arena.maxY);
      } else if (visuals.side === 'top') {
        ctx.moveTo(arena.minX, arena.minY + 2);
        ctx.lineTo(arena.maxX, arena.minY + 2);
      } else if (visuals.side === 'bottom') {
        ctx.moveTo(arena.minX, arena.maxY - 2);
        ctx.lineTo(arena.maxX, arena.maxY - 2);
      }
      ctx.stroke();
    }

    // Top warning banner on canvas
    ctx.fillStyle = `rgba(18, 18, 22, 0.92)`;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    const bannerW = 480;
    const bannerH = 34;
    const bX = (this.width - bannerW) / 2;
    const bY = 22;
    ctx.fillRect(bX, bY, bannerW, bannerH);
    ctx.strokeRect(bX, bY, bannerW, bannerH);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `⚠ ADAPTIVE DIRECTOR: ${director.activeWarningMessage.toUpperCase()} (${remainingSec}s) ⚠`,
      this.width / 2,
      bY + 21
    );

    ctx.restore();
  }

  // Alias for backward compatibility
  renderSensors(ctx, rocket, sensorData) {
    this.renderAIInsight(ctx, rocket, null, sensorData, 0);
  }

  renderGraceOverlay(ctx, simulation) {
    const remaining = Math.ceil(
      (simulation.spawner.gracePeriodTicks - simulation.ticks) / 60
    );
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `ARENA READY // GRACE PERIOD: ${remaining}s`,
      this.width / 2,
      40
    );
    ctx.restore();
  }
}
