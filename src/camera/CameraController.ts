import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import type { DeskManager } from '../scene/DeskManager';

export type CameraMode = 'overview' | 'focus' | 'tour';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private deskManager: DeskManager;
  private mode: CameraMode = 'overview';
  private focusedDeskId: string | null = null;
  private activeTween: gsap.core.Tween | null = null;
  readonly controls: OrbitControls;

  private readonly overviewPos = new THREE.Vector3(0, 2.8, 11);
  private readonly overviewTarget = new THREE.Vector3(0, 1.6, 0);

  constructor(camera: THREE.PerspectiveCamera, deskManager: DeskManager, domElement: HTMLElement) {
    this.camera = camera;
    this.deskManager = deskManager;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 25;
    this.controls.maxPolarAngle = Math.PI * 0.48; // Don't go below floor
    this.controls.target.copy(this.overviewTarget);

    this.setOverview(false);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getFocusedDeskId(): string | null {
    return this.focusedDeskId;
  }

  setOverview(animate = true) {
    this.mode = 'overview';
    this.focusedDeskId = null;
    this.animateTo(this.overviewPos, this.overviewTarget, animate);
  }

  focusDesk(deskId: string, animate = true) {
    const desk = this.deskManager.getDesk(deskId);
    if (!desk) return;

    this.mode = 'focus';
    this.focusedDeskId = deskId;

    const cameraPos = desk.getFocusCameraPosition();
    const lookAt = desk.getMonitorWorldPosition();
    this.animateTo(cameraPos, lookAt, animate);
  }

  focusDeskByIndex(index: number, animate = true) {
    const desk = this.deskManager.getDeskByIndex(index);
    if (!desk) return;
    this.focusDesk(desk.config.id, animate);
  }

  private animateTo(position: THREE.Vector3, target: THREE.Vector3, animate: boolean) {
    if (this.activeTween) {
      this.activeTween.kill();
      this.activeTween = null;
    }

    if (!animate) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    // Temporarily disable damping during animation
    this.controls.enabled = false;

    const proxy = {
      px: this.camera.position.x,
      py: this.camera.position.y,
      pz: this.camera.position.z,
      tx: this.controls.target.x,
      ty: this.controls.target.y,
      tz: this.controls.target.z,
    };

    this.activeTween = gsap.to(proxy, {
      px: position.x,
      py: position.y,
      pz: position.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.position.set(proxy.px, proxy.py, proxy.pz);
        this.controls.target.set(proxy.tx, proxy.ty, proxy.tz);
        this.controls.update();
      },
      onComplete: () => {
        this.activeTween = null;
        this.controls.enabled = true;
      },
    });
  }

  handleCommand(command: string) {
    if (command === 'camera:overview') {
      this.setOverview();
    } else if (command.startsWith('camera:focus:')) {
      const id = command.replace('camera:focus:', '');
      this.focusDesk(id);
    }
  }

  update() {
    if (!this.activeTween) {
      this.controls.update();
    }
  }
}
