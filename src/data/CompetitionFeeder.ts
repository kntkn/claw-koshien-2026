import type { StateManager } from './StateManager';
import type { CompetitionEvent } from './CompetitionTypes';

/**
 * Receives competition events from the relay WebSocket and updates StateManager.
 * Event-driven — no polling.
 */
export class CompetitionFeeder {
  private stateManager: StateManager;
  private onTeamDiscovered: ((teamId: string, teamName: string) => void) | null = null;
  private knownTeams = new Set<string>();

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /** Register callback for when a new team appears */
  onNewTeam(callback: (teamId: string, teamName: string) => void) {
    this.onTeamDiscovered = callback;
  }

  /** Handle a competition event from the relay */
  handleEvent(event: CompetitionEvent) {
    if (!event.teamId) return;

    const deskId = `desk-${event.teamId}`;

    // Notify if new team
    if (!this.knownTeams.has(event.teamId)) {
      this.knownTeams.add(event.teamId);
      this.onTeamDiscovered?.(event.teamId, event.teamName ?? event.teamId);
    }

    switch (event.type) {
      case 'progress':
        this.stateManager.updateParticipant(deskId, {
          name: event.teamName ?? event.teamId,
          status: (event.status as 'working' | 'thinking' | 'idle') ?? 'idle',
          tool: event.tool ?? '',
          summary: event.summary ?? '',
        });
        // Add to recent tools if tool is specified
        if (event.tool) {
          const existing = this.stateManager.getParticipant(deskId);
          if (existing) {
            const recentTools = [...existing.recentTools];
            recentTools.push({
              name: event.tool,
              timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });
            // Keep last 20
            if (recentTools.length > 20) recentTools.splice(0, recentTools.length - 20);
            this.stateManager.updateParticipant(deskId, { recentTools });
          }
        }
        break;

      case 'score':
        if (event.score !== undefined) {
          this.stateManager.updateParticipant(deskId, {
            name: event.teamName ?? event.teamId,
            score: event.score,
          });
        }
        break;

      case 'vote':
        if (event.votes !== undefined) {
          this.stateManager.updateParticipant(deskId, {
            name: event.teamName ?? event.teamId,
            votes: event.votes,
          });
        }
        break;

      case 'commentary':
        // Commentary is handled by BroadcastBar directly
        break;
    }
  }

  /** Load initial state from relay GET /state for late-connecting clients */
  async loadInitialState(relayUrl: string) {
    try {
      const res = await fetch(`${relayUrl}/state`);
      if (!res.ok) return;
      const state = await res.json();
      if (state.teams) {
        for (const [teamId, team] of Object.entries(state.teams)) {
          const t = team as any;
          this.handleEvent({
            type: 'progress',
            teamId,
            teamName: t.name ?? teamId,
            status: t.status ?? 'idle',
            tool: t.tool ?? '',
            summary: t.summary ?? '',
          });
          if (t.score) {
            this.handleEvent({ type: 'score', teamId, teamName: t.name, score: t.score });
          }
          if (t.votes) {
            this.handleEvent({ type: 'vote', teamId, teamName: t.name, votes: t.votes });
          }
        }
      }
    } catch {
      console.warn('[CompetitionFeeder] Failed to load initial state');
    }
  }
}
