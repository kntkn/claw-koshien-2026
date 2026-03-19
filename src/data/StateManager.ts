export type AgentStatus = 'thinking' | 'working' | 'idle';

export interface ToolEntry {
  name: string;
  timestamp: string;
}

export interface ParticipantState {
  id: string;
  name: string;
  status: AgentStatus;
  tool: string;
  summary: string;
  lastTask: string;
  recentTools: ToolEntry[];
  streamId?: string;
  score?: number;
  progress?: number;
  votes?: number;
  rank?: number;
  updatedAt: number;
}

type StateListener = (id: string, state: ParticipantState) => void;

export class StateManager {
  private participants = new Map<string, ParticipantState>();
  private listeners: StateListener[] = [];

  getParticipant(id: string): ParticipantState | undefined {
    return this.participants.get(id);
  }

  getAllParticipants(): ParticipantState[] {
    return [...this.participants.values()];
  }

  getParticipantIds(): string[] {
    return [...this.participants.keys()];
  }

  updateParticipant(id: string, partial: Partial<ParticipantState>) {
    const existing = this.participants.get(id) ?? {
      id,
      name: id,
      status: 'idle' as AgentStatus,
      tool: '',
      summary: '',
      lastTask: '',
      recentTools: [],
      updatedAt: Date.now(),
    };
    const updated = { ...existing, ...partial, updatedAt: Date.now() };
    this.participants.set(id, updated);
    this.notifyListeners(id, updated);
  }

  removeParticipant(id: string) {
    this.participants.delete(id);
  }

  onUpdate(listener: StateListener) {
    this.listeners.push(listener);
  }

  private notifyListeners(id: string, state: ParticipantState) {
    for (const listener of this.listeners) {
      listener(id, state);
    }
  }

  /** Mark stale participants as idle (no update for > threshold ms) */
  checkStale(thresholdMs = 30000) {
    const now = Date.now();
    for (const [id, state] of this.participants) {
      if (state.status !== 'idle' && now - state.updatedAt > thresholdMs) {
        this.updateParticipant(id, { status: 'idle', tool: '', summary: '' });
      }
    }
  }
}
