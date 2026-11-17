import { resolveAvatarLook } from '../data/avatarLooks';

export interface DrawCanvasRunnerParams {
  ctx: CanvasRenderingContext2D;
  avatarId?: string | null;
  name: string;
  color?: string | null;
  isPlayer: boolean;
  isBot?: boolean;
  isSliding: boolean;
  isAirborne: boolean;
  strideCycle: number;
  stumbling: boolean;
  hatImmunity?: boolean;
  labelText: string;
  scale?: number;
}

export function drawCanvasRunnerAvatar({
  ctx,
  avatarId,
  name,
  color,
  isPlayer,
  isBot = false,
  isSliding,
  isAirborne,
  strideCycle,
  stumbling,
  hatImmunity = false,
  labelText,
  scale = 1,
}: DrawCanvasRunnerParams) {
  const look = resolveAvatarLook(avatarId, name, color);

  ctx.save();
  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  // Aura de imunidade do Chapéu do Kudurista ou alerta de tropeço
  if (hatImmunity) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();
  } else if (stumbling) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.34)';
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fill();
  } else if (isPlayer) {
    // Anel sutil de destaque do jogador na pista
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.42)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 28.5, 18, 5.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Impulso vertical e inclinação cinemática da passada
  const strideBounce = isSliding || isAirborne ? 0 : Math.abs(Math.sin(strideCycle)) * -2.3;
  const bodyLean = isSliding ? -0.14 : stumbling ? Math.sin(strideCycle * 1.4) * 0.14 : Math.sin(strideCycle) * 0.035;

  ctx.save();
  ctx.translate(0, strideBounce);
  ctx.rotate(bodyLean);

  // 1. Capa ou Lenço flutuante atrás do tronco com brilho e sombra em onda dupla
  if (look.capeOrScarf) {
    const capeFlutter = Math.sin(strideCycle * 1.5) * 4.8 + Math.cos(strideCycle * 2.7) * 1.6;
    const capeGrad = ctx.createLinearGradient(0, -10, 0, isSliding ? 12 : 28);
    capeGrad.addColorStop(0, look.capeOrScarf);
    capeGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = capeGrad;
    ctx.beginPath();
    ctx.moveTo(-11, -9);
    ctx.lineTo(11, -9);
    ctx.lineTo(15.5 + capeFlutter, isSliding ? 11 : 27.5);
    ctx.lineTo(0, isSliding ? 13 : 29.5);
    ctx.lineTo(-15.5 - capeFlutter * 0.85, isSliding ? 11 : 27.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = look.jacketAccent;
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  // 2. Pernas articuladas (coxa + joelho + canela) & Sapatilhas com sola branca rotacionada
  if (!isSliding) {
    const strideL = Math.sin(strideCycle);
    const strideR = Math.sin(strideCycle + Math.PI);
    const legLeftLift = isAirborne ? -7 : strideL * 10.8;
    const legRightLift = isAirborne ? -3 : strideR * 10.8;
    const kneeLeftX = -6.5 - (isAirborne ? 2 : strideL * 2.4);
    const kneeRightX = 6.5 + (isAirborne ? 1.5 : strideR * 2.4);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Coxas e canelas articuladas
    ctx.strokeStyle = look.pants;
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(kneeLeftX, 20 + legLeftLift * 0.45);
    ctx.lineTo(-6, 25.5 + legLeftLift);

    ctx.moveTo(6, 14);
    ctx.lineTo(kneeRightX, 20 + legRightLift * 0.45);
    ctx.lineTo(6, 25.5 + legRightLift);
    ctx.stroke();

    // Sapatilhas atléticas + sola branca com ângulo da passada
    const drawSneaker = (sx: number, sy: number, tilt: number) => {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(tilt * 0.16);
      ctx.fillStyle = look.shoes;
      ctx.beginPath();
      ctx.roundRect(-4.4, -1.6, 9, 4.4, 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-4.4, 1.8, 9, 1.6);
      ctx.restore();
    };
    drawSneaker(-6, 25.5 + legLeftLift, isAirborne ? -0.8 : strideL);
    drawSneaker(6, 25.5 + legRightLift, isAirborne ? -0.4 : strideR);
  }

  // 3. Tronco esculpido com gradiente desportivo + roupa identificadora
  const torsoTop = isSliding ? 2 : -13.5;
  const torsoH = isSliding ? 19 : 32;
  const jacketGrad = ctx.createLinearGradient(-14, torsoTop, 14, torsoTop + torsoH);
  jacketGrad.addColorStop(0, stumbling ? '#b91c1c' : look.jacket);
  jacketGrad.addColorStop(0.75, stumbling ? '#7f1d1d' : look.jacket);
  jacketGrad.addColorStop(1, '#090a0f');

  ctx.fillStyle = jacketGrad;
  ctx.beginPath();
  ctx.roundRect(-14, torsoTop, 28, torsoH, 6.5);
  ctx.fill();
  ctx.strokeStyle = look.jacketAccent;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  // Realce superior nos ombros
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-10, torsoTop + 1.5);
  ctx.lineTo(10, torsoTop + 1.5);
  ctx.stroke();

  // Gola / Camisola interior & Detalhes do uniforme
  if (!isSliding) {
    ctx.fillStyle = look.shirt;
    ctx.beginPath();
    ctx.moveTo(-5.2, -13.2);
    ctx.lineTo(0, -2.5);
    ctx.lineTo(5.2, -13.2);
    ctx.closePath();
    ctx.fill();

    // Lapelas
    ctx.fillStyle = look.jacketAccent;
    ctx.beginPath();
    ctx.moveTo(-7.2, -13);
    ctx.lineTo(-4.8, -13);
    ctx.lineTo(-1.2, -4);
    ctx.lineTo(-4.2, -3.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(7.2, -13);
    ctx.lineTo(4.8, -13);
    ctx.lineTo(1.2, -4);
    ctx.lineTo(4.2, -3.5);
    ctx.closePath();
    ctx.fill();

    if (look.pattern === 'candonga-vest') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-12.5, 2, 25, 3.4);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-12.5, 6.4, 25, 2);
    } else if (look.pattern === 'angola-sash') {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-10.5, -10);
      ctx.lineTo(10.5, 14);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (look.pattern === 'samakaka-tunic') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-12.5, 6, 25, 3);
    } else if (look.pattern === 'royal-cape' || look.pattern === 'imperial-armor') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 2, 1.5, 0, Math.PI * 2);
      ctx.arc(0, 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = look.jacketAccent;
      ctx.fillRect(-4.5, 4, 9, 2.6);
    }
  }

  // 4. Braços articulados com punhos & mãos
  if (!isSliding) {
    const armSwing = isAirborne ? -5.5 : Math.sin(strideCycle) * 7.8;
    const armSwingR = isAirborne ? -5.5 : -armSwing;
    ctx.lineCap = 'round';
    ctx.strokeStyle = look.jacket;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(-13.8, -6.5);
    ctx.lineTo(-17.8, 0.5 - armSwing * 0.45);
    ctx.lineTo(-17.2, 6 - armSwing);

    ctx.moveTo(13.8, -6.5);
    ctx.lineTo(17.8, 0.5 - armSwingR * 0.45);
    ctx.lineTo(17.2, 6 - armSwingR);
    ctx.stroke();

    // Punho da jaqueta
    ctx.fillStyle = look.jacketAccent;
    ctx.fillRect(-19.5, 3 - armSwing, 4.5, 1.8);
    ctx.fillRect(15, 3 - armSwingR, 4.5, 1.8);

    // Mãos com sombreamento
    ctx.fillStyle = look.skin;
    ctx.strokeStyle = look.skinShadow;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(-17.2, 7.2 - armSwing, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(17.2, 7.2 - armSwingR, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 5. Cabeça volumétrica com orelhas, sombreado facial, cabelo e olhos nítidos
  const headY = isSliding ? -4 : -22.5;

  // Rabo de cavalo ou Afro atrás da cabeça
  if ((look.isFeminine || look.hairStyle === 'ponytail') && look.headwear !== 'samakaka-wrap') {
    const hairSwing = Math.sin(strideCycle * 1.4) * 2.2;
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(7, headY - 3);
    ctx.quadraticCurveTo(15 + hairSwing, headY - 1, 13 + hairSwing, headY + 7);
    ctx.quadraticCurveTo(9, headY + 4, 7, headY + 1);
    ctx.closePath();
    ctx.fill();
  } else if (
    look.hairStyle === 'afro' &&
    look.headwear !== 'stealth-hood' &&
    look.headwear !== 'bucket-hat' &&
    look.headwear !== 'samakaka-wrap' &&
    look.headwear !== 'driver-cap'
  ) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(0, headY - 3.5, 11.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pescoço
  if (!isSliding) {
    ctx.fillStyle = look.skinShadow;
    ctx.fillRect(-3.2, -16, 6.4, 4.5);
  }

  // Orelhas
  ctx.fillStyle = look.skinShadow;
  ctx.beginPath();
  ctx.arc(-9.8, headY + 0.5, 2.1, 0, Math.PI * 2);
  ctx.arc(9.8, headY + 0.5, 2.1, 0, Math.PI * 2);
  ctx.fill();

  // Rosto com gradiente radial volumétrico
  const headGrad = ctx.createRadialGradient(-2.5, headY - 3, 1.5, 0, headY, 10.5);
  headGrad.addColorStop(0, look.skin);
  headGrad.addColorStop(0.72, look.skin);
  headGrad.addColorStop(1, look.skinShadow);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, headY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.skinShadow;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Cabelo topo
  if (
    look.headwear !== 'stealth-hood' &&
    look.headwear !== 'bucket-hat' &&
    look.headwear !== 'samakaka-wrap' &&
    look.headwear !== 'driver-cap'
  ) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(0, headY - 1.4, 9.8, Math.PI, 0);
    ctx.fill();

    if (look.hairStyle === 'locs') {
      ctx.fillRect(-10.5, headY - 3, 2.2, 7.5);
      ctx.fillRect(8.3, headY - 3, 2.2, 7.5);
    }
  }

  // Sobrancelhas & Olhos detalhados
  ctx.strokeStyle = look.hair;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-5.2, headY - 1.8);
  ctx.lineTo(-1.8, headY - 2.3);
  ctx.moveTo(1.8, headY - 2.3);
  ctx.lineTo(5.2, headY - 1.8);
  ctx.stroke();

  // Esclera branca + pupila escura + reflexo
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(-3.4, headY + 0.3, 1.8, 1.35, 0, 0, Math.PI * 2);
  ctx.ellipse(3.4, headY + 0.3, 1.8, 1.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-3.3, headY + 0.3, 1.1, 0, Math.PI * 2);
  ctx.arc(3.3, headY + 0.3, 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2.9, headY - 0.1, 0.38, 0, Math.PI * 2);
  ctx.arc(3.7, headY - 0.1, 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Sorriso confiante
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(0, headY + 3.2, 3.2, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  // 6. Acessório / Chapéu / Coroa identificadora do personagem
  if (look.headwear === 'royal-crown' || look.headwear === 'imperial-crown') {
    const crownGrad = ctx.createLinearGradient(-9, headY - 16, 9, headY - 7);
    crownGrad.addColorStop(0, '#fef08a');
    crownGrad.addColorStop(0.5, look.headwearColor);
    crownGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = crownGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, headY - 7);
    ctx.lineTo(-8, headY - 15.5);
    ctx.lineTo(-3.5, headY - 10.5);
    ctx.lineTo(0, headY - 17);
    ctx.lineTo(3.5, headY - 10.5);
    ctx.lineTo(8, headY - 15.5);
    ctx.lineTo(9, headY - 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = look.headwearAccent;
    ctx.beginPath();
    ctx.arc(0, headY - 10.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.headwear === 'headphones-visor') {
    ctx.strokeStyle = look.headwearColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, headY - 1, 11, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = look.headwearColor;
    ctx.fillRect(-11.8, headY - 3.2, 3.2, 6.4);
    ctx.fillRect(8.6, headY - 3.2, 3.2, 6.4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6.8, headY - 1.6, 13.6, 3.8);
    ctx.strokeStyle = look.headwearColor;
    ctx.lineWidth = 0.9;
    ctx.strokeRect(-6.8, headY - 1.6, 13.6, 3.8);
  } else if (look.headwear === 'bucket-hat') {
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.roundRect(-9.2, headY - 13.2, 18.4, 7.2, 3);
    ctx.fill();
    ctx.fillStyle = look.headwearAccent;
    ctx.fillRect(-9.2, headY - 8.2, 18.4, 2);
    ctx.fillStyle = look.headwearColor;
    ctx.fillRect(-13.2, headY - 6.4, 26.4, 2.6);
  } else if (look.headwear === 'driver-cap') {
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.arc(0, headY - 5, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = look.headwearAccent;
    ctx.fillRect(-9.6, headY - 6.6, 19.2, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, headY - 5, 17, 2.5);
  } else if (look.headwear === 'samakaka-wrap') {
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.arc(0, headY - 3.5, 10.6, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = look.headwearAccent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = look.headwearAccent;
    ctx.beginPath();
    ctx.arc(0, headY - 12.2, 3.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.headwear === 'stealth-hood') {
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.arc(0, headY - 2, 10.8, Math.PI * 0.9, Math.PI * 0.1);
    ctx.fill();
    ctx.fillRect(-9.2, headY + 4.2, 18.4, 5.2);
  } else if (look.headwear === 'aviator-goggles') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(-9.6, headY - 9, 19.2, 3);
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.arc(-3.5, headY - 7.5, 2.8, 0, Math.PI * 2);
    ctx.arc(3.5, headY - 7.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (look.headwear === 'crystal-visor') {
    ctx.fillStyle = look.headwearColor;
    ctx.fillRect(-7.5, headY - 2, 15, 4);
    ctx.strokeStyle = '#ecfeff';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-7.5, headY - 2, 15, 4);
  } else if (look.headwear === 'shades-band') {
    ctx.fillStyle = look.headwearColor;
    ctx.beginPath();
    ctx.arc(0, headY - 5.5, 9.6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-7, headY - 1.5, 6, 3.6);
    ctx.fillRect(1, headY - 1.5, 6, 3.6);
    ctx.strokeStyle = look.headwearColor;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-7, headY - 1.5, 6, 3.6);
    ctx.strokeRect(1, headY - 1.5, 6, 3.6);
  } else {
    ctx.fillStyle = look.headwearColor;
    ctx.fillRect(-9.6, headY - 8.6, 19.2, 3.6);
    ctx.fillStyle = look.headwearAccent;
    ctx.beginPath();
    ctx.arc(0, headY - 6.8, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Fim da rotação/balanço cinemático do corredor

  // 7. Estrelas de tontura no impacto
  if (stumbling) {
    const starAngle = performance.now() * 0.012;
    const starRadius = 18;
    const star1X = Math.cos(starAngle) * starRadius;
    const star1Y = (isSliding ? -18 : -36) + Math.sin(starAngle) * 5;
    const star2X = Math.cos(starAngle + Math.PI) * starRadius;
    const star2Y = (isSliding ? -18 : -36) + Math.sin(starAngle + Math.PI) * 5;

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💫', star1X, star1Y);
    ctx.fillText('⭐', star2X, star2Y);
  }

  // 8. Etiqueta do Nome com acabamento chamativo e nítido
  const pillW = Math.max(68, Math.min(96, labelText.length * 5.2 + 14));
  const pillY = isSliding ? -27 : -50;
  ctx.fillStyle = stumbling ? 'rgba(127, 29, 29, 0.94)' : 'rgba(6, 9, 18, 0.9)';
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, pillY, pillW, 13.5, 4);
  ctx.fill();

  ctx.strokeStyle = stumbling
    ? '#ef4444'
    : isPlayer
    ? '#f59e0b'
    : look.jacketAccent;
  ctx.lineWidth = isPlayer ? 1.3 : 0.9;
  ctx.stroke();

  ctx.fillStyle = stumbling
    ? '#fca5a5'
    : isPlayer
    ? '#fef08a'
    : isBot
    ? '#7dd3fc'
    : '#facc15';
  ctx.font = isPlayer ? 'bold 8.5px sans-serif' : 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, 0, pillY + 6.8);

  ctx.restore();
}
