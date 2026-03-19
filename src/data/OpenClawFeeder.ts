import type { StateManager, AgentStatus, ToolEntry } from './StateManager';

interface AgentDef {
  id: string;
  deskId: string;
  name: string;
  sessionDir: string;
}

interface ParsedState {
  status: AgentStatus;
  tool: string;
  summary: string;
  lastTask: string;
  recentTools: ToolEntry[];
}

export class OpenClawFeeder {
  private stateManager: StateManager;
  private agents: AgentDef[];
  private interval: ReturnType<typeof setInterval> | null = null;
  private apiBase: string;

  constructor(stateManager: StateManager, apiBase = import.meta.env.VITE_SESSION_API || `http://${location.hostname}:9002`) {
    this.stateManager = stateManager;
    this.apiBase = apiBase;

    this.agents = [
      { id: 'ceo', deskId: 'desk-0', name: 'CEO', sessionDir: 'ceo' },
      { id: 'cto', deskId: 'desk-1', name: 'CTO', sessionDir: 'cto' },
      { id: 'coo', deskId: 'desk-2', name: 'COO', sessionDir: 'coo' },
      { id: 'cmo', deskId: 'desk-3', name: 'CMO', sessionDir: 'cmo' },
      { id: 'cfo', deskId: 'desk-4', name: 'CFO', sessionDir: 'cfo' },
    ];
  }

  getAgentNames(): string[] {
    return this.agents.map(a => a.name);
  }

  getAgentCount(): number {
    return this.agents.length;
  }

  start(intervalMs = 3000) {
    for (const agent of this.agents) {
      this.stateManager.updateParticipant(agent.deskId, {
        name: agent.name,
        status: 'idle',
        tool: '',
        summary: '',
        lastTask: '',
        recentTools: [],
      });
    }

    this.poll();
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll() {
    for (const agent of this.agents) {
      try {
        const resp = await fetch(`${this.apiBase}/agent/${agent.sessionDir}`);
        if (!resp.ok) continue;
        const data: ParsedState = await resp.json();
        this.stateManager.updateParticipant(agent.deskId, {
          name: agent.name,
          status: data.status,
          tool: data.tool,
          summary: data.summary,
          lastTask: data.lastTask ?? '',
          recentTools: data.recentTools ?? [],
        });
      } catch {
        // Server not reachable
      }
    }
  }
}
