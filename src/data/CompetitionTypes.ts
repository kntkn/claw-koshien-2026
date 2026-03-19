// Shared types for the competition system

export type CompetitionEventType = 'progress' | 'score' | 'task' | 'timer' | 'commentary' | 'vote';

export interface CompetitionEvent {
  type: CompetitionEventType;
  teamId: string;
  teamName: string;
  timestamp?: number;
  // progress events
  status?: 'working' | 'thinking' | 'idle' | 'complete';
  tool?: string;
  summary?: string;
  // score events
  score?: number;
  breakdown?: Record<string, number>;
  // task events
  taskTitle?: string;
  taskDescription?: string;
  // timer events
  action?: 'start' | 'stop' | 'reset';
  // commentary events
  commentary?: string;
  // vote events
  votes?: number;
}

export interface CompetitionTeam {
  id: string;
  name: string;
  score: number;
  progress: number; // 0-100
  status: 'working' | 'thinking' | 'idle' | 'complete';
  tool: string;
  summary: string;
  votes: number;
  recentTools: Array<{ name: string; timestamp: string }>;
  updatedAt: number;
}

export interface CompetitionTask {
  id: string;
  title: string;
  description: string;
  startedAt: number;
}

export interface CompetitionState {
  teams: Map<string, CompetitionTeam>;
  task: CompetitionTask | null;
  timerStart: number | null;
  timerRunning: boolean;
  commentary: string[];
}
