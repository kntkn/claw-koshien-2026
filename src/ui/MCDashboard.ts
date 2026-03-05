import type { CameraController } from '../camera/CameraController';
import type { AutoTour } from '../camera/AutoTour';
import type { StateManager } from '../data/StateManager';
import type { DeskManager } from '../scene/DeskManager';

/**
 * MCDashboard provides keyboard controls and an on-screen HUD
 * for the MC (master of ceremonies) to control the camera and event.
 */
export class MCDashboard {
  private controller: CameraController;
  private autoTour: AutoTour;
  private stateManager: StateManager;
  private deskManager: DeskManager;
  private hudElement: HTMLDivElement;
  private timerElement: HTMLDivElement;
  private timerStart: number | null = null;
  private timerRunning = false;
  private timerRAF: number | null = null;

  constructor(
    controller: CameraController,
    autoTour: AutoTour,
    stateManager: StateManager,
    deskManager: DeskManager,
  ) {
    this.controller = controller;
    this.autoTour = autoTour;
    this.stateManager = stateManager;
    this.deskManager = deskManager;

    this.hudElement = this.createHUD();
    this.timerElement = this.hudElement.querySelector('#mc-timer') as HTMLDivElement;
    this.setupKeyboardShortcuts();
    this.startTimerLoop();
  }

  private createHUD(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'mc-hud';
    hud.innerHTML = `
      <style>
        #mc-hud {
          position: fixed; bottom: 16px; right: 16px; z-index: 100;
          background: rgba(26,30,40,0.9); border: 1px solid #3a4858;
          border-radius: 12px; padding: 12px 16px; color: #e8eaf0;
          font-family: 'SF Pro Text', system-ui, sans-serif; font-size: 12px;
          backdrop-filter: blur(8px); min-width: 200px;
          user-select: none;
        }
        #mc-hud .title { font-size: 10px; letter-spacing: 2px; color: #5cf89a; margin-bottom: 8px; }
        #mc-hud .mode { font-weight: 700; margin-bottom: 6px; }
        #mc-hud .shortcuts { color: #8a9aaa; line-height: 1.6; }
        #mc-hud kbd {
          background: #3a4858; padding: 1px 5px; border-radius: 3px;
          font-family: monospace; font-size: 11px; margin-right: 4px;
        }
        #mc-timer {
          font-family: 'SF Mono', monospace; font-size: 20px; color: #5cf89a;
          text-shadow: 0 0 10px rgba(92,248,154,.3); margin: 6px 0;
          font-variant-numeric: tabular-nums;
        }
        #mc-participants {
          margin-top: 6px; max-height: 120px; overflow-y: auto;
        }
        .mc-p { display: flex; align-items: center; gap: 6px; padding: 2px 0; cursor: pointer; }
        .mc-p:hover { color: #5cf89a; }
        .mc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .mc-dot.thinking { background: #f0c040; }
        .mc-dot.working { background: #5cf89a; }
        .mc-dot.idle { background: #607088; }
      </style>
      <div class="title">MC CONTROLS</div>
      <div id="mc-timer">00:00:00</div>
      <div class="mode" id="mc-mode">OVERVIEW</div>
      <div class="shortcuts">
        <kbd>1</kbd> Overview
        <kbd>2</kbd> Auto Tour
        <kbd>3-9</kbd> Focus Desk
        <kbd>Space</kbd> Timer
        <kbd>R</kbd> Reset
      </div>
      <div id="mc-participants"></div>
    `;
    document.body.appendChild(hud);

    // Update participant list
    this.stateManager.onUpdate(() => this.renderParticipants(hud));

    return hud;
  }

  private renderParticipants(hud: HTMLDivElement) {
    const container = hud.querySelector('#mc-participants') as HTMLDivElement;
    const participants = this.stateManager.getAllParticipants();
    container.innerHTML = participants.map(p => `
      <div class="mc-p" data-id="${p.id}">
        <span class="mc-dot ${p.status}"></span>
        <span>${p.name}</span>
      </div>
    `).join('');

    // Click handlers
    container.querySelectorAll('.mc-p').forEach(el => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.id!;
        this.controller.focusDesk(id);
        this.autoTour.stop();
        this.updateModeDisplay();
      });
    });
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1':
        case 'Escape':
          this.autoTour.stop();
          this.controller.setOverview();
          break;
        case '2':
          if (this.autoTour.isRunning()) {
            this.autoTour.stop();
            this.controller.setOverview();
          } else {
            this.autoTour.start();
          }
          break;
        case ' ':
          e.preventDefault();
          this.toggleTimer();
          break;
        case 'r':
        case 'R':
          this.resetTimer();
          break;
        default: {
          const num = parseInt(e.key);
          if (num >= 3 && num <= 9) {
            this.autoTour.stop();
            this.controller.focusDeskByIndex(num - 3);
          }
          break;
        }
      }
      this.updateModeDisplay();
    });
  }

  private updateModeDisplay() {
    const modeEl = this.hudElement.querySelector('#mc-mode') as HTMLDivElement;
    if (this.autoTour.isRunning()) {
      modeEl.textContent = 'AUTO TOUR';
    } else {
      const mode = this.controller.getMode().toUpperCase();
      const focused = this.controller.getFocusedDeskId();
      modeEl.textContent = focused ? `FOCUS: ${focused}` : mode;
    }
  }

  private toggleTimer() {
    if (this.timerRunning) {
      this.timerRunning = false;
    } else {
      if (!this.timerStart) this.timerStart = Date.now();
      this.timerRunning = true;
    }
  }

  private resetTimer() {
    this.timerStart = null;
    this.timerRunning = false;
    this.timerElement.textContent = '00:00:00';
  }

  private startTimerLoop() {
    const tick = () => {
      if (this.timerRunning && this.timerStart) {
        const elapsed = Date.now() - this.timerStart;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        this.timerElement.textContent =
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      this.timerRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Handle MC commands from relay server */
  handleCommand(command: string) {
    if (command === 'camera:overview') {
      this.autoTour.stop();
      this.controller.setOverview();
    } else if (command === 'camera:tour') {
      this.autoTour.start();
    } else if (command === 'timer:toggle') {
      this.toggleTimer();
    } else if (command === 'timer:start') {
      if (!this.timerStart) this.timerStart = Date.now();
      this.timerRunning = true;
    } else if (command === 'timer:reset') {
      this.resetTimer();
    } else if (command.startsWith('camera:focus:')) {
      this.autoTour.stop();
      this.controller.handleCommand(command);
    }
    this.updateModeDisplay();
  }

  dispose() {
    if (this.timerRAF) cancelAnimationFrame(this.timerRAF);
    this.hudElement.remove();
  }
}
