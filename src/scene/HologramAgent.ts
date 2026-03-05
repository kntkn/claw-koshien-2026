import * as THREE from 'three';
import type { Desk } from './Desk';
import type { AgentStatus } from '../data/StateManager';

const AGENT_EMOJIS: Record<string, string> = {
  CEO: '\u{1F454}',
  CTO: '\u{1F4BB}',
  COO: '\u2699\uFE0F',
  CMO: '\u{1F4E2}',
  CFO: '\u{1F4B0}',
};

const STATUS_COLORS: Record<string, number> = {
  working: 0x5cf89a,
  thinking: 0xf0c040,
  idle: 0x405060,
};

export class HologramAgent {
  readonly group = new THREE.Group();
  private bodyMat: THREE.MeshStandardMaterial;
  private iconSprite: THREE.Sprite;
  private glowLight: THREE.PointLight;
  private status: AgentStatus = 'idle';
  private time = Math.random() * Math.PI * 2;

  constructor(desk: Desk, agentName: string) {
    this.group.name = `hologram-${agentName}`;

    // Position at chair location (desk local coords: chair seat at y=0.45, z=0.5)
    const chairPos = new THREE.Vector3(0, 0, 0.5);

    // Holographic body — translucent human-like silhouette
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.0, 8, 1, true);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: STATUS_COLORS.idle,
      emissive: STATUS_COLORS.idle,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.position.set(chairPos.x, 1.0, chairPos.z);
    this.group.add(body);

    // Head sphere
    const headGeo = new THREE.SphereGeometry(0.14, 12, 8);
    const headMat = this.bodyMat.clone();
    headMat.opacity = 0.35;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(chairPos.x, 1.6, chairPos.z);
    this.group.add(head);

    // Shoulders ring
    const shoulderGeo = new THREE.TorusGeometry(0.2, 0.03, 6, 12);
    const shoulderMat = this.bodyMat.clone();
    shoulderMat.opacity = 0.3;
    const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulders.position.set(chairPos.x, 1.45, chairPos.z);
    shoulders.rotation.x = Math.PI / 2;
    this.group.add(shoulders);

    // Emoji icon as sprite (Canvas texture)
    this.iconSprite = this.createEmojiSprite(
      AGENT_EMOJIS[agentName] ?? '\u{1F916}',
    );
    this.iconSprite.position.set(chairPos.x, 1.85, chairPos.z);
    this.group.add(this.iconSprite);

    // Subtle point light for glow effect
    this.glowLight = new THREE.PointLight(STATUS_COLORS.idle, 0.15, 3, 2);
    this.glowLight.position.set(chairPos.x, 1.2, chairPos.z);
    this.group.add(this.glowLight);

    // Base disc (hologram projector effect)
    const discGeo = new THREE.RingGeometry(0.1, 0.25, 16);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x40a0ff,
      emissive: 0x40a0ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(chairPos.x, 0.48, chairPos.z);
    this.group.add(disc);

    desk.group.add(this.group);
  }

  private createEmojiSprite(emoji: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    return sprite;
  }

  setStatus(status: AgentStatus) {
    if (this.status === status) return;
    this.status = status;

    const color = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
    this.bodyMat.color.setHex(color);
    this.bodyMat.emissive.setHex(color);
    this.bodyMat.emissiveIntensity = status === 'idle' ? 0.3 : 1.2;
    this.bodyMat.opacity = status === 'idle' ? 0.15 : 0.35;
    this.glowLight.color.setHex(color);
    this.glowLight.intensity = status === 'idle' ? 0.05 : 0.3;
  }

  /** Call each frame for breathing/pulse animation */
  update(dt: number) {
    this.time += dt;

    if (this.status === 'thinking') {
      // Pulsing opacity
      const pulse = 0.25 + 0.1 * Math.sin(this.time * 3);
      this.bodyMat.opacity = pulse;
    } else if (this.status === 'working') {
      // Gentle bob
      this.group.position.y = Math.sin(this.time * 1.5) * 0.02;
    } else {
      this.group.position.y = 0;
    }

    // Slow rotation of icon
    this.iconSprite.material.rotation = Math.sin(this.time * 0.5) * 0.1;
  }
}
