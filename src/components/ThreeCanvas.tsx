import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Lane, Competitor, Obstacle, PowerUpItem, Coin, Player, TimeMode, GameStatus } from '../types/game';
import {
  LANE_CENTERS,
  LANE_WIDTH,
  PLAYER_BASE_Y,
  TOTAL_GAME_TIME_SECONDS,
  HARD_MODE_START_SECONDS,
  THRONE_APPROACH_START_SECONDS,
  computeCompetitorScreenY,
} from '../game/constants';
import { resolveAvatarLook } from '../data/avatarLooks';

export interface ThreeLiveState {
  status: GameStatus;
  elapsedSeconds: number;
  speed: number;
  playerDistance: number;
  playerLeanAngle: number;
  player: Player;
  competitorsList: Competitor[];
  obstacles: Obstacle[];
  powerUps: PowerUpItem[];
  coins: Coin[];
  isSpectating?: boolean;
  followedRunnerId?: string | null;
}

interface ThreeCanvasProps {
  status: GameStatus;
  elapsedSeconds: number;
  competitors: Competitor[];
  obstacles: Obstacle[];
  powerUps: PowerUpItem[];
  coins?: Coin[];
  playerLane: Lane;
  playerJumpY: number;
  playerSlideProgress: number;
  isDashing: boolean;
  isNitro: boolean;
  isStumbling?: boolean;
  timeMode: TimeMode;
  liveStateRef?: React.RefObject<ThreeLiveState>;
  paused?: boolean;
  isSpectating?: boolean;
  spectatedRunnerId?: string | null;
  onMoveLane: (dir: 'left' | 'right') => void;
  onJump: () => void;
  onSlide: () => void;
  onDash?: () => void;
}

// Converte coordenada X 2D (LANE_CENTERS[0..4]) para coordenada 3D nas 5 faixas (-4, -2, 0, +2, +4)
const toWorldX = (laneX: number | undefined, fallbackLane: Lane): number => {
  const safeLane = Math.max(0, Math.min(4, Math.round(fallbackLane))) as Lane;
  const center2d = LANE_CENTERS[safeLane] ?? LANE_CENTERS[2];
  const rawX = typeof laneX === 'number' && Number.isFinite(laneX) ? laneX : center2d;
  return THREE.MathUtils.clamp(((rawX - LANE_CENTERS[2]) / LANE_WIDTH) * 2.0, -4.0, 4.0);
};

// Converte coordenada Y 2D para coordenada Z 3D centrada no jogador (PLAYER_BASE_Y -> z = 0)
const toWorldZ = (y2d: number): number => {
  return (y2d - PLAYER_BASE_Y) * 0.115;
};

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  if (!gl) return false;
  try {
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      const rendererName = String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|Software|Microsoft Basic Render|Apple Software/i.test(rendererName)) {
        return true;
      }
    }
  } catch {
    // Fallback silencioso caso o navegador bloqueie debug_renderer_info
  }
  return false;
}

// Texturas procedurais PBR para Asfalto da Marginal e Calçadão Português
function createRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#252c3d';
    ctx.fillRect(0, 0, 512, 512);

    // Micro-grão mineral do asfalto
    for (let i = 0; i < 4200; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 19341.123) % 1;
      const px = Math.abs(x) * 512;
      const py = Math.abs(y) * 512;
      const shade = i % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.16)';
      ctx.fillStyle = shade;
      ctx.fillRect(px, py, 2, 2);
    }

    // Marcas longitudinais subtis de rodagem nas 5 faixas
    const laneCentersPx = [56, 154, 256, 358, 456];
    laneCentersPx.forEach((cx) => {
      const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.32, 'rgba(0,0,0,0.22)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      grad.addColorStop(0.68, 'rgba(0,0,0,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 28, 0, 56, 512);
    });

    // Bermas laterais escuras
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, 14, 512);
    ctx.fillRect(498, 0, 14, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 16);
  return tex;
}

function createSidewalkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#363b48';
    ctx.fillRect(0, 0, 256, 256);

    const tile = 32;
    for (let y = 0; y < 256; y += tile) {
      for (let x = 0; x < 256; x += tile) {
        const alt = ((x / tile) + (y / tile)) % 2 === 0;
        ctx.fillStyle = alt ? '#474d5d' : '#2f3442';
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x + 2, y + 2, tile - 4, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 48);
  return tex;
}

interface RunnerRig {
  root: THREE.Group;
  inner: THREE.Group;
  shadow: THREE.Mesh;
  playerRing: THREE.Mesh;
  nitroAura: THREE.Mesh;
  hipsGroup: THREE.Group;
  pelvisMesh: THREE.Mesh;
  torsoGroup: THREE.Group;
  body: THREE.Mesh;
  chestStripe: THREE.Mesh;
  collarMesh: THREE.Mesh;
  beltMesh: THREE.Mesh;
  leftEpaulet: THREE.Mesh;
  rightEpaulet: THREE.Mesh;
  neckMesh: THREE.Mesh;
  headGroup: THREE.Group;
  head: THREE.Mesh;
  leftEar: THREE.Mesh;
  rightEar: THREE.Mesh;
  hairCap: THREE.Mesh;
  afroMesh: THREE.Mesh;
  ponytailGroup: THREE.Group;
  ponytailMesh: THREE.Mesh;
  backHairMesh: THREE.Mesh;
  visor: THREE.Mesh;
  leftHip: THREE.Group;
  leftThigh: THREE.Mesh;
  leftKnee: THREE.Group;
  leftKneeCap: THREE.Mesh;
  leftShin: THREE.Mesh;
  leftShoeGroup: THREE.Group;
  leftShoe: THREE.Mesh;
  leftSole: THREE.Mesh;
  rightHip: THREE.Group;
  rightThigh: THREE.Mesh;
  rightKnee: THREE.Group;
  rightKneeCap: THREE.Mesh;
  rightShin: THREE.Mesh;
  rightShoeGroup: THREE.Group;
  rightShoe: THREE.Mesh;
  rightSole: THREE.Mesh;
  leftShoulder: THREE.Group;
  leftUpperArm: THREE.Mesh;
  leftElbow: THREE.Group;
  leftElbowCap: THREE.Mesh;
  leftForearm: THREE.Mesh;
  leftCuff: THREE.Mesh;
  leftHand: THREE.Mesh;
  rightShoulder: THREE.Group;
  rightUpperArm: THREE.Mesh;
  rightElbow: THREE.Group;
  rightElbowCap: THREE.Mesh;
  rightForearm: THREE.Mesh;
  rightCuff: THREE.Mesh;
  rightHand: THREE.Mesh;
  crownGroup: THREE.Group;
  crownGem: THREE.Mesh;
  capGroup: THREE.Group;
  capCrown: THREE.Mesh;
  capBrim: THREE.Mesh;
  bandGroup: THREE.Group;
  bandMesh: THREE.Mesh;
  leftEarCup: THREE.Mesh;
  rightEarCup: THREE.Mesh;
  cape: THREE.Mesh;
  dizzyGroup: THREE.Group;
  smoothX: number;
  smoothZ: number;
  prevJumpOffset: number;
  squashY: number;
  wasAirborne: boolean;
  initialized: boolean;
  trailAcc: number;
  trailStep: number;
  appliedLookKey: string;
}

interface PooledObstacle {
  group: THREE.Group;
  obstacleId: string;
  wheels: THREE.Mesh[];
  blinkLights: THREE.Mesh[];
  sirenL?: THREE.Mesh;
  sirenR?: THREE.Mesh;
  dogTail?: THREE.Mesh;
  spark?: THREE.Mesh;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = (props) => {
  const { status, timeMode, paused = false, onMoveLane, onJump, onSlide } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number | null>(null);
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const [webglContextLost, setWebglContextLost] = useState(false);

  // Store always-fresh props in ref so 60fps animation loop never closes over stale state
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    if (!paused) {
      resumeLoopRef.current?.();
    }
  }, [paused, status]);

  // 5 Faixas no espaço 3D (X = -4.0, -2.0, 0, 2.0, 4.0) — uma para cada um dos 5 corredores
  const lanePositionsX = [-4.0, -2.0, 0, 2.0, 4.0];

  // Gestos de toque unificados via Pointer Events (1 deslize = 1 troca de faixa)
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    hasSwiped: boolean;
    lastTapTime: number;
    isPointerDown: boolean;
    activePointerId: number | null;
  }>({
    startX: 0,
    startY: 0,
    hasSwiped: false,
    lastTapTime: 0,
    isPointerDown: false,
    activePointerId: null,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 640;
    const initialIsNight = timeMode === 'night';

    // 1. Scene & Atmosphere (Cores pré-alocadas para zero GC por frame)
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const dayBgColor = new THREE.Color(0x38bdf8);
    const nightBgColor = new THREE.Color(0x05070f);
    const dayFogColor = new THREE.Color(0x7dd3fc);
    const nightFogColor = new THREE.Color(0x05070f);

    let lastAppliedNight = initialIsNight;
    scene.background = initialIsNight ? nightBgColor : dayBgColor;
    scene.fog = new THREE.FogExp2(initialIsNight ? 0x05070f : 0x7dd3fc, 0.011);

    // 2. Camera com perspectiva ampla que enquadra com folga todas as 5 faixas (-4..+4)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 240);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 6.4, 12.2);
    camera.lookAt(0, 1.0, -14);
    cameraRef.current = camera;
    let camRoll = 0;

    // 3. WebGL Renderer + Context Loss Resilience + Software GL Guard
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const isSoftwareGl = detectSoftwareWebGL(renderer.getContext());
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1.25 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = initialIsNight ? 1.0 : 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Iluminação PBR (RoomEnvironment + HemisphereLight + Directional Key Light)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = initialIsNight ? 0.52 : 0.78;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(
      initialIsNight ? 0x3b82f6 : 0xbae6fd,
      initialIsNight ? 0x090d16 : 0x1e293b,
      initialIsNight ? 0.65 : 0.72
    );
    scene.add(hemiLight);

    const sunMoonLight = new THREE.DirectionalLight(
      initialIsNight ? 0x60a5fa : 0xfef08a,
      initialIsNight ? 0.95 : 1.35
    );
    sunMoonLight.position.set(12, 24, 15);
    sunMoonLight.castShadow = !isSoftwareGl;
    sunMoonLight.shadow.mapSize.width = 1024;
    sunMoonLight.shadow.mapSize.height = 1024;
    sunMoonLight.shadow.bias = -0.0005;
    sunMoonLight.shadow.camera.left = -8;
    sunMoonLight.shadow.camera.right = 8;
    sunMoonLight.shadow.camera.top = 15;
    sunMoonLight.shadow.camera.bottom = -48;
    sunMoonLight.shadow.camera.near = 1;
    sunMoonLight.shadow.camera.far = 85;
    scene.add(sunMoonLight);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglContextLost(true);
    };
    const handleContextRestored = () => {
      setWebglContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    // 5. Asfalto da Marginal de Luanda com textura PBR, Calçadão, Paredão & Horizonte
    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
    const roadTex = createRoadTexture();
    roadTex.anisotropy = maxAnisotropy;
    const sidewalkTex = createSidewalkTexture();
    sidewalkTex.anisotropy = maxAnisotropy;

    const roadWidth = 10.6;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, 240);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: initialIsNight ? 0x64748b : 0xdbeafe,
      roughness: 0.82,
      metalness: 0.08,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -90;
    road.receiveShadow = true;
    scene.add(road);

    // Calçadões laterais (Esquerda cidade / Direita Baía de Luanda)
    const sidewalkGeo = new THREE.PlaneGeometry(4.6, 240);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      color: initialIsNight ? 0x475569 : 0xcbd5e1,
      roughness: 0.9,
      metalness: 0.04,
    });
    const leftSidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    leftSidewalk.rotation.x = -Math.PI / 2;
    leftSidewalk.position.set(-7.6, 0.04, -90);
    leftSidewalk.receiveShadow = true;
    const rightSidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    rightSidewalk.rotation.x = -Math.PI / 2;
    rightSidewalk.position.set(7.6, 0.04, -90);
    rightSidewalk.receiveShadow = true;
    scene.add(leftSidewalk, rightSidewalk);

    // Mureta / Paredão da Baía (entre o calçadão direito e o oceano)
    const seawallGeo = new THREE.BoxGeometry(0.45, 0.55, 240);
    const seawallMat = new THREE.MeshStandardMaterial({
      color: initialIsNight ? 0x334155 : 0xe2e8f0,
      roughness: 0.85,
    });
    const seawall = new THREE.Mesh(seawallGeo, seawallMat);
    seawall.position.set(9.8, 0.25, -90);
    scene.add(seawall);

    // Guias laterais em relevo (faixas exteriores X = -5.12 e +5.12)
    const borderGeo = new THREE.BoxGeometry(0.28, 0.14, 240);
    const borderMat = new THREE.MeshStandardMaterial({
      color: initialIsNight ? 0xdc2626 : 0xf8fafc,
      roughness: 0.5,
    });
    [-5.12, 5.12].forEach((bx) => {
      const borderMesh = new THREE.Mesh(borderGeo, borderMat);
      borderMesh.position.set(bx, 0.07, -90);
      scene.add(borderMesh);
    });

    // Linhas divisórias tracejadas das 5 Faixas móveis + Cat's-Eye Studs âmbar
    const roadLinesGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: initialIsNight ? 0xf59e0b : 0xfde047 });
    const lineGeo = new THREE.PlaneGeometry(0.16, 4.8);
    const studGeo = new THREE.BoxGeometry(0.14, 0.045, 0.2);
    const studMat = new THREE.MeshBasicMaterial({ color: initialIsNight ? 0xfbbf24 : 0xfef08a });
    const lineMeshes: THREE.Mesh[] = [];
    [-3.0, -1.0, 1.0, 3.0].forEach((lx) => {
      for (let z = -200; z < 20; z += 10) {
        const lineMesh = new THREE.Mesh(lineGeo, lineMat);
        lineMesh.rotation.x = -Math.PI / 2;
        lineMesh.position.set(lx, 0.025, z);
        roadLinesGroup.add(lineMesh);
        lineMeshes.push(lineMesh);

        const stud = new THREE.Mesh(studGeo, studMat);
        stud.position.set(lx, 0.028, z + 5);
        roadLinesGroup.add(stud);
        lineMeshes.push(stud);
      }
    });
    scene.add(roadLinesGroup);

    // Baía de Luanda (Oceano ao lado direito)
    const oceanGeo = new THREE.PlaneGeometry(120, 240);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: initialIsNight ? 0x02192e : 0x0284c7,
      roughness: 0.2,
      metalness: 0.72,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(70, -0.25, -90);
    scene.add(ocean);

    // Silhueta distante da cidade / Baía no horizonte (esquerda e centro-longe)
    const skylineGroup = new THREE.Group();
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: initialIsNight ? 0x0f172a : 0x475569,
      roughness: 0.85,
    });
    const windowStripMat = new THREE.MeshBasicMaterial({
      color: initialIsNight ? 0xfbbf24 : 0xbae6fd,
    });
    const windowStripGeo = new THREE.PlaneGeometry(0.65, 0.14);
    for (let b = 0; b < 14; b++) {
      const bx = -24 + (b % 7) * 5.2 + (b > 6 ? 2.1 : 0);
      if (bx > -11 && bx < 11) continue;
      const bz = -132 - (b % 3) * 10;
      const bh = 10 + ((b * 7) % 14);
      const bw = 3.2 + (b % 3) * 0.9;
      const tower = new THREE.Mesh(buildingGeo, buildingMat);
      tower.scale.set(bw, bh, bw);
      tower.position.set(bx, bh / 2 - 0.5, bz);
      skylineGroup.add(tower);

      for (let w = 0; w < 3; w++) {
        const win = new THREE.Mesh(windowStripGeo, windowStripMat);
        win.scale.set(bw * 0.7, 1, 1);
        win.position.set(bx, bh * (0.35 + w * 0.22), bz + bw * 0.51);
        skylineGroup.add(win);
      }
    }
    scene.add(skylineGroup);

    // Palmeiras de copa múltipla & Postes da Marginal de Luanda (Scrolláveis sincronizados à velocidade real)
    const sceneryGroup = new THREE.Group();
    const sceneryItems: THREE.Group[] = [];
    const trunkLowerGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.0, 7);
    const trunkUpperGeo = new THREE.CylinderGeometry(0.12, 0.19, 2.8, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
    const palmHubGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const frondGeo = new THREE.BoxGeometry(0.42, 0.08, 2.35);
    const leavesMat = new THREE.MeshStandardMaterial({ color: initialIsNight ? 0x065f46 : 0x16a34a, roughness: 0.65 });
    const coconutGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8);
    const poleArmGeo = new THREE.BoxGeometry(0.95, 0.09, 0.09);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.35 });
    const lampHeadGeo = new THREE.SphereGeometry(0.24, 10, 10);
    const lampHeadMat = new THREE.MeshBasicMaterial({ color: initialIsNight ? 0xfacc15 : 0xf8fafc });
    const lampGlowGeo = new THREE.CircleGeometry(1.45, 14);
    const lampGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: initialIsNight ? 0.16 : 0.0,
      depthWrite: false,
    });

    for (let pz = -180; pz < 20; pz += 18) {
      const palm = new THREE.Group();
      const trunkLow = new THREE.Mesh(trunkLowerGeo, trunkMat);
      trunkLow.position.set(0, 1.45, 0);
      trunkLow.rotation.z = 0.06;
      const trunkUp = new THREE.Mesh(trunkUpperGeo, trunkMat);
      trunkUp.position.set(-0.14, 4.1, 0);
      trunkUp.rotation.z = 0.11;
      palm.add(trunkLow, trunkUp);

      const hub = new THREE.Mesh(palmHubGeo, leavesMat);
      hub.position.set(-0.28, 5.45, 0);
      palm.add(hub);

      for (let f = 0; f < 6; f++) {
        const angle = (f / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(frondGeo, leavesMat);
        frond.position.set(
          -0.28 + Math.sin(angle) * 0.98,
          5.36,
          Math.cos(angle) * 0.98
        );
        frond.rotation.y = angle;
        frond.rotation.x = 0.32;
        palm.add(frond);
      }

      for (let c = 0; c < 3; c++) {
        const ca = (c / 3) * Math.PI * 2;
        const nut = new THREE.Mesh(coconutGeo, coconutMat);
        nut.position.set(-0.28 + Math.sin(ca) * 0.24, 5.15, Math.cos(ca) * 0.24);
        palm.add(nut);
      }

      palm.position.set(6.45, 0, pz);
      sceneryGroup.add(palm);
      sceneryItems.push(palm);

      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.6;
      const arm = new THREE.Mesh(poleArmGeo, poleMat);
      arm.position.set(0.45, 5.18, 0);
      const lampHead = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      lampHead.position.set(0.88, 5.12, 0);
      const lampPool = new THREE.Mesh(lampGlowGeo, lampGlowMat);
      lampPool.rotation.x = -Math.PI / 2;
      lampPool.position.set(1.1, 0.032, 0);
      lamp.add(pole, arm, lampHead, lampPool);
      lamp.position.set(-6.15, 0, pz);
      sceneryGroup.add(lamp);
      sceneryItems.push(lamp);
    }
    scene.add(sceneryGroup);

    // 6. Arco Monumental de Chegada + Trono Real no Topo (Meta Oficial aos 40s)
    const throneGroup = new THREE.Group();
    const throneBaseGeo = new THREE.BoxGeometry(5.2, 0.9, 3.8);
    const throneBaseMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
    const baseThrone = new THREE.Mesh(throneBaseGeo, throneBaseMat);

    const throneBackGeo = new THREE.BoxGeometry(4.6, 5.0, 0.7);
    const throneBackMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.25 });
    const backThrone = new THREE.Mesh(throneBackGeo, throneBackMat);
    backThrone.position.set(0, 2.5, -1.5);

    const throneCrownGeo = new THREE.ConeGeometry(0.95, 1.4, 5);
    const throneCrownMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.1 });
    const crownThrone = new THREE.Mesh(throneCrownGeo, throneCrownMat);
    crownThrone.position.set(0, 5.3, -1.5);

    const throneCushionGeo = new THREE.BoxGeometry(3.8, 0.35, 2.8);
    const throneCushionMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
    const cushion = new THREE.Mesh(throneCushionGeo, throneCushionMat);
    cushion.position.set(0, 0.55, 0.2);

    // Pórtico Dourado da Meta (2 pilares + travessa + faixa axadrezada no chão)
    const archPillarGeo = new THREE.BoxGeometry(0.55, 6.2, 0.55);
    const archBeamGeo = new THREE.BoxGeometry(11.4, 0.85, 0.75);
    const finishStripGeo = new THREE.PlaneGeometry(10.2, 1.2);
    const finishStripMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.38 });
    const leftArchPillar = new THREE.Mesh(archPillarGeo, throneBaseMat);
    leftArchPillar.position.set(-5.3, 2.7, 1.8);
    const rightArchPillar = new THREE.Mesh(archPillarGeo, throneBaseMat);
    rightArchPillar.position.set(5.3, 2.7, 1.8);
    const topArchBeam = new THREE.Mesh(archBeamGeo, throneCrownMat);
    topArchBeam.position.set(0, 5.9, 1.8);
    const finishStrip = new THREE.Mesh(finishStripGeo, finishStripMat);
    finishStrip.rotation.x = -Math.PI / 2;
    finishStrip.position.set(0, -0.34, 1.8);

    throneGroup.add(
      baseThrone,
      backThrone,
      crownThrone,
      cushion,
      leftArchPillar,
      rightArchPillar,
      topArchBeam,
      finishStrip
    );
    throneGroup.position.set(0, 0.4, -145);
    scene.add(throneGroup);

    // Grupos dinâmicos persistentes (Zero-GC Object Pooling)
    const runnersGroup = new THREE.Group();
    scene.add(runnersGroup);

    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);

    const powerUpsGroup = new THREE.Group();
    scene.add(powerUpsGroup);

    const coinsGroup = new THREE.Group();
    scene.add(coinsGroup);

    // ========================================================================
    // RASTRO SUTIL NA BASE DOS AVATARES (ZERO-GC INSTANCED PARTICLE POOL)
    // ========================================================================
    const BASE_TRAIL_POOL_SIZE = 150;
    const baseTrailGeo = new THREE.BoxGeometry(0.11, 0.055, 0.48);
    const baseTrailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const baseTrailMesh = new THREE.InstancedMesh(baseTrailGeo, baseTrailMat, BASE_TRAIL_POOL_SIZE);
    baseTrailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    baseTrailMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(BASE_TRAIL_POOL_SIZE * 3),
      3
    );
    baseTrailMesh.frustumCulled = false;
    baseTrailMesh.renderOrder = 2;
    scene.add(baseTrailMesh);

    interface BaseTrailSlot {
      active: boolean;
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
      baseScale: number;
      r: number;
      g: number;
      b: number;
    }

    const _trailDummyPos = new THREE.Vector3();
    const _trailDummyQuat = new THREE.Quaternion();
    const _trailDummyScale = new THREE.Vector3();
    const _trailDummyMat = new THREE.Matrix4();
    const _trailZeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const _trailTmpColor = new THREE.Color();

    const baseTrailPool: BaseTrailSlot[] = Array.from({ length: BASE_TRAIL_POOL_SIZE }, (_, idx) => {
      baseTrailMesh.setMatrixAt(idx, _trailZeroMat);
      baseTrailMesh.setColorAt(idx, _trailTmpColor.setHex(0xf59e0b));
      return {
        active: false,
        x: 0,
        y: 0.08,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.28,
        baseScale: 1,
        r: 0.96,
        g: 0.62,
        b: 0.04,
      };
    });
    baseTrailMesh.instanceMatrix.needsUpdate = true;
    if (baseTrailMesh.instanceColor) baseTrailMesh.instanceColor.needsUpdate = true;
    let baseTrailCursor = 0;

    const spawnBaseTrailParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      maxLife: number,
      baseScale: number,
      colorInput: THREE.ColorRepresentation
    ) => {
      const slot = baseTrailPool[baseTrailCursor];
      baseTrailCursor = (baseTrailCursor + 1) % BASE_TRAIL_POOL_SIZE;
      _trailTmpColor.set(colorInput);
      slot.active = true;
      slot.x = THREE.MathUtils.clamp(x, -4.4, 4.4);
      slot.y = y;
      slot.z = z;
      slot.vx = vx;
      slot.vy = vy;
      slot.vz = vz;
      slot.life = 0;
      slot.maxLife = maxLife;
      slot.baseScale = baseScale;
      slot.r = _trailTmpColor.r;
      slot.g = _trailTmpColor.g;
      slot.b = _trailTmpColor.b;
    };

    // Geometrias & materiais partilhados para zero alocação/vazamento de GPU em 60 FPS
    const sharedGeos = {
      pelvis: new THREE.BoxGeometry(0.44, 0.14, 0.28),
      bodyTorso: new THREE.BoxGeometry(0.56, 0.56, 0.34),
      chestStripe: new THREE.BoxGeometry(0.16, 0.54, 0.365),
      collar: new THREE.CylinderGeometry(0.13, 0.17, 0.09, 10),
      belt: new THREE.BoxGeometry(0.58, 0.08, 0.365),
      epaulet: new THREE.BoxGeometry(0.16, 0.075, 0.35),
      neck: new THREE.CylinderGeometry(0.09, 0.105, 0.12, 10),
      head: new THREE.SphereGeometry(0.28, 16, 14),
      ear: new THREE.SphereGeometry(0.052, 8, 8),
      hairCap: new THREE.SphereGeometry(0.295, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      afroDome: new THREE.SphereGeometry(0.35, 14, 12),
      ponytail: (() => {
        const g = new THREE.CylinderGeometry(0.06, 0.11, 0.34, 8);
        g.translate(0, -0.17, 0);
        return g;
      })(),
      backHair: new THREE.BoxGeometry(0.36, 0.24, 0.14),
      visor: new THREE.BoxGeometry(0.41, 0.095, 0.11),
      thigh: new THREE.CylinderGeometry(0.112, 0.092, 0.34, 10),
      kneeCap: new THREE.SphereGeometry(0.09, 8, 8),
      shin: new THREE.CylinderGeometry(0.09, 0.072, 0.32, 10),
      shoeUpper: new THREE.BoxGeometry(0.195, 0.095, 0.31),
      shoeSole: new THREE.BoxGeometry(0.21, 0.045, 0.335),
      upperArm: new THREE.CylinderGeometry(0.082, 0.07, 0.28, 10),
      elbowCap: new THREE.SphereGeometry(0.07, 8, 8),
      forearm: new THREE.CylinderGeometry(0.068, 0.056, 0.26, 10),
      cuff: new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10),
      hand: new THREE.SphereGeometry(0.07, 8, 8),
      crownBand: new THREE.CylinderGeometry(0.22, 0.20, 0.1, 14),
      crownPeak: new THREE.ConeGeometry(0.055, 0.16, 5),
      crownGem: new THREE.OctahedronGeometry(0.045, 0),
      cap: new THREE.CylinderGeometry(0.29, 0.31, 0.2, 14),
      capBrim: new THREE.BoxGeometry(0.42, 0.035, 0.24),
      band: new THREE.TorusGeometry(0.292, 0.04, 8, 16),
      earCup: new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10),
      cape: (() => {
        const g = new THREE.PlaneGeometry(0.64, 1.05);
        g.translate(0, -0.525, 0);
        return g;
      })(),
      stumbleRing: new THREE.TorusGeometry(0.42, 0.03, 6, 16),
      dizzyStar: new THREE.OctahedronGeometry(0.085, 0),
      playerRing: new THREE.RingGeometry(0.62, 0.78, 24),
      nitroAura: new THREE.RingGeometry(0.82, 0.96, 24),
      shadow: new THREE.CircleGeometry(0.55, 12),
      obsShadow: new THREE.CircleGeometry(0.85, 14),
      // Veículos 3D (Candongueiro & Táxi)
      vanBody: new THREE.BoxGeometry(1.75, 1.1, 2.95),
      vanRoof: new THREE.BoxGeometry(1.64, 0.62, 2.25),
      windshield: new THREE.BoxGeometry(1.52, 0.45, 0.08),
      taxiCabBody: new THREE.BoxGeometry(1.62, 0.68, 2.75),
      taxiCabRoof: new THREE.BoxGeometry(1.38, 0.52, 1.45),
      taxiSign: new THREE.BoxGeometry(0.54, 0.22, 0.26),
      wheel: new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12),
      wheelRim: new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10),
      headlight: new THREE.SphereGeometry(0.14, 8, 8),
      // Buraco na Marginal + Cones 3D
      hole: new THREE.CylinderGeometry(0.92, 0.72, 0.16, 16),
      holeRim: new THREE.TorusGeometry(0.95, 0.08, 6, 18),
      coneBase: new THREE.BoxGeometry(0.42, 0.07, 0.42),
      coneBody: new THREE.ConeGeometry(0.18, 0.55, 10),
      coneStripe: new THREE.CylinderGeometry(0.11, 0.14, 0.14, 10),
      // Zungueira com Bacia
      dress: new THREE.CylinderGeometry(0.3, 0.52, 1.0, 10),
      personHead: new THREE.SphereGeometry(0.24, 10, 10),
      basket: new THREE.CylinderGeometry(0.82, 0.46, 0.55, 14),
      fruitItem: new THREE.SphereGeometry(0.2, 8, 8),
      // Tambor de Obra metálico
      drum: new THREE.CylinderGeometry(0.54, 0.54, 1.22, 14),
      drumBand: new THREE.CylinderGeometry(0.555, 0.555, 0.34, 14),
      drumRim: new THREE.TorusGeometry(0.54, 0.04, 6, 14),
      // Barreira Policial 3D
      barricadeBeam: new THREE.BoxGeometry(1.76, 0.42, 0.18),
      barricadeStripe: new THREE.BoxGeometry(0.32, 0.44, 0.2),
      barricadeLeg: new THREE.BoxGeometry(0.12, 1.15, 0.12),
      siren: new THREE.SphereGeometry(0.16, 8, 8),
      // Balde d'Água 3D
      puddle: new THREE.CylinderGeometry(0.95, 0.95, 0.04, 16),
      bucket: new THREE.CylinderGeometry(0.46, 0.34, 0.78, 14),
      bucketWater: new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14),
      bucketHandle: new THREE.TorusGeometry(0.46, 0.035, 6, 14, Math.PI),
      // Cão de Rua 3D
      dogTorso: new THREE.BoxGeometry(0.52, 0.45, 1.05),
      dogHead: new THREE.BoxGeometry(0.36, 0.34, 0.42),
      dogSnout: new THREE.BoxGeometry(0.22, 0.18, 0.26),
      dogLeg: new THREE.BoxGeometry(0.14, 0.42, 0.14),
      dogTail: new THREE.CylinderGeometry(0.04, 0.06, 0.48, 6),
      // Fios Caídos + Postes + Faíscas
      wire: new THREE.CylinderGeometry(0.05, 0.05, 1.95, 6),
      wirePost: new THREE.CylinderGeometry(0.07, 0.09, 1.75, 6),
      spark: new THREE.OctahedronGeometry(0.16),
      // Montra Comercial 3D
      kioskBase: new THREE.BoxGeometry(1.68, 1.15, 0.9),
      kioskGlass: new THREE.BoxGeometry(1.48, 0.65, 0.94),
      kioskAwning: new THREE.BoxGeometry(1.82, 0.16, 1.18),
      // Power-ups & Moeda
      nitro: new THREE.OctahedronGeometry(0.52),
      hatBase: new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12),
      hatTop: new THREE.CylinderGeometry(0.38, 0.38, 0.48, 12),
      gasCan: new THREE.BoxGeometry(0.58, 0.78, 0.38),
      coin: new THREE.CylinderGeometry(0.36, 0.36, 0.1, 14),
    };

    const sharedMats = {
      headSkin: new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 }),
      legDark: new THREE.MeshStandardMaterial({ color: 0x1e293b }),
      whiteSole: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }),
      crownGold: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.12 }),
      crownRuby: new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x450a0a, roughness: 0.18 }),
      visorDark: new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.85, roughness: 0.15 }),
      playerRingGold: new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82,
      }),
      nitroAuraCyan: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
      capePlayer: new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide }),
      capeBot: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, side: THREE.DoubleSide }),
      stumbleBody: new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        roughness: 0.45,
      }),
      stumbleRing: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
      shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
      vanBlue: new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.35, roughness: 0.35 }),
      vanWhite: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }),
      glassDark: new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15 }),
      tireBlack: new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 }),
      rimSilver: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.25 }),
      headlight: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      tailLightRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      hole: new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.95 }),
      holeRim: new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 }),
      coneOrange: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 }),
      basket: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 }),
      dressRed: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 }),
      fruitYellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
      fruitGreen: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45 }),
      fruitRed: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 }),
      drum: new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.45, roughness: 0.35 }),
      drumBand: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.25, roughness: 0.4 }),
      police: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.3 }),
      sirenRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      sirenBlue: new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
      metalGray: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 }),
      waterPuddle: new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        metalness: 0.6,
        roughness: 0.15,
        transparent: true,
        opacity: 0.85,
      }),
      bucketMetal: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 }),
      dogFur: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 }),
      wire: new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
      wirePost: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 }),
      sparkCyan: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      kioskFrame: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }),
      kioskGlass: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        metalness: 0.6,
      }),
      nitro: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 }),
      hatBase: new THREE.MeshStandardMaterial({ color: 0xf97316 }),
      hatTop: new THREE.MeshStandardMaterial({ color: 0x18181b }),
      gasCan: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.4 }),
      coin: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.18 }),
    };

    const runnerBodyMats = new Map<string, THREE.MeshStandardMaterial>();
    const getRunnerBodyMat = (colorKey: string | number, roughness = 0.45, doubleSide = false) => {
      const key = `${String(colorKey)}-${roughness}-${doubleSide}`;
      let mat = runnerBodyMats.get(key);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: colorKey as THREE.ColorRepresentation,
          metalness: 0.3,
          roughness,
          side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        });
        runnerBodyMats.set(key, mat);
      }
      return mat;
    };

    // ========================================================================
    // POOLS PERSISTENTES ZERO-GC (Corredores, Obstáculos, Moedas, Power-Ups)
    // ========================================================================
    const runnerRigMap = new Map<string, RunnerRig>();
    const obsMeshMap = new Map<number, PooledObstacle>();
    const coinMeshMap = new Map<number, THREE.Mesh>();
    const puMeshMap = new Map<number, THREE.Group>();

    const wheelOffsets: Array<[number, number]> = [
      [-0.86, 0.92],
      [0.86, 0.92],
      [-0.86, -0.92],
      [0.86, -0.92],
    ];

    const getOrCreateRunnerRig = (comp: Competitor): RunnerRig => {
      const existing = runnerRigMap.get(comp.id);
      if (existing) return existing;

      const look = resolveAvatarLook(comp.avatarId, comp.name, comp.color);

      const root = new THREE.Group();
      const inner = new THREE.Group();
      root.add(inner);

      const shadow = new THREE.Mesh(sharedGeos.shadow, sharedMats.shadow);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      root.add(shadow);

      const playerRing = new THREE.Mesh(sharedGeos.playerRing, sharedMats.playerRingGold);
      playerRing.rotation.x = -Math.PI / 2;
      playerRing.position.y = 0.04;
      playerRing.visible = comp.isPlayer;
      root.add(playerRing);

      const nitroAura = new THREE.Mesh(sharedGeos.nitroAura, sharedMats.nitroAuraCyan);
      nitroAura.rotation.x = -Math.PI / 2;
      nitroAura.position.y = 0.05;
      nitroAura.visible = false;
      root.add(nitroAura);

      const jacketMat = getRunnerBodyMat(look.jacket, 0.45);
      const accentMat = getRunnerBodyMat(look.jacketAccent, 0.35);
      const skinMat = getRunnerBodyMat(look.skin, 0.58);
      const hairMat = getRunnerBodyMat(look.hair, 0.72);
      const legMat = getRunnerBodyMat(look.pants, 0.72);
      const shoeMat = getRunnerBodyMat(look.shoes, 0.38);
      const headwearMat = getRunnerBodyMat(look.headwearColor, 0.4);
      const headwearAccentMat = getRunnerBodyMat(look.headwearAccent, 0.35);

      // Pélvis articulada (chão aos pés ~0.76m)
      const hipsGroup = new THREE.Group();
      hipsGroup.position.set(0, 0.76, 0);
      inner.add(hipsGroup);

      const pelvisMesh = new THREE.Mesh(sharedGeos.pelvis, legMat);
      pelvisMesh.castShadow = true;
      hipsGroup.add(pelvisMesh);

      // Tronco articulado
      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.05, 0);
      hipsGroup.add(torsoGroup);

      const body = new THREE.Mesh(sharedGeos.bodyTorso, jacketMat);
      body.position.y = 0.29;
      body.castShadow = true;
      torsoGroup.add(body);

      const chestStripe = new THREE.Mesh(sharedGeos.chestStripe, accentMat);
      chestStripe.position.set(0, 0.29, -0.005);
      torsoGroup.add(chestStripe);

      const collarMesh = new THREE.Mesh(sharedGeos.collar, accentMat);
      collarMesh.position.set(0, 0.59, 0);
      torsoGroup.add(collarMesh);

      const beltMesh = new THREE.Mesh(sharedGeos.belt, accentMat);
      beltMesh.position.set(0, 0.045, 0);
      torsoGroup.add(beltMesh);

      const leftEpaulet = new THREE.Mesh(sharedGeos.epaulet, accentMat);
      leftEpaulet.position.set(-0.27, 0.56, 0);
      const rightEpaulet = new THREE.Mesh(sharedGeos.epaulet, accentMat);
      rightEpaulet.position.set(0.27, 0.56, 0);
      torsoGroup.add(leftEpaulet, rightEpaulet);

      // Pescoço & Cabeça articulada (frente = -Z)
      const neckMesh = new THREE.Mesh(sharedGeos.neck, skinMat);
      neckMesh.position.set(0, 0.64, 0);
      torsoGroup.add(neckMesh);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.88, 0);
      torsoGroup.add(headGroup);

      const head = new THREE.Mesh(sharedGeos.head, skinMat);
      head.scale.set(0.95, 1.04, 0.98);
      head.castShadow = true;
      headGroup.add(head);

      const leftEar = new THREE.Mesh(sharedGeos.ear, skinMat);
      leftEar.position.set(-0.26, 0, 0.02);
      const rightEar = new THREE.Mesh(sharedGeos.ear, skinMat);
      rightEar.position.set(0.26, 0, 0.02);
      headGroup.add(leftEar, rightEar);

      const hairCap = new THREE.Mesh(sharedGeos.hairCap, hairMat);
      hairCap.position.set(0, 0.025, 0.02);
      hairCap.rotation.x = 0.16;
      headGroup.add(hairCap);

      const afroMesh = new THREE.Mesh(sharedGeos.afroDome, hairMat);
      afroMesh.position.set(0, 0.07, 0.03);
      afroMesh.visible = look.hairStyle === 'afro';
      headGroup.add(afroMesh);

      const ponytailGroup = new THREE.Group();
      ponytailGroup.position.set(0, 0.05, 0.27);
      ponytailGroup.rotation.x = -0.35;
      ponytailGroup.visible = look.hairStyle === 'ponytail';
      const ponytailMesh = new THREE.Mesh(sharedGeos.ponytail, hairMat);
      ponytailGroup.add(ponytailMesh);
      headGroup.add(ponytailGroup);

      const backHairMesh = new THREE.Mesh(sharedGeos.backHair, hairMat);
      backHairMesh.position.set(0, -0.05, 0.22);
      backHairMesh.visible = look.hairStyle === 'locs' || look.hairStyle === 'braids';
      headGroup.add(backHairMesh);

      const visor = new THREE.Mesh(sharedGeos.visor, sharedMats.visorDark);
      visor.position.set(0, 0.03, -0.255);
      headGroup.add(visor);

      // Coroa Real 5 Pontas
      const crownGroup = new THREE.Group();
      crownGroup.position.set(0, 0.27, 0);
      const crownBand = new THREE.Mesh(sharedGeos.crownBand, sharedMats.crownGold);
      crownGroup.add(crownBand);
      for (let pk = 0; pk < 5; pk++) {
        const ang = (pk / 5) * Math.PI * 2;
        const peak = new THREE.Mesh(sharedGeos.crownPeak, sharedMats.crownGold);
        peak.position.set(Math.sin(ang) * 0.18, 0.11, Math.cos(ang) * 0.18);
        crownGroup.add(peak);
      }
      const crownGem = new THREE.Mesh(sharedGeos.crownGem, sharedMats.crownRuby);
      crownGem.position.set(0, 0.02, -0.215);
      crownGroup.add(crownGem);
      headGroup.add(crownGroup);

      // Boné / Chapéu com pala
      const capGroup = new THREE.Group();
      capGroup.position.set(0, 0.25, 0);
      const capCrown = new THREE.Mesh(sharedGeos.cap, headwearMat);
      const capBrim = new THREE.Mesh(sharedGeos.capBrim, headwearAccentMat);
      capBrim.position.set(0, -0.08, -0.22);
      capGroup.add(capCrown, capBrim);
      headGroup.add(capGroup);

      // Fita / Auscultadores
      const bandGroup = new THREE.Group();
      bandGroup.position.set(0, 0.09, 0);
      const bandMesh = new THREE.Mesh(sharedGeos.band, headwearMat);
      bandMesh.rotation.x = Math.PI / 2;
      const leftEarCup = new THREE.Mesh(sharedGeos.earCup, headwearAccentMat);
      leftEarCup.rotation.z = Math.PI / 2;
      leftEarCup.position.set(-0.29, -0.08, 0.01);
      const rightEarCup = new THREE.Mesh(sharedGeos.earCup, headwearAccentMat);
      rightEarCup.rotation.z = Math.PI / 2;
      rightEarCup.position.set(0.29, -0.08, 0.01);
      const isPhones = look.headwear === 'headphones-visor';
      leftEarCup.visible = isPhones;
      rightEarCup.visible = isPhones;
      bandGroup.add(bandMesh, leftEarCup, rightEarCup);
      headGroup.add(bandGroup);

      // Pernas articuladas (Anca -> Coxa -> Joelho -> Canela -> Ténis bicolor)
      const buildLeg = (side: -1 | 1) => {
        const hip = new THREE.Group();
        hip.position.set(side * 0.14, -0.04, 0);
        hipsGroup.add(hip);

        const thigh = new THREE.Mesh(sharedGeos.thigh, legMat);
        thigh.position.y = -0.17;
        thigh.castShadow = true;
        hip.add(thigh);

        const knee = new THREE.Group();
        knee.position.set(0, -0.34, 0);
        hip.add(knee);

        const kneeCap = new THREE.Mesh(sharedGeos.kneeCap, legMat);
        knee.add(kneeCap);

        const shin = new THREE.Mesh(sharedGeos.shin, legMat);
        shin.position.y = -0.16;
        shin.castShadow = true;
        knee.add(shin);

        const shoeGroup = new THREE.Group();
        shoeGroup.position.set(0, -0.33, -0.04);
        knee.add(shoeGroup);

        const shoe = new THREE.Mesh(sharedGeos.shoeUpper, shoeMat);
        shoe.position.y = 0.025;
        const sole = new THREE.Mesh(sharedGeos.shoeSole, sharedMats.whiteSole);
        sole.position.y = -0.025;
        shoeGroup.add(shoe, sole);

        return { hip, thigh, knee, kneeCap, shin, shoeGroup, shoe, sole };
      };
      const leftLegParts = buildLeg(-1);
      const rightLegParts = buildLeg(1);

      // Braços articulados (Ombro -> Braço -> Cotovelo -> Antebraço -> Mão)
      const buildArm = (side: -1 | 1) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.36, 0.51, 0);
        torsoGroup.add(shoulder);

        const upperArm = new THREE.Mesh(sharedGeos.upperArm, jacketMat);
        upperArm.position.y = -0.14;
        upperArm.castShadow = true;
        shoulder.add(upperArm);

        const elbow = new THREE.Group();
        elbow.position.set(0, -0.28, 0);
        shoulder.add(elbow);

        const elbowCap = new THREE.Mesh(sharedGeos.elbowCap, jacketMat);
        elbow.add(elbowCap);

        const forearm = new THREE.Mesh(sharedGeos.forearm, jacketMat);
        forearm.position.y = -0.13;
        forearm.castShadow = true;
        elbow.add(forearm);

        const cuff = new THREE.Mesh(sharedGeos.cuff, accentMat);
        cuff.position.y = -0.24;
        elbow.add(cuff);

        const hand = new THREE.Mesh(sharedGeos.hand, skinMat);
        hand.position.y = -0.29;
        elbow.add(hand);

        return { shoulder, upperArm, elbow, elbowCap, forearm, cuff, hand };
      };
      const leftArmParts = buildArm(-1);
      const rightArmParts = buildArm(1);

      // Capa Real ancorada nos ombros
      const cape = new THREE.Mesh(
        sharedGeos.cape,
        getRunnerBodyMat(look.capeOrScarf || look.jacketAccent, 0.55, true)
      );
      cape.position.set(0, 0.56, 0.2);
      cape.visible = Boolean(look.capeOrScarf);
      torsoGroup.add(cape);

      // Estrelas de tontura ao bater em obstáculo
      const dizzyGroup = new THREE.Group();
      dizzyGroup.visible = false;
      const dizzyRingMesh = new THREE.Mesh(sharedGeos.stumbleRing, sharedMats.stumbleRing);
      dizzyRingMesh.rotation.x = Math.PI / 2;
      dizzyGroup.add(dizzyRingMesh);
      for (let st = 0; st < 3; st++) {
        const ang = (st / 3) * Math.PI * 2;
        const star = new THREE.Mesh(sharedGeos.dizzyStar, sharedMats.crownGold);
        star.position.set(Math.cos(ang) * 0.42, 0.04, Math.sin(ang) * 0.42);
        dizzyGroup.add(star);
      }
      headGroup.add(dizzyGroup);

      runnersGroup.add(root);

      const rig: RunnerRig = {
        root,
        inner,
        shadow,
        playerRing,
        nitroAura,
        hipsGroup,
        pelvisMesh,
        torsoGroup,
        body,
        chestStripe,
        collarMesh,
        beltMesh,
        leftEpaulet,
        rightEpaulet,
        neckMesh,
        headGroup,
        head,
        leftEar,
        rightEar,
        hairCap,
        afroMesh,
        ponytailGroup,
        ponytailMesh,
        backHairMesh,
        visor,
        leftHip: leftLegParts.hip,
        leftThigh: leftLegParts.thigh,
        leftKnee: leftLegParts.knee,
        leftKneeCap: leftLegParts.kneeCap,
        leftShin: leftLegParts.shin,
        leftShoeGroup: leftLegParts.shoeGroup,
        leftShoe: leftLegParts.shoe,
        leftSole: leftLegParts.sole,
        rightHip: rightLegParts.hip,
        rightThigh: rightLegParts.thigh,
        rightKnee: rightLegParts.knee,
        rightKneeCap: rightLegParts.kneeCap,
        rightShin: rightLegParts.shin,
        rightShoeGroup: rightLegParts.shoeGroup,
        rightShoe: rightLegParts.shoe,
        rightSole: rightLegParts.sole,
        leftShoulder: leftArmParts.shoulder,
        leftUpperArm: leftArmParts.upperArm,
        leftElbow: leftArmParts.elbow,
        leftElbowCap: leftArmParts.elbowCap,
        leftForearm: leftArmParts.forearm,
        leftCuff: leftArmParts.cuff,
        leftHand: leftArmParts.hand,
        rightShoulder: rightArmParts.shoulder,
        rightUpperArm: rightArmParts.upperArm,
        rightElbow: rightArmParts.elbow,
        rightElbowCap: rightArmParts.elbowCap,
        rightForearm: rightArmParts.forearm,
        rightCuff: rightArmParts.cuff,
        rightHand: rightArmParts.hand,
        crownGroup,
        crownGem,
        capGroup,
        capCrown: capCrown,
        capBrim,
        bandGroup,
        bandMesh,
        leftEarCup,
        rightEarCup,
        cape,
        dizzyGroup,
        smoothX: 0,
        smoothZ: 0,
        prevJumpOffset: 0,
        squashY: 1,
        wasAirborne: false,
        initialized: false,
        trailAcc: 0,
        trailStep: 0,
        appliedLookKey: `${comp.avatarId || ''}|${comp.name}|${comp.color || ''}`,
      };
      runnerRigMap.set(comp.id, rig);
      return rig;
    };

    const createPooledObstacle = (obs: Obstacle): PooledObstacle => {
      const obsObj = new THREE.Group();
      const oId = obs.obstacleId;
      const wheels: THREE.Mesh[] = [];
      const blinkLights: THREE.Mesh[] = [];
      let sirenL: THREE.Mesh | undefined;
      let sirenR: THREE.Mesh | undefined;
      let dogTail: THREE.Mesh | undefined;
      let spark: THREE.Mesh | undefined;

      if (oId === 'candongueiro-parado') {
        const vanBody = new THREE.Mesh(sharedGeos.vanBody, sharedMats.vanBlue);
        vanBody.position.y = 0.86;
        vanBody.castShadow = true;

        const vanRoof = new THREE.Mesh(sharedGeos.vanRoof, sharedMats.vanWhite);
        vanRoof.position.set(0, 1.7, -0.1);
        vanRoof.castShadow = true;

        const rearGlass = new THREE.Mesh(sharedGeos.windshield, sharedMats.glassDark);
        rearGlass.position.set(0, 1.56, 1.04);

        const hlLeft = new THREE.Mesh(sharedGeos.headlight, sharedMats.headlight);
        hlLeft.position.set(-0.62, 0.72, 1.48);
        const hlRight = new THREE.Mesh(sharedGeos.headlight, sharedMats.headlight);
        hlRight.position.set(0.62, 0.72, 1.48);
        blinkLights.push(hlLeft, hlRight);

        obsObj.add(vanBody, vanRoof, rearGlass, hlLeft, hlRight);

        wheelOffsets.forEach(([wx, wz]) => {
          const tire = new THREE.Mesh(sharedGeos.wheel, sharedMats.tireBlack);
          tire.rotation.z = Math.PI / 2;
          tire.position.set(wx, 0.3, wz);
          const rim = new THREE.Mesh(sharedGeos.wheelRim, sharedMats.rimSilver);
          rim.rotation.z = Math.PI / 2;
          rim.position.set(wx, 0.3, wz);
          wheels.push(tire, rim);
          obsObj.add(tire, rim);
        });
      } else if (oId === 'taxi-azul-branco') {
        const cabBody = new THREE.Mesh(sharedGeos.taxiCabBody, sharedMats.vanBlue);
        cabBody.position.y = 0.64;
        cabBody.castShadow = true;

        const cabRoof = new THREE.Mesh(sharedGeos.taxiCabRoof, sharedMats.vanWhite);
        cabRoof.position.set(0, 1.22, -0.05);
        cabRoof.castShadow = true;

        const taxiSign = new THREE.Mesh(sharedGeos.taxiSign, sharedMats.headlight);
        taxiSign.position.set(0, 1.56, -0.05);

        const tailL = new THREE.Mesh(sharedGeos.headlight, sharedMats.tailLightRed);
        tailL.position.set(-0.56, 0.68, 1.38);
        const tailR = new THREE.Mesh(sharedGeos.headlight, sharedMats.tailLightRed);
        tailR.position.set(0.56, 0.68, 1.38);

        obsObj.add(cabBody, cabRoof, taxiSign, tailL, tailR);

        wheelOffsets.forEach(([wx, wz]) => {
          const tire = new THREE.Mesh(sharedGeos.wheel, sharedMats.tireBlack);
          tire.rotation.z = Math.PI / 2;
          tire.position.set(wx * 0.92, 0.28, wz * 0.88);
          wheels.push(tire);
          obsObj.add(tire);
        });
      } else if (oId === 'buraco-marginal') {
        const hole = new THREE.Mesh(sharedGeos.hole, sharedMats.hole);
        hole.position.y = 0.04;
        const rim = new THREE.Mesh(sharedGeos.holeRim, sharedMats.holeRim);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.08;
        obsObj.add(hole, rim);

        [-0.78, 0.78].forEach((cx) => {
          const base = new THREE.Mesh(sharedGeos.coneBase, sharedMats.coneOrange);
          base.position.set(cx, 0.04, 0.2);
          const cone = new THREE.Mesh(sharedGeos.coneBody, sharedMats.coneOrange);
          cone.position.set(cx, 0.34, 0.2);
          const stripe = new THREE.Mesh(sharedGeos.coneStripe, sharedMats.vanWhite);
          stripe.position.set(cx, 0.34, 0.2);
          obsObj.add(base, cone, stripe);
        });
      } else if (oId === 'zungueira-bacia') {
        const shadow = new THREE.Mesh(sharedGeos.obsShadow, sharedMats.shadow);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;

        const dress = new THREE.Mesh(sharedGeos.dress, sharedMats.dressRed);
        dress.position.y = 0.5;
        const head = new THREE.Mesh(sharedGeos.personHead, sharedMats.basket);
        head.position.y = 1.15;
        const basket = new THREE.Mesh(sharedGeos.basket, sharedMats.basket);
        basket.position.y = 1.56;

        const f1 = new THREE.Mesh(sharedGeos.fruitItem, sharedMats.fruitYellow);
        f1.position.set(-0.28, 1.85, 0.12);
        const f2 = new THREE.Mesh(sharedGeos.fruitItem, sharedMats.fruitGreen);
        f2.position.set(0.22, 1.88, -0.05);
        const f3 = new THREE.Mesh(sharedGeos.fruitItem, sharedMats.fruitRed);
        f3.position.set(0.0, 1.92, 0.24);

        obsObj.add(shadow, dress, head, basket, f1, f2, f3);
      } else if (oId === 'tambor') {
        const shadow = new THREE.Mesh(sharedGeos.obsShadow, sharedMats.shadow);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;

        const drum = new THREE.Mesh(sharedGeos.drum, sharedMats.drum);
        drum.position.y = 0.62;
        drum.castShadow = true;

        const band = new THREE.Mesh(sharedGeos.drumBand, sharedMats.drumBand);
        band.position.y = 0.62;

        const rimTop = new THREE.Mesh(sharedGeos.drumRim, sharedMats.metalGray);
        rimTop.rotation.x = Math.PI / 2;
        rimTop.position.y = 1.22;

        obsObj.add(shadow, drum, band, rimTop);
      } else if (oId === 'policia') {
        const beam = new THREE.Mesh(sharedGeos.barricadeBeam, sharedMats.vanWhite);
        beam.position.y = 0.85;
        beam.castShadow = true;

        [-0.62, 0, 0.62].forEach((sx) => {
          const stripe = new THREE.Mesh(sharedGeos.barricadeStripe, sharedMats.drum);
          stripe.position.set(sx, 0.85, 0);
          obsObj.add(stripe);
        });

        [-0.72, 0.72].forEach((lx) => {
          const legF = new THREE.Mesh(sharedGeos.barricadeLeg, sharedMats.metalGray);
          legF.position.set(lx, 0.55, 0.2);
          legF.rotation.x = -0.3;
          const legB = new THREE.Mesh(sharedGeos.barricadeLeg, sharedMats.metalGray);
          legB.position.set(lx, 0.55, -0.2);
          legB.rotation.x = 0.3;
          obsObj.add(legF, legB);
        });

        sirenL = new THREE.Mesh(sharedGeos.siren, sharedMats.sirenRed);
        sirenL.position.set(-0.62, 1.2, 0);
        sirenR = new THREE.Mesh(sharedGeos.siren, sharedMats.sirenBlue);
        sirenR.position.set(0.62, 1.2, 0);

        obsObj.add(beam, sirenL, sirenR);
      } else if (oId === 'balde-agua') {
        const puddle = new THREE.Mesh(sharedGeos.puddle, sharedMats.waterPuddle);
        puddle.position.y = 0.025;

        const bucket = new THREE.Mesh(sharedGeos.bucket, sharedMats.bucketMetal);
        bucket.position.y = 0.42;
        bucket.castShadow = true;

        const waterTop = new THREE.Mesh(sharedGeos.bucketWater, sharedMats.waterPuddle);
        waterTop.position.y = 0.79;

        const handle = new THREE.Mesh(sharedGeos.bucketHandle, sharedMats.metalGray);
        handle.position.y = 0.78;

        obsObj.add(puddle, bucket, waterTop, handle);
      } else if (oId === 'cao-de-rua' || (oId as string) === 'cao-rua') {
        const shadow = new THREE.Mesh(sharedGeos.shadow, sharedMats.shadow);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;

        const torso = new THREE.Mesh(sharedGeos.dogTorso, sharedMats.dogFur);
        torso.position.y = 0.56;
        torso.castShadow = true;

        const dHead = new THREE.Mesh(sharedGeos.dogHead, sharedMats.dogFur);
        dHead.position.set(0, 0.82, 0.56);

        const snout = new THREE.Mesh(sharedGeos.dogSnout, sharedMats.basket);
        snout.position.set(0, 0.76, 0.84);

        dogTail = new THREE.Mesh(sharedGeos.dogTail, sharedMats.dogFur);
        dogTail.position.set(0, 0.85, -0.58);
        dogTail.rotation.x = -0.7;

        obsObj.add(shadow, torso, dHead, snout, dogTail);

        [
          [-0.18, 0.36],
          [0.18, 0.36],
          [-0.18, -0.36],
          [0.18, -0.36],
        ].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(sharedGeos.dogLeg, sharedMats.dogFur);
          leg.position.set(lx, 0.22, lz);
          obsObj.add(leg);
        });
      } else if (oId === 'fios-caidos') {
        const wireTop = new THREE.Mesh(sharedGeos.wire, sharedMats.tireBlack);
        wireTop.rotation.z = Math.PI / 2;
        wireTop.position.y = 1.65;

        const wireLive = new THREE.Mesh(sharedGeos.wire, sharedMats.wire);
        wireLive.rotation.z = Math.PI / 2;
        wireLive.position.y = 1.42;

        const postL = new THREE.Mesh(sharedGeos.wirePost, sharedMats.wirePost);
        postL.position.set(-0.92, 0.88, 0);
        const postR = new THREE.Mesh(sharedGeos.wirePost, sharedMats.wirePost);
        postR.position.set(0.92, 0.88, 0);

        spark = new THREE.Mesh(sharedGeos.spark, sharedMats.sparkCyan);
        spark.position.set(0, 1.42, 0.12);

        obsObj.add(wireTop, wireLive, postL, postR, spark);
      } else {
        const kBase = new THREE.Mesh(sharedGeos.kioskBase, sharedMats.kioskFrame);
        kBase.position.y = 0.58;
        kBase.castShadow = true;

        const kGlass = new THREE.Mesh(sharedGeos.kioskGlass, sharedMats.kioskGlass);
        kGlass.position.y = 0.72;

        const awning = new THREE.Mesh(sharedGeos.kioskAwning, sharedMats.drum);
        awning.position.set(0, 1.28, 0.12);
        awning.rotation.x = 0.28;

        obsObj.add(kBase, kGlass, awning);
      }

      obstaclesGroup.add(obsObj);
      return { group: obsObj, obstacleId: oId, wheels, blinkLights, sirenL, sirenR, dogTail, spark };
    };

    const createPooledPowerUp = (pu: PowerUpItem): THREE.Group => {
      const puGroup = new THREE.Group();
      if (pu.type === 'kikuuba-nitro') {
        const nitroMesh = new THREE.Mesh(sharedGeos.nitro, sharedMats.nitro);
        nitroMesh.rotation.z = 0.3;
        puGroup.add(nitroMesh);
      } else if (pu.type === 'chapeu-kudurista') {
        const hatBase = new THREE.Mesh(sharedGeos.hatBase, sharedMats.hatBase);
        const hatTop = new THREE.Mesh(sharedGeos.hatTop, sharedMats.hatTop);
        hatTop.position.y = 0.25;
        puGroup.add(hatBase, hatTop);
      } else {
        const gasCan = new THREE.Mesh(sharedGeos.gasCan, sharedMats.gasCan);
        puGroup.add(gasCan);
      }
      powerUpsGroup.add(puGroup);
      return puGroup;
    };

    // Resize handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 640;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Loop de Animação 60 FPS Zero-GC com Física 3D Otimizada
    let lastFrameTime = performance.now();
    let runStridePhase = 0;
    const activeRunnerIds = new Set<string>();
    const activeObsIds = new Set<number>();
    const activeCoinIds = new Set<number>();
    const activePuIds = new Set<number>();

    let isLoopStopped = false;
    const animate = (now: number) => {
      if (isLoopStopped) return;
      const p = propsRef.current;
      const live = p.liveStateRef?.current;
      const currentStatus = live ? live.status : p.status;

      if (p.paused || document.hidden) {
        reqIdRef.current = null;
        return;
      }

      reqIdRef.current = requestAnimationFrame(animate);
      const dt = Math.min(Math.max((now - lastFrameTime) / 1000, 0.001), 0.05);
      lastFrameTime = now;

      const elapsedSeconds = live ? live.elapsedSeconds : p.elapsedSeconds;
      const competitorsList = live ? live.competitorsList : p.competitors;
      const obstaclesList = live ? live.obstacles : p.obstacles;
      const powerUpsList = live ? live.powerUps : p.powerUps;
      const coinsList = live ? live.coins : p.coins || [];

      const rawPlayerLane = live ? live.player.lane : p.playerLane;
      const rawTargetLane = live ? live.player.targetLane : p.playerLane;
      const playerLane = Math.max(0, Math.min(4, Math.round(rawPlayerLane))) as Lane;
      const playerTargetLane = Math.max(0, Math.min(4, Math.round(rawTargetLane))) as Lane;
      const playerLaneX = live ? live.player.laneX : LANE_CENTERS[playerLane];
      const playerJumpY = live ? live.player.jumpY : p.playerJumpY;
      const playerSlideProgress = live ? live.player.slideProgress : p.playerSlideProgress;
      const isDashing = live ? live.player.dashTimer > 0 : p.isDashing;
      const isNitro = live ? live.player.nitroTimer > 0 : p.isNitro;
      const isPlayerStumbling = live ? live.player.stumbleTimer > 0 : Boolean(p.isStumbling);
      const playerDistance = live ? live.playerDistance : elapsedSeconds * 10.2;
      const liveSpeed = live
        ? live.speed
        : isPlayerStumbling
        ? 3.2
        : isNitro
        ? 11.0
        : isDashing
        ? 9.0
        : elapsedSeconds >= HARD_MODE_START_SECONDS
        ? 12.2
        : 10.2;

      const currentIsNight = p.timeMode === 'night';
      const isRunning = currentStatus === 'running';

      // Atualiza cores/luz dia/noite apenas quando o modo muda (Zero alocação por frame)
      if (currentIsNight !== lastAppliedNight) {
        lastAppliedNight = currentIsNight;
        scene.background = currentIsNight ? nightBgColor : dayBgColor;
        if (scene.fog) {
          (scene.fog as THREE.FogExp2).color.copy(currentIsNight ? nightFogColor : dayFogColor);
        }
        scene.environmentIntensity = currentIsNight ? 0.55 : 0.82;
        renderer.toneMappingExposure = currentIsNight ? 1.02 : 1.1;
        roadMat.color.setHex(currentIsNight ? 0x64748b : 0xdbeafe);
        sidewalkMat.color.setHex(currentIsNight ? 0x475569 : 0xcbd5e1);
        seawallMat.color.setHex(currentIsNight ? 0x334155 : 0xe2e8f0);
        borderMat.color.setHex(currentIsNight ? 0xdc2626 : 0xf8fafc);
        lineMat.color.setHex(currentIsNight ? 0xf59e0b : 0xfde047);
        studMat.color.setHex(currentIsNight ? 0xfbbf24 : 0xfef08a);
        oceanMat.color.setHex(currentIsNight ? 0x02192e : 0x0284c7);
        buildingMat.color.setHex(currentIsNight ? 0x0f172a : 0x475569);
        windowStripMat.color.setHex(currentIsNight ? 0xfbbf24 : 0xbae6fd);
        leavesMat.color.setHex(currentIsNight ? 0x065f46 : 0x16a34a);
        lampHeadMat.color.setHex(currentIsNight ? 0xfacc15 : 0xf8fafc);
        lampGlowMat.opacity = currentIsNight ? 0.16 : 0.0;
        hemiLight.color.setHex(currentIsNight ? 0x3b82f6 : 0xbae6fd);
        hemiLight.groundColor.setHex(currentIsNight ? 0x090d16 : 0x1e293b);
        sunMoonLight.color.setHex(currentIsNight ? 0x60a5fa : 0xfef08a);
        sunMoonLight.intensity = currentIsNight ? 0.95 : 1.35;
      }

      const worldSpeed = isRunning ? liveSpeed * 3.1 : 0;

      // Rolagem real da pista, texturas & palmeiras sincronizada à velocidade real
      if (isRunning) {
        const deltaZ = worldSpeed * dt;
        runStridePhase += worldSpeed * 0.72 * dt;

        roadTex.offset.y = (roadTex.offset.y + deltaZ / 15) % 1;
        sidewalkTex.offset.y = (sidewalkTex.offset.y + deltaZ / 5) % 1;

        for (let i = 0; i < lineMeshes.length; i++) {
          const mesh = lineMeshes[i];
          mesh.position.z += deltaZ;
          if (mesh.position.z > 20) mesh.position.z -= 220;
        }

        for (let i = 0; i < sceneryItems.length; i++) {
          const item = sceneryItems[i];
          item.position.z += deltaZ;
          if (item.position.z > 20) item.position.z -= 216;
        }

        // Câmera com amortecimento exponencial independente do framerate (Y estável para salto vertical nítido)
        const strideAmp = isPlayerStumbling ? 0.035 : 0.075;
        const strideBob = Math.sin(runStridePhase) * strideAmp;
        const clampedPlayerWorldX = toWorldX(playerLaneX, playerLane);
        const targetCamX = clampedPlayerWorldX * 0.28;
        const targetCamY = 6.4 + strideBob;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 11, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 12, dt);

        const targetFov = isPlayerStumbling ? 56 : 60;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 9, dt);
          camera.updateProjectionMatrix();
        }
        camera.lookAt(camera.position.x * 0.4, 1.0, -14);
        const targetRoll = live ? -(live.playerLeanAngle || 0) * 0.05 : 0;
        camRoll = THREE.MathUtils.damp(camRoll, targetRoll, 12, dt);
        camera.rotation.z = camRoll;
      } else {
        const targetCamX = (lanePositionsX[playerLane] ?? 0) * 0.28;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 6.4, 10, dt);
        if (Math.abs(camera.fov - 60) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, 60, 10, dt);
          camera.updateProjectionMatrix();
        }
        camera.lookAt(camera.position.x * 0.4, 1.0, -14);
        camRoll = THREE.MathUtils.damp(camRoll, 0, 12, dt);
        camera.rotation.z = camRoll;
      }

      // Trono aproxima-se nos últimos 5.5 segundos na mesma cadência da pista até à meta aos 40s
      const throneStartSec = Math.max(THRONE_APPROACH_START_SECONDS, TOTAL_GAME_TIME_SECONDS - 5.5);
      if (elapsedSeconds >= throneStartSec) {
        const throneWindow = Math.max(1, TOTAL_GAME_TIME_SECONDS - throneStartSec);
        const throneProgress = Math.min(1.0, (elapsedSeconds - throneStartSec) / throneWindow);
        throneGroup.position.z = -180 + throneProgress * 172;
      } else {
        throneGroup.position.z = -180;
      }

      const spectatingNow = Boolean(live?.isSpectating ?? propsRef.current.isSpectating);
      const followedRunnerId = live?.followedRunnerId ?? propsRef.current.spectatedRunnerId ?? null;

      // ==========================================
      // ATUALIZA OS 5 CORREDORES NAS 5 FAIXAS (ZERO-GC RIG POOL + BOUNDARY CHECK)
      // ==========================================
      activeRunnerIds.clear();
      for (let i = 0; i < competitorsList.length; i++) {
        const comp = competitorsList[i];
        activeRunnerIds.add(comp.id);
        const rig = getOrCreateRunnerRig(comp);

        const isUser = !spectatingNow && comp.isPlayer;
        const isFollowedTarget = spectatingNow && Boolean(followedRunnerId && comp.id === followedRunnerId);
        const safeCompLane = Math.max(0, Math.min(4, Math.round(comp.lane))) as Lane;
        const safeCompTargetLane = Math.max(0, Math.min(4, Math.round(comp.targetLane ?? comp.lane))) as Lane;

        const originWorldX = lanePositionsX[isUser ? playerLane : safeCompLane] ?? 0;
        const destWorldX = lanePositionsX[isUser ? playerTargetLane : safeCompTargetLane] ?? 0;
        const corridorMinX = Math.max(-4.0, Math.min(originWorldX, destWorldX));
        const corridorMaxX = Math.min(4.0, Math.max(originWorldX, destWorldX));

        // Camada de verificação de limites X (3D): acompanha comp.laneX contínuo para humanos remotos e trava no centro só quando rig.smoothX também alinhar
        const compLaneAligned =
          !Number.isFinite(comp.laneX) ||
          (Math.abs(toWorldX(comp.laneX, safeCompTargetLane) - destWorldX) < 0.04 &&
            Math.abs(rig.smoothX - destWorldX) < 0.03);
        const targetWorldX = isUser
          ? playerLane === playerTargetLane
            ? lanePositionsX[playerTargetLane]
            : toWorldX(playerLaneX, playerTargetLane)
          : compLaneAligned
          ? destWorldX
          : toWorldX(comp.laneX, safeCompTargetLane);

        const jumpOffset = isUser ? (playerJumpY / 89) * 2.15 : ((comp.jumpY || 0) / 89) * 2.15;
        const isSlide = isUser ? playerSlideProgress > 0.05 : comp.action === 'sliding';
        const isStumbling = isUser ? isPlayerStumbling : Boolean(comp.stumbling);

        const distDelta = comp.progressDistance - playerDistance;
        const targetZPos = isUser ? 0 : toWorldZ(computeCompetitorScreenY(distDelta));

        if (!rig.initialized || currentStatus === 'idle' || currentStatus === 'starting') {
          rig.smoothX = THREE.MathUtils.clamp(destWorldX, -4.0, 4.0);
          rig.smoothZ = targetZPos;
          rig.prevJumpOffset = jumpOffset;
          rig.trailAcc = 0;
          rig.initialized = true;
        } else {
          const isLaneAligned = isUser
            ? playerLane === playerTargetLane
            : compLaneAligned;
          const useCorridorClamp = isUser || safeCompLane !== safeCompTargetLane;
          const boundedTargetX = useCorridorClamp
            ? THREE.MathUtils.clamp(targetWorldX, corridorMinX, corridorMaxX)
            : THREE.MathUtils.clamp(targetWorldX, -4.0, 4.0);
          if (isLaneAligned) {
            rig.smoothX = destWorldX;
          } else if (live) {
            // Acompanhamento direto 1:1 com a física 60 FPS sem duplo atraso de amortecimento
            rig.smoothX = boundedTargetX;
          } else {
            const dampedX = THREE.MathUtils.damp(
              rig.smoothX,
              boundedTargetX,
              isUser ? 40 : 28,
              dt
            );
            rig.smoothX = useCorridorClamp
              ? THREE.MathUtils.clamp(dampedX, corridorMinX, corridorMaxX)
              : THREE.MathUtils.clamp(dampedX, -4.0, 4.0);
          }
          rig.smoothZ = isUser ? 0 : THREE.MathUtils.damp(rig.smoothZ, targetZPos, 18, dt);
        }

        // Cinemática parabólica de salto + squash-and-stretch na aterragem
        const jumpVel = (jumpOffset - rig.prevJumpOffset) / Math.max(dt, 0.004);
        rig.prevJumpOffset = jumpOffset;
        const airborne = jumpOffset > 0.06;
        if (rig.wasAirborne && !airborne) {
          rig.squashY = 0.78;
        }
        rig.wasAirborne = airborne;
        rig.squashY = THREE.MathUtils.damp(rig.squashY, 1.0, 16, dt);
        const xzScale = 1 / Math.sqrt(rig.squashY);

        rig.inner.scale.set(xzScale, rig.squashY, xzScale);

        const targetPitch = isStumbling
          ? -0.26
          : isSlide
          ? -0.24
          : airborne
          ? THREE.MathUtils.clamp(jumpVel * 0.032, -0.22, 0.22)
          : 0;
        rig.inner.rotation.x = THREE.MathUtils.damp(rig.inner.rotation.x, targetPitch, 16, dt);

        // Sombra no asfalto escala com altura do salto
        const shadowScale = Math.max(0.42, 1.0 - jumpOffset * 0.24);
        rig.shadow.scale.setScalar(shadowScale);

        // Quando um corredor bate num obstáculo, o ritmo das passadas abranda claramente
        const phase = isRunning
          ? isStumbling
            ? runStridePhase * 0.42
            : runStridePhase
          : 0;

        const look = resolveAvatarLook(comp.avatarId, comp.name, comp.color);
        const lookKey = `${comp.avatarId || ''}|${comp.name}|${comp.color || ''}`;
        if (rig.appliedLookKey !== lookKey) {
          rig.appliedLookKey = lookKey;
          const skinMat = getRunnerBodyMat(look.skin, 0.58);
          const hairMat = getRunnerBodyMat(look.hair, 0.72);
          const legMat = getRunnerBodyMat(look.pants, 0.72);
          const shoeMat = getRunnerBodyMat(look.shoes, 0.38);
          const jacketMat = getRunnerBodyMat(look.jacket, 0.45);
          const accentMat = getRunnerBodyMat(look.jacketAccent, 0.35);
          const headwearMat = getRunnerBodyMat(look.headwearColor, 0.4);
          const headwearAccentMat = getRunnerBodyMat(look.headwearAccent, 0.35);

          rig.head.material = skinMat;
          rig.leftEar.material = skinMat;
          rig.rightEar.material = skinMat;
          rig.neckMesh.material = skinMat;
          rig.hairCap.material = hairMat;
          rig.afroMesh.material = hairMat;
          rig.afroMesh.visible = look.hairStyle === 'afro';
          rig.ponytailMesh.material = hairMat;
          rig.ponytailGroup.visible = look.hairStyle === 'ponytail';
          rig.backHairMesh.material = hairMat;
          rig.backHairMesh.visible = look.hairStyle === 'locs' || look.hairStyle === 'braids';

          rig.chestStripe.material = accentMat;
          rig.collarMesh.material = accentMat;
          rig.beltMesh.material = accentMat;
          rig.leftEpaulet.material = accentMat;
          rig.rightEpaulet.material = accentMat;
          rig.leftCuff.material = accentMat;
          rig.rightCuff.material = accentMat;

          rig.pelvisMesh.material = legMat;
          rig.leftThigh.material = legMat;
          rig.leftKneeCap.material = legMat;
          rig.leftShin.material = legMat;
          rig.rightThigh.material = legMat;
          rig.rightKneeCap.material = legMat;
          rig.rightShin.material = legMat;
          rig.leftShoe.material = shoeMat;
          rig.rightShoe.material = shoeMat;

          rig.leftUpperArm.material = jacketMat;
          rig.leftElbowCap.material = jacketMat;
          rig.leftForearm.material = jacketMat;
          rig.rightUpperArm.material = jacketMat;
          rig.rightElbowCap.material = jacketMat;
          rig.rightForearm.material = jacketMat;
          rig.leftHand.material = skinMat;
          rig.rightHand.material = skinMat;

          rig.capCrown.material = headwearMat;
          rig.capBrim.material = headwearAccentMat;
          rig.bandMesh.material = headwearMat;
          rig.leftEarCup.material = headwearAccentMat;
          rig.rightEarCup.material = headwearAccentMat;
          const isPhones = look.headwear === 'headphones-visor';
          rig.leftEarCup.visible = isPhones;
          rig.rightEarCup.visible = isPhones;
          rig.cape.material = getRunnerBodyMat(look.capeOrScarf || look.jacketAccent, 0.55, true);
          rig.cape.visible = Boolean(look.capeOrScarf);
        }

        const compDashing = isUser ? isNitro || isDashing : comp.action === 'dashing';
        rig.playerRing.visible = isUser || isFollowedTarget;
        rig.nitroAura.visible = compDashing && !isStumbling;
        if (rig.nitroAura.visible) {
          const pulse = 1 + Math.sin(now * 0.018) * 0.08;
          rig.nitroAura.scale.setScalar(pulse);
        }

        const bodyColor: string | number = isUser && isNitro ? 0xfacc15 : look.jacket;
        const activeTorsoMat = isStumbling ? sharedMats.stumbleBody : getRunnerBodyMat(bodyColor);
        rig.body.material = activeTorsoMat;
        rig.leftUpperArm.material = activeTorsoMat;
        rig.leftElbowCap.material = activeTorsoMat;
        rig.leftForearm.material = activeTorsoMat;
        rig.rightUpperArm.material = activeTorsoMat;
        rig.rightElbowCap.material = activeTorsoMat;
        rig.rightForearm.material = activeTorsoMat;

        const runnerPhase = phase + (isUser ? 0 : comp.lane * 1.15);
        const speedDrive = !isStumbling && compDashing ? 1.15 : 1.0;

        // Cinemática articulada de corrida, salto, queda, slide e tropeço (frente = -Z)
        let targetHipsY = 0.76 + jumpOffset;
        let targetTorsoX = 0;
        let targetTorsoY = 0;
        let targetHeadX = 0;
        let targetHeadY = 0;
        let targetLHipX = 0;
        let targetLKneeX = 0;
        let targetLShoeX = 0;
        let targetRHipX = 0;
        let targetRKneeX = 0;
        let targetRShoeX = 0;
        let targetLShoulderX = 0;
        let targetLElbowX = 0.25;
        let targetRShoulderX = 0;
        let targetRElbowX = 0.25;

        if (isSlide) {
          // Pose aerodinâmica de deslizamento por baixo dos fios
          targetHipsY = 0.28 + jumpOffset;
          targetTorsoX = 0.55;
          targetHeadX = -0.42;
          targetLHipX = 1.38;
          targetLKneeX = -0.18;
          targetLShoeX = -0.25;
          targetRHipX = 0.92;
          targetRKneeX = -1.62;
          targetRShoeX = 0.35;
          targetLShoulderX = -0.62;
          targetLElbowX = 0.55;
          targetRShoulderX = 0.72;
          targetRElbowX = 0.48;
        } else if (airborne) {
          // Tuck atlético no ar
          targetHipsY = 0.8 + jumpOffset;
          targetTorsoX = THREE.MathUtils.clamp(jumpVel * 0.025, -0.2, 0.14);
          targetHeadX = -targetTorsoX * 0.5;
          targetLHipX = 0.65;
          targetLKneeX = -1.05;
          targetRHipX = -0.35;
          targetRKneeX = -0.55;
          targetLShoulderX = 0.78;
          targetLElbowX = 0.95;
          targetRShoulderX = -0.65;
          targetRElbowX = 0.85;
        } else if (isRunning) {
          const swing = Math.sin(runnerPhase);
          const oppSwing = -swing;
          const amp = (isStumbling ? 0.38 : 0.78) * speedDrive;
          const strideBounce = Math.abs(Math.sin(runnerPhase)) * (isStumbling ? 0.02 : 0.065);

          targetHipsY = 0.76 + strideBounce + jumpOffset;
          targetTorsoX = isStumbling ? -0.3 : -0.16 * speedDrive;
          targetTorsoY = swing * (isStumbling ? 0.08 : 0.14);
          targetHeadX = -targetTorsoX * 0.65;
          targetHeadY = -targetTorsoY * 0.75;

          targetLHipX = swing * amp;
          targetRHipX = oppSwing * amp;
          // Joelho dobra para trás na fase de recuperação da passada
          targetLKneeX = -0.22 - Math.max(0, -swing) * 1.05;
          targetRKneeX = -0.22 - Math.max(0, -oppSwing) * 1.05;
          targetLShoeX = swing * 0.25;
          targetRShoeX = oppSwing * 0.25;

          // Braços bombeiam em oposição às pernas com cotovelos flectidos a ~90º
          targetLShoulderX = oppSwing * amp * 0.92;
          targetRShoulderX = swing * amp * 0.92;
          const elbowBase = isStumbling ? 0.65 : 1.08;
          targetLElbowX = elbowBase + Math.max(0, oppSwing) * 0.38;
          targetRElbowX = elbowBase + Math.max(0, swing) * 0.38;
        }

        const kLimb = 22;
        rig.hipsGroup.position.y = THREE.MathUtils.damp(rig.hipsGroup.position.y, targetHipsY, kLimb, dt);
        rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, targetTorsoX, kLimb, dt);
        rig.torsoGroup.rotation.y = THREE.MathUtils.damp(rig.torsoGroup.rotation.y, targetTorsoY, kLimb, dt);
        rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, targetHeadX, kLimb, dt);
        rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, targetHeadY, kLimb, dt);

        rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, targetLHipX, kLimb, dt);
        rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, targetLKneeX, kLimb, dt);
        rig.leftShoeGroup.rotation.x = THREE.MathUtils.damp(rig.leftShoeGroup.rotation.x, targetLShoeX, kLimb, dt);
        rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, targetRHipX, kLimb, dt);
        rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, targetRKneeX, kLimb, dt);
        rig.rightShoeGroup.rotation.x = THREE.MathUtils.damp(rig.rightShoeGroup.rotation.x, targetRShoeX, kLimb, dt);

        rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, targetLShoulderX, kLimb, dt);
        rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, targetLElbowX, kLimb, dt);
        rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, targetRShoulderX, kLimb, dt);
        rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, targetRElbowX, kLimb, dt);

        if (rig.ponytailGroup.visible) {
          rig.ponytailGroup.rotation.x = isRunning
            ? -0.45 - Math.sin(runnerPhase * 1.4) * 0.25 - (isNitro || isDashing ? 0.28 : 0)
            : -0.25;
        }

        const isCrown = look.headwear === 'royal-crown' || look.headwear === 'imperial-crown';
        const isCap =
          look.headwear === 'bucket-hat' ||
          look.headwear === 'driver-cap' ||
          look.headwear === 'stealth-hood' ||
          look.headwear === 'samakaka-wrap';
        rig.crownGroup.visible = isCrown;
        rig.capGroup.visible = !isCrown && isCap;
        rig.bandGroup.visible = !isCrown && !isCap;

        rig.cape.visible = Boolean(look.capeOrScarf);
        if (rig.cape.visible) {
          const targetCapeX = isSlide
            ? -0.25
            : isRunning
            ? -0.42 - Math.sin(runnerPhase * 1.5) * 0.16 - (!isStumbling && (isNitro || isDashing) ? 0.34 : 0)
            : -0.14;
          rig.cape.rotation.x = THREE.MathUtils.damp(rig.cape.rotation.x, targetCapeX, 14, dt);
        }

        rig.dizzyGroup.visible = isStumbling;
        if (isStumbling) {
          rig.dizzyGroup.position.y = 0.42;
          rig.dizzyGroup.rotation.y += dt * 7;
          rig.inner.rotation.z = Math.sin(now * 0.025) * 0.2;
        } else if (isUser && live) {
          rig.inner.rotation.z = THREE.MathUtils.damp(
            rig.inner.rotation.z,
            -(live.playerLeanAngle || 0) * 0.4,
            15,
            dt
          );
        } else {
          const laneDeltaLean = THREE.MathUtils.clamp((targetWorldX - rig.smoothX) * 0.35, -0.32, 0.32);
          rig.inner.rotation.z = THREE.MathUtils.damp(rig.inner.rotation.z, -laneDeltaLean, 14, dt);
        }

        rig.root.position.set(rig.smoothX, 0, rig.smoothZ);

        // Emissão de rastro sutil apenas na base dos pés (desvanece rápido, sem clones colados)
        if (isRunning && !isStumbling && jumpOffset < 0.25 && rig.smoothZ > -92 && rig.smoothZ < 10) {
          const speedRatio = Math.max(0.6, Math.min(1.65, liveSpeed / 9.0));
          const emitRate = isUser
            ? isNitro || isDashing
              ? 20
              : 13 * speedRatio
            : 8 * speedRatio;
          rig.trailAcc += dt * emitRate;
          while (rig.trailAcc >= 1) {
            rig.trailAcc -= 1;
            rig.trailStep = (rig.trailStep + 1) % 2;
            const footOffsetX = rig.trailStep === 0 ? -0.17 : 0.17;
            const particleColor: THREE.ColorRepresentation = isUser
              ? isNitro
                ? 0x38bdf8
                : isDashing
                ? 0xfde047
                : 0xf59e0b
              : comp.color || 0x38bdf8;
            spawnBaseTrailParticle(
              rig.smoothX + footOffsetX + (Math.random() - 0.5) * 0.06,
              0.062 + Math.random() * 0.025,
              rig.smoothZ + 0.36,
              (Math.random() - 0.5) * 0.12,
              0.1 + Math.random() * 0.1,
              1.8 + Math.random() * 0.8,
              isUser ? (isNitro || isDashing ? 0.2 : 0.16) : 0.15,
              isUser ? (isNitro || isDashing ? 1.05 : 0.84) : 0.72,
              particleColor
            );
          }
        } else {
          rig.trailAcc = 0;
        }
      }

      // Atualiza pool instanciado de rastro na base (Zero-GC por frame)
      const clearTrails = currentStatus === 'idle' || currentStatus === 'starting';
      let hasTrailUpdate = false;
      for (let i = 0; i < BASE_TRAIL_POOL_SIZE; i++) {
        const slot = baseTrailPool[i];
        if (clearTrails && slot.active) {
          slot.active = false;
          baseTrailMesh.setMatrixAt(i, _trailZeroMat);
          hasTrailUpdate = true;
          continue;
        }
        if (!slot.active) continue;

        slot.life += dt;
        if (slot.life >= slot.maxLife || slot.z > 14) {
          slot.active = false;
          baseTrailMesh.setMatrixAt(i, _trailZeroMat);
          hasTrailUpdate = true;
          continue;
        }

        slot.x = THREE.MathUtils.clamp(slot.x + slot.vx * dt, -4.4, 4.4);
        slot.y += slot.vy * dt;
        slot.z += (worldSpeed * 0.8 + slot.vz) * dt;

        const progress = slot.life / slot.maxLife;
        const fade = 1 - progress;
        const sXY = slot.baseScale * (0.25 + 0.75 * fade * fade);
        const sZ = slot.baseScale * (0.45 + 0.85 * fade);

        _trailDummyPos.set(slot.x, slot.y, slot.z);
        _trailDummyScale.set(sXY, sXY, sZ);
        _trailDummyMat.compose(_trailDummyPos, _trailDummyQuat, _trailDummyScale);
        baseTrailMesh.setMatrixAt(i, _trailDummyMat);

        _trailTmpColor.setRGB(
          slot.r * (0.45 + 0.55 * fade),
          slot.g * (0.45 + 0.55 * fade),
          slot.b * (0.45 + 0.55 * fade)
        );
        baseTrailMesh.setColorAt(i, _trailTmpColor);
        hasTrailUpdate = true;
      }
      if (hasTrailUpdate) {
        baseTrailMesh.instanceMatrix.needsUpdate = true;
        if (baseTrailMesh.instanceColor) baseTrailMesh.instanceColor.needsUpdate = true;
      }

      // Remove rigs obsoletos apenas se a lista de IDs mudar
      for (const [id, rig] of runnerRigMap.entries()) {
        if (!activeRunnerIds.has(id)) {
          runnersGroup.remove(rig.root);
          runnerRigMap.delete(id);
        }
      }

      // ==========================================
      // ATUALIZA OS 10 OBSTÁCULOS EM 3D REAL (POOL POR obs.id)
      // ==========================================
      activeObsIds.clear();
      const wheelSpinDelta = worldSpeed * dt * 1.4;
      const blinkOn = Math.floor(now * 0.008) % 2 === 0;
      const sparkOn = Math.floor(now * 0.015) % 2 === 0;

      for (let i = 0; i < obstaclesList.length; i++) {
        const obs = obstaclesList[i];
        const oz = toWorldZ(obs.y);
        if (oz < -118 || oz > 14) continue;

        activeObsIds.add(obs.id);
        let pooled = obsMeshMap.get(obs.id);
        if (!pooled || pooled.obstacleId !== obs.obstacleId) {
          if (pooled) obstaclesGroup.remove(pooled.group);
          pooled = createPooledObstacle(obs);
          obsMeshMap.set(obs.id, pooled);
        }

        const ox = lanePositionsX[obs.lane] ?? 0;
        pooled.group.position.set(ox, 0, oz);

        // Rotação real das rodas dos Candongueiros & Táxis
        for (let w = 0; w < pooled.wheels.length; w++) {
          pooled.wheels[w].rotation.x += wheelSpinDelta;
        }
        // Piscar luzes / sirenes / faíscas com materiais partilhados
        for (let b = 0; b < pooled.blinkLights.length; b++) {
          pooled.blinkLights[b].material = blinkOn ? sharedMats.headlight : sharedMats.drum;
        }
        if (pooled.sirenL && pooled.sirenR) {
          pooled.sirenL.material = blinkOn ? sharedMats.sirenRed : sharedMats.sirenBlue;
          pooled.sirenR.material = blinkOn ? sharedMats.sirenBlue : sharedMats.sirenRed;
        }
        if (pooled.dogTail) {
          pooled.dogTail.rotation.z = Math.sin(now * 0.015 + obs.id) * 0.45;
        }
        if (pooled.spark) {
          pooled.spark.visible = sparkOn;
          pooled.spark.position.x = Math.sin(now * 0.02 + obs.id) * 0.42;
        }
      }

      for (const [obsId, pooled] of obsMeshMap.entries()) {
        if (!activeObsIds.has(obsId)) {
          obstaclesGroup.remove(pooled.group);
          obsMeshMap.delete(obsId);
        }
      }

      // ==========================================
      // ATUALIZA MOEDAS DOURADAS (KWANZA) EM 3D (POOL POR coin.id)
      // ==========================================
      activeCoinIds.clear();
      for (let i = 0; i < coinsList.length; i++) {
        const coin = coinsList[i];
        if (coin.collected) continue;
        const cz = toWorldZ(coin.y);
        if (cz < -118 || cz > 12) continue;

        activeCoinIds.add(coin.id);
        let coinMesh = coinMeshMap.get(coin.id);
        if (!coinMesh) {
          coinMesh = new THREE.Mesh(sharedGeos.coin, sharedMats.coin);
          coinMesh.rotation.x = Math.PI / 2;
          coinsGroup.add(coinMesh);
          coinMeshMap.set(coin.id, coinMesh);
        }
        const cx = lanePositionsX[coin.lane] ?? 0;
        coinMesh.rotation.z = now * 0.004 + coin.id;
        coinMesh.position.set(cx, 0.75 + Math.sin(now * 0.005 + coin.id) * 0.12, cz);
      }

      for (const [coinId, coinMesh] of coinMeshMap.entries()) {
        if (!activeCoinIds.has(coinId)) {
          coinsGroup.remove(coinMesh);
          coinMeshMap.delete(coinId);
        }
      }

      // ==========================================
      // ATUALIZA POWER-UPS EM 3D (POOL POR pu.id)
      // ==========================================
      activePuIds.clear();
      const spinAngle = now * 0.004;
      for (let i = 0; i < powerUpsList.length; i++) {
        const pu = powerUpsList[i];
        if (pu.collected) continue;
        const pz = toWorldZ(pu.y);
        if (pz < -118 || pz > 12) continue;

        activePuIds.add(pu.id);
        let puGroup = puMeshMap.get(pu.id);
        if (!puGroup) {
          puGroup = createPooledPowerUp(pu);
          puMeshMap.set(pu.id, puGroup);
        }
        const px = lanePositionsX[pu.lane] ?? 0;
        puGroup.rotation.y = spinAngle;
        puGroup.position.set(px, 1.05 + Math.sin(now * 0.005 + pu.id) * 0.15, pz);
      }

      for (const [puId, puGroup] of puMeshMap.entries()) {
        if (!activePuIds.has(puId)) {
          powerUpsGroup.remove(puGroup);
          puMeshMap.delete(puId);
        }
      }

      renderer.render(scene, camera);
    };

    const startOrResumeLoop = () => {
      if (isLoopStopped || reqIdRef.current !== null || propsRef.current.paused || document.hidden) {
        return;
      }
      lastFrameTime = performance.now();
      reqIdRef.current = requestAnimationFrame(animate);
    };
    resumeLoopRef.current = startOrResumeLoop;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        startOrResumeLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startOrResumeLoop();

    return () => {
      isLoopStopped = true;
      resumeLoopRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);

      // Limpeza total de memória GPU (Texturas, Geometrias, Materiais, Environment RenderTarget & Renderer)
      envRT.dispose();
      roadTex.dispose();
      sidewalkTex.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      sidewalkGeo.dispose();
      sidewalkMat.dispose();
      seawallGeo.dispose();
      seawallMat.dispose();
      borderGeo.dispose();
      borderMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      studGeo.dispose();
      studMat.dispose();
      oceanGeo.dispose();
      oceanMat.dispose();
      buildingGeo.dispose();
      buildingMat.dispose();
      windowStripGeo.dispose();
      windowStripMat.dispose();
      trunkLowerGeo.dispose();
      trunkUpperGeo.dispose();
      trunkMat.dispose();
      palmHubGeo.dispose();
      frondGeo.dispose();
      leavesMat.dispose();
      coconutGeo.dispose();
      coconutMat.dispose();
      poleGeo.dispose();
      poleArmGeo.dispose();
      poleMat.dispose();
      lampHeadGeo.dispose();
      lampHeadMat.dispose();
      lampGlowGeo.dispose();
      lampGlowMat.dispose();
      throneBaseGeo.dispose();
      throneBaseMat.dispose();
      throneBackGeo.dispose();
      throneBackMat.dispose();
      throneCrownGeo.dispose();
      throneCrownMat.dispose();
      throneCushionGeo.dispose();
      throneCushionMat.dispose();
      archPillarGeo.dispose();
      archBeamGeo.dispose();
      finishStripGeo.dispose();
      finishStripMat.dispose();

      Object.values(sharedGeos).forEach((geo) => geo.dispose());
      Object.values(sharedMats).forEach((mat) => mat.dispose());
      baseTrailGeo.dispose();
      baseTrailMat.dispose();
      baseTrailMesh.dispose();
      runnerBodyMats.forEach((mat) => mat.dispose());
      runnerRigMap.clear();
      obsMeshMap.clear();
      coinMeshMap.clear();
      puMeshMap.clear();

      renderer.dispose();
    };
  }, []);

  // Gestos de toque e arrasto unificados via Pointer Events (1 deslize = 1 troca de faixa)
  const beginPointerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status !== 'running' || propsRef.current.isSpectating) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (
      touchStartRef.current.activePointerId !== null &&
      e.currentTarget.hasPointerCapture?.(touchStartRef.current.activePointerId)
    ) {
      return;
    }
    touchStartRef.current.activePointerId = e.pointerId;
    touchStartRef.current.startX = e.clientX;
    touchStartRef.current.startY = e.clientY;
    touchStartRef.current.hasSwiped = false;
    touchStartRef.current.isPointerDown = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // fallback se captura não for suportada
    }
  };

  const movePointerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status !== 'running') return;
    if (!touchStartRef.current.isPointerDown) return;
    if (touchStartRef.current.activePointerId !== e.pointerId) return;
    if (touchStartRef.current.hasSwiped) return;

    const dx = e.clientX - touchStartRef.current.startX;
    const dy = e.clientY - touchStartRef.current.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > 18 && absDx > absDy * 0.8) {
      if (dx > 0) onMoveLane('right');
      else onMoveLane('left');
      touchStartRef.current.hasSwiped = true;
      touchStartRef.current.lastTapTime = 0;
      return;
    }

    if (dy < -18 && absDy > absDx * 0.8) {
      onJump();
      touchStartRef.current.hasSwiped = true;
      touchStartRef.current.lastTapTime = 0;
      return;
    }

    if (dy > 18 && absDy > absDx * 0.8) {
      onSlide();
      touchStartRef.current.hasSwiped = true;
      touchStartRef.current.lastTapTime = 0;
      return;
    }
  };

  const endPointerGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (touchStartRef.current.activePointerId !== e.pointerId) return;
    touchStartRef.current.activePointerId = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
    }
    if (!touchStartRef.current.isPointerDown) return;
    touchStartRef.current.isPointerDown = false;

    if (!cancelled && !touchStartRef.current.hasSwiped && status === 'running') {
      const totalDx = e.clientX - touchStartRef.current.startX;
      const totalDy = e.clientY - touchStartRef.current.startY;
      const absDx = Math.abs(totalDx);
      const absDy = Math.abs(totalDy);

      if (absDx > 16 || absDy > 16) {
        touchStartRef.current.lastTapTime = 0;
        if (absDx > absDy) {
          if (totalDx > 0) onMoveLane('right');
          else onMoveLane('left');
        } else {
          if (totalDy < 0) onJump();
          else onSlide();
        }
      } else {
        const now = performance.now();
        const sincePrevTap = now - touchStartRef.current.lastTapTime;
        if (sincePrevTap > 20 && sincePrevTap <= 360) {
          touchStartRef.current.lastTapTime = 0;
          propsRef.current.onDash?.();
        } else {
          touchStartRef.current.lastTapTime = now;
        }
      }
    } else {
      touchStartRef.current.lastTapTime = 0;
    }
    touchStartRef.current.hasSwiped = false;
  };

  const lostPointerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchStartRef.current.activePointerId === e.pointerId) {
      touchStartRef.current.activePointerId = null;
      touchStartRef.current.isPointerDown = false;
      touchStartRef.current.hasSwiped = false;
    }
  };

  return (
    <div
      data-game-surface="3d"
      onPointerDown={beginPointerGesture}
      onPointerMove={movePointerGesture}
      onPointerUp={(e) => endPointerGesture(e, false)}
      onPointerCancel={(e) => endPointerGesture(e, true)}
      onLostPointerCapture={lostPointerGesture}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        touchAction: status === 'running' || status === 'starting' ? 'none' : 'auto',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
      className={`relative w-full h-full cursor-default select-none overflow-hidden rounded-2xl border border-amber-500/30 shadow-2xl ${
        status === 'running' || status === 'starting' ? 'touch-none' : 'touch-auto'
      }`}
    >
      <div ref={containerRef} className="w-full h-full pointer-events-none" />
      {webglContextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center">
          <span className="text-4xl mb-2">🧊</span>
          <p className="text-sm font-bold text-amber-400">WebGL 3D paused — restoring context…</p>
          <p className="text-xs text-zinc-400 mt-1">
            Switch to 2D mode at any time using the header toggle.
          </p>
        </div>
      )}
    </div>
  );
};
