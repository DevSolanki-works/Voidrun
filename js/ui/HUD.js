/**
 * HUD.js
 * Heads-Up Display and overlay manager for VOIDRUN.
 * Updates telemetry, score, shields, wave indicators, and handles game over / pause modals.
 */

import { sound } from '../audio/sound.js';

export class HUD {
  constructor(domElements) {
    this.el = domElements;
  }

  update(simulation, mode = 'human', extraInfo = '', aiGen = '', aiDesc = '') {
    // Format survival timer MM:SS.SS
    const totalSeconds = simulation.ticks / 60;
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2);
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;

    if (this.el.timeDisplay) {
      this.el.timeDisplay.textContent = formattedTime;
    }
    if (this.el.scoreDisplay) {
      this.el.scoreDisplay.textContent = simulation.score.toLocaleString();
    }
    if (this.el.waveDisplay) {
      this.el.waveDisplay.textContent = `WAVE ${simulation.spawner.wave}`;
    }

    // Shields display
    if (this.el.shieldsContainer) {
      const shields = simulation.rocket.shields;
      const max = simulation.rocket.maxShields;
      let html = '';
      for (let i = 0; i < max; i++) {
        const active = i < shields ? 'active' : 'depleted';
        html += `<span class="shield-pip ${active}"></span>`;
      }
      this.el.shieldsContainer.innerHTML = html;
    }

    // Mode badge & AI generation displays (single prominent display of current generation)
    if (this.el.modeBadge) {
      if (mode === 'human') {
        this.el.modeBadge.textContent = 'YOU';
        this.el.modeBadge.className = 'hud-badge badge-human';
      } else if (mode === 'ai-watch') {
        let genStr = 'GEN 1000';
        if (aiGen) {
          const clean = String(aiGen).trim();
          genStr = clean.toUpperCase().includes('GEN') ? clean.toUpperCase() : `GEN ${clean}`;
        } else if (extraInfo) {
          const match = String(extraInfo).match(/GEN\s*\d+/i);
          if (match) {
            genStr = match[0].toUpperCase();
          } else {
            genStr = extraInfo;
          }
        }
        this.el.modeBadge.textContent = `AI PILOT • ${genStr}`;
        this.el.modeBadge.className = 'hud-badge badge-ai';
      }
    }

    // Safely hide legacy generation elements if present in DOM
    if (this.el.aiGenItem) {
      this.el.aiGenItem.style.display = 'none';
    }
    if (this.el.aiBanner) {
      this.el.aiBanner.style.display = 'none';
    }

    // Adaptive Director Status Indicator
    if (this.el.directorBanner) {
      if (simulation.director && simulation.director.activeWarningMessage) {
        this.el.directorBanner.textContent = `⚠ ${simulation.director.activeWarningMessage.toUpperCase()}`;
        this.el.directorBanner.style.display = 'block';
      } else {
        this.el.directorBanner.style.display = 'none';
      }
    }
  }

  updateAIInsightPanel(sensorData, rocket, isVisible = true) {
    if (!this.el.insightPanel) return;

    if (!isVisible || !sensorData) {
      this.el.insightPanel.style.display = 'none';
      return;
    }

    this.el.insightPanel.style.display = 'flex';

    // Inputs update
    if (sensorData.inputs && sensorData.inputs.length >= 20) {
      const inp = sensorData.inputs;
      if (this.el.inPos) this.el.inPos.textContent = `(${inp[0].toFixed(2)}, ${inp[1].toFixed(2)})`;
      if (this.el.inVel) this.el.inVel.textContent = `(${inp[2].toFixed(2)}, ${inp[3].toFixed(2)})`;
      if (this.el.inWalls) {
        this.el.inWalls.textContent = `L:${Math.round(inp[4]*100)}% R:${Math.round(inp[5]*100)}% T:${Math.round(inp[6]*100)}% B:${Math.round(inp[7]*100)}%`;
      }

      // 8 Radar Ray Meters
      if (this.el.radarMeters && sensorData.radarDistances) {
        let html = '';
        const labels = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
        for (let i = 0; i < 8; i++) {
          const d = sensorData.radarDistances[i];
          const pct = Math.round(d * 100);
          const colorClass = d < 0.3 ? 'danger' : d < 0.65 ? 'warning' : 'safe';
          html += `
            <div class="mini-bar-col">
              <span class="mini-bar-lbl">${labels[i]}</span>
              <div class="mini-bar-track">
                <div class="mini-bar-fill ${colorClass}" style="height: ${pct}%"></div>
              </div>
            </div>
          `;
        }
        this.el.radarMeters.innerHTML = html;
      }
    }

    // Nearest Threat
    if (this.el.inThreat) {
      if (sensorData.nearestThreat) {
        const nt = sensorData.nearestThreat;
        this.el.inThreat.textContent = `${Math.round(nt.dist)}px [RelV: ${sensorData.inputs[19].toFixed(2)}]`;
      } else {
        this.el.inThreat.textContent = 'None detected (<350px)';
      }
    }

    // Outputs / Motor Activations
    if (sensorData.outputs && sensorData.outputs.length >= 4) {
      const out = sensorData.outputs;
      if (this.el.outLeft) this.el.outLeft.style.width = `${Math.round(out[0] * 100)}%`;
      if (this.el.outRight) this.el.outRight.style.width = `${Math.round(out[1] * 100)}%`;
      if (this.el.outUp) this.el.outUp.style.width = `${Math.round(out[2] * 100)}%`;
      if (this.el.outDown) this.el.outDown.style.width = `${Math.round(out[3] * 100)}%`;

      if (this.el.outAction) {
        const tx = out[1] - out[0];
        const ty = out[3] - out[2];
        this.el.outAction.textContent = `Throttle: (${tx.toFixed(2)}, ${ty.toFixed(2)})`;
      }
    }
  }

  showGameOver(simulation, onReplay, onMenu, onSaveAgent = null) {
    if (!this.el.gameOverModal) return;

    const totalSeconds = (simulation.ticks / 60).toFixed(2);
    const m = simulation.rocket.metrics;

    if (this.el.goTime) this.el.goTime.textContent = `${totalSeconds}s`;
    if (this.el.goScore) this.el.goScore.textContent = simulation.score.toLocaleString();
    if (this.el.goWave) this.el.goWave.textContent = `Wave ${simulation.spawner.wave}`;
    if (this.el.goDodges) this.el.goDodges.textContent = m.nearMisses;
    if (this.el.goReason) this.el.goReason.textContent = simulation.gameOverReason || 'Hull Failure';

    // Show/hide save button if an AI agent is playable
    if (this.el.goSaveBtn) {
      if (onSaveAgent) {
        this.el.goSaveBtn.style.display = 'inline-flex';
        this.el.goSaveBtn.onclick = () => {
          sound.playButtonClick();
          onSaveAgent();
          this.el.goSaveBtn.textContent = 'SAVED TO BROWSER!';
          this.el.goSaveBtn.disabled = true;
        };
      } else {
        this.el.goSaveBtn.style.display = 'none';
      }
    }

    if (this.el.goReplayBtn) {
      this.el.goReplayBtn.onclick = () => {
        sound.playButtonClick();
        this.hideGameOver();
        onReplay();
      };
    }

    if (this.el.goMenuBtn) {
      this.el.goMenuBtn.onclick = () => {
        sound.playButtonClick();
        this.hideGameOver();
        onMenu();
      };
    }

    this.el.gameOverModal.classList.add('visible');
  }

  hideGameOver() {
    if (this.el.gameOverModal) {
      this.el.gameOverModal.classList.remove('visible');
    }
  }

  setPaused(isPaused) {
    if (this.el.pauseModal) {
      if (isPaused) {
        this.el.pauseModal.classList.add('visible');
      } else {
        this.el.pauseModal.classList.remove('visible');
      }
    }
  }
}
