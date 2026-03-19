import type { StateManager, ParticipantState } from '../data/StateManager';
import type { CameraController } from '../camera/CameraController';
import type { AutoTour } from '../camera/AutoTour';
import { formatToolJa, formatToolShortJa, formatStatusJa } from './i18n';

export class Dashboard {
  private container: HTMLDivElement;
  private stateManager: StateManager;
  private cameraController: CameraController;
  private autoTour: AutoTour;
  private timerStart: number | null = null;
  private timerRunning = false;
  private timerRAF: number | null = null;
  private competitionMode = false;

  constructor(
    stateManager: StateManager,
    cameraController: CameraController,
    autoTour: AutoTour,
  ) {
    this.stateManager = stateManager;
    this.cameraController = cameraController;
    this.autoTour = autoTour;
    this.container = document.getElementById('dashboard') as HTMLDivElement;
    this.injectStyles();
    this.render();
    this.setupKeyboard();
    this.startTimerLoop();

    stateManager.onUpdate(() => this.renderCards());
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #dashboard {
        background: #0e1018;
        color: #e0e4ec;
        font-family: 'SF Pro Text', 'Inter', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .dash-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #1e2230;
        flex-shrink: 0;
      }
      .dash-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: #5cf89a;
      }
      .dash-timer {
        font-family: 'SF Mono', 'JetBrains Mono', monospace;
        font-size: 28px;
        color: #5cf89a;
        text-shadow: 0 0 15px rgba(92,248,154,.25);
        font-variant-numeric: tabular-nums;
        margin-top: 4px;
      }
      .dash-controls {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      .dash-btn {
        background: #1a1e28;
        border: 1px solid #2a3040;
        color: #8a9aaa;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .dash-btn:hover { border-color: #5cf89a; color: #e0e4ec; }
      .dash-btn.active { border-color: #5cf89a; color: #5cf89a; background: #1a2828; }
      .dash-btn kbd {
        background: #2a3040;
        padding: 1px 4px;
        border-radius: 2px;
        font-size: 10px;
        margin-left: 3px;
      }
      .dash-cards {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .dash-cards::-webkit-scrollbar { width: 4px; }
      .dash-cards::-webkit-scrollbar-track { background: transparent; }
      .dash-cards::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 2px; }

      .agent-card {
        background: #14171f;
        border: 1px solid #1e2230;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .agent-card:hover { border-color: #3a4858; background: #181c26; }
      .agent-card.focused { border-color: #5cf89a; background: #141e1a; }

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .card-name {
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .status-dot.working {
        background: #5cf89a;
        box-shadow: 0 0 6px rgba(92,248,154,.6);
      }
      .status-dot.thinking {
        background: #f0c040;
        box-shadow: 0 0 6px rgba(240,192,64,.6);
        animation: pulse-dot 1.5s ease-in-out infinite;
      }
      .status-dot.idle { background: #404858; }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .card-status {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 3px;
      }
      .card-status.working { color: #5cf89a; background: rgba(92,248,154,.1); }
      .card-status.thinking { color: #f0c040; background: rgba(240,192,64,.1); }
      .card-status.idle { color: #606878; background: rgba(96,104,120,.1); }

      .card-tool {
        font-size: 12px;
        color: #a0c0ff;
        margin-bottom: 4px;
      }
      .card-tool .tool-name {
        background: rgba(160,192,255,.1);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
      }

      .card-task {
        font-size: 11px;
        color: #707888;
        line-height: 1.4;
        margin-bottom: 6px;
        max-height: 40px;
        overflow: hidden;
      }

      .card-services {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .card-svc-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(100,140,200,.1);
        color: #8aa0c0;
      }

      .card-activity {
        border-top: 1px solid #1e2230;
        padding-top: 6px;
        max-height: 80px;
        overflow-y: auto;
      }
      .card-activity::-webkit-scrollbar { width: 2px; }
      .card-activity::-webkit-scrollbar-thumb { background: #2a3040; }

      .activity-item {
        font-size: 11px;
        font-family: 'SF Mono', monospace;
        color: #607088;
        padding: 1px 0;
        display: flex;
        gap: 6px;
      }
      .activity-item .time { color: #404858; flex-shrink: 0; }
      .activity-item .tool {
        color: #8090b0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-competition-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .card-score {
        font-family: 'SF Mono', monospace;
        font-size: 22px;
        font-weight: 800;
        color: #5cf89a;
      }
      .card-votes {
        font-size: 11px;
        color: #f0c040;
      }
      .card-progress-bar {
        height: 4px;
        background: #1e2230;
        border-radius: 2px;
        margin-bottom: 6px;
        overflow: hidden;
      }
      .card-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #5cf89a, #40d8f0);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      .card-rank {
        font-size: 14px;
        font-weight: 800;
        margin-right: 8px;
      }
      .agent-card.rank-1 { border-left: 3px solid #ffd700; }
      .agent-card.rank-2 { border-left: 3px solid #c0c0c0; }
      .agent-card.rank-3 { border-left: 3px solid #cd7f32; }
    `;
    document.head.appendChild(style);
  }

  private render() {
    this.container.innerHTML = `
      <div class="dash-header">
        <div class="dash-title">Claw Koshien 2026</div>
        <div class="dash-timer" id="dash-timer">00:00:00</div>
        <div class="dash-controls">
          <button class="dash-btn" data-cmd="overview"><kbd>1</kbd> \u5168\u4F53</button>
          <button class="dash-btn" data-cmd="tour"><kbd>2</kbd> \u5DE1\u56DE</button>
          <button class="dash-btn" data-cmd="timer"><kbd>Space</kbd> \u30BF\u30A4\u30DE\u30FC</button>
        </div>
      </div>
      <div class="dash-cards" id="dash-cards"></div>
    `;

    this.container.querySelectorAll('.dash-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = (btn as HTMLElement).dataset.cmd!;
        if (cmd === 'overview') { this.autoTour.stop(); this.cameraController.setOverview(); }
        else if (cmd === 'tour') {
          if (this.autoTour.isRunning()) { this.autoTour.stop(); this.cameraController.setOverview(); }
          else this.autoTour.start();
        }
        else if (cmd === 'timer') this.toggleTimer();
        this.updateControls();
      });
    });

    this.renderCards();
  }

  private renderCards() {
    const cards = this.container.querySelector('#dash-cards');
    if (!cards) return;

    const participants = this.stateManager.getAllParticipants();
    const focusedId = this.cameraController.getFocusedDeskId();

    let sorted = participants;
    if (this.competitionMode) {
      sorted = [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      sorted.forEach((p, i) => { p.rank = i + 1; });
    }

    cards.innerHTML = sorted.map(p => {
      // Detect external services from recent tools
      const services = detectServices(p.recentTools.map(t => t.name));

      return `
      <div class="agent-card ${p.id === focusedId ? 'focused' : ''} ${this.competitionMode && (p.rank ?? 0) <= 3 ? `rank-${p.rank}` : ''}" data-id="${p.id}">
        <div class="card-top">
          <div class="card-name">
            <span class="status-dot ${p.status}"></span>
            ${p.name}
          </div>
          <span class="card-status ${p.status}">${formatStatusJa(p.status)}</span>
        </div>
        ${this.competitionMode ? `
          <div class="card-competition-row">
            <div>
              <span class="card-rank">${getRankEmoji(p.rank ?? 0)}</span>
              <span class="card-score">${p.score ?? 0}</span>
              <span style="font-size:11px;color:#607088">pts</span>
            </div>
            <span class="card-votes">${p.votes ?? 0} votes</span>
          </div>
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width:${p.progress ?? 0}%"></div>
          </div>
        ` : ''}
        ${p.tool ? `<div class="card-tool">
          <span class="tool-name">${formatToolJa(p.tool)}</span>
        </div>` : ''}
        ${p.lastTask ? `<div class="card-task">${escapeHtml(p.lastTask.slice(0, 120))}</div>` : ''}
        ${p.summary && !p.lastTask ? `<div class="card-task">${escapeHtml(p.summary)}</div>` : ''}
        ${services.length > 0 ? `
          <div class="card-services">
            ${services.map(s => `<span class="card-svc-tag">${s}</span>`).join('')}
          </div>
        ` : ''}
        ${p.recentTools.length > 0 ? `
          <div class="card-activity">
            ${p.recentTools.slice(-5).map(t => `
              <div class="activity-item">
                <span class="time">${t.timestamp}</span>
                <span class="tool">${formatToolShortJa(t.name)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;}).join('');

    cards.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.id!;
        this.autoTour.stop();
        this.cameraController.focusDesk(id);
        this.updateControls();
        // Re-render to update focused state
        setTimeout(() => this.renderCards(), 100);
      });
    });
  }

  private setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1':
        case 'Escape':
          this.autoTour.stop();
          this.cameraController.setOverview();
          break;
        case '2':
          if (this.autoTour.isRunning()) {
            this.autoTour.stop();
            this.cameraController.setOverview();
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
            this.cameraController.focusDeskByIndex(num - 3);
          }
          break;
        }
      }
      this.updateControls();
      setTimeout(() => this.renderCards(), 100);
    });
  }

  private updateControls() {
    const btns = this.container.querySelectorAll('.dash-btn');
    btns.forEach(btn => {
      const cmd = (btn as HTMLElement).dataset.cmd;
      btn.classList.toggle('active',
        (cmd === 'tour' && this.autoTour.isRunning()) ||
        (cmd === 'overview' && this.cameraController.getMode() === 'overview'),
      );
    });
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
    const el = document.getElementById('dash-timer');
    if (el) el.textContent = '00:00:00';
  }

  private startTimerLoop() {
    const tick = () => {
      if (this.timerRunning && this.timerStart) {
        const elapsed = Date.now() - this.timerStart;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        const el = document.getElementById('dash-timer');
        if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      this.timerRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  setCompetitionMode(enabled: boolean) {
    this.competitionMode = enabled;
    this.renderCards();
  }

  handleCommand(command: string) {
    if (command === 'camera:overview') {
      this.autoTour.stop();
      this.cameraController.setOverview();
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
      this.cameraController.handleCommand(command);
    }
    this.updateControls();
    setTimeout(() => this.renderCards(), 100);
  }

  dispose() {
    if (this.timerRAF) cancelAnimationFrame(this.timerRAF);
  }
}

const SERVICE_PATTERNS: Array<[RegExp, string]> = [
  [/slack/i, 'Slack'],
  [/github/i, 'GitHub'],
  [/notion/i, 'Notion'],
  [/calendar|gcal/i, 'Calendar'],
  [/gmail/i, 'Gmail'],
  [/chrome/i, 'Browser'],
  [/filesystem/i, 'Files'],
  [/context7/i, 'Docs'],
];

function detectServices(toolNames: string[]): string[] {
  const found = new Set<string>();
  for (const name of toolNames) {
    for (const [pattern, label] of SERVICE_PATTERNS) {
      if (pattern.test(name)) found.add(label);
    }
  }
  return [...found];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return '#1';
  if (rank === 2) return '#2';
  if (rank === 3) return '#3';
  return `#${rank}`;
}
