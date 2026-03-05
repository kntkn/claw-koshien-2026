import * as THREE from 'three';

export interface DeskConfig {
  id: string;
  name: string;
  position: THREE.Vector3;
  rotation?: number; // Y-axis rotation in radians
}

export class Desk {
  readonly group = new THREE.Group();
  readonly monitorScreen: THREE.Mesh;
  readonly statusLED: THREE.Mesh;
  readonly nameLabel: THREE.Sprite;
  readonly config: DeskConfig;

  private ledMaterial: THREE.MeshStandardMaterial;

  constructor(config: DeskConfig) {
    this.config = config;
    this.group.name = `desk-${config.id}`;
    this.group.position.copy(config.position);
    if (config.rotation) this.group.rotation.y = config.rotation;

    this.createDeskSurface();
    this.createLegs();
    this.monitorScreen = this.createMonitor();
    this.createChair();
    this.statusLED = this.createStatusLED();
    this.ledMaterial = this.statusLED.material as THREE.MeshStandardMaterial;
    this.nameLabel = this.createNameLabel(config.name);
    this.createKeyboard();
  }

  private createDeskSurface() {
    const geo = new THREE.BoxGeometry(1.4, 0.05, 0.7);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a3a4a,
      roughness: 0.4,
      metalness: 0.2,
    });
    const surface = new THREE.Mesh(geo, mat);
    surface.position.y = 0.75;
    surface.castShadow = true;
    surface.receiveShadow = true;
    this.group.add(surface);
  }

  private createLegs() {
    const legGeo = new THREE.BoxGeometry(0.04, 0.75, 0.04);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x606068, metalness: 0.5 });
    const positions = [
      [-0.65, 0.375, -0.3],
      [0.65, 0.375, -0.3],
      [-0.65, 0.375, 0.3],
      [0.65, 0.375, 0.3],
    ];
    for (const [x, y, z] of positions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.group.add(leg);
    }
  }

  private createMonitor(): THREE.Mesh {
    // Monitor stand
    const standGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.6 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, 0.93, -0.2);
    this.group.add(stand);

    // Monitor base
    const baseGeo = new THREE.BoxGeometry(0.25, 0.02, 0.15);
    const base = new THREE.Mesh(baseGeo, standMat);
    base.position.set(0, 0.78, -0.2);
    this.group.add(base);

    // Monitor frame
    const frameGeo = new THREE.BoxGeometry(0.95, 0.55, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.3 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 1.35, -0.22);
    frame.castShadow = true;
    this.group.add(frame);

    // Monitor screen (where video texture goes)
    const screenGeo = new THREE.PlaneGeometry(0.88, 0.48);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x1a2848,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.35, -0.195);
    this.group.add(screen);

    return screen;
  }

  private createChair() {
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.45, 0.05, 0.45);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.8 });
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.set(0, 0.45, 0.5);
    seat.castShadow = true;
    this.group.add(seat);

    // Backrest
    const backGeo = new THREE.BoxGeometry(0.45, 0.5, 0.04);
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.72, 0.72);
    back.castShadow = true;
    this.group.add(back);

    // Chair base (cylinder)
    const baseGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.6 });
    const basePost = new THREE.Mesh(baseGeo, baseMat);
    basePost.position.set(0, 0.225, 0.5);
    this.group.add(basePost);

    // Casters
    const casterGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const casterPositions = [
      [-0.15, 0.03, 0.35], [0.15, 0.03, 0.35],
      [-0.15, 0.03, 0.65], [0.15, 0.03, 0.65],
    ];
    for (const [x, y, z] of casterPositions) {
      const caster = new THREE.Mesh(casterGeo, baseMat);
      caster.position.set(x, y, z);
      this.group.add(caster);
    }
  }

  private createStatusLED(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.08, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x607088,
      emissive: 0x607088,
      emissiveIntensity: 0.8,
    });
    const led = new THREE.Mesh(geo, mat);
    led.position.set(0.4, 1.62, -0.22);
    this.group.add(led);
    return led;
  }

  private createNameLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(26, 30, 40, 0.85)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.set(0, 2.2, 0);
    this.group.add(sprite);
    return sprite;
  }

  private createKeyboard() {
    const geo = new THREE.BoxGeometry(0.35, 0.015, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 });
    const keyboard = new THREE.Mesh(geo, mat);
    keyboard.position.set(-0.1, 0.785, 0.05);
    this.group.add(keyboard);

    // Mouse
    const mouseGeo = new THREE.BoxGeometry(0.06, 0.015, 0.1);
    const mouse = new THREE.Mesh(mouseGeo, mat);
    mouse.position.set(0.35, 0.785, 0.05);
    this.group.add(mouse);
  }

  setStatus(status: 'thinking' | 'working' | 'idle') {
    const colors: Record<string, number> = {
      thinking: 0xf0c040,
      working: 0x5cf89a,
      idle: 0x607088,
    };
    const color = colors[status] ?? colors.idle;
    this.ledMaterial.color.setHex(color);
    this.ledMaterial.emissive.setHex(color);
    this.ledMaterial.emissiveIntensity = status === 'idle' ? 0.3 : 2.0;
  }

  setScreenTexture(texture: THREE.Texture | null) {
    const mat = this.monitorScreen.material as THREE.MeshBasicMaterial;
    if (texture) {
      mat.map = texture;
      mat.color.setHex(0xffffff);
    } else {
      mat.map = null;
      mat.color.setHex(0x1a2848);
    }
    mat.needsUpdate = true;
  }

  /** Get world position of the monitor center (for camera focus) */
  getMonitorWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.monitorScreen.getWorldPosition(pos);
    return pos;
  }

  /** Get a good camera position for focusing on this desk */
  getFocusCameraPosition(): THREE.Vector3 {
    const monitorPos = this.getMonitorWorldPosition();
    return new THREE.Vector3(
      monitorPos.x,
      monitorPos.y + 0.3,
      monitorPos.z + 2.0,
    );
  }
}
