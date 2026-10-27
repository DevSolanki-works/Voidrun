/**
 * SettingsModal.js
 * Comprehensive, user-friendly settings manager for VOIDRUN.
 * Organizes gameplay, audio, visual, and AI parameters under clear headings,
 * explains their effects in everyday language, and manages persistence.
 */

import { Storage, DEFAULT_SETTINGS } from '../utils/Storage.js';
import { sound } from '../audio/sound.js';

export class SettingsModal {
  constructor(modalElement, elements, onSettingsChange) {
    this.modal = modalElement;
    this.el = elements;
    this.onSettingsChange = onSettingsChange;

    this.settings = Storage.loadSettings();

    this.bindEvents();
    this.syncUI();
  }

  show() {
    this.settings = Storage.loadSettings();
    this.syncUI();
    if (this.modal) {
      this.modal.classList.add('visible');
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.remove('visible');
    }
  }

  syncUI() {
    // 1. Difficulty
    this.setActivePill('difficulty', this.settings.difficulty);

    // 2. Adaptive Arena
    this.setActivePill('adaptive', this.settings.adaptiveArena);

    // 3. Audio & Volume
    if (this.el.chkSound) {
      this.el.chkSound.checked = this.settings.soundEnabled;
    }
    if (this.el.sliderVolume) {
      this.el.sliderVolume.value = Math.round(this.settings.volume * 100);
      if (this.el.valVolume) this.el.valVolume.textContent = `${Math.round(this.settings.volume * 100)}%`;
    }

    // 4. Visual Effects
    this.setActivePill('shake', this.settings.screenShake);
    this.setActivePill('flash', this.settings.flashEffects);

    // 5. AI Viewing Mode Default
    this.setActivePill('aiview', this.settings.aiViewMode);

    // 6. Training Speed
    this.setActivePill('trainspeed', this.settings.trainingSpeed);

    // 7. Advanced AI Hyperparameters
    if (this.el.sliderPop) {
      this.el.sliderPop.value = this.settings.populationSize;
      if (this.el.valPop) this.el.valPop.textContent = `${this.settings.populationSize} pilots`;
    }
    if (this.el.sliderMut) {
      this.el.sliderMut.value = this.settings.mutationRate;
      if (this.el.valMut) this.el.valMut.textContent = `${Math.round(this.settings.mutationRate * 100)}%`;
    }
    if (this.el.sliderElite) {
      this.el.sliderElite.value = this.settings.elitismCount;
      if (this.el.valElite) this.el.valElite.textContent = `${this.settings.elitismCount} pilots`;
    }
  }

  setActivePill(groupName, activeValue) {
    const pills = document.querySelectorAll(`[data-setting-group="${groupName}"]`);
    pills.forEach((p) => {
      if (p.dataset.settingValue === activeValue) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  bindEvents() {
    // Close button
    if (this.el.btnClose) {
      this.el.btnClose.onclick = () => {
        sound.playButtonClick();
        this.hide();
      };
    }

    // Outside click to close
    if (this.modal) {
      this.modal.onclick = (e) => {
        if (e.target === this.modal) this.hide();
      };
    }

    // Generic pill click handlers
    const pillGroups = document.querySelectorAll('[data-setting-group]');
    pillGroups.forEach((pill) => {
      pill.onclick = () => {
        sound.playButtonClick();
        const group = pill.dataset.settingGroup;
        const val = pill.dataset.settingValue;

        switch (group) {
          case 'difficulty':
            this.settings.difficulty = val;
            break;
          case 'adaptive':
            this.settings.adaptiveArena = val;
            break;
          case 'shake':
            this.settings.screenShake = val;
            break;
          case 'flash':
            this.settings.flashEffects = val;
            break;
          case 'aiview':
            this.settings.aiViewMode = val;
            break;
          case 'trainspeed':
            this.settings.trainingSpeed = val;
            break;
        }

        this.setActivePill(group, val);
        this.saveAndApply();
      };
    });

    // Volume Slider
    if (this.el.sliderVolume) {
      this.el.sliderVolume.oninput = (e) => {
        const vol = parseInt(e.target.value) / 100;
        this.settings.volume = vol;
        if (this.el.valVolume) this.el.valVolume.textContent = `${Math.round(vol * 100)}%`;
        sound.setVolume(vol);
        this.saveAndApply();
      };
    }

    // Sound Checkbox
    if (this.el.chkSound) {
      this.el.chkSound.onchange = (e) => {
        const enabled = e.target.checked;
        this.settings.soundEnabled = enabled;
        sound.setMute(!enabled);
        this.saveAndApply();
      };
    }

    // Advanced Accordion Toggle
    if (this.el.btnToggleAdvanced) {
      this.el.btnToggleAdvanced.onclick = () => {
        sound.playButtonClick();
        const advPanel = this.el.advancedPanel;
        if (advPanel) {
          const isHidden = advPanel.style.display === 'none';
          advPanel.style.display = isHidden ? 'flex' : 'none';
          this.el.btnToggleAdvanced.textContent = isHidden
            ? '▲ HIDE ADVANCED AI SETTINGS'
            : '▼ EXPAND ADVANCED AI SETTINGS';
        }
      };
    }

    // Advanced Sliders
    if (this.el.sliderPop) {
      this.el.sliderPop.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.settings.populationSize = val;
        if (this.el.valPop) this.el.valPop.textContent = `${val} pilots`;
        this.saveAndApply();
      };
    }
    if (this.el.sliderMut) {
      this.el.sliderMut.oninput = (e) => {
        const val = parseFloat(e.target.value);
        this.settings.mutationRate = val;
        if (this.el.valMut) this.el.valMut.textContent = `${Math.round(val * 100)}%`;
        this.saveAndApply();
      };
    }
    if (this.el.sliderElite) {
      this.el.sliderElite.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.settings.elitismCount = val;
        if (this.el.valElite) this.el.valElite.textContent = `${val} pilots`;
        this.saveAndApply();
      };
    }

    // Restore Defaults button
    if (this.el.btnRestoreDefaults) {
      this.el.btnRestoreDefaults.onclick = () => {
        sound.playButtonClick();
        const ok = confirm('Reset all settings to default factory values?');
        if (ok) {
          this.settings = Storage.resetSettings();
          this.syncUI();
          this.saveAndApply();
        }
      };
    }
  }

  saveAndApply() {
    Storage.saveSettings(this.settings);
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }
  }
}
