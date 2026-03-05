import gsap from 'gsap';

/**
 * EventBanner displays the event title and status across the top of the screen.
 */
export class EventBanner {
  private element: HTMLDivElement;
  private visible = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'event-banner';
    this.element.innerHTML = `
      <style>
        #event-banner {
          position: absolute; top: 0; left: 0; right: 0; z-index: 90;
          background: linear-gradient(180deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0) 100%);
          padding: 20px 40px 40px;
          display: flex; align-items: center; justify-content: space-between;
          pointer-events: none;
          transform: translateY(-100%);
        }
        #event-banner.visible { transform: translateY(0); }
        .banner-title {
          font-family: 'SF Pro Display', system-ui, sans-serif;
          font-size: 28px; font-weight: 800; color: #e8eaf0;
          letter-spacing: 4px; text-transform: uppercase;
        }
        .banner-sub {
          font-size: 14px; font-weight: 400; color: #5cf89a;
          letter-spacing: 2px; margin-top: 4px;
        }
        .banner-right {
          text-align: right;
        }
        .banner-date {
          font-family: 'SF Mono', monospace; font-size: 16px; color: #8a9aaa;
          font-variant-numeric: tabular-nums;
        }
        .banner-venue {
          font-size: 12px; color: #607088; margin-top: 2px;
        }
      </style>
      <div>
        <div class="banner-title">Claw Koshien 2026</div>
        <div class="banner-sub">OpenClaw Agent Championship</div>
      </div>
      <div class="banner-right">
        <div class="banner-date">2026.03.19</div>
        <div class="banner-venue">Inspired.Lab, Tokyo</div>
      </div>
    `;
    document.getElementById('viewport')!.appendChild(this.element);
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    gsap.to(this.element, {
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
    });
    this.element.classList.add('visible');
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    gsap.to(this.element, {
      y: '-100%',
      duration: 0.4,
      ease: 'power2.in',
    });
    this.element.classList.remove('visible');
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  setTitle(title: string, sub?: string) {
    const titleEl = this.element.querySelector('.banner-title');
    if (titleEl) titleEl.textContent = title;
    if (sub) {
      const subEl = this.element.querySelector('.banner-sub');
      if (subEl) subEl.textContent = sub;
    }
  }

  handleCommand(command: string) {
    if (command === 'banner:show') this.show();
    else if (command === 'banner:hide') this.hide();
    else if (command === 'banner:toggle') this.toggle();
  }

  dispose() {
    this.element.remove();
  }
}
