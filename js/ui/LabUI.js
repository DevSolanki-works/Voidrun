/**
 * LabUI.js
 * Controls and displays for the AI / Evolution Lab.
 * Manages training execution loops, parameter tuning, metric cards,
 * chart rendering, and empirical baseline benchmarking.
 */

import { ChartRenderer } from './ChartRenderer.js';
import { BaselineEvaluator, RandomController, HeuristicRuleBasedController } from '../ai/Baselines.js';
import { AgentController } from '../ai/AgentController.js';
import { NeuralNetwork } from '../ai/NeuralNetwork.js';
import { Storage } from '../utils/Storage.js';
import { CHECKPOINTS, PRETRAINED_GENOME, PRETRAINED_METADATA } from '../ai/PretrainedAgent.js';
import { sound } from '../audio/sound.js';

export class LabUI {
  constructor(ga, elements, onWatchBest, onTrainingComplete = null) {
    this.ga = ga;
    this.el = elements;
    this.onWatchBest = onWatchBest;
    this.onTrainingComplete = onTrainingComplete;
    this.targetGenerations = 25;
    this.trainingStartGeneration = 0;
    this.trainingEndGeneration = 0;

    this.isRunning = false;
    this.speedMode = 'fast'; // '1x', '5x', 'fast', 'max'
    this.chart = new ChartRenderer(this.el.chartCanvas);

    this.bindEvents();
    if (this.el.sliderMutation) {
      this.el.sliderMutation.value = this.ga.mutationRate;
      if (this.el.valMutation) this.el.valMutation.textContent = `${Math.round(this.ga.mutationRate * 100)}%`;
    }
    if (this.el.sliderElitism) {
      this.el.sliderElitism.value = this.ga.elitismCount;
      if (this.el.valElitism) this.el.valElitism.textContent = this.ga.elitismCount;
    }
    if (this.el.inputTargetGens) {
      this.el.inputTargetGens.value = this.targetGenerations;
    }
    this.updateMetrics();
    this.updateGuidedProgress();
  }

  bindEvents() {
    // Custom target generation numeric input
    if (this.el.inputTargetGens) {
      this.el.inputTargetGens.onchange = (e) => {
        let val = parseInt(e.target.value) || 25;
        val = Math.max(1, Math.min(1000, val));
        e.target.value = val;
        this.targetGenerations = val;
        this.trainingStartGeneration = this.ga.generation;
        this.trainingEndGeneration = this.ga.generation + this.targetGenerations;
        this.updateGuidedProgress();
      };
      this.el.inputTargetGens.oninput = (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 1) {
          this.targetGenerations = Math.min(1000, val);
          this.trainingStartGeneration = this.ga.generation;
          this.trainingEndGeneration = this.ga.generation + this.targetGenerations;
          this.updateGuidedProgress();
        }
      };
    }

    // Quick stepper adjustment buttons (+10, +25, +50, +100)
    if (this.el.genStepBtns) {
      this.el.genStepBtns.forEach((btn) => {
        btn.onclick = () => {
          sound.playButtonClick();
          const step = parseInt(btn.dataset.step) || 10;
          let current = parseInt(this.el.inputTargetGens?.value) || this.targetGenerations || 25;
          current = Math.min(1000, current + step);
          if (this.el.inputTargetGens) this.el.inputTargetGens.value = current;
          this.targetGenerations = current;
          this.trainingStartGeneration = this.ga.generation;
          this.trainingEndGeneration = this.ga.generation + this.targetGenerations;
          this.updateGuidedProgress();
        };
      });
    }

    // Pretrained checkpoint buttons in Lab (Gen 100, 500, 1000)
    if (this.el.labChkBtns) {
      this.el.labChkBtns.forEach((btn) => {
        btn.onclick = () => {
          sound.playButtonClick();
          const gen = parseInt(btn.dataset.gen);
          this.loadCheckpoint(gen);
        };
      });
    }

    // Start / Pause Training
    if (this.el.btnTrainToggle) {
      this.el.btnTrainToggle.onclick = () => {
        sound.playButtonClick();
        this.toggleTraining();
      };
    }

    // Step 1 Generation
    if (this.el.btnStepGen) {
      this.el.btnStepGen.onclick = () => {
        sound.playButtonClick();
        if (!this.isRunning) {
          this.runSingleGeneration();
        }
      };
    }

    // Speed selector radio/buttons
    if (this.el.speedBtns) {
      this.el.speedBtns.forEach((btn) => {
        btn.onclick = () => {
          sound.playButtonClick();
          this.el.speedBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.speedMode = btn.dataset.speed;

          // Sync with settings storage
          const s = Storage.loadSettings();
          s.trainingSpeed = this.speedMode;
          Storage.saveSettings(s);
        };
      });
    }

    // Reset Training with confirmation
    if (this.el.btnResetTrain) {
      this.el.btnResetTrain.onclick = () => {
        sound.playButtonClick();
        const ok = confirm(
          'Are you sure you want to reset training? This will reinitialize the population to generation 0.'
        );
        if (ok) {
          this.stopTraining();
          this.ga.reset();
          this.updateMetrics();
          this.chart.render(this.ga.history);
          this.updateGuidedProgress();
        }
      };
    }

    // Save Best to LocalStorage
    if (this.el.btnSaveBest) {
      this.el.btnSaveBest.onclick = () => {
        sound.playButtonClick();
        if (this.ga.bestGenome) {
          Storage.saveBestAgent(
            Array.from(this.ga.bestGenome),
            this.ga.bestFitnessAllTime,
            this.ga.generation
          );
          alert(`Best pilot saved. Survival: ${this.ga.bestSurvivalAllTime.toFixed(1)} seconds.`);
          this.updateSaveBadge();
        } else {
          alert('No trained agent available yet. Train for at least one generation.');
        }
      };
    }

    // Load Pre-trained Agent
    if (this.el.btnLoadPretrained) {
      this.el.btnLoadPretrained.onclick = () => {
        sound.playButtonClick();
        this.loadCheckpoint(1000);
      };
    }

    // Watch Best Agent
    if (this.el.btnWatchBest) {
      this.el.btnWatchBest.onclick = () => {
        sound.playButtonClick();
        if (this.onWatchBest) {
          let genome = this.ga.bestGenome;
          let label = `EVOLVED AGENT (GEN ${this.ga.generation})`;
          if (!genome) {
            const saved = Storage.loadBestAgent();
            if (saved) {
              genome = new Float32Array(saved.genome);
              label = `SAVED AGENT (GEN ${saved.generation})`;
            } else {
              genome = new Float32Array(PRETRAINED_GENOME);
              label = `PRE-TRAINED BENCHMARK AGENT`;
            }
          }
          this.onWatchBest(genome, label);
        }
      };
    }

    // Run Baseline Comparison
    if (this.el.btnRunBenchmark) {
      this.el.btnRunBenchmark.onclick = () => {
        sound.playButtonClick();
        this.runEmpiricalBenchmark();
      };
    }

    // Parameters sliders
    if (this.el.sliderMutation) {
      this.el.sliderMutation.oninput = (e) => {
        const val = parseFloat(e.target.value);
        this.ga.mutationRate = val;
        if (this.el.valMutation) this.el.valMutation.textContent = `${Math.round(val * 100)}%`;
        const s = Storage.loadSettings();
        s.mutationRate = val;
        Storage.saveSettings(s);
      };
    }
    if (this.el.sliderElitism) {
      this.el.sliderElitism.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.ga.elitismCount = val;
        if (this.el.valElitism) this.el.valElitism.textContent = val;
        const s = Storage.loadSettings();
        s.elitismCount = val;
        Storage.saveSettings(s);
      };
    }
  }

  loadCheckpoint(genNumber) {
    const key = `gen${genNumber}`;
    const chk = CHECKPOINTS[key];
    if (!chk) return;

    this.ga.bestGenome = new Float32Array(chk.weights);
    this.ga.bestFitnessAllTime = chk.bestFitness;
    this.ga.bestSurvivalAllTime = chk.bestSurvivalSec;
    this.ga.generation = chk.generation;

    // Apply to elite 0 of population
    if (this.ga.population.length > 0) {
      this.ga.population[0].network.setWeights(this.ga.bestGenome);
      this.ga.population[0].fitness = chk.bestFitness;
      this.ga.population[0].survivalTime = chk.bestSurvivalSec;
    }

    Storage.saveBestAgent(
      chk.weights,
      chk.bestFitness,
      chk.generation,
      chk
    );

    this.updateMetrics();
    this.updateSaveBadge();
    this.updateGuidedProgress();

    const trainingStatus = document.getElementById('training-status');
    if (trainingStatus) {
      trainingStatus.textContent = `Pre-trained Gen ${genNumber} model loaded! Fitness: ${chk.bestFitness} | Best Survival: ${chk.bestSurvivalSec}s.`;
    }
  }

  loadPretrainedGenome() {
    this.loadCheckpoint(1000);
  }

  toggleTraining() {
    if (this.isRunning) {
      this.stopTraining();
    } else {
      this.startTraining();
    }
  }

  startTraining() {
    if (this.el.inputTargetGens) {
      this.targetGenerations = Math.max(1, Math.min(1000, parseInt(this.el.inputTargetGens.value) || 25));
    }
    this.trainingStartGeneration = this.ga.generation;
    this.trainingEndGeneration = this.trainingStartGeneration + this.targetGenerations;

    this.isRunning = true;
    if (this.el.trainingChartPanel) this.el.trainingChartPanel.style.display = 'block';
    if (this.el.trainingCompletePanel) this.el.trainingCompletePanel.style.display = 'none';
    if (this.el.btnTrainToggle) {
      this.el.btnTrainToggle.textContent = 'Pause training';
      this.el.btnTrainToggle.classList.add('btn-danger');
    }
    if (this.el.trainingStatus) this.el.trainingStatus.textContent = `Evolving population towards target generation ${this.trainingEndGeneration}…`;
    if (this.el.inputTargetGens) this.el.inputTargetGens.disabled = true;
    if (this.el.genStepBtns) this.el.genStepBtns.forEach((b) => { b.disabled = true; });
    this.loopTraining();
  }

  stopTraining() {
    this.isRunning = false;
    if (this.el.btnTrainToggle) {
      this.el.btnTrainToggle.textContent = this.ga.generation > 0 ? 'Train more' : 'Start training';
      this.el.btnTrainToggle.classList.remove('btn-danger');
    }
    if (this.el.inputTargetGens) this.el.inputTargetGens.disabled = false;
    if (this.el.genStepBtns) this.el.genStepBtns.forEach((b) => { b.disabled = false; });
  }

  runSingleGeneration() {
    const record = this.ga.evaluateGeneration();
    this.ga.evolveNextGeneration();
    this.updateMetrics(record);
    this.chart.render(this.ga.history);
  }

  loopTraining() {
    if (!this.isRunning) return;

    // Execute generation step based on speed
    const batchSize = this.speedMode === 'max' ? 4 : this.speedMode === 'fast' ? 2 : this.speedMode === '5x' ? 2 : 1;
    for (let b = 0; b < batchSize; b++) {
      if (!this.isRunning || this.ga.generation >= this.trainingEndGeneration) break;
      const record = this.ga.evaluateGeneration();
      this.ga.evolveNextGeneration();
      this.updateMetrics(record);
    }

    this.chart.render(this.ga.history);
    this.updateGuidedProgress();

    if (this.ga.generation >= this.trainingEndGeneration) {
      this.stopTraining();
      if (this.el.trainingProgressLabel) this.el.trainingProgressLabel.textContent = 'Training complete';
      if (this.el.trainingStatus) this.el.trainingStatus.textContent = 'Review the graph, then choose when the AI should play.';
      if (this.el.trainingChartPanel) this.el.trainingChartPanel.style.display = 'block';
      if (this.el.trainingCompletePanel) this.el.trainingCompletePanel.style.display = 'flex';
      this.chart.render(this.ga.history);
      if (this.onTrainingComplete) this.onTrainingComplete();
      return;
    }

    // Frame scheduling
    const delay = this.speedMode === '1x' ? 300 : this.speedMode === '5x' ? 80 : 0;
    if (delay > 0) {
      setTimeout(() => {
        if (this.isRunning) requestAnimationFrame(() => this.loopTraining());
      }, delay);
    } else {
      requestAnimationFrame(() => this.loopTraining());
    }
  }

  updateMetrics(latestRecord = null) {
    if (this.el.metricGen) {
      this.el.metricGen.textContent = this.ga.generation;
    }
    if (this.el.metricBestFit) {
      this.el.metricBestFit.textContent = this.ga.bestFitnessAllTime.toFixed(1);
    }
    if (this.el.metricAvgFit) {
      const avg = latestRecord
        ? latestRecord.avgFitness.toFixed(1)
        : this.ga.history.length > 0
        ? this.ga.history[this.ga.history.length - 1].avgFitness.toFixed(1)
        : '0.0';
      this.el.metricAvgFit.textContent = avg;
    }
    if (this.el.metricBestSurvival) {
      this.el.metricBestSurvival.textContent = `${this.ga.bestSurvivalAllTime.toFixed(2)}s`;
    }
    if (this.el.metricPlayerBest) {
      const record = Storage.loadHighScore().survivalTime || 0;
      this.el.metricPlayerBest.textContent = `${Number(record).toFixed(2)}s`;
    }
    const playerBest = Number(Storage.loadHighScore().survivalTime) || 0;
    if (this.el.trainingPlayerBest) this.el.trainingPlayerBest.textContent = `${playerBest.toFixed(1)}s`;
    if (this.el.trainingAIBest) this.el.trainingAIBest.textContent = `${this.ga.bestSurvivalAllTime.toFixed(1)}s`;
    if (this.el.metricPop) {
      this.el.metricPop.textContent = `${this.ga.populationSize} pilots`;
    }

    this.updateSaveBadge();
    this.updateGuidedProgress();
  }

  updateGuidedProgress() {
    const completed = Math.max(0, this.ga.generation - this.trainingStartGeneration);
    const total = this.targetGenerations;
    if (this.el.trainingGenerationCount) {
      this.el.trainingGenerationCount.textContent = `${Math.min(completed, total)} / ${total} generations`;
    }
    if (this.el.trainingProgressBar) {
      this.el.trainingProgressBar.style.width = `${Math.min(100, (completed / Math.max(1, total)) * 100)}%`;
    }
    if (this.el.trainingProgressLabel && this.isRunning) {
      this.el.trainingProgressLabel.textContent = `Training · generation ${Math.min(completed, total)} of ${total}`;
    } else if (this.el.trainingProgressLabel && !this.isRunning && this.ga.generation === 0) {
      this.el.trainingProgressLabel.textContent = 'Ready to train';
    }
  }

  updateSaveBadge() {
    if (!this.el.savedBadge) return;
    const hasSaved = Storage.hasBestAgent();
    if (hasSaved) {
      this.el.savedBadge.textContent = 'Your best pilot is saved';
      this.el.savedBadge.className = 'status-badge badge-ready';
    } else {
      this.el.savedBadge.textContent = 'Demo pilot ready';
      this.el.savedBadge.className = 'status-badge badge-ready';
    }
  }

  /**
   * Benchmarks Random vs Rule-Based vs Evolved over 5 deterministic test seeds
   */
  runEmpiricalBenchmark() {
    if (!this.el.benchmarkContainer) return;

    this.el.benchmarkContainer.innerHTML = `
      <div class="benchmark-loading">
        <span class="spinner"></span> Comparing pilots on the same five hazard patterns...
      </div>
    `;

    setTimeout(() => {
      // 1. Prepare Evolved Controller
      let evolvedNet = new NeuralNetwork(20, 16, 4);
      if (this.ga.bestGenome) {
        evolvedNet.setWeights(this.ga.bestGenome);
      } else {
        const saved = Storage.loadBestAgent();
        if (saved) {
          evolvedNet.setWeights(new Float32Array(saved.genome));
        } else {
          evolvedNet.setWeights(new Float32Array(PRETRAINED_GENOME));
        }
      }

      const policies = [
        { name: '1. Random Controller', controller: new RandomController() },
        { name: '2. Rule-Based (Potential Fields)', controller: new HeuristicRuleBasedController() },
        { name: '3. Evolved GA Neuro-Controller', controller: new AgentController(evolvedNet) }
      ];

      const testSeeds = [9001, 9002, 9003, 9004, 9005];
      const benchmarkResults = BaselineEvaluator.runBenchmark(policies, testSeeds);

      // Render table
      let tableHtml = `
        <table class="benchmark-table">
          <thead>
            <tr>
              <th>Controller Policy</th>
              <th>Avg Survival Time</th>
              <th>Avg Score</th>
              <th>Near-Miss Dodges</th>
              <th>Wall Collisions</th>
              <th>Evaluation Trials</th>
            </tr>
          </thead>
          <tbody>
      `;

      benchmarkResults.forEach((res, idx) => {
        const isBest = idx === 2; // Evolved agent highlight
        tableHtml += `
          <tr class="${isBest ? 'row-highlight' : ''}">
            <td><strong>${res.name}</strong></td>
            <td><span class="stat-num">${res.avgSurvival}s</span></td>
            <td>${res.avgScore.toLocaleString()}</td>
            <td>${res.avgNearMisses}</td>
            <td>${res.avgWallCollisions}</td>
            <td>${res.trials} hazard patterns</td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
        <p class="benchmark-caption">
          All pilots face the same five repeatable hazard patterns. Compare the measured survival and score values to see how the evolved pilot performs; results may vary with training settings.
        </p>
      `;

      this.el.benchmarkContainer.innerHTML = tableHtml;
    }, 50);
  }
}
