/**
 * 3D Showcase Component for Landing Page
 * Auto-orbiting 3D board with interactive mouse controls and tooltips
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createPieceFallback,
  createPieceInstance,
  loadPieceModel,
} from '../lib/modelLoader';

export default function Board3DShowcase() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animatedPiecesRef = useRef({ tiger: null, goat: null });
  const controlsRef = useRef({
    isRotating: false,
    mouseX: 0,
    mouseY: 0,
    targetRotationX: 0,
    targetRotationY: 0,
  });
  const [tooltip, setTooltip] = useState(null);

  const BOARD_POSITIONS = [
    [0, 2.5, 0],
    [-0.866, 1.75, 0],
    [0.866, 1.75, 0],
    [-1.732, 1, 0],
    [0, 1, 0],
    [1.732, 1, 0],
    [-2.598, 0.25, 0],
    [-0.866, 0.25, 0],
    [0.866, 0.25, 0],
    [2.598, 0.25, 0],
    [-3.464, -0.5, 0],
    [-1.732, -0.5, 0],
    [0, -0.5, 0],
    [1.732, -0.5, 0],
    [3.464, -0.5, 0],
    [-2.598, -1.25, 0],
    [2.598, -1.25, 0],
    [-1.732, -2, 0],
    [1.732, -2, 0],
    [-0.866, -1.25, 0],
    [0.866, -1.25, 0],
    [-4.33, -1.25, 0],
    [4.33, -1.25, 0],
  ];

  const ADJACENCY = {
    0: [1, 2],
    1: [0, 2, 3, 4],
    2: [0, 1, 4, 5],
    3: [1, 4, 6, 7],
    4: [1, 2, 3, 5, 7, 8],
    5: [2, 4, 8, 9],
    6: [3, 7, 10, 11],
    7: [3, 4, 6, 8, 11, 12],
    8: [4, 5, 7, 9, 12, 13],
    9: [5, 8, 13, 14],
    10: [6, 11, 15],
    11: [6, 7, 10, 12, 15, 16],
    12: [7, 8, 11, 13, 16, 17],
    13: [8, 9, 12, 14, 17, 18],
    14: [9, 13, 18],
    15: [10, 11, 19, 20],
    16: [11, 12, 20, 21],
    17: [12, 13, 21, 22],
    18: [13, 14, 22],
    19: [15, 20],
    20: [15, 16, 19, 21],
    21: [16, 17, 20, 22],
    22: [17, 18, 21],
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    sceneRef.current = scene;

    // Camera
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    directionalLight.position.multiplyScalar(20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Animated lights
    const pointLight1 = new THREE.PointLight(0x4488ff, 0.3);
    pointLight1.position.set(10, 5, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6644, 0.3);
    pointLight2.position.set(-10, 5, -10);
    scene.add(pointLight2);

    // Create board visualization
    createBoardNodes(scene);
    createEdges(scene);

    let cancelled = false;
    const loadPieces = async () => {
      const [tigerResult, goatResult] = await Promise.allSettled([
        loadPieceModel('tiger'),
        loadPieceModel('goat'),
      ]);

      if (cancelled) return;

      animatedPiecesRef.current = {
        tiger:
          tigerResult.status === 'fulfilled'
            ? createPieceInstance('tiger', tigerResult.value)
            : createPieceFallback('tiger'),
        goat:
          goatResult.status === 'fulfilled'
            ? createPieceInstance('goat', goatResult.value)
            : createPieceFallback('goat'),
      };

      addAnimatedPieces(scene);
    };

    loadPieces();

    // Handle resize
    const handleResize = () => {
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Mouse interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Store for orbit control
      controlsRef.current.mouseX = (event.clientX / w) * 2 - 1;
      controlsRef.current.mouseY = -(event.clientY / h) * 2 + 1;

      // Raycast for tooltips
      raycaster.setFromCamera(mouse, camera);
      const objects = scene.children.filter((child) => child.userData.isNode);
      const intersects = raycaster.intersectObjects(objects);

      if (intersects.length > 0) {
        const nodeData = intersects[0].object.userData;
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          text: nodeData.tooltipText || '',
        });
      } else {
        setTooltip(null);
      }
    };

    const handleMouseDown = () => {
      controlsRef.current.isRotating = true;
    };

    const handleMouseUp = () => {
      controlsRef.current.isRotating = false;
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleMouseUp);

    // Animation loop
    let time = 0;
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Auto-orbit (when not rotating)
      if (!controlsRef.current.isRotating) {
        controlsRef.current.targetRotationY = (time * 0.3) * Math.PI;
        controlsRef.current.targetRotationX = Math.sin(time * 0.2) * 0.2;
      }

      // Smooth camera rotation
      const radius = 12;
      const x = Math.sin(controlsRef.current.targetRotationY) * radius;
      const z = Math.cos(controlsRef.current.targetRotationY) * radius;
      const y = 2 + Math.sin(controlsRef.current.targetRotationX) * radius * 0.3;

      camera.position.x += (x - camera.position.x) * 0.05;
      camera.position.z += (z - camera.position.z) * 0.05;
      camera.position.y += (y - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      // Animate lights
      pointLight1.position.x = Math.cos(time * 0.3) * 15;
      pointLight1.position.z = Math.sin(time * 0.3) * 15;

      const tiger = animatedPiecesRef.current.tiger;
      const goat = animatedPiecesRef.current.goat;

      if (tiger) {
        tiger.rotation.y = 0.18 + Math.sin(time * 1.4) * 0.1;
        tiger.position.y = BOARD_POSITIONS[4][1] + (tiger.userData.baseYOffset ?? 0.45) + Math.sin(time * 1.7) * 0.06;
      }

      if (goat) {
        goat.rotation.z = Math.sin(time * 2.1) * 0.08;
        goat.position.y = BOARD_POSITIONS[11][1] + (goat.userData.baseYOffset ?? 0.4) + Math.cos(time * 2.3) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const createBoardNodes = (scene) => {
    const nodeGeometry = new THREE.SphereGeometry(0.3, 16, 16);

    BOARD_POSITIONS.forEach((pos, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0x4488cc,
        metalness: 0.6,
        roughness: 0.3,
        emissive: 0x223355,
        emissiveIntensity: 0.3,
      });

      const node = new THREE.Mesh(nodeGeometry, material);
      node.position.set(pos[0], pos[1], pos[2]);
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.isNode = true;
      node.userData.index = index;
      node.userData.tooltipText = `Node ${index}`;

      scene.add(node);
    });
  };

  const createEdges = (scene) => {
    const points = [];
    const edgeSet = new Set();

    Object.entries(ADJACENCY).forEach(([nodeIdx, adjacent]) => {
      const idx = parseInt(nodeIdx);
      adjacent.forEach((adjIdx) => {
        const edgeKey = [Math.min(idx, adjIdx), Math.max(idx, adjIdx)].join('-');
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          const pos1 = BOARD_POSITIONS[idx];
          const pos2 = BOARD_POSITIONS[adjIdx];
          points.push(new THREE.Vector3(pos1[0], pos1[1], pos1[2]));
          points.push(new THREE.Vector3(pos2[0], pos2[1], pos2[2]));
        }
      });
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x5577aa,
      linewidth: 1,
    });

    const edges = new THREE.LineSegments(geometry, material);
    scene.add(edges);
  };

  const addAnimatedPieces = (scene) => {
    const tiger = animatedPiecesRef.current.tiger;
    const goat = animatedPiecesRef.current.goat;

    if (tiger && !scene.children.includes(tiger)) {
      tiger.position.set(
        BOARD_POSITIONS[4][0],
        BOARD_POSITIONS[4][1] + (tiger.userData.baseYOffset ?? 0.45),
        BOARD_POSITIONS[4][2]
      );
      tiger.rotation.y = Math.PI / 4;
      scene.add(tiger);
    }

    if (goat && !scene.children.includes(goat)) {
      goat.position.set(
        BOARD_POSITIONS[11][0],
        BOARD_POSITIONS[11][1] + (goat.userData.baseYOffset ?? 0.4),
        BOARD_POSITIONS[11][2]
      );
      goat.rotation.y = -Math.PI / 10;
      scene.add(goat);
    }
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#4488ff',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            border: '1px solid #4488ff',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Info Overlay */}
      <div className="absolute top-6 left-6 text-white/70 text-sm font-mono max-w-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Tiger: Pounce &amp; Roar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white"></div>
          <span>Goat: Fortify &amp; Decoy</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 left-6 text-white/50 text-xs font-mono">
        <div>🖱 Drag to rotate • Scroll to zoom</div>
      </div>
    </div>
  );
}
