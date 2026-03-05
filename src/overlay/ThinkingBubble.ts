import * as THREE from 'three';
import gsap from 'gsap';
import type { Desk } from '../scene/Desk';

/**
 * ThinkingBubble shows a floating thought bubble above the desk
 * when the agent is in 'thinking' state.
 */
export class ThinkingBubble {
  private sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private visible = false;
  private currentText = '';

  constructor(private desk: Desk) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 160;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      opacity: 0,
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(2.0, 0.625, 1);
    this.sprite.position.set(0, 2.6, 0);
    this.desk.group.add(this.sprite);
  }

  show(text: string) {
    if (this.visible && this.currentText === text) return;
    this.currentText = text;
    this.render(text);

    if (!this.visible) {
      this.visible = true;
      const mat = this.sprite.material as THREE.SpriteMaterial;
      gsap.to(mat, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
      });
      gsap.fromTo(
        this.sprite.position,
        { y: 2.3 },
        { y: 2.6, duration: 0.4, ease: 'back.out(1.5)' },
      );
    }
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    const mat = this.sprite.material as THREE.SpriteMaterial;
    gsap.to(mat, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    });
  }

  private render(text: string) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bubble background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;

    // Rounded rect
    const x = 16, y = 8, w = canvas.width - 32, h = canvas.height - 48;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();

    // Tail (small circles)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2 - 20, h + 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width / 2 - 35, h + 32, 6, 0, Math.PI * 2);
    ctx.fill();

    // "..." thinking indicator
    ctx.fillStyle = '#a0a0b0';
    ctx.font = 'bold 28px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('...', 32, 36);

    // Text
    ctx.fillStyle = '#1a1a28';
    ctx.font = '22px system-ui';
    const maxLen = 45;
    const displayText = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
    ctx.fillText(displayText, 32, 75);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.desk.group.remove(this.sprite);
  }
}
