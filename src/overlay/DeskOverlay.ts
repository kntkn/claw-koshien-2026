import * as THREE from 'three';
import type { Desk } from '../scene/Desk';
import type { ParticipantState } from '../data/StateManager';

/**
 * DeskOverlay renders a CSS2D-style overlay via canvas sprites
 * showing participant name, status, and current tool.
 */
export class DeskOverlay {
  private sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private currentState: ParticipantState | null = null;

  constructor(private desk: Desk) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(1.6, 0.4, 1);
    this.sprite.position.set(0, 2.1, -0.22);
    this.desk.group.add(this.sprite);
  }

  update(state: ParticipantState) {
    if (
      this.currentState &&
      this.currentState.status === state.status &&
      this.currentState.tool === state.tool &&
      this.currentState.summary === state.summary
    ) {
      return; // No visual change
    }
    this.currentState = { ...state };
    this.render(state);
  }

  private render(state: ParticipantState) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = 'rgba(26, 30, 40, 0.9)';
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 12);
    ctx.fill();

    // Status indicator
    const statusColors: Record<string, string> = {
      thinking: '#f0c040',
      working: '#5cf89a',
      idle: '#607088',
    };
    ctx.fillStyle = statusColors[state.status] ?? '#607088';
    ctx.beginPath();
    ctx.arc(36, 44, 8, 0, Math.PI * 2);
    ctx.fill();

    // Status glow
    if (state.status !== 'idle') {
      ctx.shadowColor = statusColors[state.status];
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(36, 44, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Tool name
    if (state.tool) {
      ctx.fillStyle = '#a0c0ff';
      ctx.font = 'bold 22px system-ui';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatToolName(state.tool), 56, 40);
    }

    // Summary (bottom line)
    if (state.summary) {
      ctx.fillStyle = '#8a9aaa';
      ctx.font = '18px system-ui';
      ctx.fillText(
        state.summary.length > 40 ? state.summary.slice(0, 40) + '...' : state.summary,
        56,
        80,
      );
    }

    // Status text (right side)
    ctx.fillStyle = statusColors[state.status] ?? '#607088';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(state.status.toUpperCase(), canvas.width - 24, 40);
    ctx.textAlign = 'left';

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.desk.group.remove(this.sprite);
  }
}

function formatToolName(tool: string): string {
  // Strip mcp__ prefix and shorten
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    return parts.length > 2 ? `${parts[1]}/${parts[2]}` : parts[1];
  }
  return tool;
}
