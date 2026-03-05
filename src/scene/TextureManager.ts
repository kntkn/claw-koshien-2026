import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function loadTexture(path: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const key = `${path}:${repeatX}:${repeatY}`;
  if (cache.has(key)) return cache.get(key)!;

  const tex = loader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function loadNormal(path: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const tex = loadTexture(path, repeatX, repeatY);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  return tex;
}

function loadRoughness(path: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const tex = loadTexture(path, repeatX, repeatY);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  return tex;
}

export interface PBRMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export function loadBrickPBR(repeatX = 4, repeatY = 2): PBRMaps {
  return {
    map: loadTexture('/textures/brick/red_brick_03_diff_1k.jpg', repeatX, repeatY),
    normalMap: loadNormal('/textures/brick/red_brick_03_nor_gl_1k.jpg', repeatX, repeatY),
    roughnessMap: loadRoughness('/textures/brick/red_brick_03_rough_1k.jpg', repeatX, repeatY),
  };
}

export function loadWoodPBR(repeatX = 6, repeatY = 4): PBRMaps {
  return {
    map: loadTexture('/textures/wood/wood_herringbone_diff_1k.jpg', repeatX, repeatY),
    normalMap: loadNormal('/textures/wood/wood_herringbone_nor_gl_1k.jpg', repeatX, repeatY),
    roughnessMap: loadRoughness('/textures/wood/wood_herringbone_rough_1k.jpg', repeatX, repeatY),
  };
}

export function loadLeatherPBR(repeatX = 2, repeatY = 2): PBRMaps {
  return {
    map: loadTexture('/textures/leather/brown_leather_diff_1k.jpg', repeatX, repeatY),
    normalMap: loadNormal('/textures/leather/brown_leather_nor_gl_1k.jpg', repeatX, repeatY),
    roughnessMap: loadRoughness('/textures/leather/brown_leather_rough_1k.jpg', repeatX, repeatY),
  };
}

export function loadConcretePBR(repeatX = 4, repeatY = 4): PBRMaps {
  return {
    map: loadTexture('/textures/concrete/concrete_floor_02_diff_1k.jpg', repeatX, repeatY),
    normalMap: loadNormal('/textures/concrete/concrete_floor_02_nor_gl_1k.jpg', repeatX, repeatY),
    roughnessMap: loadRoughness('/textures/concrete/concrete_floor_02_rough_1k.jpg', repeatX, repeatY),
  };
}

export function loadMetalPBR(repeatX = 2, repeatY = 2): PBRMaps {
  return {
    map: loadTexture('/textures/metal/painted_metal_02_diff_1k.jpg', repeatX, repeatY),
    normalMap: loadNormal('/textures/metal/painted_metal_02_nor_gl_1k.jpg', repeatX, repeatY),
    roughnessMap: loadRoughness('/textures/metal/painted_metal_02_rough_1k.jpg', repeatX, repeatY),
  };
}
