/**
 * 3D Model Loader Utility
 * Handles async loading and caching of GLTF models
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();
const modelCache = new Map();

export const PIECE_MODEL_URLS = {
  tiger: '/model/tiger.glb',
  goat: '/model/goat.glb',
};

const PIECE_MODEL_HEIGHTS = {
  tiger: 0.78,
  goat: 0.62,
};

const PIECE_MODEL_OFFSETS = {
  tiger: 0.45,
  goat: 0.4,
};

/**
 * Load a GLTF model from URL with caching
 * @param {string} url - URL to the .glb model file
 * @returns {Promise<Object>} Scene, animations, and scene data
 */
export async function loadModel(url) {
  // Return cached model if available
  if (modelCache.has(url)) {
    return modelCache.get(url);
  }

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

    const modelData = {
      scene: gltf.scene,
      animations: gltf.animations,
      asset: gltf.asset,
    };

    modelCache.set(url, modelData);
    return modelData;
  } catch (error) {
    console.error(`Failed to load model: ${url}`, error);
    // Return a fallback box geometry
    return createFallbackModel();
  }
}

/**
 * Load a goat/tiger GLB using the shared asset map.
 * @param {('tiger'|'goat')} piece
 * @returns {Promise<Object>}
 */
export async function loadPieceModel(piece) {
  const url = PIECE_MODEL_URLS[piece];
  if (!url) {
    return createFallbackModel();
  }

  return loadModel(url);
}

/**
 * Clone a loaded model's scene
 * @param {THREE.Group} scene - The original scene
 * @returns {THREE.Group} Cloned scene with unique instance
 */
export function cloneModel(scene) {
  const clone = scene.clone();
  // Traverse and ensure materials are cloned too for independent modifications
  clone.traverse((child) => {
    if (child.material) {
      child.material = child.material.clone();
    }
  });
  return clone;
}

/**
 * Fit a model to a target height and center it around the node anchor.
 * @param {THREE.Object3D} model
 * @param {number} targetHeight
 */
export function normalizeModel(model, targetHeight) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  if (size.y > 0) {
    const scale = targetHeight / size.y;
    model.scale.setScalar(scale);
    model.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale
    );
  }
}

/**
 * Clone and prepare a model instance for a board node.
 * @param {('tiger'|'goat')} piece
 * @param {Object} modelData
 * @returns {THREE.Group}
 */
export function createPieceInstance(piece, modelData) {
  const source = modelData?.scene ?? createFallbackModel().scene;
  const instance = cloneModel(source);

  normalizeModel(instance, PIECE_MODEL_HEIGHTS[piece] ?? 0.6);

  instance.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  instance.userData.piece = piece;
  instance.userData.baseYOffset = PIECE_MODEL_OFFSETS[piece] ?? 0.4;
  instance.userData.baseScale = 1;

  return instance;
}

/**
 * Create a simple fallback piece when GLB loading fails.
 * @param {('tiger'|'goat')} piece
 * @returns {THREE.Group}
 */
export function createPieceFallback(piece) {
  const group = new THREE.Group();
  const color = piece === 'tiger' ? 0xff8844 : 0xf5f5f5;
  const geometry =
    piece === 'tiger'
      ? new THREE.BoxGeometry(0.42, 0.24, 0.18)
      : new THREE.ConeGeometry(0.2, 0.38, 8);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.15,
    metalness: 0.25,
    roughness: 0.55,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  normalizeModel(group, PIECE_MODEL_HEIGHTS[piece] ?? 0.6);
  group.userData.piece = piece;
  group.userData.baseYOffset = PIECE_MODEL_OFFSETS[piece] ?? 0.4;
  return group;
}

/**
 * Create a fallback 3D model (colorful box)
 * Used when actual model fails to load
 * @returns {Object} Scene and metadata
 */
export function createFallbackModel() {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  return {
    scene,
    animations: [],
    asset: { generator: 'Fallback' },
  };
}

/**
 * Apply color to a model
 * @param {THREE.Group} model - The model to colorize
 * @param {number} color - Hex color value
 * @param {number} intensity - Emissive intensity (0-1)
 */
export function colorizeModel(model, color, intensity = 0.2) {
  model.traverse((child) => {
    if (child.material) {
      child.material.color.setHex(color);
      child.material.emissive.setHex(color);
      child.material.emissiveIntensity = intensity;
    }
  });
}

/**
 * Animate model with tween-like effect
 * @param {THREE.Group} model - Model to animate
 * @param {THREE.Vector3} from - Start position
 * @param {THREE.Vector3} to - End position
 * @param {number} duration - Duration in ms
 * @param {Function} onComplete - Callback when animation completes
 */
export function animateModelPosition(model, from, to, duration = 300, onComplete = null) {
  model.position.copy(from);
  let startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    model.position.lerpVectors(from, to, easeInOutQuad(progress));
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      model.position.copy(to);
      if (onComplete) onComplete();
    }
  };
  
  animate();
}

/**
 * Easing function for smooth animations
 */
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Create particle effect for abilities
 * @param {THREE.Vector3} position - Where to spawn particles
 * @param {number} color - Hex color
 * @param {number} count - Number of particles
 * @returns {THREE.Points} Particle system
 */
export function createParticleEffect(position, color = 0xff0000, count = 50) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const velocities = [];
  
  for (let i = 0; i < count; i++) {
    // Random sphere distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = Math.random() * 0.5;
    
    positions.push(
      position.x + r * Math.sin(phi) * Math.cos(theta),
      position.y + r * Math.sin(phi) * Math.sin(theta),
      position.z + r * Math.cos(phi)
    );
    
    const vx = (Math.random() - 0.5) * 0.02;
    const vy = Math.random() * 0.01;
    const vz = (Math.random() - 0.5) * 0.02;
    velocities.push(vx, vy, vz);
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  
  const material = new THREE.PointsMaterial({
    color,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  
  const particles = new THREE.Points(geometry, material);
  particles.userData = { velocities, life: 1.0, maxLife: 1.0 };
  
  return particles;
}

/**
 * Update particle system (animate and fade)
 * @param {THREE.Points} particles - Particle system
 * @param {number} deltaTime - Time delta in seconds
 */
export function updateParticles(particles, deltaTime = 0.016) {
  const userData = particles.userData;
  if (!userData.velocities) return;
  
  userData.life -= deltaTime * 0.5; // Fade out over 2 seconds
  
  if (userData.life <= 0) {
    particles.geometry.dispose();
    particles.material.dispose();
    return false; // Signal to remove
  }
  
  const positions = particles.geometry.attributes.position.array;
  const velocities = userData.velocities;
  
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += velocities[i];
    positions[i + 1] += velocities[i + 1];
    positions[i + 2] += velocities[i + 2];
  }
  
  particles.geometry.attributes.position.needsUpdate = true;
  particles.material.opacity = userData.life / userData.maxLife;
  
  return true; // Still alive
}

export default {
  loadModel,
  loadPieceModel,
  cloneModel,
  normalizeModel,
  createPieceInstance,
  createPieceFallback,
  createFallbackModel,
  colorizeModel,
  animateModelPosition,
  createParticleEffect,
  updateParticles,
};
