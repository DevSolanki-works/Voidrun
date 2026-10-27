/**
 * ChartRenderer.js
 * Zero-dependency Canvas 2D line graph renderer.
 * Visualizes generation-by-generation evolution metrics: Best Fitness and Average Fitness curves.
 */

export class ChartRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.padding = { top: 25, right: 30, bottom: 35, left: 55 };
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Renders the evolution history
   * @param {Array<{ gen: number, bestFitness: number, avgFitness: number }>} history
   */
  render(history) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background panel
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(0, 0, w, h);

    if (!history || history.length === 0) {
      ctx.fillStyle = 'rgba(161, 161, 170, 0.4)';
      ctx.font = '13px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING EVOLUTION DATA...', w / 2, h / 2);
      return;
    }

    const p = this.padding;
    const plotW = w - p.left - p.right;
    const plotH = h - p.top - p.bottom;

    // Compute bounds
    let maxFitness = 100;
    for (const d of history) {
      if (d.bestFitness > maxFitness) maxFitness = d.bestFitness;
    }
    // Pad max slightly
    maxFitness *= 1.15;

    const xCount = Math.max(1, history.length - 1);

    const getX = (idx) => p.left + (idx / xCount) * plotW;
    const getY = (val) => p.top + plotH - (val / maxFitness) * plotH;

    // 1. Gridlines & Axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(161, 161, 170, 0.7)';
    ctx.font = '11px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'right';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = (maxFitness / yTicks) * i;
      const y = getY(val);
      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(p.left + plotW, y);
      ctx.stroke();
      ctx.fillText(Math.round(val).toString(), p.left - 8, y + 4);
    }

    // X Axis ticks
    ctx.textAlign = 'center';
    const xStep = Math.max(1, Math.floor(history.length / 5));
    for (let i = 0; i < history.length; i += xStep) {
      const x = getX(i);
      ctx.fillText(`G${history[i].gen}`, x, h - p.bottom + 18);
    }
    // Always show latest generation
    if ((history.length - 1) % xStep !== 0) {
      const lastIdx = history.length - 1;
      ctx.fillText(`G${history[lastIdx].gen}`, getX(lastIdx), h - p.bottom + 18);
    }

    // 2. Average Fitness Curve (Subtle Slate/Silver, dashed)
    if (history.length > 1) {
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].avgFitness));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(getX(i), getY(history[i].avgFitness));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Best Fitness Curve (Crisp Pure White with subtle gradient fill)
    if (history.length > 1) {
      // Area fill
      const grad = ctx.createLinearGradient(0, p.top, 0, p.top + plotH);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].bestFitness));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(getX(i), getY(history[i].bestFitness));
      }
      ctx.lineTo(getX(history.length - 1), p.top + plotH);
      ctx.lineTo(getX(0), p.top + plotH);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(history[0].bestFitness));
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(getX(i), getY(history[i].bestFitness));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Data point nodes
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < history.length; i++) {
        ctx.beginPath();
        ctx.arc(getX(i), getY(history[i].bestFitness), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Single point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(getX(0), getY(history[0].bestFitness), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Legend
    ctx.font = '11px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'left';

    // Best Fitness Legend
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w - 180, 10, 12, 3);
    ctx.fillText('Best Fitness', w - 162, 14);

    // Avg Fitness Legend
    ctx.fillStyle = '#71717a';
    ctx.fillRect(w - 85, 10, 12, 3);
    ctx.fillText('Avg Fitness', w - 67, 14);
  }
}
