import * as THREE from 'three';
import { Desk, type DeskConfig } from './Desk';

export interface DeskManagerConfig {
  count: number;
  columns: number;
  spacingX: number;
  spacingZ: number;
  names?: string[];
}

export class DeskManager {
  readonly group = new THREE.Group();
  readonly desks: Map<string, Desk> = new Map();
  private deskOrder: string[] = [];

  constructor(config: DeskManagerConfig) {
    this.group.name = 'desk-manager';
    this.layoutDesks(config);
  }

  private layoutDesks(config: DeskManagerConfig) {
    const { count, columns, spacingX, spacingZ, names } = config;
    const rows = Math.ceil(count / columns);
    const totalWidth = (columns - 1) * spacingX;
    const totalDepth = (rows - 1) * spacingZ;

    for (let i = 0; i < count; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const id = `desk-${i}`;
      const name = names?.[i] ?? `Agent ${i + 1}`;

      const x = col * spacingX - totalWidth / 2;
      const z = row * spacingZ - totalDepth / 2;

      const deskConfig: DeskConfig = {
        id,
        name,
        position: new THREE.Vector3(x, 0, z),
      };

      const desk = new Desk(deskConfig);
      this.desks.set(id, desk);
      this.deskOrder.push(id);
      this.group.add(desk.group);
    }
  }

  getDesk(id: string): Desk | undefined {
    return this.desks.get(id);
  }

  getDeskByIndex(index: number): Desk | undefined {
    const id = this.deskOrder[index];
    return id ? this.desks.get(id) : undefined;
  }

  getDeskIds(): string[] {
    return [...this.deskOrder];
  }

  getDeskCount(): number {
    return this.deskOrder.length;
  }

  /** Update desk from participant state */
  updateDesk(id: string, state: { status?: string; texture?: THREE.Texture | null }) {
    const desk = this.desks.get(id);
    if (!desk) return;
    if (state.status) {
      desk.setStatus(state.status as 'thinking' | 'working' | 'idle');
    }
    if (state.texture !== undefined) {
      desk.setScreenTexture(state.texture);
    }
  }
}
