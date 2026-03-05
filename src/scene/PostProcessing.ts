import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostProcessing {
  readonly composer: EffectComposer;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6,   // strength
      0.4,   // radius
      0.7,   // threshold - only high-emissive objects glow
    );
    this.composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}
