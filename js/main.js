/**
 * main.js
 * Master application controller and screen router for VOIDRUN: Evasion Protocol.
 * Coordinates input handling, game loop, rendering, audio, settings, and AI visibility modes.
 */

import { GameSimulation } from './engine/GameSimulation.js';
import { Renderer } from './render/Renderer.js';
import { AgentController } from './ai/AgentController.js';
import { NeuralNetwork } from './ai/NeuralNetwork.js';
import { GeneticAlgorithm } from './ai/GeneticAlgorithm.js';
import { CHECKPOINTS, PRETRAINED_GENOME, PRETRAINED_METADATA } from './ai/PretrainedAgent.js';
import { Storage } from './utils/Storage.js';
import { HUD } from './ui/HUD.js';
import { LabUI } from './ui/LabUI.js';
import { HowItWorksModal } from './ui/HowItWorksModal.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { sound } from './audio/sound.js';

class App {
  constructor() {
    this.currentScreen = 'menu'; // 'menu', 'game', 'lab'
    this.gameMode = 'human';     // 'human' or 'ai-watch'
    this.aiPolicyLabel = 'MANUAL PILOT';
    this.sessionPhase = 'intro';
    this.aiGenerationsAtDemo = 0;

    // Load persisted settings
    this.settings = Storage.loadSettings();

    // Core Canvas & Rendering
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.sim = new GameSimulation({
      width: 800,
      height: 600,
      maxShields: 3,
      difficulty: this.settings.difficulty,
      adaptiveMode: this.settings.adaptiveArena
    });

    // AI & Controllers
    this.ga = new GeneticAlgorithm({
      populationSize: this.settings.populationSize,
      mutationRate: this.settings.mutationRate,
      elitismCount: this.settings.elitismCount,
      targetSurvivalTicks: Math.round(Storage.loadHighScore().survivalTime * 60)
    });
    this.watchController = null;

    // Apply initial settings to rendering and audio systems
    this.applySettings(this.settings);

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    this.isPaused = false;
    this.animationFrameId = null;

    this.initUI();
    this.initAudioHooks();
    this.bindInputs();
    this.updateTitleBadges();
  }

  applySettings(settings) {
    this.settings = settings;

    // Audio
    sound.setMute(!settings.soundEnabled);
    sound.setVolume(settings.volume);

    // Visuals
    this.renderer.vfx.setScreenShake(settings.screenShake);
    this.renderer.vfx.setFlash(settings.flashEffects);
    this.renderer.aiViewMode = settings.aiViewMode;

    // Simulation
    if (this.sim) {
      this.sim.setDifficulty(settings.difficulty);
      this.sim.setAdaptiveMode(settings.adaptiveArena);
    }

    // GA parameters (applied to future training generations)
    if (this.ga) {
      this.ga.populationSize = settings.populationSize;
      this.ga.mutationRate = settings.mutationRate;
      this.ga.elitismCount = settings.elitismCount;
    }

    // Lab training speed
    if (this.lab) {
      this.lab.speedMode = settings.trainingSpeed;
      if (this.lab.el.speedBtns) {
        this.lab.el.speedBtns.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.speed === settings.trainingSpeed);
        });
      }
    }

    // Update HUD view mode button display
    const btnViewMode = document.getElementById('btn-hud-viewmode');
    if (btnViewMode) {
      btnViewMode.textContent = settings.aiViewMode === 'insight' ? 'Game view' : 'Explain AI';
      btnViewMode.classList.toggle('insight-active', settings.aiViewMode === 'insight');
    }
  }

  initUI() {
    // DOM references for HUD
    const hudElements = {
      timeDisplay: document.getElementById('hud-time'),
      scoreDisplay: document.getElementById('hud-score'),
      waveDisplay: document.getElementById('hud-wave'),
      shieldsContainer: document.getElementById('hud-shields'),
      modeBadge: document.getElementById('hud-mode-badge'),
      directorBanner: document.getElementById('hud-director-banner'),
      gameOverModal: document.getElementById('modal-gameover'),
      pauseModal: document.getElementById('modal-pause'),
      goTime: document.getElementById('go-time'),
      goScore: document.getElementById('go-score'),
      goWave: document.getElementById('go-wave'),
      goDodges: document.getElementById('go-dodges'),
      goReason: document.getElementById('go-reason'),
      goReplayBtn: document.getElementById('btn-go-replay'),
      goMenuBtn: document.getElementById('btn-go-menu'),
      goSaveBtn: document.getElementById('btn-go-save-agent'),

      // AI Insight Telemetry Panel
      insightPanel: document.getElementById('ai-insight-panel'),
      inPos: document.getElementById('in-pos'),
      inVel: document.getElementById('in-vel'),
      inWalls: document.getElementById('in-walls'),
      inThreat: document.getElementById('in-threat'),
      radarMeters: document.getElementById('ai-radar-meters'),
      outLeft: document.getElementById('out-left'),
      outRight: document.getElementById('out-right'),
      outUp: document.getElementById('out-up'),
      outDown: document.getElementById('out-down'),
      outAction: document.getElementById('out-action')
    };
    this.hud = new HUD(hudElements);

    // DOM references for Lab
    const labElements = {
      chartCanvas: document.getElementById('chart-canvas'),
      btnTrainToggle: document.getElementById('btn-train-toggle'),
      btnStepGen: document.getElementById('btn-step-gen'),
      btnResetTrain: document.getElementById('btn-reset-train'),
      btnSaveBest: document.getElementById('btn-save-best'),
      btnLoadPretrained: document.getElementById('btn-load-pretrained'),
      btnWatchBest: document.getElementById('btn-watch-best'),
      btnRunBenchmark: document.getElementById('btn-run-benchmark'),
      speedBtns: document.querySelectorAll('.speed-btn'),
      inputTargetGens: document.getElementById('input-target-gens'),
      genStepBtns: document.querySelectorAll('.gen-step-btn'),
      labChkBtns: document.querySelectorAll('.lab-chk-btn'),
      trainingProgressLabel: document.getElementById('training-progress-label'),
      trainingGenerationCount: document.getElementById('training-generation-count'),
      trainingProgressBar: document.getElementById('training-progress-bar'),
      trainingStatus: document.getElementById('training-status'),
      trainingPlayerBest: document.getElementById('training-player-best'),
      trainingAIBest: document.getElementById('training-ai-best'),
      trainingChartPanel: document.getElementById('training-chart-panel'),
      trainingCompletePanel: document.getElementById('training-finished-panel'),
      sliderMutation: document.getElementById('slider-mutation'),
      sliderElitism: document.getElementById('slider-elitism'),
      valMutation: document.getElementById('val-mutation'),
      valElitism: document.getElementById('val-elitism'),
      metricGen: document.getElementById('metric-gen'),
      metricBestFit: document.getElementById('metric-best-fit'),
      metricAvgFit: document.getElementById('metric-avg-fit'),
      metricBestSurvival: document.getElementById('metric-best-survival'),
      metricPlayerBest: document.getElementById('metric-player-best'),
      metricPop: document.getElementById('metric-pop'),
      savedBadge: document.getElementById('lab-saved-badge'),
      benchmarkContainer: document.getElementById('benchmark-results')
    };

    this.lab = new LabUI(this.ga, labElements, (genome, label) => {
      this.startWatchBestMode(genome, label);
    }, () => this.showTrainingComplete());

    const btnLetAIPlay = document.getElementById('btn-let-ai-play');
    if (btnLetAIPlay) btnLetAIPlay.onclick = () => this.startTrainedAIDemo();

    const btnChallengeAfterTrain = document.getElementById('btn-challenge-after-train');
    if (btnChallengeAfterTrain) {
      btnChallengeAfterTrain.onclick = () => {
        sound.playButtonClick();
        const genome = this.ga.bestGenome || new Float32Array(CHECKPOINTS.gen1000.weights);
        const label = `TRAINED AGENT (GEN ${this.ga.generation || 1000})`;
        this.startChallengeMode(genome, label);
      };
    }

    // Challenge Top Screen Buttons
    const btnChallengeRestart = document.getElementById('btn-challenge-restart');
    if (btnChallengeRestart) {
      btnChallengeRestart.onclick = () => {
        sound.playButtonClick();
        this.startChallengeMode(this.challengeAIGenome, this.challengeAILabel);
      };
    }

    const btnChallengeExit = document.getElementById('btn-challenge-exit');
    if (btnChallengeExit) {
      btnChallengeExit.onclick = () => {
        sound.playButtonClick();
        this.showScreen('menu');
      };
    }

    // Challenge Results Modal Buttons
    const btnChalRematch = document.getElementById('btn-chal-rematch');
    if (btnChalRematch) {
      btnChalRematch.onclick = () => {
        sound.playButtonClick();
        const modal = document.getElementById('modal-challenge-results');
        if (modal) modal.classList.remove('active');
        this.startChallengeMode(this.challengeAIGenome, this.challengeAILabel);
      };
    }

    const btnChalMenu = document.getElementById('btn-chal-menu');
    if (btnChalMenu) {
      btnChalMenu.onclick = () => {
        sound.playButtonClick();
        const modal = document.getElementById('modal-challenge-results');
        if (modal) modal.classList.remove('active');
        this.showScreen('menu');
      };
    }

    const btnChalSkip = document.getElementById('btn-chal-skip-results');
    if (btnChalSkip) {
      btnChalSkip.onclick = () => {
        sound.playButtonClick();
        if (!this.challengeAISim.gameOver) {
          this.challengeAISim.gameOver = true;
          const timeSec = (this.challengeAISim.ticks / 60).toFixed(2);
          this.challengeAIStats = {
            time: timeSec,
            score: this.challengeAISim.score,
            dodges: this.challengeAISim.rocket.metrics.nearMisses
          };
        }
        this.challengeFinished = true;
        this.showChallengeResults();
      };
    }

    const btnChalAISkip = document.getElementById('btn-chal-ai-skip-results');
    if (btnChalAISkip) {
      btnChalAISkip.onclick = () => {
        sound.playButtonClick();
        if (!this.challengeHumanSim.gameOver) {
          this.challengeHumanSim.gameOver = true;
          const timeSec = (this.challengeHumanSim.ticks / 60).toFixed(2);
          this.challengeHumanStats = {
            time: timeSec,
            score: this.challengeHumanSim.score,
            dodges: this.challengeHumanSim.rocket.metrics.nearMisses
          };
        }
        this.challengeFinished = true;
        this.showChallengeResults();
      };
    }

    // How It Works Modal
    this.modalHowItWorks = new HowItWorksModal(
      document.getElementById('modal-how-it-works'),
      document.getElementById('btn-close-how-it-works')
    );

    // Settings Modal
    const settingsElements = {
      btnClose: document.getElementById('btn-close-settings'),
      btnCloseBottom: document.getElementById('btn-close-settings-bottom'),
      chkSound: document.getElementById('chk-sound-enabled'),
      sliderVolume: document.getElementById('slider-volume'),
      valVolume: document.getElementById('val-volume'),
      btnToggleAdvanced: document.getElementById('btn-toggle-advanced-settings'),
      advancedPanel: document.getElementById('advanced-settings-panel'),
      sliderPop: document.getElementById('slider-setting-pop'),
      valPop: document.getElementById('val-setting-pop'),
      sliderMut: document.getElementById('slider-setting-mut'),
      valMut: document.getElementById('val-setting-mut'),
      sliderElite: document.getElementById('slider-setting-elite'),
      valElite: document.getElementById('val-setting-elite'),
      btnRestoreDefaults: document.getElementById('btn-restore-defaults')
    };

    this.settingsModal = new SettingsModal(
      document.getElementById('modal-settings'),
      settingsElements,
      (updatedSettings) => {
        this.applySettings(updatedSettings);
      }
    );

    // Menu Screen Buttons
    document.getElementById('btn-menu-play').onclick = () => {
      sound.playButtonClick();
      this.startHumanGame();
    };

    const btnMenuChallenge = document.getElementById('btn-menu-challenge');
    if (btnMenuChallenge) {
      btnMenuChallenge.onclick = () => {
        sound.playButtonClick();
        this.startChallengeMode();
      };
    }

    // Pretrained Checkpoints Buttons on Main Menu
    document.querySelectorAll('.btn-chk-watch').forEach((btn) => {
      btn.onclick = () => {
        sound.playButtonClick();
        const gen = btn.dataset.gen;
        const chk = CHECKPOINTS[`gen${gen}`];
        if (chk) {
          this.startWatchBestMode(new Float32Array(chk.weights), `GEN ${gen} CHECKPOINT`);
        }
      };
    });

    document.querySelectorAll('.btn-chk-challenge').forEach((btn) => {
      btn.onclick = () => {
        sound.playButtonClick();
        const gen = btn.dataset.gen;
        const chk = CHECKPOINTS[`gen${gen}`];
        if (chk) {
          this.startChallengeMode(new Float32Array(chk.weights), `GEN ${gen} MODEL`);
        }
      };
    });

    const btnExitSession = document.getElementById('btn-exit-session');
    if (btnExitSession) btnExitSession.onclick = () => this.exitGuidedSession();

    document.getElementById('btn-menu-lab').onclick = () => {
      sound.playButtonClick();
      this.showScreen('lab');
    };

    document.getElementById('btn-menu-watch').onclick = () => {
      sound.playButtonClick();
      this.startWatchBestDefault();
    };

    document.getElementById('btn-menu-how').onclick = () => {
      sound.playButtonClick();
      this.modalHowItWorks.show();
    };

    const btnMenuSettings = document.getElementById('btn-menu-settings');
    if (btnMenuSettings) {
      btnMenuSettings.onclick = () => {
        sound.playButtonClick();
        this.settingsModal.show();
      };
    }

    // Global HUD Buttons
    const btnMute = document.getElementById('btn-hud-mute');
    if (btnMute) {
      btnMute.onclick = () => {
        const isMuted = sound.toggleMute();
        btnMute.textContent = isMuted ? '🔇 MUTED' : '🔊 AUDIO';
        btnMute.classList.toggle('active', !isMuted);
      };
    }

    // AI Visibility Mode Toggle (Game View vs AI Insight)
    const btnViewMode = document.getElementById('btn-hud-viewmode');
    if (btnViewMode) {
      btnViewMode.onclick = () => {
        sound.playButtonClick();
        const nextMode = this.renderer.aiViewMode === 'insight' ? 'game' : 'insight';
        this.renderer.aiViewMode = nextMode;
        btnViewMode.textContent = nextMode === 'insight' ? 'Game view' : 'Explain AI';
        btnViewMode.classList.toggle('insight-active', nextMode === 'insight');

        const insightPanel = document.getElementById('ai-insight-panel');
        if (insightPanel) {
          insightPanel.style.display =
            nextMode === 'insight' && this.gameMode === 'ai-watch' ? 'flex' : 'none';
        }
      };
    }

    // Toggle Details inside AI Insight Panel
    const btnToggleDetails = document.getElementById('btn-toggle-insight-details');
    if (btnToggleDetails) {
      btnToggleDetails.onclick = () => {
        sound.playButtonClick();
        const grid = document.getElementById('insight-details-grid');
        if (grid) {
          const isHidden = grid.style.display === 'none';
          grid.style.display = isHidden ? 'grid' : 'none';
          btnToggleDetails.textContent = isHidden ? 'Hide details' : 'Show details';
        }
      };
    }

    const btnSettings = document.getElementById('btn-hud-settings');
    if (btnSettings) {
      btnSettings.onclick = () => {
        sound.playButtonClick();
        this.settingsModal.show();
      };
    }

    const btnPause = document.getElementById('btn-hud-pause');
    if (btnPause) {
      btnPause.onclick = () => {
        sound.playButtonClick();
        this.togglePause();
      };
    }

    const btnExit = document.getElementById('btn-hud-exit');
    if (btnExit) {
      btnExit.onclick = () => {
        sound.playButtonClick();
        this.showScreen('menu');
      };
    }

    const btnLabBack = document.getElementById('btn-lab-back');
    if (btnLabBack) {
      btnLabBack.onclick = () => {
        sound.playButtonClick();
        this.showScreen('menu');
      };
    }

    // Pause Modal Buttons
    const btnResume = document.getElementById('btn-pause-resume');
    if (btnResume) {
      btnResume.onclick = () => {
        sound.playButtonClick();
        this.togglePause();
      };
    }

    const btnPauseSettings = document.getElementById('btn-pause-settings');
    if (btnPauseSettings) {
      btnPauseSettings.onclick = () => {
        sound.playButtonClick();
        this.settingsModal.show();
      };
    }

    const btnPauseQuit = document.getElementById('btn-pause-quit');
    if (btnPauseQuit) {
      btnPauseQuit.onclick = () => {
        sound.playButtonClick();
        this.togglePause();
        this.showScreen('menu');
      };
    }

    const btnCloseSettingsBottom = document.getElementById('btn-close-settings-bottom');
    if (btnCloseSettingsBottom) {
      btnCloseSettingsBottom.onclick = () => {
        sound.playButtonClick();
        this.settingsModal.hide();
      };
    }
  }

  initAudioHooks() {
    this.sim.onCollision = (threat) => {
      sound.playCollision();
      this.renderer.vfx.triggerShake(10, 18);
      this.renderer.vfx.triggerFlash('#ff3366', 0.4);
    };

    this.sim.onNearMiss = () => {
      sound.playNearMiss();
      this.renderer.vfx.triggerShake(2.5, 8);
    };

    this.sim.onWaveAdvance = (wave) => {
      sound.playWaveAdvance();
      this.renderer.vfx.triggerFlash('#ffffff', 0.25);
    };
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      // Avoid scrolling on arrow keys or space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.keys.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (this.currentScreen === 'game') {
          this.togglePause();
        }
      }

      if (e.key === 'm' || e.key === 'M') {
        const btnMute = document.getElementById('btn-hud-mute');
        if (btnMute) btnMute.click();
      }

      if (e.key === 'v' || e.key === 'V') {
        const btnViewMode = document.getElementById('btn-hud-viewmode');
        if (btnViewMode) btnViewMode.click();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.keys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
    });
  }

  updateTitleBadges() {
    const titleBadge = document.getElementById('menu-status-badge');
    if (!titleBadge) return;

    if (Storage.hasBestAgent()) {
      titleBadge.textContent = 'A trained pilot is ready to watch';
      titleBadge.className = 'status-badge badge-ready';
    } else {
      titleBadge.textContent = 'A demo pilot is ready to watch';
      titleBadge.className = 'status-badge badge-ready';
    }
  }

  showScreen(screenName) {
    this.currentScreen = screenName;
    document.querySelectorAll('.app-screen').forEach((s) => s.classList.remove('active'));

    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.add('active');

    if (screenName === 'game' || screenName === 'challenge') {
      this.isPaused = false;
      if (screenName === 'game') {
        this.hud.setPaused(false);
        this.hud.hideGameOver();
      }
      this.startLoop();
    } else {
      this.stopLoop();
    }

    if (screenName === 'lab') {
      this.lab.chart.render(this.ga.history);
      this.lab.updateMetrics();
      const trainingStatus = document.getElementById('training-status');
      if (trainingStatus) {
        trainingStatus.textContent = this.ga.generation > 0
          ? `${this.ga.generation} generations completed. You can train another batch to try to improve the pilot.`
          : 'Each generation tests a group of pilots and keeps the strongest movers.';
      }
    }

    if (screenName === 'menu') {
      this.updateTitleBadges();
    }
  }

  startHumanGame() {
    this.sessionPhase = 'human';
    this.ga.reset();
    this.ga.targetSurvivalTicks = Math.round(Storage.loadHighScore().survivalTime * 60);
    this.gameMode = 'human';
    this.aiPolicyLabel = 'MANUAL PILOT';
    const viewModeButton = document.getElementById('btn-hud-viewmode');
    if (viewModeButton) viewModeButton.style.display = 'none';
    const recordGoal = document.getElementById('hud-record-goal');
    if (recordGoal) recordGoal.style.display = 'none';

    // Apply gameplay settings
    this.sim.setDifficulty(this.settings.difficulty);
    this.sim.setAdaptiveMode(this.settings.adaptiveArena);

    // Hide AI insight panel in human pilot mode
    const insightPanel = document.getElementById('ai-insight-panel');
    if (insightPanel) insightPanel.style.display = 'none';

    // 3 Shields for rich arcade playability
    this.sim.reset(Date.now() % 100000, 3, false);
    this.showScreen('game');
  }

  startWatchBestDefault() {
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

    this.startWatchBestMode(genome, label, 'trained-demo');
  }

  startUntrainedAIDemo() {
    const firstPilot = this.ga.population[0];
    this.startWatchBestMode(firstPilot.network.getWeights(), 'Untrained pilot', 'untrained-demo');
  }

  startTrainedAIDemo() {
    const genome = this.ga.bestGenome;
    if (!genome) {
      const trainingStatus = document.getElementById('training-status');
      if (trainingStatus) trainingStatus.textContent = 'No complete training run yet. Start training to create a pilot.';
      this.showScreen('lab');
      return;
    }
    this.aiGenerationsAtDemo = this.ga.generation;
    this.startWatchBestMode(genome, 'Trained pilot', 'trained-demo');
  }

  showTrainingComplete() {
    const panel = document.getElementById('training-finished-panel');
    const chartPanel = document.getElementById('training-chart-panel');
    if (chartPanel) chartPanel.style.display = 'block';
    if (panel) panel.style.display = 'flex';
    this.lab.chart.render(this.ga.history);
  }

  exitGuidedSession() {
    this.lab?.stopTraining();
    this.hud?.hideGameOver();
    this.sessionPhase = 'intro';
    this.showScreen('menu');
  }

  startWatchBestMode(genome, label, phase = 'trained-demo') {
    this.gameMode = 'ai-watch';
    this.aiPolicyLabel = label;
    this.sessionPhase = phase;
    const viewModeButton = document.getElementById('btn-hud-viewmode');
    if (viewModeButton) viewModeButton.style.display = 'inline-flex';
    const recordGoal = document.getElementById('hud-record-goal');
    const recordTime = document.getElementById('hud-record-time');
    const personalBest = Number(Storage.loadHighScore().survivalTime) || 0;
    this.aiTargetTime = personalBest;
    if (recordGoal) recordGoal.style.display = 'flex';
    if (recordTime) {
      recordTime.textContent = personalBest > 0
        ? `${Math.floor(personalBest / 60).toString().padStart(2, '0')}:${(personalBest % 60).toFixed(1).padStart(4, '0')}`
        : 'Set a record!';
    }

    // Apply gameplay settings
    this.sim.setDifficulty(this.settings.difficulty);
    this.sim.setAdaptiveMode(this.settings.adaptiveArena);

    // Set visibility mode default to insight so user clearly sees what AI is observing and calculating
    this.renderer.aiViewMode = 'insight';
    const btnViewMode = document.getElementById('btn-hud-viewmode');
    if (btnViewMode) {
      btnViewMode.textContent = 'Game view';
      btnViewMode.classList.add('insight-active');
    }

    const insightPanel = document.getElementById('ai-insight-panel');
    if (insightPanel) {
      insightPanel.style.display = 'flex';
      const grid = document.getElementById('insight-details-grid');
      if (grid) grid.style.display = 'grid';
      const btnToggleDetails = document.getElementById('btn-toggle-insight-details');
      if (btnToggleDetails) btnToggleDetails.textContent = 'Hide details';
    }

    const net = new NeuralNetwork(20, 16, 4);
    net.setWeights(genome);
    this.watchController = new AgentController(net);

    // 1 Shield for untrained AI demo; 3 Shields for trained AI
    const isUntrained = (phase === 'untrained-demo');
    const shields = isUntrained ? 1 : 3;
    this.sim.reset(Date.now() % 100000, shields, isUntrained);
    this.showScreen('game');
  }

  startChallengeMode(aiGenome = null, aiLabel = 'GEN 1000 APEX MODEL') {
    if (!aiGenome) {
      if (this.ga.bestGenome) {
        aiGenome = this.ga.bestGenome;
        aiLabel = `TRAINED AI (GEN ${this.ga.generation})`;
      } else {
        aiGenome = new Float32Array(CHECKPOINTS.gen1000.weights);
        aiLabel = 'GEN 1000 APEX MODEL';
      }
    }

    this.challengeAIGenome = aiGenome;
    this.challengeAILabel = aiLabel;

    const net = new NeuralNetwork(20, 16, 4);
    net.setWeights(aiGenome);
    this.challengeAIController = new AgentController(net);

    const matchSeed = Math.floor(Math.random() * 1000000) + 1;

    // Both get 3 shields and identical shared seed
    this.challengeHumanSim = new GameSimulation({
      width: 600,
      height: 480,
      seed: matchSeed,
      maxShields: 3,
      difficulty: this.settings.difficulty,
      adaptiveMode: this.settings.adaptiveArena
    });

    this.challengeAISim = new GameSimulation({
      width: 600,
      height: 480,
      seed: matchSeed,
      maxShields: 3,
      difficulty: this.settings.difficulty,
      adaptiveMode: this.settings.adaptiveArena
    });

    // Sound hooks
    this.challengeHumanSim.onCollision = () => {
      sound.playCollision();
      this.challengeHumanRenderer?.vfx.triggerShake(8, 14);
      this.challengeHumanRenderer?.vfx.triggerFlash('#ef4444', 0.35);
    };
    this.challengeHumanSim.onNearMiss = () => sound.playNearMiss();
    this.challengeHumanSim.onWaveAdvance = () => sound.playWaveAdvance();

    // Renderers
    if (!this.challengeHumanCanvas) {
      this.challengeHumanCanvas = document.getElementById('canvas-chal-human');
      this.challengeHumanRenderer = new Renderer(this.challengeHumanCanvas);
    }
    this.challengeHumanRenderer.resize(600, 480);
    this.challengeHumanRenderer.aiViewMode = 'game';

    if (!this.challengeAICanvas) {
      this.challengeAICanvas = document.getElementById('canvas-chal-ai');
      this.challengeAIRenderer = new Renderer(this.challengeAICanvas);
    }
    this.challengeAIRenderer.resize(600, 480);
    this.challengeAIRenderer.aiViewMode = 'insight'; // Real-time AI observation overlay!

    // Reset Overlays
    const humanOverlay = document.getElementById('overlay-human-elim');
    const aiOverlay = document.getElementById('overlay-ai-elim');
    if (humanOverlay) humanOverlay.style.display = 'none';
    if (aiOverlay) aiOverlay.style.display = 'none';

    const aiModelTag = document.getElementById('chal-ai-checkpoint-tag');
    if (aiModelTag) aiModelTag.textContent = aiLabel;

    this.challengeHumanStats = null;
    this.challengeAIStats = null;
    this.challengeFinished = false;

    this.showScreen('challenge');
  }

  updateChallenge() {
    if (this.currentScreen !== 'challenge') return;

    // 1. Step Human Simulation
    if (!this.challengeHumanSim.gameOver) {
      let tx = 0;
      let ty = 0;
      if (this.keys.left) tx -= 1;
      if (this.keys.right) tx += 1;
      if (this.keys.up) ty -= 1;
      if (this.keys.down) ty += 1;
      if (tx !== 0 || ty !== 0) sound.playThrust();

      this.challengeHumanSim.rocket.setThrottle(tx, ty);
      this.challengeHumanSim.step(null);
      this.updateChallengeSideHUD('human', this.challengeHumanSim);

      if (this.challengeHumanSim.gameOver) {
        const timeSec = (this.challengeHumanSim.ticks / 60).toFixed(2);
        this.challengeHumanStats = {
          time: timeSec,
          score: this.challengeHumanSim.score,
          dodges: this.challengeHumanSim.rocket.metrics.nearMisses
        };
        const overlay = document.getElementById('overlay-human-elim');
        const elimTime = document.getElementById('elim-human-time');
        if (overlay) overlay.style.display = 'flex';
        if (elimTime) elimTime.textContent = `Survived: ${timeSec}s`;
      }
    }

    // 2. Step AI Simulation
    if (!this.challengeAISim.gameOver) {
      this.challengeAISim.step(this.challengeAIController);
      this.updateChallengeSideHUD('ai', this.challengeAISim);

      if (this.challengeAISim.gameOver) {
        const timeSec = (this.challengeAISim.ticks / 60).toFixed(2);
        this.challengeAIStats = {
          time: timeSec,
          score: this.challengeAISim.score,
          dodges: this.challengeAISim.rocket.metrics.nearMisses
        };
        const overlay = document.getElementById('overlay-ai-elim');
        const elimTime = document.getElementById('elim-ai-time');
        if (overlay) overlay.style.display = 'flex';
        if (elimTime) elimTime.textContent = `Survived: ${timeSec}s`;
      }
    }

    // 3. Render Canvases
    this.challengeHumanRenderer.render(this.challengeHumanSim, null);
    const aiSensorData = this.challengeAIController.lastSensorData;
    this.challengeAIRenderer.render(this.challengeAISim, aiSensorData);

    // 4. Update Bottom Ticker
    this.updateChallengeTicker(aiSensorData);

    // 5. Completion Check
    if (!this.challengeFinished && this.challengeHumanSim.gameOver && this.challengeAISim.gameOver) {
      this.challengeFinished = true;
      setTimeout(() => this.showChallengeResults(), 600);
    }
  }

  updateChallengeSideHUD(side, sim) {
    const totalSec = sim.ticks / 60;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(2);
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;

    const timeEl = document.getElementById(`chal-${side}-time`);
    const scoreEl = document.getElementById(`chal-${side}-score`);
    const shieldsEl = document.getElementById(`chal-${side}-shields`);

    if (timeEl) timeEl.textContent = formatted;
    if (scoreEl) scoreEl.textContent = sim.score.toLocaleString();

    if (shieldsEl) {
      const shields = sim.rocket.shields;
      const max = sim.rocket.maxShields;
      let html = '';
      for (let i = 0; i < max; i++) {
        html += `<span class="shield-pip ${i < shields ? 'active' : 'depleted'}"></span>`;
      }
      shieldsEl.innerHTML = html;
    }
  }

  updateChallengeTicker(sensorData) {
    if (!sensorData) return;
    const threatEl = document.getElementById('chal-ticker-threat');
    const actionEl = document.getElementById('chal-ticker-action');

    if (threatEl) {
      if (sensorData.nearestThreat) {
        threatEl.textContent = `${Math.round(sensorData.nearestThreat.dist)}px distant (Rel Speed: ${sensorData.inputs[19].toFixed(2)})`;
      } else {
        threatEl.textContent = 'Scanning 180px horizon...';
      }
    }

    if (actionEl && sensorData.outputs && sensorData.outputs.length >= 4) {
      const out = sensorData.outputs;
      const tx = out[1] - out[0];
      const ty = out[3] - out[2];
      actionEl.textContent = `Throttle: [${tx.toFixed(2)}, ${ty.toFixed(2)}]`;
    }
  }

  showChallengeResults() {
    const modal = document.getElementById('modal-challenge-results');
    if (!modal) return;

    const hTime = parseFloat(this.challengeHumanStats.time);
    const aTime = parseFloat(this.challengeAIStats.time);
    const hScore = this.challengeHumanStats.score;
    const aScore = this.challengeAIStats.score;
    const hDodges = this.challengeHumanStats.dodges;
    const aDodges = this.challengeAIStats.dodges;

    const timeWinner = hTime > aTime ? '🏆 Human' : hTime < aTime ? '🏆 AI' : 'Tie';
    const scoreWinner = hScore > aScore ? '🏆 Human' : hScore < aScore ? '🏆 AI' : 'Tie';
    const dodgesWinner = hDodges > aDodges ? '🏆 Human' : hDodges < aDodges ? '🏆 AI' : 'Tie';
    const overallWinner = hTime >= aTime ? 'YOU WIN!' : 'AI WINS!';

    const elHTime = document.getElementById('chal-res-human-time');
    const elATime = document.getElementById('chal-res-ai-time');
    const elTimeWin = document.getElementById('chal-res-time-winner');
    if (elHTime) elHTime.textContent = `${hTime.toFixed(2)}s`;
    if (elATime) elATime.textContent = `${aTime.toFixed(2)}s`;
    if (elTimeWin) elTimeWin.textContent = timeWinner;

    const elHScore = document.getElementById('chal-res-human-score');
    const elAScore = document.getElementById('chal-res-ai-score');
    const elScoreWin = document.getElementById('chal-res-score-winner');
    if (elHScore) elHScore.textContent = hScore.toLocaleString();
    if (elAScore) elAScore.textContent = aScore.toLocaleString();
    if (elScoreWin) elScoreWin.textContent = scoreWinner;

    const elHDodges = document.getElementById('chal-res-human-dodges');
    const elADodges = document.getElementById('chal-res-ai-dodges');
    const elDodgesWin = document.getElementById('chal-res-dodges-winner');
    if (elHDodges) elHDodges.textContent = hDodges;
    if (elADodges) elADodges.textContent = aDodges;
    if (elDodgesWin) elDodgesWin.textContent = dodgesWinner;

    const elHStatus = document.getElementById('chal-res-human-status');
    const elAStatus = document.getElementById('chal-res-ai-status');
    const elOverall = document.getElementById('chal-res-overall-winner');
    if (elHStatus) elHStatus.textContent = hTime >= aTime ? 'Survived Longer' : 'Destroyed';
    if (elAStatus) elAStatus.textContent = aTime >= hTime ? 'Survived Longer' : 'Destroyed';
    if (elOverall) elOverall.textContent = overallWinner;

    const title = document.getElementById('chal-result-title');
    if (title) title.textContent = hTime >= aTime ? 'VICTORY: HUMAN OUT-DODGED AI' : 'DEFEAT: AI OUTLASTED HUMAN';

    modal.classList.add('active');
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.hud.setPaused(this.isPaused);
  }

  startLoop() {
    this.stopLoop();
    const tick = () => {
      this.updateGame();
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updateGame() {
    if (this.currentScreen === 'challenge') {
      this.updateChallenge();
      return;
    }
    if (this.currentScreen !== 'game') return;

    if (!this.isPaused && !this.sim.gameOver) {
      if (this.gameMode === 'human') {
        // Compute human throttle from arrow/WASD keys
        let tx = 0;
        let ty = 0;
        if (this.keys.left) tx -= 1;
        if (this.keys.right) tx += 1;
        if (this.keys.up) ty -= 1;
        if (this.keys.down) ty += 1;

        if (tx !== 0 || ty !== 0) {
          sound.playThrust();
        }

        this.sim.rocket.setThrottle(tx, ty);
        this.sim.step(null);
      } else if (this.gameMode === 'ai-watch') {
        this.sim.step(this.watchController);
      }

      // Check for Game Over condition
      if (this.sim.gameOver) {
        if (this.gameMode === 'human') {
          Storage.saveHighScore(this.sim.score, (this.sim.ticks / 60).toFixed(2));
          this.ga.targetSurvivalTicks = Math.round(Storage.loadHighScore().survivalTime * 60);
          this.lab.updateMetrics();
        }
        this.configureGuidedResult();
        this.hud.showGameOver(
          this.sim,
          () => {
            if (this.sessionPhase === 'human') this.startUntrainedAIDemo();
            else if (this.sessionPhase === 'untrained-demo' || this.sessionPhase === 'trained-demo') this.showScreen('lab');
          },
          () => this.exitGuidedSession(),
          null
        );
        if (this.sessionPhase === 'trained-demo' && this.aiTargetTime > 0 && this.sim.ticks / 60 > this.aiTargetTime) {
          const resultMessage = document.getElementById('go-reason');
          if (resultMessage) resultMessage.textContent = 'It beat your best flight!';
        }
      }
    }

    if (this.gameMode === 'ai-watch' && this.aiTargetTime > 0) {
      const recordLabel = document.getElementById('hud-record-label');
      if (recordLabel) {
        recordLabel.textContent = this.sim.ticks / 60 > this.aiTargetTime
          ? 'Your record beaten!'
          : 'Your best to beat';
      }
    }

    // Extract sensor data for rendering and HUD
    const sensorData =
      this.gameMode === 'ai-watch' && this.watchController
        ? this.watchController.lastSensorData
        : null;

    // Render Canvas (Draws AI Insight or Game View based on renderer.aiViewMode)
    this.renderer.render(this.sim, sensorData);

    // Update HUD
    this.hud.update(this.sim, this.gameMode, this.aiPolicyLabel);

    // Update AI Insight Telemetry Panel
    if (this.gameMode === 'ai-watch') {
      const isInsight = this.renderer.aiViewMode === 'insight';
      this.hud.updateAIInsightPanel(sensorData, this.sim.rocket, isInsight);
    }
  }

  configureGuidedResult() {
    const title = document.querySelector('#modal-gameover .modal-title');
    const nextButton = document.getElementById('btn-go-replay');
    const exitButton = document.getElementById('btn-go-menu');
    const generationItem = document.getElementById('go-generations-item');
    const generationValue = document.getElementById('go-generations');
    const playerBestItem = document.getElementById('go-player-best-item');
    const playerBestValue = document.getElementById('go-player-best');
    const saveButton = document.getElementById('btn-go-save-agent');
    const playerBest = Number(Storage.loadHighScore().survivalTime) || 0;

    if (saveButton) saveButton.style.display = 'none';
    if (exitButton) exitButton.textContent = 'Exit';
    if (generationItem) generationItem.style.display = this.sessionPhase === 'trained-demo' ? 'block' : 'none';
    if (generationValue) generationValue.textContent = `${this.aiGenerationsAtDemo}`;
    if (playerBestItem) playerBestItem.style.display = this.sessionPhase === 'trained-demo' ? 'block' : 'none';
    if (playerBestValue) playerBestValue.textContent = `${playerBest.toFixed(1)}s`;

    if (this.sessionPhase === 'human') {
      if (title) title.textContent = 'Flight complete';
      if (nextButton) nextButton.textContent = 'Watch the AI';
    } else if (this.sessionPhase === 'untrained-demo') {
      if (title) title.textContent = 'The new pilot crashed';
      if (nextButton) nextButton.textContent = 'Help it learn';
    } else {
      if (title) title.textContent = 'Your trained pilot is done';
      if (nextButton) nextButton.textContent = 'Train it more';
    }
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
