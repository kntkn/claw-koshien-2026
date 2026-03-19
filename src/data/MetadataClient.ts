import type { StateManager } from './StateManager';

export class MetadataClient {
  private ws: WebSocket | null = null;
  private stateManager: StateManager;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private commandListeners: Array<(command: string) => void> = [];
  private competitionListeners: Array<(event: any) => void> = [];

  constructor(stateManager: StateManager, url?: string) {
    this.stateManager = stateManager;
    this.url = url ?? (import.meta.env.VITE_RELAY_WS || `ws://${location.hostname}:9001`);
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[MetadataClient] Connected to relay server');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 15000);
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (msg.type === 'state') {
      this.stateManager.updateParticipant(msg.id as string, {
        name: (msg.name as string) ?? (msg.id as string),
        status: (msg.status as 'thinking' | 'working' | 'idle') ?? 'idle',
        tool: (msg.tool as string) ?? '',
        summary: (msg.summary as string) ?? '',
      });
    } else if (msg.type === 'mc-command') {
      const command = msg.command as string;
      for (const listener of this.commandListeners) {
        listener(command);
      }
    } else if (['progress', 'score', 'task', 'timer', 'commentary', 'vote'].includes(msg.type as string)) {
      // Competition events — delegate to listeners
      for (const listener of this.competitionListeners) {
        listener(msg as any);
      }
    }
  }

  onCommand(listener: (command: string) => void) {
    this.commandListeners.push(listener);
  }

  onCompetitionEvent(listener: (event: any) => void) {
    this.competitionListeners.push(listener);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
