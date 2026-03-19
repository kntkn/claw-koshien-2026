import type { StateManager } from '../data/StateManager';

const TOOL_CATEGORIES: Record<string, { label: string; color: string }> = {
  slack: { label: 'Slack', color: '#4a154b' },
  github: { label: 'GitHub', color: '#238636' },
  notion: { label: 'Notion', color: '#ffffff' },
  read: { label: 'Read', color: '#4a9eff' },
  write: { label: 'Write', color: '#f97316' },
  edit: { label: 'Edit', color: '#eab308' },
  bash: { label: 'Bash', color: '#22c55e' },
  grep: { label: 'Grep', color: '#a855f7' },
  web: { label: 'Web', color: '#06b6d4' },
  other: { label: 'Other', color: '#6b7280' },
};

function categorize(toolName: string): string {
  const lower = toolName.toLowerCase();
  if (lower.includes('slack')) return 'slack';
  if (lower.includes('github')) return 'github';
  if (lower.includes('notion')) return 'notion';
  if (lower.includes('read')) return 'read';
  if (lower.includes('write')) return 'write';
  if (lower.includes('edit')) return 'edit';
  if (lower.includes('bash')) return 'bash';
  if (lower.includes('grep') || lower.includes('glob')) return 'grep';
  if (lower.includes('web') || lower.includes('fetch')) return 'web';
  return 'other';
}

export class ToolGraph {
  private container: HTMLDivElement;
  private stateManager: StateManager;

  constructor(stateManager: StateManager, parentEl: HTMLElement) {
    this.stateManager = stateManager;
    this.container = document.createElement('div');
    this.container.id = 'tool-graph';
    this.injectStyles();
    parentEl.appendChild(this.container);

    stateManager.onUpdate(() => this.render());
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #tool-graph {
        padding: 8px 12px;
        border-top: 1px solid #1e2230;
      }
      .tg-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #5cf89a;
        margin-bottom: 8px;
      }
      .tg-row {
        margin-bottom: 6px;
      }
      .tg-label {
        font-size: 10px;
        color: #8a9aaa;
        margin-bottom: 2px;
      }
      .tg-bar {
        display: flex;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
        background: #1e2230;
      }
      .tg-segment {
        height: 100%;
        transition: width 0.3s ease;
        min-width: 0;
      }
      .tg-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .tg-legend-item {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 9px;
        color: #607088;
      }
      .tg-legend-dot {
        width: 6px;
        height: 6px;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    const participants = this.stateManager.getAllParticipants();
    if (participants.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    // Count tool categories per participant
    const rows = participants.map(p => {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const t of p.recentTools) {
        const cat = categorize(t.name);
        counts[cat] = (counts[cat] ?? 0) + 1;
        total++;
      }
      return { name: p.name, counts, total };
    });

    // Build legend from all used categories
    const usedCategories = new Set<string>();
    for (const row of rows) {
      for (const cat of Object.keys(row.counts)) usedCategories.add(cat);
    }

    this.container.innerHTML = `
      <div class="tg-title">Tool Usage</div>
      ${rows.map(row => `
        <div class="tg-row">
          <div class="tg-label">${row.name}</div>
          <div class="tg-bar">
            ${row.total > 0 ? Object.entries(row.counts).map(([cat, count]) => {
              const pct = (count / row.total) * 100;
              const cfg = TOOL_CATEGORIES[cat] ?? TOOL_CATEGORIES.other;
              return `<div class="tg-segment" style="width:${pct}%;background:${cfg.color}" title="${cfg.label}: ${count}"></div>`;
            }).join('') : ''}
          </div>
        </div>
      `).join('')}
      <div class="tg-legend">
        ${[...usedCategories].map(cat => {
          const cfg = TOOL_CATEGORIES[cat] ?? TOOL_CATEGORIES.other;
          return `<span class="tg-legend-item"><span class="tg-legend-dot" style="background:${cfg.color}"></span>${cfg.label}</span>`;
        }).join('')}
      </div>
    `;
  }
}
