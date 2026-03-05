import * as THREE from 'three';
import type { Desk } from '../scene/Desk';

/**
 * ToolBadge shows the currently-used tool as a small badge
 * next to the monitor.
 */
export class ToolBadge {
  private sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private currentTool = '';

  constructor(private desk: Desk) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(0.8, 0.2, 1);
    this.sprite.position.set(-0.55, 1.65, -0.15);
    this.sprite.visible = false;
    this.desk.group.add(this.sprite);
  }

  update(tool: string) {
    if (this.currentTool === tool) return;
    this.currentTool = tool;

    if (!tool) {
      this.sprite.visible = false;
      return;
    }

    this.render(tool);
    this.sprite.visible = true;
  }

  private render(tool: string) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Badge background
    const color = this.getToolColor(tool);
    ctx.fillStyle = color;
    ctx.roundRect(4, 8, canvas.width - 8, canvas.height - 16, 10);
    ctx.fill();

    // Tool name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = this.formatTool(tool);
    ctx.fillText(label.slice(0, 15), canvas.width / 2, canvas.height / 2);

    this.texture.needsUpdate = true;
  }

  private formatTool(tool: string): string {
    if (tool.startsWith('mcp__')) {
      const parts = tool.split('__');
      return parts[parts.length - 1];
    }
    return tool;
  }

  private getToolColor(tool: string): string {
    const colors: Record<string, string> = {
      Read: '#3b82f6',
      Write: '#10b981',
      Edit: '#f59e0b',
      Bash: '#ef4444',
      Grep: '#8b5cf6',
      Glob: '#6366f1',
      Agent: '#ec4899',
      WebSearch: '#06b6d4',
      WebFetch: '#14b8a6',
    };
    return colors[tool] ?? '#6b7280';
  }

  dispose() {
    this.texture.dispose();
    this.desk.group.remove(this.sprite);
  }
}
