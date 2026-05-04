/**
 * 3D Game Board Component
 * Renders an interactive 3D board with animated pieces using Three.js
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import {
  createPieceFallback,
  createPieceInstance,
  loadPieceModel,
} from '../../lib/modelLoader';

// Board node positions (from backend board.py - 23 node triangular graph)
const BOARD_POSITIONS = [
  // Apex (1 node)
  [0, 2.5, 0],
  // Row 2 (2 nodes)
  [-0.866, 1.75, 0],
  [0.866, 1.75, 0],
  // Row 3 (3 nodes)
  [-1.732, 1, 0],
  [0, 1, 0],
  [1.732, 1, 0],
  // Row 4 (4 nodes)
  [-2.598, 0.25, 0],
  [-0.866, 0.25, 0],
  [0.866, 0.25, 0],
  [2.598, 0.25, 0],
  // Row 5 (5 nodes)
  [-3.464, -0.5, 0],
  [-1.732, -0.5, 0],
  [0, -0.5, 0],
  [1.732, -0.5, 0],
  [3.464, -0.5, 0],
  // Extension row 1 (2 nodes)
  [-2.598, -1.25, 0],
  [2.598, -1.25, 0],
  // Extension row 2 (2 nodes)
  [-1.732, -2, 0],
  [1.732, -2, 0],
  // Corner nodes (2 nodes)
  [-0.866, -1.25, 0],
  [0.866, -1.25, 0],
  // Additional expansion nodes
  [-4.33, -1.25, 0],
  [4.33, -1.25, 0],
];

// Adjacency list (from backend board.py)
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

export default function Board3D({ boardMeta = null, interactive = true, onNodeClick = null }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const piecesRef = useRef(new Map());
  const nodesRef = useRef([]);
  const edgesRef = useRef(null);
  const particlesRef = useRef([]);
  const hoveredNodeRef = useRef(null);
  
  const { state, selected, select } = useGameStore();
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pieceModels, setPieceModels] = useState({ tiger: null, goat: null });

  useEffect(() => {
    let cancelled = false;

    const loadPieces = async () => {
      const [tiger, goat] = await Promise.all([
        loadPieceModel('tiger'),
        loadPieceModel('goat'),
      ]);

      if (!cancelled) {
        setPieceModels({ tiger, goat });
      }
    };

    loadPieces();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x4488ff, 0.4);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Create board nodes
    createBoardNodes(scene);

    // Create board edges
    createEdges(scene);

    // Handle window resize
    const handleResize = () => {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event) => {
      if (!interactive) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodesRef.current);
      const nextHovered = intersects.length > 0 ? intersects[0].object.userData.index : null;
      hoveredNodeRef.current = nextHovered;
      setHoveredNode(nextHovered);
    };

    const handleClick = (event) => {
      const currentHovered = hoveredNodeRef.current;
      if (!interactive || currentHovered === null) return;
      
      // Use custom click handler if provided, otherwise select node
      if (onNodeClick) {
        onNodeClick(currentHovered);
      } else {
        select(currentHovered);
      }
    };

    const handleMouseLeave = () => {
      hoveredNodeRef.current = null;
      setHoveredNode(null);
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const now = Date.now() * 0.001;

      // Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        const { updateParticles } = require('../../lib/modelLoader');
        return updateParticles(p, 0.016);
      });

      piecesRef.current.forEach((pieceMesh, nodeIdx) => {
        const nodePos = BOARD_POSITIONS[nodeIdx];
        const piece = pieceMesh.userData.piece;
        const baseYOffset = pieceMesh.userData.baseYOffset ?? 0.4;

        pieceMesh.position.set(nodePos[0], nodePos[1] + baseYOffset, nodePos[2]);

        if (piece === 'tiger') {
          pieceMesh.rotation.y = 0.12 + Math.sin(now * 1.6) * 0.08;
          pieceMesh.position.y += Math.sin(now * 1.8) * 0.05;
        } else {
          pieceMesh.rotation.z = Math.sin(now * 2.0) * 0.06;
          pieceMesh.position.y += Math.cos(now * 2.2) * 0.04;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [interactive, onNodeClick, select]);

  // Create board nodes
  const createBoardNodes = (scene) => {
    const nodeGeometry = new THREE.SphereGeometry(0.25, 32, 32);

    BOARD_POSITIONS.forEach((pos, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0x3d5a80,
        metalness: 0.5,
        roughness: 0.4,
      });

      const node = new THREE.Mesh(nodeGeometry, material);
      node.position.set(pos[0], pos[1], pos[2]);
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.index = index;

      // Add glow outline
      const outlineGeometry = new THREE.SphereGeometry(0.3, 32, 32);
      const outlineMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        emissive: 0x4488ff,
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      });
      const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outline.userData.nodeIndex = index;
      node.add(outline);
      node.userData.outline = outline;

      scene.add(node);
      nodesRef.current.push(node);
    });
  };

  // Create board edges
  const createEdges = (scene) => {
    const points = [];
    const edgeSet = new Set();

    Object.entries(ADJACENCY).forEach(([nodeIdx, adjacent]) => {
      const idx = parseInt(nodeIdx);
      adjacent.forEach((adjIdx) => {
        // Avoid duplicate edges
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
      color: 0x5a7da8,
      linewidth: 2,
    });

    const edges = new THREE.LineSegments(geometry, material);
    scene.add(edges);
    edgesRef.current = edges;
  };

  // Update pieces based on game state
  useEffect(() => {
    if (!state || !state.board || !sceneRef.current) return;

    // Remove old pieces
    piecesRef.current.forEach((piece) => {
      sceneRef.current.remove(piece);
    });
    piecesRef.current.clear();

    // Add new pieces
    state.board.forEach((piece, nodeIdx) => {
      if (!piece) return;

      const pos = BOARD_POSITIONS[nodeIdx];
      const modelData = pieceModels[piece];
      const pieceMesh = modelData
        ? createPieceInstance(piece, modelData)
        : createPieceFallback(piece);

      pieceMesh.userData.piece = piece;
      pieceMesh.userData.nodeIndex = nodeIdx;
      const baseYOffset = pieceMesh.userData.baseYOffset ?? 0.4;
      pieceMesh.position.set(pos[0], pos[1] + baseYOffset, pos[2]);
      pieceMesh.rotation.y = piece === 'tiger' ? Math.PI / 3 : 0;

      sceneRef.current.add(pieceMesh);
      piecesRef.current.set(nodeIdx, pieceMesh);
    });

    // Update node highlights
    nodesRef.current.forEach((node, idx) => {
      const outline = node.userData.outline;
      if (state.board[idx]) {
        // Node has a piece
        outline.material.emissiveIntensity = 0.5;
        outline.material.opacity = 0.3;
      } else {
        outline.material.emissiveIntensity = 0;
        outline.material.opacity = 0;
      }
    });

  }, [state, pieceModels]);

  // Highlight hovered node
  useEffect(() => {
    nodesRef.current.forEach((node, idx) => {
      const outline = node.userData.outline;
      if (idx === hoveredNode) {
        outline.material.color.setHex(0x44ff88);
        outline.material.emissive.setHex(0x44ff88);
        outline.material.emissiveIntensity = 0.7;
        outline.material.opacity = 0.5;
      } else if (idx === selected) {
        outline.material.color.setHex(0xffff00);
        outline.material.emissive.setHex(0xffff00);
        outline.material.emissiveIntensity = 1;
        outline.material.opacity = 0.6;
      } else if (state?.board[idx]) {
        outline.material.emissiveIntensity = 0.5;
        outline.material.opacity = 0.3;
      } else {
        outline.material.emissiveIntensity = 0;
        outline.material.opacity = 0;
      }
    });
  }, [hoveredNode, selected, state]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
      }}
    />
  );
}
