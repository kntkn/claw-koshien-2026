import * as THREE from 'three';
import type { DeskManager } from '../scene/DeskManager';
import type { StreamManager, StreamEntry } from './StreamManager';

export type RenderTier = 'full' | 'snapshot' | 'none';

interface TextureEntry {
  deskId: string;
  streamId: string;
  videoTexture: THREE.VideoTexture | null;
  canvasTexture: THREE.CanvasTexture | null;
  canvas: HTMLCanvasElement | null;
  tier: RenderTier;
  lastSnapshotTime: number;
}

export class VideoTexturePool {
  private entries = new Map<string, TextureEntry>();
  private deskManager: DeskManager;
  private streamManager: StreamManager;
  private camera: THREE.Camera;
  private snapshotIntervalMs = 3000;

  // Distance thresholds for tiered rendering
  private fullDistanceMax = 5;
  private snapshotDistanceMax = 15;

  constructor(
    deskManager: DeskManager,
    streamManager: StreamManager,
    camera: THREE.Camera,
  ) {
    this.deskManager = deskManager;
    this.streamManager = streamManager;
    this.camera = camera;
  }

  /** Register a stream for a desk */
  register(deskId: string, streamId: string) {
    this.entries.set(deskId, {
      deskId,
      streamId,
      videoTexture: null,
      canvasTexture: null,
      canvas: null,
      tier: 'none',
      lastSnapshotTime: 0,
    });
  }

  /** Update all textures based on camera distance */
  update() {
    const cameraPos = this.camera.position;
    const now = performance.now();

    for (const [deskId, entry] of this.entries) {
      const desk = this.deskManager.getDesk(deskId);
      const stream = this.streamManager.getStream(entry.streamId);
      if (!desk || !stream || !stream.active) {
        if (entry.tier !== 'none') {
          this.setTier(entry, 'none', desk);
        }
        continue;
      }

      const monitorPos = desk.getMonitorWorldPosition();
      const distance = cameraPos.distanceTo(monitorPos);

      let targetTier: RenderTier;
      if (distance <= this.fullDistanceMax) {
        targetTier = 'full';
      } else if (distance <= this.snapshotDistanceMax) {
        targetTier = 'snapshot';
      } else {
        targetTier = 'none';
      }

      if (targetTier !== entry.tier) {
        this.setTier(entry, targetTier, desk, stream);
      }

      // Update snapshot if in snapshot tier
      if (entry.tier === 'snapshot' && now - entry.lastSnapshotTime > this.snapshotIntervalMs) {
        this.captureSnapshot(entry, stream);
        entry.lastSnapshotTime = now;
      }
    }
  }

  private setTier(
    entry: TextureEntry,
    tier: RenderTier,
    desk: ReturnType<DeskManager['getDesk']>,
    stream?: StreamEntry,
  ) {
    // Cleanup previous tier
    if (entry.tier === 'full' && entry.videoTexture) {
      entry.videoTexture.dispose();
      entry.videoTexture = null;
    }

    entry.tier = tier;

    if (!desk) return;

    if (tier === 'full' && stream) {
      const vt = new THREE.VideoTexture(stream.videoElement);
      vt.minFilter = THREE.LinearFilter;
      vt.magFilter = THREE.LinearFilter;
      vt.colorSpace = THREE.SRGBColorSpace;
      entry.videoTexture = vt;
      desk.setScreenTexture(vt);
    } else if (tier === 'snapshot' && stream) {
      if (!entry.canvas) {
        entry.canvas = document.createElement('canvas');
        entry.canvas.width = 320;
        entry.canvas.height = 180;
      }
      if (!entry.canvasTexture) {
        entry.canvasTexture = new THREE.CanvasTexture(entry.canvas);
        entry.canvasTexture.colorSpace = THREE.SRGBColorSpace;
      }
      this.captureSnapshot(entry, stream);
      desk.setScreenTexture(entry.canvasTexture);
    } else {
      desk.setScreenTexture(null);
    }
  }

  private captureSnapshot(entry: TextureEntry, stream: StreamEntry) {
    if (!entry.canvas) return;
    const ctx = entry.canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(stream.videoElement, 0, 0, entry.canvas.width, entry.canvas.height);
      if (entry.canvasTexture) {
        entry.canvasTexture.needsUpdate = true;
      }
    } catch {
      // Video not ready yet
    }
  }

  dispose() {
    for (const entry of this.entries.values()) {
      entry.videoTexture?.dispose();
      entry.canvasTexture?.dispose();
    }
    this.entries.clear();
  }
}
