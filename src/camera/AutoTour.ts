import type { CameraController } from './CameraController';
import type { DeskManager } from '../scene/DeskManager';

export class AutoTour {
  private controller: CameraController;
  private deskManager: DeskManager;
  private running = false;
  private currentIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pauseMs: number;

  constructor(controller: CameraController, deskManager: DeskManager, pauseMs = 8000) {
    this.controller = controller;
    this.deskManager = deskManager;
    this.pauseMs = pauseMs;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.currentIndex = 0;
    this.advance();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isRunning() {
    return this.running;
  }

  setPause(ms: number) {
    this.pauseMs = ms;
  }

  private advance() {
    if (!this.running) return;

    const count = this.deskManager.getDeskCount();
    if (count === 0) return;

    this.controller.focusDeskByIndex(this.currentIndex);
    this.currentIndex = (this.currentIndex + 1) % count;

    this.timer = setTimeout(() => this.advance(), this.pauseMs);
  }
}
