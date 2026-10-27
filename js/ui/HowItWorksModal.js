/**
 * HowItWorksModal.js
 * Comprehensive academic explanation, neural architecture breakdown,
 * mathematical fitness formulation, and 5-slide presentation guide.
 */

export class HowItWorksModal {
  constructor(modalElement, closeBtn) {
    this.modal = modalElement;
    this.closeBtn = closeBtn;

    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.hide();
    }

    // Close on outside click
    if (this.modal) {
      this.modal.onclick = (e) => {
        if (e.target === this.modal) this.hide();
      };
    }
  }

  show() {
    if (this.modal) {
      this.modal.classList.add('visible');
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.remove('visible');
    }
  }
}
