import * as THREE from 'three';
import { loadBrickPBR, loadWoodPBR, loadLeatherPBR, loadConcretePBR, loadMetalPBR } from './TextureManager';

const CEILING_H = 8;
const HALF_H = CEILING_H / 2;

/**
 * Inspired.Lab (Otemachi, Tokyo) style office environment.
 * High ceiling (8m), large front glass wall, Edison bulb grid.
 */
export class Office {
  readonly group = new THREE.Group();

  constructor() {
    this.group.name = 'office';
    this.createFloor();
    this.createBrickWalls();
    this.createFrontGlassWall();
    this.createExposedCeiling();
    this.createEdisonBulbGrid();
    this.createBrickPillars();
    this.createLoungeFurniture();
    this.createPlants();
    this.createLargeDisplay();
    this.createMezzanineRailing();
    this.createLighting();
  }

  /** Herringbone wood floor (PBR textured) */
  private createFloor() {
    const woodPBR = loadWoodPBR(6, 4);
    const geo = new THREE.PlaneGeometry(30, 20);
    const mat = new THREE.MeshStandardMaterial({
      ...woodPBR,
      color: 0xccaa70,
      roughness: 0.7,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Striped carpet runner in center aisle
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x3a3530,
      roughness: 0.95,
    });
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.5), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.005, 3);
    carpet.receiveShadow = true;
    this.group.add(carpet);
  }

  /** Brick side walls (PBR textured) — back wall is now glass */
  private createBrickWalls() {
    const sideBrickPBR = loadBrickPBR(4, 2);
    const sideWallMat = new THREE.MeshStandardMaterial({
      ...sideBrickPBR,
      color: 0x9a6040,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(20, CEILING_H),
      sideWallMat,
    );
    leftWall.position.set(-15, HALF_H, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.group.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(20, CEILING_H),
      sideWallMat,
    );
    rightWall.position.set(15, HALF_H, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.group.add(rightWall);

    // Rear wall (opposite from glass — brick with small accent windows)
    const brickPBR = loadBrickPBR(6, 2);
    const rearMat = new THREE.MeshStandardMaterial({
      ...brickPBR,
      color: 0xbb7755,
      roughness: 0.9,
    });
    const rearWall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, CEILING_H),
      rearMat,
    );
    rearWall.position.set(0, HALF_H, 10);
    rearWall.rotation.y = Math.PI;
    this.group.add(rearWall);
  }

  /** Full-height glass wall at front (z = -10) */
  private createFrontGlassWall() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.8,
      roughness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a1525,
      emissive: 0x050a15,
      emissiveIntensity: 0.15,
      metalness: 0.4,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });

    // Thin structural mullions dividing the glass wall into panels
    const panelCount = 6;
    const totalWidth = 30;
    const panelWidth = totalWidth / panelCount;
    const glassHeight = CEILING_H - 0.3;

    for (let i = 0; i < panelCount; i++) {
      const x = (i + 0.5) * panelWidth - totalWidth / 2;

      // Glass pane
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(panelWidth - 0.12, glassHeight),
        glassMat,
      );
      glass.position.set(x, glassHeight / 2 + 0.15, -10);
      this.group.add(glass);
    }

    // Vertical mullions
    for (let i = 0; i <= panelCount; i++) {
      const x = i * panelWidth - totalWidth / 2;
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, CEILING_H, 0.06),
        frameMat,
      );
      mullion.position.set(x, HALF_H, -10);
      this.group.add(mullion);
    }

    // Horizontal transom bar at 2/3 height
    const transom = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, 0.04, 0.06),
      frameMat,
    );
    transom.position.set(0, CEILING_H * 0.65, -10);
    this.group.add(transom);

    // Bottom sill
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, 0.15, 0.1),
      frameMat,
    );
    sill.position.set(0, 0.075, -10);
    this.group.add(sill);

    // Subtle cityscape glow from outside
    const glowLight = new THREE.RectAreaLight(0x223355, 0.5, totalWidth, glassHeight);
    glowLight.position.set(0, HALF_H, -10.5);
    glowLight.lookAt(0, HALF_H, 0);
    this.group.add(glowLight);
  }

  /** Exposed industrial ceiling with pipes and ducts (PBR) */
  private createExposedCeiling() {
    const concretePBR = loadConcretePBR(4, 3);
    const ceilMat = new THREE.MeshStandardMaterial({
      ...concretePBR,
      color: 0x444444,
      roughness: 0.95,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = CEILING_H;
    this.group.add(ceiling);

    // Main structural beams (metal PBR)
    const metalPBR = loadMetalPBR(1, 4);
    const beamMat = new THREE.MeshStandardMaterial({
      ...metalPBR,
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.4,
    });
    for (let x = -10; x <= 10; x += 10) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.5, 20),
        beamMat,
      );
      beam.position.set(x, CEILING_H - 0.25, 0);
      this.group.add(beam);
    }

    // Cross beams
    for (let z = -8; z <= 8; z += 8) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(30, 0.3, 0.25),
        beamMat,
      );
      beam.position.set(0, CEILING_H - 0.35, z);
      this.group.add(beam);
    }

    // Duct pipes
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x606060,
      metalness: 0.5,
      roughness: 0.3,
    });
    const duct = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.5, 20),
      pipeMat,
    );
    duct.position.set(-5, CEILING_H - 0.6, 0);
    this.group.add(duct);

    // Round pipes
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 20, 8);
    for (const x of [-3, 5, 8]) {
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, CEILING_H - 0.5, 0);
      this.group.add(pipe);
    }

    // Conduit on ceiling
    const conduitGeo = new THREE.CylinderGeometry(0.03, 0.03, 30, 6);
    for (const z of [-4, 2, 6]) {
      const c = new THREE.Mesh(conduitGeo, pipeMat);
      c.rotation.z = Math.PI / 2;
      c.position.set(0, CEILING_H - 0.15, z);
      this.group.add(c);
    }
  }

  /** Edison bulb grid - signature Inspired.Lab ceiling feature (InstancedMesh) */
  private createEdisonBulbGrid() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.7,
      roughness: 0.3,
    });

    const gridStartX = -8;
    const gridEndX = 8;
    const gridStartZ = -6;
    const gridEndZ = 4;
    const gridY = 5.5; // Hangs from ceiling
    const spacing = 1.0;

    // X rails
    for (let z = gridStartZ; z <= gridEndZ; z += spacing) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(gridEndX - gridStartX, 0.015, 0.015),
        frameMat,
      );
      rail.position.set(0, gridY, z);
      this.group.add(rail);
    }
    // Z rails
    for (let x = gridStartX; x <= gridEndX; x += spacing) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.015, gridEndZ - gridStartZ),
        frameMat,
      );
      rail.position.set(x, gridY, (gridStartZ + gridEndZ) / 2);
      this.group.add(rail);
    }

    // Suspension rods from ceiling to grid
    const rodLen = CEILING_H - gridY;
    for (let x = gridStartX; x <= gridEndX; x += 4) {
      for (let z = gridStartZ; z <= gridEndZ; z += 5) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, rodLen, 4),
          frameMat,
        );
        rod.position.set(x, gridY + rodLen / 2, z);
        this.group.add(rod);
      }
    }

    // Collect bulb positions
    const positions: Array<{ x: number; y: number; z: number; wireY: number }> = [];
    for (let x = gridStartX; x <= gridEndX; x += spacing) {
      for (let z = gridStartZ; z <= gridEndZ; z += spacing) {
        const yOff = Math.sin(x * 3.7 + z * 2.3) * 0.05;
        positions.push({ x, y: gridY - 0.35 + yOff, z, wireY: gridY - 0.15 });
      }
    }

    // InstancedMesh for bulbs
    const bulbGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffcc44,
      emissive: 0xff932c,
      emissiveIntensity: 3.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const bulbInstances = new THREE.InstancedMesh(bulbGeo, bulbMat, positions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      bulbInstances.setMatrixAt(i, dummy.matrix);
    }
    bulbInstances.instanceMatrix.needsUpdate = true;
    this.group.add(bulbInstances);

    // InstancedMesh for wires
    const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4);
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.5,
    });
    const wireInstances = new THREE.InstancedMesh(wireGeo, wireMat, positions.length);
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.wireY, p.z);
      dummy.updateMatrix();
      wireInstances.setMatrixAt(i, dummy.matrix);
    }
    wireInstances.instanceMatrix.needsUpdate = true;
    this.group.add(wireInstances);

    // Representative point lights
    for (let x = gridStartX; x <= gridEndX; x += spacing * 4) {
      for (let z = gridStartZ; z <= gridEndZ; z += spacing * 4) {
        const light = new THREE.PointLight(0xffaa44, 1.0, 10, 2);
        light.position.set(x, gridY - 0.3, z);
        this.group.add(light);
      }
    }
  }

  /** Brick pillars floor-to-ceiling (PBR) */
  private createBrickPillars() {
    const brickPBR = loadBrickPBR(1, 3);
    const pillarMat = new THREE.MeshStandardMaterial({
      ...brickPBR,
      color: 0xbb7755,
      roughness: 0.85,
      metalness: 0.0,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      ...brickPBR,
      color: 0xcc8866,
      roughness: 0.9,
    });

    const pillarPositions: Array<[number, number]> = [
      [-8, -6], [8, -6],
      [-8, 4], [8, 4],
    ];

    for (const [x, z] of pillarPositions) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, CEILING_H, 0.8),
        pillarMat,
      );
      pillar.position.set(x, HALF_H, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);

      // Accent band at eye level
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.0, 0.85),
        accentMat,
      );
      accent.position.set(x, 2.5, z);
      this.group.add(accent);

      // Decorative holes
      const holeMat = new THREE.MeshStandardMaterial({ color: 0x3a2010 });
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const hole = new THREE.Mesh(
            new THREE.CircleGeometry(0.06, 6),
            holeMat,
          );
          hole.position.set(
            x + (col - 1) * 0.18,
            2.2 + row * 0.3,
            z + 0.41,
          );
          this.group.add(hole);
        }
      }
    }
  }

  /** Leather lounge furniture (PBR) */
  private createLoungeFurniture() {
    const leatherPBR = loadLeatherPBR(2, 2);
    const leatherMat = new THREE.MeshStandardMaterial({
      ...leatherPBR,
      color: 0x8b5533,
      roughness: 0.8,
      metalness: 0.05,
    });
    const darkLeatherMat = new THREE.MeshStandardMaterial({
      ...leatherPBR,
      color: 0x6a3d22,
      roughness: 0.85,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xa07840,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.createSofa(-10, -7, 0, leatherMat);
    this.createSofa(-10, -7, Math.PI / 2, leatherMat);
    this.createArmchair(-11, 2, Math.PI / 4, darkLeatherMat);
    this.createArmchair(10, -7, -Math.PI / 4, leatherMat);
    this.createArmchair(11, 2, -Math.PI / 3, darkLeatherMat);

    // Coffee tables
    const tableGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16);
    const legGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 8);
    for (const [x, z] of [[-10.5, -5.5], [10.5, -5.5], [-10.5, 3], [10.5, 3]] as const) {
      const top = new THREE.Mesh(tableGeo, woodMat);
      top.position.set(x, 0.41, z);
      this.group.add(top);
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(x, 0.2, z);
      this.group.add(leg);
    }

    this.createWoodenBench();
  }

  private createSofa(x: number, z: number, rot: number, mat: THREE.Material) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.8), mat);
    seat.position.y = 0.35;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.15), mat);
    back.position.set(0, 0.6, -0.35);
    g.add(back);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat);
      arm.position.set(side * 0.85, 0.55, 0);
      g.add(arm);
    }
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5 });
    for (const [lx, lz] of [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), legMat);
      leg.position.set(lx, 0.11, lz);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.group.add(g);
  }

  private createArmchair(x: number, z: number, rot: number, mat: THREE.Material) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), mat);
    seat.position.y = 0.35;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), mat);
    back.position.set(0, 0.55, -0.32);
    g.add(back);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.6), mat);
      arm.position.set(side * 0.35, 0.5, -0.02);
      g.add(arm);
    }
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
    for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), legMat);
      leg.position.set(lx, 0.125, lz);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = true; });
    this.group.add(g);
  }

  private createWoodenBench() {
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8a6b3d, roughness: 0.7, metalness: 0.05 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.3 });
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const x = 12 + Math.sin(t * Math.PI) * 1.5;
      const z = -8 + t * 16;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.2), benchMat);
      plank.position.set(x, 0.45, z);
      plank.rotation.y = Math.cos(t * Math.PI) * 0.2;
      plank.castShadow = true;
      this.group.add(plank);
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.05), metalMat);
      support.position.set(x, 0.225, z);
      this.group.add(support);
    }
  }

  /** Indoor plants */
  private createPlants() {
    const potMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.8, metalness: 0.0 });
    const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x1e4a12, roughness: 0.85 });
    const plantPositions: Array<[number, number, number]> = [
      [-12, 0, -3], [-6, 0, -8], [6, 0, -8], [12, 0, -3],
      [-4, 0, 6], [4, 0, 6], [0, 0, -8.5],
    ];
    for (const [x, _y, z] of plantPositions) {
      this.createPlant(x, z, potMat, Math.random() > 0.5 ? leafMat : darkLeafMat);
    }
  }

  private createPlant(x: number, z: number, potMat: THREE.Material, leafMat: THREE.Material) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 8), potMat);
    pot.position.y = 0.2;
    g.add(pot);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.2, 6), trunkMat);
    trunk.position.y = 1.0;
    g.add(trunk);
    const sizes = [0.4, 0.35, 0.3];
    const heights = [1.5, 1.8, 1.3];
    const offsets = [[0, 0], [0.15, 0.1], [-0.12, -0.08]];
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(sizes[i], 8, 6), leafMat);
      leaf.position.set(offsets[i][0], heights[i], offsets[i][1]);
      leaf.scale.y = 0.7;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = true; });
    this.group.add(g);
  }

  /** Large display screen on back wall */
  private createLargeDisplay() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x1a3060 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.1), frameMat);
    frame.position.set(0, 2.8, -9.85);
    this.group.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), screenMat);
    screen.position.set(0, 2.8, -9.78);
    this.group.add(screen);
    const screenLight = new THREE.PointLight(0x4488ff, 0.3, 5);
    screenLight.position.set(0, 2.8, -9);
    this.group.add(screenLight);
  }

  /** Mezzanine railing at mid-height */
  private createMezzanineRailing() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, transparent: true, opacity: 0.15, metalness: 0.2, roughness: 0.1,
    });
    const mezzY = 5.8;

    // Railing along sides
    for (const side of [-1, 1]) {
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 10), railMat);
      topRail.position.set(side * 14, mezzY + 0.5, -4);
      this.group.add(topRail);

      for (let z = -9; z <= 1; z += 2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), railMat);
        post.position.set(side * 14, mezzY, z);
        this.group.add(post);
      }

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.9), glassMat);
      glass.position.set(side * 14, mezzY, -4);
      glass.rotation.y = Math.PI / 2;
      this.group.add(glass);
    }
  }

  /** Main scene lighting (warm amber, balanced for HDRI + Bloom) */
  private createLighting() {
    const ambient = new THREE.AmbientLight(0xffddaa, 0.15);
    this.group.add(ambient);

    const hemi = new THREE.HemisphereLight(0xffc880, 0x3a3020, 0.3);
    this.group.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffcc88, 0.4);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 35;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -10;
    this.group.add(dirLight);
  }
}
