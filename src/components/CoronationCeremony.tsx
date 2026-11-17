import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Competitor } from '../types/game';
import { useI18n } from '../contexts/I18nContext';
import { sounds } from '../audio/soundEffects';
import { resolveAvatarLook, AvatarHairStyle } from '../data/avatarLooks';
import { AvatarDoll } from './AvatarDoll';

interface CoronationCeremonyProps {
  winner: Competitor;
  onFinish?: () => void;
  onReplayRequest?: () => void;
}

// Reutilizáveis fora do loop de renderização (zero GC por frame)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpQuatA = new THREE.Quaternion();
const _tmpQuatB = new THREE.Quaternion();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

function createContactShadowTexture(disposables: { textures: THREE.Texture[] }): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.68)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  disposables.textures.push(tex);
  return tex;
}

function createBadgeTexture(
  text: string,
  bgColor: string,
  borderColor: string,
  textColor: string,
  maxAnisotropy: number,
  disposables: { textures: THREE.Texture[] }
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 112);
    ctx.fillStyle = textColor;
    ctx.font = '900 62px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  disposables.textures.push(tex);
  return tex;
}

interface DisposablesBag {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

function trackGeo<T extends THREE.BufferGeometry>(bag: DisposablesBag, g: T): T {
  bag.geometries.push(g);
  return g;
}

function trackMat<T extends THREE.Material>(bag: DisposablesBag, m: T): T {
  bag.materials.push(m);
  return m;
}

function buildRoyalCrown3D(bag: DisposablesBag): THREE.Group {
  const crown = new THREE.Group();

  const goldMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      metalness: 0.92,
      roughness: 0.16,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
    })
  );
  const darkGoldMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.85,
      roughness: 0.25,
    })
  );
  const velvetMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.82,
      metalness: 0.05,
    })
  );
  const rubyMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      emissive: 0x450a0a,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1,
    })
  );
  const sapphireMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      clearcoat: 1,
    })
  );

  // Aro dourado principal da coroa
  const band = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.185, 0.165, 0.09, 24)), darkGoldMat);
  band.position.y = 0.045;
  band.castShadow = true;
  crown.add(band);

  // Friso superior e inferior em ouro polido
  const rimTop = new THREE.Mesh(trackGeo(bag, new THREE.TorusGeometry(0.182, 0.016, 10, 28)), goldMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.09;
  crown.add(rimTop);

  // Forro interior de veludo real carmesim
  const velvetCap = new THREE.Mesh(
    trackGeo(bag, new THREE.SphereGeometry(0.165, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52)),
    velvetMat
  );
  velvetCap.position.y = 0.06;
  crown.add(velvetCap);

  // 5 Pontas reais com pérola dourada no topo
  const peakCount = 5;
  for (let i = 0; i < peakCount; i++) {
    const angle = (i / peakCount) * Math.PI * 2;
    const isFront = i === 0;
    const peakHeight = isFront ? 0.16 : 0.12;
    const peak = new THREE.Mesh(trackGeo(bag, new THREE.ConeGeometry(0.044, peakHeight, 6)), goldMat);
    peak.position.set(Math.sin(angle) * 0.168, 0.09 + peakHeight * 0.45, Math.cos(angle) * 0.168);
    peak.rotation.z = -Math.sin(angle) * 0.12;
    peak.rotation.x = Math.cos(angle) * 0.12;
    peak.castShadow = true;
    crown.add(peak);

    const pearl = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.022, 12, 10)), goldMat);
    pearl.position.set(Math.sin(angle) * 0.182, 0.09 + peakHeight * 0.92, Math.cos(angle) * 0.182);
    crown.add(pearl);
  }

  // Rubi frontal e safiras laterais
  const centerGem = new THREE.Mesh(trackGeo(bag, new THREE.OctahedronGeometry(0.036, 0)), rubyMat);
  centerGem.position.set(0, 0.055, 0.192);
  centerGem.scale.set(0.9, 1.25, 0.65);
  crown.add(centerGem);

  const sideAngles = [-Math.PI / 2.6, Math.PI / 2.6];
  sideAngles.forEach((ang) => {
    const sideGem = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.022, 10, 10)), sapphireMat);
    sideGem.position.set(Math.sin(ang) * 0.184, 0.05, Math.cos(ang) * 0.184);
    crown.add(sideGem);
  });

  return crown;
}

function buildRoyalThrone3D(bag: DisposablesBag, maxAnisotropy: number): THREE.Group {
  const throne = new THREE.Group();

  const goldMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 0.5,
    })
  );
  const bronzeGoldMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.82,
      roughness: 0.28,
    })
  );
  const velvetMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({
      color: 0x881337,
      roughness: 0.84,
      metalness: 0.05,
    })
  );
  const darkMarbleMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.36,
      metalness: 0.22,
    })
  );
  const rubyMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      clearcoat: 1,
    })
  );

  // Base em degrau (dais do trono, assentado em y = 0)
  const dais = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(1.55, 0.12, 1.35)), darkMarbleMat);
  dais.position.y = 0.06;
  dais.receiveShadow = true;
  dais.castShadow = true;
  throne.add(dais);

  const daisTrim = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(1.6, 0.04, 1.4)), goldMat);
  daisTrim.position.y = 0.12;
  throne.add(daisTrim);

  // Estrutura do assento e pernas esculpidas
  const legPositions: [number, number][] = [
    [-0.45, -0.34],
    [0.45, -0.34],
    [-0.45, 0.32],
    [0.45, 0.32],
  ];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.06, 0.045, 0.44, 12)), bronzeGoldMat);
    leg.position.set(lx, 0.34, lz);
    leg.castShadow = true;
    throne.add(leg);
  });

  const seatBase = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(1.06, 0.14, 0.82)), goldMat);
  seatBase.position.set(0, 0.56, 0);
  seatBase.castShadow = true;
  seatBase.receiveShadow = true;
  throne.add(seatBase);

  const seatCushion = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.92, 0.1, 0.72)), velvetMat);
  seatCushion.position.set(0, 0.65, 0.02);
  seatCushion.receiveShadow = true;
  throne.add(seatCushion);

  // Encosto alto real + moldura dourada
  const backFrame = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(1.08, 1.38, 0.14)), goldMat);
  backFrame.position.set(0, 1.28, -0.36);
  backFrame.castShadow = true;
  backFrame.receiveShadow = true;
  throne.add(backFrame);

  const backVelvet = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.86, 1.18, 0.08)), velvetMat);
  backVelvet.position.set(0, 1.28, -0.28);
  backVelvet.receiveShadow = true;
  throne.add(backVelvet);

  // Pilares laterais com esferas douradas no topo
  [-0.54, 0.54].forEach((px) => {
    const pillar = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.06, 0.065, 1.52, 14)), bronzeGoldMat);
    pillar.position.set(px, 1.32, -0.35);
    pillar.castShadow = true;
    throne.add(pillar);

    const finial = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.085, 14, 12)), goldMat);
    finial.position.set(px, 2.12, -0.35);
    throne.add(finial);
  });

  // Arco e Flor-de-Lis no topo do encosto
  const topArch = new THREE.Mesh(
    trackGeo(bag, new THREE.CylinderGeometry(0.54, 0.54, 0.14, 24, 1, false, 0, Math.PI)),
    goldMat
  );
  topArch.rotation.z = Math.PI / 2;
  topArch.rotation.y = Math.PI / 2;
  topArch.position.set(0, 1.96, -0.36);
  throne.add(topArch);

  const emblemGem = new THREE.Mesh(trackGeo(bag, new THREE.OctahedronGeometry(0.09, 0)), rubyMat);
  emblemGem.position.set(0, 2.18, -0.27);
  emblemGem.scale.set(0.85, 1.35, 0.65);
  throne.add(emblemGem);

  // Braços dourados do trono
  [-0.5, 0.5].forEach((ax) => {
    const armRest = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.14, 0.1, 0.72)), goldMat);
    armRest.position.set(ax, 0.88, -0.02);
    armRest.castShadow = true;
    throne.add(armRest);

    const armPost = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.045, 0.05, 0.34, 12)), bronzeGoldMat);
    armPost.position.set(ax, 0.7, 0.28);
    throne.add(armPost);

    const armOrb = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.075, 12, 12)), goldMat);
    armOrb.position.set(ax, 0.92, 0.34);
    throne.add(armOrb);
  });

  // Placa dourada "00" no frontal do dais
  const plateTex = createBadgeTexture('REI 00', '#09090b', '#facc15', '#fde047', maxAnisotropy, bag);
  const plate = new THREE.Mesh(
    trackGeo(bag, new THREE.PlaneGeometry(0.65, 0.26)),
    trackMat(bag, new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.4 }))
  );
  plate.position.set(0, 0.38, 0.42);
  throne.add(plate);

  return throne;
}

interface ArticulatedRunnerRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  headCrownAnchor: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  handCrownAnchor: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  cape?: THREE.Mesh;
  capeLower?: THREE.Mesh;
  ponytail?: THREE.Group;
}

function buildHumanRunner3D(
  bag: DisposablesBag,
  options: {
    skin: string;
    hair: string;
    hairStyle?: AvatarHairStyle;
    isFeminine?: boolean;
    jacket: string;
    jacketAccent: string;
    shirt: string;
    pants: string;
    shoes: string;
    capeColor?: string;
    chestBadgeText?: string;
    maxAnisotropy: number;
  }
): ArticulatedRunnerRig {
  const root = new THREE.Group();

  const skinMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: options.skin, roughness: 0.62, metalness: 0.04 }));
  const hairMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: options.hair, roughness: 0.85, metalness: 0.05 }));
  const jacketMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({ color: options.jacket, roughness: 0.48, metalness: 0.18 })
  );
  const accentMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({ color: options.jacketAccent, metalness: 0.8, roughness: 0.22, clearcoat: 0.4 })
  );
  const shirtMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: options.shirt, roughness: 0.72 }));
  const pantsMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: options.pants, roughness: 0.75 }));
  const shoesMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({ color: options.shoes, roughness: 0.32, metalness: 0.45 })
  );
  const soleMat = trackMat(
    bag,
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48, metalness: 0.05 })
  );
  const scleraMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  const eyeMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.12 }));
  const glintMat = trackMat(bag, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const smileMat = trackMat(bag, new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 }));

  // Pelvis é a raiz articulada (altura padrão de pé ~ 0.84m acima do chão)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.84, 0);
  root.add(pelvis);

  const pelvisWidth = options.isFeminine ? 0.30 : 0.32;
  const torsoWidth = options.isFeminine ? 0.34 : 0.38;

  const pelvisMesh = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(pelvisWidth, 0.14, 0.2)), pantsMat);
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  // Tronco + casaco + lapelas + emblema
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  pelvis.add(torso);

  const torsoCore = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(torsoWidth, 0.46, 0.24)), jacketMat);
  torsoCore.position.y = 0.24;
  torsoCore.castShadow = true;
  torsoCore.receiveShadow = true;
  torso.add(torsoCore);

  // Camisa interior em V + lapelas + fivela dourada
  const chestV = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.14, 0.24, 0.255)), shirtMat);
  chestV.position.set(0, 0.34, 0.005);
  torso.add(chestV);

  [-0.075, 0.075].forEach((lx) => {
    const lapel = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.05, 0.17, 0.03)), accentMat);
    lapel.position.set(lx, 0.38, 0.12);
    lapel.rotation.z = lx < 0 ? 0.24 : -0.24;
    torso.add(lapel);
  });

  const belt = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(torsoWidth + 0.02, 0.055, 0.255)), accentMat);
  belt.position.set(0, 0.04, 0);
  torso.add(belt);

  if (options.chestBadgeText) {
    const tex = createBadgeTexture(
      options.chestBadgeText,
      '#09090b',
      options.jacketAccent,
      '#fde047',
      options.maxAnisotropy,
      bag
    );
    const badge = new THREE.Mesh(
      trackGeo(bag, new THREE.PlaneGeometry(0.15, 0.095)),
      trackMat(bag, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.3 }))
    );
    badge.position.set(0, 0.24, 0.132);
    torso.add(badge);
  }

  // Ombros / dragonas douradas
  const epauletOffset = options.isFeminine ? 0.185 : 0.21;
  [-epauletOffset, epauletOffset].forEach((sx) => {
    const epaulet = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.115, 0.055, 0.25)), accentMat);
    epaulet.position.set(sx, 0.46, 0);
    torso.add(epaulet);
  });

  // Capa Real em 2 dobras para ondulação orgânica
  let cape: THREE.Mesh | undefined;
  let capeLower: THREE.Mesh | undefined;
  if (options.capeColor) {
    const capeMat = trackMat(
      bag,
      new THREE.MeshStandardMaterial({
        color: options.capeColor,
        roughness: 0.72,
        metalness: 0.08,
        side: THREE.DoubleSide,
      })
    );
    const capeGeo = trackGeo(bag, new THREE.BoxGeometry(0.42, 0.38, 0.03));
    capeGeo.translate(0, -0.19, 0);
    cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 0.45, -0.14);
    cape.rotation.x = 0.16;
    cape.castShadow = true;

    const capeLowerGeo = trackGeo(bag, new THREE.BoxGeometry(0.46, 0.34, 0.026));
    capeLowerGeo.translate(0, -0.17, 0);
    capeLower = new THREE.Mesh(capeLowerGeo, capeMat);
    capeLower.position.set(0, -0.36, 0);
    capeLower.rotation.x = 0.08;
    capeLower.castShadow = true;
    cape.add(capeLower);

    torso.add(cape);
  }

  // Pescoço & Cabeça esculpida
  const neck = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.062, 0.072, 0.1, 12)), skinMat);
  neck.position.set(0, 0.5, 0);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.67, 0);
  torso.add(head);

  const cranium = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.175, 22, 18)), skinMat);
  cranium.scale.set(0.95, 1.05, 0.98);
  cranium.castShadow = true;
  head.add(cranium);

  // Orelhas & Nariz
  [-0.165, 0.165].forEach((earX) => {
    const ear = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.032, 10, 8)), skinMat);
    ear.position.set(earX, 0.0, -0.005);
    head.add(ear);
  });
  const nose = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.02, 10, 8)), skinMat);
  nose.scale.set(0.8, 1.15, 0.95);
  nose.position.set(0, -0.008, 0.172);
  head.add(nose);

  // Cabelo característico por AvatarHairStyle
  const style = options.hairStyle || 'fade';
  let ponytail: THREE.Group | undefined;

  if (style === 'afro') {
    const afro = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.205, 20, 16)), hairMat);
    afro.position.set(0, 0.045, -0.015);
    afro.castShadow = true;
    head.add(afro);
  } else {
    const hairTop = new THREE.Mesh(
      trackGeo(bag, new THREE.SphereGeometry(0.181, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      hairMat
    );
    hairTop.position.y = 0.02;
    hairTop.rotation.x = -0.18;
    hairTop.castShadow = true;
    head.add(hairTop);

    if (style === 'ponytail') {
      ponytail = new THREE.Group();
      ponytail.position.set(0, 0.04, -0.17);
      ponytail.rotation.x = 0.35;
      const band = new THREE.Mesh(trackGeo(bag, new THREE.TorusGeometry(0.035, 0.01, 8, 12)), accentMat);
      const tailGeo = trackGeo(bag, new THREE.CylinderGeometry(0.032, 0.06, 0.22, 10));
      tailGeo.translate(0, -0.11, 0);
      const tailMesh = new THREE.Mesh(tailGeo, hairMat);
      tailMesh.castShadow = true;
      ponytail.add(band, tailMesh);
      head.add(ponytail);
    } else if (style === 'locs' || style === 'braids') {
      for (let li = -2; li <= 2; li++) {
        const loc = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.022, 0.018, 0.22, 8)), hairMat);
        loc.position.set(li * 0.048, -0.04, -0.145 + Math.abs(li) * 0.022);
        loc.rotation.x = 0.16;
        loc.castShadow = true;
        head.add(loc);
      }
    }
  }

  // Sobrancelhas + Olhos expressivos (Esclera + Íris + Brilho) + Sorriso
  [-0.058, 0.058].forEach((ex) => {
    const brow = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.048, 0.013, 0.018)), hairMat);
    brow.position.set(ex, 0.05, 0.158);
    brow.rotation.z = ex < 0 ? 0.08 : -0.08;
    head.add(brow);

    const sclera = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.023, 12, 10)), scleraMat);
    sclera.scale.set(1.05, 1.0, 0.65);
    sclera.position.set(ex, 0.016, 0.156);
    head.add(sclera);

    const pupil = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.014, 10, 8)), eyeMat);
    pupil.position.set(ex, 0.016, 0.169);
    head.add(pupil);

    const glint = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.0045, 6, 6)), glintMat);
    glint.position.set(ex + 0.005, 0.021, 0.178);
    head.add(glint);
  });
  const smile = new THREE.Mesh(trackGeo(bag, new THREE.TorusGeometry(0.042, 0.01, 8, 14, Math.PI)), smileMat);
  smile.position.set(0, -0.052, 0.162);
  smile.rotation.z = Math.PI;
  head.add(smile);

  const headCrownAnchor = new THREE.Group();
  headCrownAnchor.position.set(0, 0.175, 0);
  head.add(headCrownAnchor);

  // Braços articulados (ombro -> cotovelo -> punho dourado -> mão)
  const armOffset = options.isFeminine ? 0.22 : 0.25;
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * armOffset, 0.42, 0);
    torso.add(shoulder);

    const shoulderCap = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.06, 10, 8)), jacketMat);
    shoulder.add(shoulderCap);

    const upperArm = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.056, 0.048, 0.24, 12)), jacketMat);
    upperArm.position.y = -0.11;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    shoulder.add(elbow);

    const elbowCap = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.048, 10, 8)), jacketMat);
    elbow.add(elbowCap);

    const forearm = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.046, 0.04, 0.22, 12)), jacketMat);
    forearm.position.y = -0.1;
    forearm.castShadow = true;
    elbow.add(forearm);

    const cuff = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12)), accentMat);
    cuff.position.y = -0.2;
    elbow.add(cuff);

    const hand = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.046, 12, 10)), skinMat);
    hand.position.y = -0.245;
    hand.castShadow = true;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Âncora nas mãos (centrada entre a mão direita e esquerda quando o Rei segura a coroa)
  const handCrownAnchor = new THREE.Group();
  handCrownAnchor.position.set(-0.22, -0.27, 0.12);
  rightArm.elbow.add(handCrownAnchor);

  // Pernas articuladas (anca -> coxa -> joelho -> canela -> ténis bicolor)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.04, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.072, 0.06, 0.36, 12)), pantsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.37, 0);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(trackGeo(bag, new THREE.SphereGeometry(0.06, 10, 8)), pantsMat);
    knee.add(kneeCap);

    const shin = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.058, 0.048, 0.35, 12)), pantsMat);
    shin.position.y = -0.175;
    shin.castShadow = true;
    knee.add(shin);

    const boot = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.115, 0.072, 0.21)), shoesMat);
    boot.position.set(0, -0.365, 0.045);
    boot.castShadow = true;
    knee.add(boot);

    const bootSole = new THREE.Mesh(trackGeo(bag, new THREE.BoxGeometry(0.125, 0.032, 0.222)), soleMat);
    bootSole.position.set(0, -0.414, 0.045);
    knee.add(bootSole);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  return {
    root,
    pelvis,
    torso,
    head,
    headCrownAnchor,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    handCrownAnchor,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    cape,
    capeLower,
    ponytail,
  };
}

function buildChampionPedestal3D(bag: DisposablesBag, maxAnisotropy: number): THREE.Group {
  const pedestal = new THREE.Group();

  const emeraldMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0x065f46,
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 0.55,
    })
  );
  const goldMat = trackMat(
    bag,
    new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.16,
    })
  );

  const baseTier = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.76, 0.84, 0.16, 24)), emeraldMat);
  baseTier.position.y = 0.08;
  baseTier.receiveShadow = true;
  baseTier.castShadow = true;
  pedestal.add(baseTier);

  const upperTier = new THREE.Mesh(trackGeo(bag, new THREE.CylinderGeometry(0.62, 0.68, 0.2, 24)), emeraldMat);
  upperTier.position.y = 0.26;
  upperTier.receiveShadow = true;
  upperTier.castShadow = true;
  pedestal.add(upperTier);

  const topTrim = new THREE.Mesh(trackGeo(bag, new THREE.TorusGeometry(0.62, 0.022, 10, 32)), goldMat);
  topTrim.rotation.x = Math.PI / 2;
  topTrim.position.y = 0.36;
  pedestal.add(topTrim);

  const badgeTex = createBadgeTexture('#1', '#022c22', '#34d399', '#fde047', maxAnisotropy, bag);
  const badge = new THREE.Mesh(
    trackGeo(bag, new THREE.PlaneGeometry(0.46, 0.22)),
    trackMat(bag, new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.32, metalness: 0.3 }))
  );
  badge.position.set(0, 0.24, 0.65);
  pedestal.add(badge);

  return pedestal;
}

export const CoronationCeremony: React.FC<CoronationCeremonyProps> = ({
  winner,
  onFinish,
  onReplayRequest,
}) => {
  const { t, lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<number>(0);
  const [isSkipped, setIsSkipped] = useState<boolean>(false);
  const [webglFailed, setWebglFailed] = useState<boolean>(false);

  const stageRef = useRef<number>(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onReplayRequestRef = useRef(onReplayRequest);
  onReplayRequestRef.current = onReplayRequest;

  const controlsRef = useRef<{
    replay: () => void;
    skip: () => void;
  } | null>(null);

  const triggerStageAudioAndConfetti = useCallback((nextStage: number) => {
    if (nextStage === 2) {
      try {
        sounds.playLaneSwitch();
      } catch {
        // ignore audio failure
      }
    } else if (nextStage === 3) {
      try {
        sounds.playCoronationFanfare();
      } catch {
        // ignore audio failure
      }
      try {
        confetti({
          particleCount: 45,
          spread: 65,
          origin: { y: 0.45, x: 0.66 },
          colors: ['#facc15', '#eab308', '#dc2626', '#16a34a'],
        });
      } catch {
        // ignore confetti error
      }
    } else if (nextStage === 4) {
      try {
        sounds.playJump();
      } catch {
        // ignore audio failure
      }
    }
  }, []);

  const triggerStageAudioRef = useRef(triggerStageAudioAndConfetti);
  triggerStageAudioRef.current = triggerStageAudioAndConfetti;

  useEffect(() => {
    const container = stageMountRef.current;
    if (!container) return;

    const bag: DisposablesBag = { geometries: [], materials: [], textures: [] };
    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      onFinishRef.current?.();
      return;
    }

    const width = Math.max(container.clientWidth || 560, 280);
    const height = Math.max(container.clientHeight || 260, 220);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const canvasEl = renderer.domElement;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvasEl);

    const scene = new THREE.Scene();
    const bgHex = 0x0b080d;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.055);

    const roomEnv = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 45);
    camera.position.set(0.0, 2.25, 6.2);
    let camLookX = 0.05;
    camera.lookAt(camLookX, 1.15, 0);

    // Iluminação 3 pontos quente/fria equilibrada
    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x1e1b2e, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    keyLight.position.set(3.2, 5.5, 4.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 512;
      keyLight.shadow.mapSize.height = 512;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 18;
      keyLight.shadow.camera.left = -4.5;
      keyLight.shadow.camera.right = 4.5;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.15);
    rimLight.position.set(-3.8, 3.8, -3.5);
    scene.add(rimLight);

    // Chão do Salão Real + Tapete Vermelho + Bordas Douradas
    const floorMesh = new THREE.Mesh(
      trackGeo(bag, new THREE.PlaneGeometry(18, 12)),
      trackMat(
        bag,
        new THREE.MeshStandardMaterial({
          color: 0x111015,
          roughness: 0.42,
          metalness: 0.18,
        })
      )
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const carpetMesh = new THREE.Mesh(
      trackGeo(bag, new THREE.BoxGeometry(6.8, 0.02, 2.05)),
      trackMat(bag, new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.88 }))
    );
    carpetMesh.position.set(0, 0.015, 0);
    carpetMesh.receiveShadow = true;
    scene.add(carpetMesh);

    [-1.04, 1.04].forEach((zBorder) => {
      const trim = new THREE.Mesh(
        trackGeo(bag, new THREE.BoxGeometry(6.84, 0.028, 0.06)),
        trackMat(bag, new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.2 }))
      );
      trim.position.set(0, 0.022, zBorder);
      scene.add(trim);
    });

    // Sombras de contacto macias sob o Trono, Rei 00 e Pedestal do Vencedor
    const contactTex = createContactShadowTexture(bag);
    const makeContactShadow = (radius: number) => {
      const m = new THREE.Mesh(
        trackGeo(bag, new THREE.PlaneGeometry(radius, radius)),
        trackMat(
          bag,
          new THREE.MeshBasicMaterial({
            map: contactTex,
            transparent: true,
            depthWrite: false,
            opacity: 0.55,
          })
        )
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.032;
      return m;
    };

    // 1. TRONO DOURADO FIXO À ESQUERDA
    const throneX = -1.72;
    const throneZ = -0.14;
    const throneGroup = buildRoyalThrone3D(bag, maxAnisotropy);
    throneGroup.position.set(throneX, 0, throneZ);
    throneGroup.rotation.y = 0.34;
    scene.add(throneGroup);

    const throneShadow = makeContactShadow(2.2);
    throneShadow.position.set(throneX, 0.032, throneZ);
    scene.add(throneShadow);

    // 2. PEDESTAL DO VENCEDOR À DIREITA
    const pedestalX = 1.66;
    const pedestalZ = 0.06;
    const pedestalTopY = 0.36;
    const pedestalGroup = buildChampionPedestal3D(bag, maxAnisotropy);
    pedestalGroup.position.set(pedestalX, 0, pedestalZ);
    pedestalGroup.rotation.y = -0.25;
    scene.add(pedestalGroup);

    const pedestalShadow = makeContactShadow(1.8);
    pedestalShadow.position.set(pedestalX, 0.032, pedestalZ);
    scene.add(pedestalShadow);

    // 3. REI 00 (HAMILTON — O PRIMEIRO REI)
    const reiRig = buildHumanRunner3D(bag, {
      skin: '#8d5524',
      hair: '#09090b',
      hairStyle: 'fade',
      jacket: '#09090b',
      jacketAccent: '#facc15',
      shirt: '#1e293b',
      pants: '#0f172a',
      shoes: '#f59e0b',
      capeColor: '#b91c1c',
      chestBadgeText: '00',
      maxAnisotropy,
    });
    scene.add(reiRig.root);

    const reiShadow = makeContactShadow(1.0);
    scene.add(reiShadow);

    // 4. VENCEDOR DA PARTIDA NO PEDESTAL (look fiel ao perfil, sem chapéu para receber a coroa)
    const winnerLook = resolveAvatarLook(winner.avatarId, winner.name, winner.color);
    const winnerRig = buildHumanRunner3D(bag, {
      skin: winnerLook.skin,
      hair: winnerLook.hair,
      hairStyle: winnerLook.hairStyle,
      isFeminine: winnerLook.isFeminine,
      jacket: winnerLook.jacket,
      jacketAccent: winnerLook.jacketAccent,
      shirt: winnerLook.shirt,
      pants: winnerLook.pants,
      shoes: winnerLook.shoes,
      capeColor: winnerLook.capeOrScarf,
      chestBadgeText: '#1',
      maxAnisotropy,
    });
    winnerRig.root.position.set(pedestalX, pedestalTopY, pedestalZ);
    winnerRig.root.rotation.y = -0.52;
    scene.add(winnerRig.root);

    // 5. COROA REAL EM 3D + PARTÍCULAS DOURADAS ORBITAIS ZERO-GC
    const crownGroup = buildRoyalCrown3D(bag);
    scene.add(crownGroup);

    const sparkleGeo = trackGeo(bag, new THREE.OctahedronGeometry(0.024, 0));
    const sparkleMat = trackMat(
      bag,
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.85,
      })
    );
    const sparkles = Array.from({ length: 14 }, (_, idx) => {
      const sp = new THREE.Mesh(sparkleGeo, sparkleMat);
      sp.visible = false;
      scene.add(sp);
      return {
        mesh: sp,
        phase: (idx / 14) * Math.PI * 2,
        speed: 1.4 + (idx % 4) * 0.35,
        radius: 0.36 + (idx % 3) * 0.22,
        heightOffset: (idx % 5) * 0.16,
      };
    });

    // Pré-aquece shaders apenas em GPUs reais
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Estado da coreografia (timeline determinística com damping exponencial suave)
    let animElapsed = prefersReducedMotion ? 4.35 : 0;
    let crownOwner: 'reiHead' | 'reiHand' | 'flying' | 'winnerHead' = prefersReducedMotion
      ? 'winnerHead'
      : 'reiHead';
    let finishCalled = Boolean(prefersReducedMotion);
    let lastStageEmitted = prefersReducedMotion ? 4 : 0;

    stageRef.current = lastStageEmitted;
    setStage(lastStageEmitted);
    if (prefersReducedMotion) {
      onFinishRef.current?.();
    }

    const applyPoseImmediate = (tSec: number) => {
      // Estado do Rei 00 sentado no trono vs de pé
      if (tSec < 0.45) {
        reiRig.root.position.set(throneX + 0.08, 0, throneZ + 0.08);
        reiRig.root.rotation.y = 0.34;
        reiRig.pelvis.position.y = 0.64;
        reiRig.torso.rotation.x = 0.04;
        reiRig.leftHip.rotation.x = -1.32;
        reiRig.rightHip.rotation.x = -1.32;
        reiRig.leftKnee.rotation.x = 1.32;
        reiRig.rightKnee.rotation.x = 1.32;
      }
      reiRig.root.updateMatrixWorld(true);
      winnerRig.root.updateMatrixWorld(true);

      if (crownOwner === 'reiHead') {
        reiRig.headCrownAnchor.getWorldPosition(_tmpVecA);
        reiRig.headCrownAnchor.getWorldQuaternion(_tmpQuatA);
        crownGroup.position.copy(_tmpVecA);
        crownGroup.quaternion.copy(_tmpQuatA);
      } else if (crownOwner === 'winnerHead') {
        winnerRig.headCrownAnchor.getWorldPosition(_tmpVecA);
        winnerRig.headCrownAnchor.getWorldQuaternion(_tmpQuatA);
        crownGroup.position.copy(_tmpVecA);
        crownGroup.quaternion.copy(_tmpQuatA);
      }
    };

    const setCrownToWinnerFinal = () => {
      animElapsed = 4.35;
      crownOwner = 'winnerHead';
      lastStageEmitted = 4;
      stageRef.current = 4;
      setStage(4);
      setIsSkipped(true);

      reiRig.root.position.set(0.22, 0, 0.08);
      reiRig.root.rotation.y = 0.88;
      reiRig.pelvis.position.y = 0.84;
      reiRig.torso.rotation.x = 0;
      reiRig.leftHip.rotation.x = 0;
      reiRig.rightHip.rotation.x = 0;
      reiRig.leftKnee.rotation.x = 0;
      reiRig.rightKnee.rotation.x = 0;
      reiRig.leftShoulder.rotation.set(-2.35, 0, -0.35);
      reiRig.rightShoulder.rotation.set(-2.35, 0, 0.35);
      reiRig.leftElbow.rotation.x = -0.3;
      reiRig.rightElbow.rotation.x = -0.3;

      winnerRig.root.position.set(pedestalX, pedestalTopY, pedestalZ);
      winnerRig.leftShoulder.rotation.set(-2.6, 0, -0.4);
      winnerRig.rightShoulder.rotation.set(-2.6, 0, 0.4);
      applyPoseImmediate(4.35);

      if (!finishCalled) {
        finishCalled = true;
        onFinishRef.current?.();
      }
    };

    controlsRef.current = {
      replay: () => {
        onReplayRequestRef.current?.();
        animElapsed = 0;
        crownOwner = 'reiHead';
        finishCalled = false;
        lastStageEmitted = 0;
        stageRef.current = 0;
        setIsSkipped(false);
        setStage(0);
        applyPoseImmediate(0);
      },
      skip: () => {
        setCrownToWinnerFinal();
      },
    };

    if (prefersReducedMotion) {
      setCrownToWinnerFinal();
    } else {
      applyPoseImmediate(0);
    }

    const timer = new THREE.Timer();
    timer.connect(document);
    let frameId = 0;
    let isDisposed = false;

    const afterDraw = (cb: () => void) => {
      if (isDisposed || !renderer) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (isDisposed || !renderer) return;

      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      if (!prefersReducedMotion) {
        animElapsed += dt;
      }

      // Dispara estágios sincronizados (0 -> 1 -> 2 -> 3 -> 4)
      let currentStage = 0;
      if (animElapsed >= 4.25) currentStage = 4;
      else if (animElapsed >= 2.85) currentStage = 3;
      else if (animElapsed >= 2.05) currentStage = 2;
      else if (animElapsed >= 0.45) currentStage = 1;

      if (currentStage !== lastStageEmitted) {
        lastStageEmitted = currentStage;
        stageRef.current = currentStage;
        setStage(currentStage);
        triggerStageAudioRef.current(currentStage);
        if (currentStage >= 4 && !finishCalled) {
          finishCalled = true;
          onFinishRef.current?.();
        }
      }

      // =========================================================================
      // CINEMÁTICA DO REI 00 (SENTA -> LEVANTA RÁPIDO -> TIRA COROA -> COROA O VENCEDOR)
      // =========================================================================
      let targetReiX = throneX + 0.08;
      let targetReiZ = throneZ + 0.08;
      let targetReiRotY = 0.34;
      let targetPelvisY = 0.64;
      let targetTorsoX = 0.04;
      let targetReiHeadX = 0.02;
      let targetReiHeadY = 0.14;
      let targetLeftHipX = -1.32;
      let targetRightHipX = -1.32;
      let targetLeftKneeX = 1.32;
      let targetRightKneeX = 1.32;
      let targetLShoulderX = -0.45;
      let targetLShoulderZ = -0.15;
      let targetLElbowX = -0.75;
      let targetRShoulderX = -0.45;
      let targetRShoulderZ = 0.15;
      let targetRElbowX = -0.75;
      let capeFlutter = Math.sin(animElapsed * 3.0) * 0.035 + Math.cos(animElapsed * 6.4) * 0.015;

      if (animElapsed < 0.45) {
        // Fase 0: Rei 00 sentado no trono dourado observando o vencedor
        crownOwner = 'reiHead';
        targetReiHeadX = 0.04;
        targetReiHeadY = 0.18;
      } else if (animElapsed < 0.7) {
        // Fase 1A-0: Impulso orgânico para se levantar do trono
        const up = THREE.MathUtils.clamp((animElapsed - 0.45) / 0.25, 0, 1);
        const ease = up * up * (3 - 2 * up);
        targetReiX = THREE.MathUtils.lerp(throneX + 0.08, throneX + 0.24, ease);
        targetReiZ = THREE.MathUtils.lerp(throneZ + 0.08, 0.02, ease);
        targetReiRotY = THREE.MathUtils.lerp(0.34, Math.PI * 0.42, ease);
        targetPelvisY = THREE.MathUtils.lerp(0.64, 0.84, ease);
        targetTorsoX = 0.28 * Math.sin(up * Math.PI) + 0.08;
        targetLeftHipX = THREE.MathUtils.lerp(-1.32, 0.18, ease);
        targetRightHipX = THREE.MathUtils.lerp(-1.32, -0.18, ease);
        targetLeftKneeX = THREE.MathUtils.lerp(1.32, 0.15, ease);
        targetRightKneeX = THREE.MathUtils.lerp(1.32, 0.15, ease);
        targetLShoulderX = -0.25;
        targetRShoulderX = -0.25;
        targetLElbowX = -0.45;
        targetRElbowX = -0.45;
        targetReiHeadY = 0.1;
        crownOwner = 'reiHead';
      } else if (animElapsed < 1.25) {
        // Fase 1A: Camina com vigor pelo tapete vermelho até diante do vencedor
        const u = THREE.MathUtils.clamp((animElapsed - 0.7) / 0.55, 0, 1);
        const smoothU = u * u * (3 - 2 * u);
        targetReiX = THREE.MathUtils.lerp(throneX + 0.24, 0.4, smoothU);
        targetReiZ = THREE.MathUtils.lerp(0.02, 0.08, smoothU);
        targetReiRotY = THREE.MathUtils.lerp(Math.PI * 0.42, Math.PI * 0.48, smoothU);
        targetPelvisY = 0.84 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.045;
        targetTorsoX = 0.11;
        const stride = Math.sin(u * Math.PI * 3.0) * 0.58 * (1 - u * 0.45);
        targetLeftHipX = stride;
        targetRightHipX = -stride;
        targetLeftKneeX = Math.max(0, -stride * 0.9);
        targetRightKneeX = Math.max(0, stride * 0.9);
        targetLShoulderX = -stride * 0.6;
        targetRShoulderX = stride * 0.6;
        targetLElbowX = -0.4;
        targetRElbowX = -0.4;
        targetReiHeadX = -0.04;
        targetReiHeadY = 0.05;
        capeFlutter = 0.28 + Math.sin(u * 12) * 0.12 + Math.cos(u * 21) * 0.04;
        crownOwner = 'reiHead';
      } else if (animElapsed < 2.05) {
        // Fase 1B/2A: Rei 00 para diante do vencedor, ergue os braços e retira a coroa da própria cabeça!
        const u = THREE.MathUtils.clamp((animElapsed - 1.25) / 0.8, 0, 1);
        targetReiX = 0.52;
        targetReiZ = 0.08;
        targetReiRotY = Math.PI * 0.48;
        targetPelvisY = 0.84;
        targetTorsoX = 0.02;
        targetLeftHipX = 0;
        targetRightHipX = 0;
        targetLeftKneeX = 0;
        targetRightKneeX = 0;
        targetReiHeadX = u < 0.48 ? -0.1 : 0.06;
        targetReiHeadY = 0.02;

        if (u < 0.48) {
          crownOwner = 'reiHead';
          targetLShoulderX = -2.55;
          targetRShoulderX = -2.55;
          targetLShoulderZ = -0.18;
          targetRShoulderZ = 0.18;
          targetLElbowX = -1.05;
          targetRElbowX = -1.05;
        } else {
          crownOwner = 'reiHand';
          targetLShoulderX = -1.65;
          targetRShoulderX = -1.65;
          targetLShoulderZ = -0.1;
          targetRShoulderZ = 0.1;
          targetLElbowX = -0.45;
          targetRElbowX = -0.45;
        }
      } else if (animElapsed < 2.85) {
        // Fase 2B: Estende os braços em direção ao vencedor e pousa a coroa sobre sua cabeça
        const u = THREE.MathUtils.clamp((animElapsed - 2.05) / 0.8, 0, 1);
        targetReiX = THREE.MathUtils.lerp(0.52, 0.72, u);
        targetReiZ = 0.08;
        targetReiRotY = Math.PI * 0.48;
        targetPelvisY = 0.84;
        targetTorsoX = 0.12;
        targetLeftHipX = 0.08;
        targetRightHipX = -0.08;
        targetLeftKneeX = 0;
        targetRightKneeX = 0;
        targetLShoulderX = THREE.MathUtils.lerp(-1.65, -1.35, u);
        targetRShoulderX = THREE.MathUtils.lerp(-1.65, -1.35, u);
        targetLShoulderZ = -0.12;
        targetRShoulderZ = 0.12;
        targetLElbowX = -0.15;
        targetRElbowX = -0.15;
        targetReiHeadX = -0.08;
        targetReiHeadY = 0.04;
        crownOwner = u < 0.88 ? 'flying' : 'winnerHead';
      } else {
        // Fase 3 e 4: Rei 00 recua ligeiramente e ergue os braços em consagração ao novo Rei!
        crownOwner = 'winnerHead';
        const cheerWave = Math.sin((animElapsed - 2.85) * 4.5) * 0.14;
        targetReiX = 0.24;
        targetReiZ = 0.08;
        targetReiRotY = 0.88;
        targetPelvisY = 0.84;
        targetTorsoX = -0.03;
        targetLeftHipX = 0;
        targetRightHipX = 0;
        targetLeftKneeX = 0;
        targetRightKneeX = 0;
        targetLShoulderX = -2.35 + cheerWave;
        targetRShoulderX = -2.35 - cheerWave;
        targetLShoulderZ = -0.35;
        targetRShoulderZ = 0.35;
        targetLElbowX = -0.32 - Math.abs(cheerWave) * 0.5;
        targetRElbowX = -0.32 - Math.abs(cheerWave) * 0.5;
        targetReiHeadX = -0.06;
        targetReiHeadY = 0.28;
      }

      // Damping exponencial suave no Rei 00
      const k = 12;
      reiRig.root.position.x = THREE.MathUtils.damp(reiRig.root.position.x, targetReiX, k, dt);
      reiRig.root.position.z = THREE.MathUtils.damp(reiRig.root.position.z, targetReiZ, k, dt);
      reiRig.root.rotation.y = THREE.MathUtils.damp(reiRig.root.rotation.y, targetReiRotY, k, dt);
      reiRig.pelvis.position.y = THREE.MathUtils.damp(reiRig.pelvis.position.y, targetPelvisY, k, dt);
      reiRig.torso.rotation.x = THREE.MathUtils.damp(reiRig.torso.rotation.x, targetTorsoX, k, dt);
      reiRig.head.rotation.x = THREE.MathUtils.damp(reiRig.head.rotation.x, targetReiHeadX, k, dt);
      reiRig.head.rotation.y = THREE.MathUtils.damp(reiRig.head.rotation.y, targetReiHeadY, k, dt);
      reiRig.leftHip.rotation.x = THREE.MathUtils.damp(reiRig.leftHip.rotation.x, targetLeftHipX, k, dt);
      reiRig.rightHip.rotation.x = THREE.MathUtils.damp(reiRig.rightHip.rotation.x, targetRightHipX, k, dt);
      reiRig.leftKnee.rotation.x = THREE.MathUtils.damp(reiRig.leftKnee.rotation.x, targetLeftKneeX, k, dt);
      reiRig.rightKnee.rotation.x = THREE.MathUtils.damp(reiRig.rightKnee.rotation.x, targetRightKneeX, k, dt);
      reiRig.leftShoulder.rotation.x = THREE.MathUtils.damp(reiRig.leftShoulder.rotation.x, targetLShoulderX, k, dt);
      reiRig.leftShoulder.rotation.z = THREE.MathUtils.damp(reiRig.leftShoulder.rotation.z, targetLShoulderZ, k, dt);
      reiRig.leftElbow.rotation.x = THREE.MathUtils.damp(reiRig.leftElbow.rotation.x, targetLElbowX, k, dt);
      reiRig.rightShoulder.rotation.x = THREE.MathUtils.damp(reiRig.rightShoulder.rotation.x, targetRShoulderX, k, dt);
      reiRig.rightShoulder.rotation.z = THREE.MathUtils.damp(reiRig.rightShoulder.rotation.z, targetRShoulderZ, k, dt);
      reiRig.rightElbow.rotation.x = THREE.MathUtils.damp(reiRig.rightElbow.rotation.x, targetRElbowX, k, dt);
      if (reiRig.cape) {
        reiRig.cape.rotation.x = THREE.MathUtils.damp(reiRig.cape.rotation.x, 0.16 + capeFlutter, 8, dt);
        if (reiRig.capeLower) {
          reiRig.capeLower.rotation.x = THREE.MathUtils.damp(
            reiRig.capeLower.rotation.x,
            0.08 + capeFlutter * 1.45,
            7,
            dt
          );
        }
      }

      reiShadow.position.x = reiRig.root.position.x;
      reiShadow.position.z = reiRig.root.position.z;

      // =========================================================================
      // CINEMÁTICA DO VENCEDOR NO PEDESTAL (ESPERA -> VÉNIA REAL -> SALTO TRIUNFAL)
      // =========================================================================
      let winnerJumpY = 0;
      let winnerTorsoX = 0;
      let winnerHeadX = 0;
      let winnerHeadY = -0.22;
      let winnerArmX = -0.15;
      let winnerArmZ = 0.08;
      let winnerElbowX = -0.25;
      let winnerLegTuck = 0;

      if (animElapsed >= 2.05 && animElapsed < 2.85 && !prefersReducedMotion) {
        // Inclina respeitosamente a cabeça para receber a Coroa Real
        const bowU = Math.sin(THREE.MathUtils.clamp((animElapsed - 2.05) / 0.8, 0, 1) * Math.PI);
        winnerTorsoX = bowU * 0.12;
        winnerHeadX = bowU * 0.26;
        winnerHeadY = -0.18;
        winnerArmX = -0.25;
        winnerElbowX = -0.45;
      } else if (animElapsed >= 2.85 && animElapsed < 4.05 && !prefersReducedMotion) {
        const ju = (animElapsed - 2.85) / 1.2;
        const arc = Math.sin(ju * Math.PI);
        winnerJumpY = arc * 0.58;
        winnerTorsoX = -arc * 0.08;
        winnerHeadX = -0.12;
        winnerHeadY = 0.15;
        winnerArmX = -2.65;
        winnerArmZ = 0.35;
        winnerElbowX = -0.42;
        winnerLegTuck = arc * 0.44;
      } else if (animElapsed >= 4.05) {
        const idleBounce = prefersReducedMotion ? 0 : Math.abs(Math.sin((animElapsed - 4.05) * 2.6)) * 0.06;
        const cheer = Math.sin(animElapsed * 4.5);
        winnerJumpY = idleBounce;
        winnerTorsoX = -0.03;
        winnerHeadX = -0.05;
        winnerHeadY = 0.12 + cheer * 0.06;
        winnerArmX = -2.35 + cheer * 0.15;
        winnerArmZ = 0.35;
        winnerElbowX = -0.35 - Math.abs(cheer) * 0.25;
      }

      winnerRig.root.position.y = THREE.MathUtils.damp(
        winnerRig.root.position.y,
        pedestalTopY + winnerJumpY,
        14,
        dt
      );
      winnerRig.torso.rotation.x = THREE.MathUtils.damp(winnerRig.torso.rotation.x, winnerTorsoX, 12, dt);
      winnerRig.head.rotation.x = THREE.MathUtils.damp(winnerRig.head.rotation.x, winnerHeadX, 12, dt);
      winnerRig.head.rotation.y = THREE.MathUtils.damp(winnerRig.head.rotation.y, winnerHeadY, 12, dt);
      winnerRig.leftShoulder.rotation.x = THREE.MathUtils.damp(winnerRig.leftShoulder.rotation.x, winnerArmX, 12, dt);
      winnerRig.leftShoulder.rotation.z = THREE.MathUtils.damp(winnerRig.leftShoulder.rotation.z, -winnerArmZ, 12, dt);
      winnerRig.leftElbow.rotation.x = THREE.MathUtils.damp(winnerRig.leftElbow.rotation.x, winnerElbowX, 12, dt);
      winnerRig.rightShoulder.rotation.x = THREE.MathUtils.damp(winnerRig.rightShoulder.rotation.x, winnerArmX, 12, dt);
      winnerRig.rightShoulder.rotation.z = THREE.MathUtils.damp(winnerRig.rightShoulder.rotation.z, winnerArmZ, 12, dt);
      winnerRig.rightElbow.rotation.x = THREE.MathUtils.damp(winnerRig.rightElbow.rotation.x, winnerElbowX, 12, dt);
      winnerRig.leftHip.rotation.x = THREE.MathUtils.damp(winnerRig.leftHip.rotation.x, -winnerLegTuck, 12, dt);
      winnerRig.rightHip.rotation.x = THREE.MathUtils.damp(winnerRig.rightHip.rotation.x, -winnerLegTuck, 12, dt);
      winnerRig.leftKnee.rotation.x = THREE.MathUtils.damp(winnerRig.leftKnee.rotation.x, winnerLegTuck * 1.4, 12, dt);
      winnerRig.rightKnee.rotation.x = THREE.MathUtils.damp(winnerRig.rightKnee.rotation.x, winnerLegTuck * 1.4, 12, dt);
      if (winnerRig.cape) {
        const wFlutter = 0.14 + (winnerJumpY > 0.08 ? 0.35 : 0.05) + Math.sin(animElapsed * 4.2) * 0.08;
        winnerRig.cape.rotation.x = THREE.MathUtils.damp(winnerRig.cape.rotation.x, wFlutter, 10, dt);
        if (winnerRig.capeLower) {
          winnerRig.capeLower.rotation.x = THREE.MathUtils.damp(winnerRig.capeLower.rotation.x, wFlutter * 0.85, 9, dt);
        }
      }
      if (winnerRig.ponytail) {
        winnerRig.ponytail.rotation.x = THREE.MathUtils.damp(
          winnerRig.ponytail.rotation.x,
          0.35 + winnerJumpY * 0.75 + Math.sin(animElapsed * 4) * 0.08,
          10,
          dt
        );
      }

      // Atualiza matrizes do esqueleto antes de posicionar a Coroa Real 3D
      reiRig.root.updateMatrixWorld(true);
      winnerRig.root.updateMatrixWorld(true);

      if (crownOwner === 'reiHead') {
        reiRig.headCrownAnchor.getWorldPosition(_tmpVecA);
        reiRig.headCrownAnchor.getWorldQuaternion(_tmpQuatA);
        crownGroup.position.copy(_tmpVecA);
        crownGroup.quaternion.copy(_tmpQuatA);
      } else if (crownOwner === 'reiHand') {
        reiRig.handCrownAnchor.getWorldPosition(_tmpVecA);
        reiRig.handCrownAnchor.getWorldQuaternion(_tmpQuatA);
        crownGroup.position.copy(_tmpVecA);
        crownGroup.quaternion.copy(_tmpQuatA);
      } else if (crownOwner === 'flying') {
        const flyU = THREE.MathUtils.clamp((animElapsed - 2.05) / 0.72, 0, 1);
        const easedFly = flyU * flyU * (3 - 2 * flyU);
        reiRig.handCrownAnchor.getWorldPosition(_tmpVecA);
        winnerRig.headCrownAnchor.getWorldPosition(_tmpVecB);
        _tmpVecC.lerpVectors(_tmpVecA, _tmpVecB, easedFly);
        _tmpVecC.y += Math.sin(easedFly * Math.PI) * 0.32;
        crownGroup.position.copy(_tmpVecC);

        reiRig.handCrownAnchor.getWorldQuaternion(_tmpQuatA);
        winnerRig.headCrownAnchor.getWorldQuaternion(_tmpQuatB);
        crownGroup.quaternion.slerpQuaternions(_tmpQuatA, _tmpQuatB, easedFly);
      } else {
        winnerRig.headCrownAnchor.getWorldPosition(_tmpVecA);
        winnerRig.headCrownAnchor.getWorldQuaternion(_tmpQuatA);
        crownGroup.position.copy(_tmpVecA);
        crownGroup.quaternion.copy(_tmpQuatA);
      }

      // Partículas douradas orbitais ao redor da coroa e do campeão (Zero-GC)
      const sparklesActive = animElapsed >= 2.05;
      for (let si = 0; si < sparkles.length; si++) {
        const sp = sparkles[si];
        sp.mesh.visible = sparklesActive;
        if (sparklesActive) {
          const ang = sp.phase + animElapsed * sp.speed;
          const cx = crownOwner === 'flying' ? crownGroup.position.x : pedestalX;
          const cz = crownOwner === 'flying' ? crownGroup.position.z : pedestalZ;
          const baseY = crownOwner === 'flying' ? crownGroup.position.y - 0.15 : pedestalTopY + 1.15;
          sp.mesh.position.set(
            cx + Math.cos(ang) * sp.radius,
            baseY + sp.heightOffset + Math.sin(animElapsed * 2.5 + sp.phase) * 0.16,
            cz + Math.sin(ang) * sp.radius
          );
          sp.mesh.rotation.y = ang * 1.5;
          const s = 0.7 + 0.45 * Math.sin(animElapsed * 4.5 + sp.phase);
          sp.mesh.scale.setScalar(s);
        }
      }

      // Movimento sutil e cinematográfico da câmara acompanhando a entrega da coroa (sem saltos bruscos no lookAt)
      const targetCamX = animElapsed < 1.25 ? -0.1 : animElapsed < 2.85 ? 0.28 : 0.18;
      const targetCamZ = animElapsed < 1.25 ? 6.2 : animElapsed < 2.85 ? 5.75 : 5.95;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 3.6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 3.6, dt);
      camLookX = THREE.MathUtils.damp(camLookX, targetCamX * 0.65, 3.6, dt);
      camera.lookAt(camLookX, 1.15, 0);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();

    let lastObservedW = width;
    let lastObservedH = height;
    const handleResize = () => {
      if (!container || !renderer || isDisposed) return;
      const w = Math.max(Math.round(container.clientWidth), 280);
      const h = Math.max(Math.round(container.clientHeight), 220);
      if (Math.abs(w - lastObservedW) < 2 && Math.abs(h - lastObservedH) < 2) {
        return;
      }
      lastObservedW = w;
      lastObservedH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.render(scene, camera);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', handleResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      setWebglFailed(true);
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);

    return () => {
      isDisposed = true;
      timer.dispose();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);

      bag.geometries.forEach((g) => g.dispose());
      bag.materials.forEach((m) => m.dispose());
      bag.textures.forEach((tx) => tx.dispose());
      envTarget.dispose();
      renderer?.dispose();
      container.innerHTML = '';
    };
  }, [winner.avatarId, winner.name, winner.color, prefersReducedMotion]);

  const winnerDisplayName =
    winner.isPlayer && !winner.name.includes(t.youTag)
      ? `${winner.name} ${t.youTag}`
      : winner.name;

  const rei00PlateLabel =
    lang === 'en' ? 'REI 00 · FIRST KING' : lang.startsWith('es') ? 'REI 00 · PRIMER REY' : 'REI 00 · 1º REI';

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-amber-950/90 via-zinc-950 to-black border-2 border-amber-500/60 p-3.5 sm:p-5 shadow-[0_0_50px_rgba(245,158,11,0.35)] overflow-hidden">
      {/* Cabeçalho da Cerimónia */}
      <div className="relative z-10 flex items-center justify-between border-b border-amber-500/30 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">👑</span>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 font-sans">
              {t.coronation.title}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">
              &quot;{t.officialPhrase}&quot;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {stage >= 4 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => controlsRef.current?.replay()}
              type="button"
              className="text-[10px] font-mono font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 cursor-pointer flex items-center gap-1 transition-colors"
            >
              <span>↺</span> {t.coronation.replayBtn}
            </motion.button>
          )}
          {stage < 4 && !isSkipped && (
            <button
              onClick={() => controlsRef.current?.skip()}
              type="button"
              className="text-[10px] font-mono text-zinc-300 hover:text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-700 cursor-pointer"
            >
              {t.coronation.skipBtn}
            </button>
          )}
        </div>
      </div>

      {/* Palco 3D Three.js (sem backdrop-blur para máxima nitidez e FPS em qualquer GPU) */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-amber-500/35 bg-[#0b080d]">
        {!webglFailed ? (
          <div ref={stageMountRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-around px-4 bg-gradient-to-t from-red-950/60 via-zinc-950 to-zinc-900">
            <div className="flex flex-col items-center">
              <AvatarDoll avatarId="rei-zero" name="Rei 00" size={54} variant="full" hideHeadwear />
              <span className="mt-1 text-[10px] font-mono font-bold text-amber-300">{rei00PlateLabel}</span>
            </div>
            <span className="text-3xl">👑 → 🏆</span>
            <div className="flex flex-col items-center">
              <AvatarDoll
                avatarId={winner.avatarId}
                name={winner.name}
                color={winner.color}
                size={58}
                variant="full"
              />
              <span className="mt-1 text-[10px] font-mono font-bold text-emerald-300">{winnerDisplayName}</span>
            </div>
          </div>
        )}

        {/* Faixa superior discreta */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-3 py-0.5 rounded bg-black/80 border border-amber-500/40">
          <span className="text-[9px] font-mono font-bold tracking-widest text-amber-300 uppercase whitespace-nowrap">
            {t.coronation.palaceBanner}
          </span>
        </div>

        {/* Balão do Rei 00 sincronizado com os movimentos 3D */}
        <div className="absolute top-9 left-3 sm:left-6 pointer-events-none z-10">
          <AnimatePresence mode="wait">
            {stage === 1 && (
              <motion.div
                key="rei3d-b1"
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="bg-amber-400 text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg border border-amber-200 whitespace-nowrap"
              >
                {t.coronation.bubble1}
              </motion.div>
            )}
            {stage === 2 && (
              <motion.div
                key="rei3d-b2"
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="bg-yellow-400 text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg border border-white whitespace-nowrap"
              >
                {t.coronation.bubble2}
              </motion.div>
            )}
            {stage >= 3 && (
              <motion.div
                key="rei3d-b3"
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-zinc-900 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/60 shadow whitespace-nowrap"
              >
                {t.coronation.bubble3}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Balão de celebração do Vencedor */}
        <div className="absolute top-9 right-3 sm:right-6 pointer-events-none z-10">
          <AnimatePresence>
            {stage === 3 && (
              <motion.div
                key="win3d-jump"
                initial={{ opacity: 0, scale: 0.65, y: 8 }}
                animate={{ opacity: 1, scale: 1.05, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="bg-emerald-500 text-zinc-950 font-black text-[10px] sm:text-[11px] px-2.5 py-1 rounded-xl shadow-lg border border-white flex items-center gap-1 whitespace-nowrap"
              >
                <span>🎉</span>
                <span>{t.coronation.jumpShout}</span>
                <span>👑</span>
              </motion.div>
            )}
            {stage >= 4 && (
              <motion.div
                key="win3d-crowned"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-950 text-emerald-300 font-bold text-[9px] px-2.5 py-1 rounded-lg border border-emerald-500/60 shadow whitespace-nowrap"
              >
                👑 {t.coronation.crownedBadge}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Placas identificadoras na base do palco 3D */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <span className="text-[9px] font-mono font-black uppercase text-amber-300 bg-black/85 px-2 py-0.5 rounded border border-amber-500/45">
            {rei00PlateLabel}
          </span>
          <span className="text-[9px] font-mono font-black uppercase text-emerald-300 bg-black/85 px-2 py-0.5 rounded border border-emerald-500/45 truncate max-w-[160px]">
            🏆 {winnerDisplayName}
          </span>
        </div>
      </div>

      {/* Legenda Dinâmica da Cerimónia */}
      <div className="mt-2.5 text-center">
        <p className="text-[11px] font-mono text-amber-200/95 font-semibold">
          {stage === 0 && t.coronation.stage0}
          {stage === 1 && t.coronation.stage1}
          {stage === 2 && t.coronation.stage2}
          {stage === 3 && t.coronation.stage3}
          {stage >= 4 && t.coronation.stage4}
        </p>
      </div>
    </div>
  );
};
