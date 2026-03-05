import type { StateManager, ParticipantState } from '../data/StateManager';
import { formatToolJa, formatStatusJa } from './i18n';

interface TickerItem {
  agent: string;
  text: string;
  timestamp: number;
}

export class BroadcastBar {
  private element: HTMLDivElement;
  private tickerEl: HTMLDivElement;
  private stateManager: StateManager;
  private tickerItems: TickerItem[] = [];
  private scrollOffset = 0;
  private raf: number | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.element = document.createElement('div');
    this.element.id = 'broadcast-bar';
    this.element.innerHTML = `
      <style>
        #broadcast-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 80;
          height: 36px;
          background: linear-gradient(90deg,
            rgba(10,12,20,0.92) 0%,
            rgba(14,16,26,0.88) 50%,
            rgba(10,12,20,0.92) 100%
          );
          border-bottom: 1px solid rgba(92,248,154,0.2);
          display: flex;
          align-items: center;
          pointer-events: none;
          font-family: 'SF Pro Text', 'Inter', system-ui, sans-serif;
          overflow: hidden;
        }
        .bb-live {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          height: 100%;
          background: rgba(220,40,40,0.15);
          border-right: 1px solid rgba(92,248,154,0.15);
        }
        .bb-live-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #e04040;
          box-shadow: 0 0 8px rgba(224,64,64,0.8);
          animation: bb-pulse 1.5s ease-in-out infinite;
        }
        @keyframes bb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .bb-live-text {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #e04040;
        }
        .bb-logo {
          flex-shrink: 0;
          padding: 0 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #5cf89a;
          border-right: 1px solid rgba(92,248,154,0.15);
          white-space: nowrap;
        }
        .bb-ticker-wrap {
          flex: 1;
          overflow: hidden;
          height: 100%;
          position: relative;
        }
        .bb-ticker {
          display: flex;
          align-items: center;
          height: 100%;
          white-space: nowrap;
          will-change: transform;
        }
        .bb-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 20px;
          font-size: 12px;
          color: #c0c8d8;
          flex-shrink: 0;
        }
        .bb-item .agent-name {
          font-weight: 700;
          color: #5cf89a;
        }
        .bb-item .separator {
          color: rgba(92,248,154,0.3);
          font-size: 10px;
        }
        .bb-agents {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 12px;
          border-left: 1px solid rgba(92,248,154,0.15);
        }
        .bb-agent-pip {
          width: 6px; height: 6px;
          border-radius: 50%;
        }
        .bb-agent-pip.working { background: #5cf89a; box-shadow: 0 0 4px rgba(92,248,154,0.6); }
        .bb-agent-pip.thinking { background: #f0c040; }
        .bb-agent-pip.idle { background: #404858; }
      </style>
      <div class="bb-live">
        <span class="bb-live-dot"></span>
        <span class="bb-live-text">LIVE</span>
      </div>
      <div class="bb-logo">CLAW KOSHIEN</div>
      <div class="bb-ticker-wrap">
        <div class="bb-ticker" id="bb-ticker"></div>
      </div>
      <div class="bb-agents" id="bb-agents"></div>
    `;

    document.getElementById('viewport')!.appendChild(this.element);
    this.tickerEl = this.element.querySelector('#bb-ticker') as HTMLDivElement;

    stateManager.onUpdate((id, state) => this.onAgentUpdate(id, state));
    this.startScroll();
  }

  private onAgentUpdate(id: string, state: ParticipantState) {
    // Add ticker item for active agents
    if (state.status !== 'idle' && state.tool) {
      const text = formatToolJa(state.tool);
      // Avoid duplicate consecutive entries
      const last = this.tickerItems[this.tickerItems.length - 1];
      if (!last || last.agent !== state.name || last.text !== text) {
        this.tickerItems.push({
          agent: state.name,
          text,
          timestamp: Date.now(),
        });
        // Keep last 20 items
        if (this.tickerItems.length > 20) {
          this.tickerItems = this.tickerItems.slice(-20);
        }
        this.renderTicker();
      }
    }

    this.renderAgentPips();
  }

  private renderTicker() {
    // Duplicate items for seamless loop
    const items = this.tickerItems.length > 0 ? this.tickerItems : [
      { agent: 'System', text: '\u5F85\u6A5F\u4E2D...', timestamp: Date.now() },
    ];

    const html = [...items, ...items].map(item =>
      `<span class="bb-item">
        <span class="agent-name">${item.agent}</span>
        <span>${item.text}</span>
        <span class="separator">\u25C6</span>
      </span>`
    ).join('');

    this.tickerEl.innerHTML = html;
  }

  private renderAgentPips() {
    const pipsEl = this.element.querySelector('#bb-agents') as HTMLDivElement;
    const participants = this.stateManager.getAllParticipants();
    pipsEl.innerHTML = participants.map(p =>
      `<span class="bb-agent-pip ${p.status}" title="${p.name}: ${formatStatusJa(p.status)}"></span>`
    ).join('');
  }

  private startScroll() {
    this.renderTicker();
    const speed = 0.5; // px per frame

    const tick = () => {
      this.scrollOffset += speed;
      const tickerWidth = this.tickerEl.scrollWidth / 2;
      if (tickerWidth > 0 && this.scrollOffset >= tickerWidth) {
        this.scrollOffset -= tickerWidth;
      }
      this.tickerEl.style.transform = `translateX(-${this.scrollOffset}px)`;
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.element.remove();
  }
}
