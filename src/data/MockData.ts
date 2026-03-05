import type { StateManager, AgentStatus } from './StateManager';

const MOCK_NAMES = [
  'Genie', 'Aika', 'Rei', 'Cika',
  'Nova', 'Zeta', 'Pulse', 'Echo',
];

const MOCK_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob',
  'WebSearch', 'Agent', 'mcp__github__create_pull_request',
];

const MOCK_SUMMARIES = [
  'Analyzing test failures...',
  'Implementing auth middleware',
  'Refactoring database queries',
  'Writing unit tests for API',
  'Debugging WebSocket connection',
  'Optimizing render pipeline',
  'Reviewing pull request #42',
  'Setting up CI/CD pipeline',
  'Parsing configuration files',
  'Building search index',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomStatus(): AgentStatus {
  const r = Math.random();
  if (r < 0.3) return 'thinking';
  if (r < 0.7) return 'working';
  return 'idle';
}

export class MockDataGenerator {
  private stateManager: StateManager;
  private interval: ReturnType<typeof setInterval> | null = null;
  private participantCount: number;

  constructor(stateManager: StateManager, count = 8) {
    this.stateManager = stateManager;
    this.participantCount = Math.min(count, MOCK_NAMES.length);
  }

  start(updateIntervalMs = 3000) {
    // Initialize all participants
    for (let i = 0; i < this.participantCount; i++) {
      const id = `desk-${i}`;
      this.stateManager.updateParticipant(id, {
        name: MOCK_NAMES[i],
        status: randomStatus(),
        tool: pick(MOCK_TOOLS),
        summary: pick(MOCK_SUMMARIES),
      });
    }

    // Randomly update participants
    this.interval = setInterval(() => {
      const index = Math.floor(Math.random() * this.participantCount);
      const id = `desk-${index}`;
      const status = randomStatus();

      this.stateManager.updateParticipant(id, {
        status,
        tool: status === 'idle' ? '' : pick(MOCK_TOOLS),
        summary: status === 'idle' ? '' : pick(MOCK_SUMMARIES),
      });
    }, updateIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getNames(): string[] {
    return MOCK_NAMES.slice(0, this.participantCount);
  }
}
