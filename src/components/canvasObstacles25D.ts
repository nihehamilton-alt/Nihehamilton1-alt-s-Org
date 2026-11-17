import { LuandaObstacleId } from '../types/game';

export interface ObstacleTagLabels {
  jump: string;
  slide: string;
  dodge: string;
}

function drawActionTag(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  color: string,
  wide = false
) {
  const w = wide ? 64 : 58;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, y, w, 12.5, 3);
  ctx.fill();
  ctx.strokeStyle = color + '66';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, y + 6.5);
}

/**
 * Renders all 10 Luanda obstacles in 2D mode as genuine 2.5D / 3D volumetric
 * isometric extruded objects (front face + top plane + 3D side extrusion + ground shadow)
 * so every main obstacle looks unmistakably 3D even in 2D mode.
 */
export function drawVolumetricObstacle25D(
  ctx: CanvasRenderingContext2D,
  obsId: LuandaObstacleId | string,
  tags: ObstacleTagLabels,
  nowMs: number
) {
  if (obsId === 'buraco-marginal') {
    // 1. 3D Deep Asphalt Crater + Side Wall Depth + 3D Traffic Cones
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.ellipse(0, 1, 29, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner cutaway lip (gives 3D pit depth)
    const rimGrad = ctx.createLinearGradient(0, -14, 0, 14);
    rimGrad.addColorStop(0, '#52525b');
    rimGrad.addColorStop(0.5, '#18181b');
    rimGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep pitch core shifted down to create upper inner cliff wall
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.ellipse(0, 3, 21, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Broken asphalt 3D chunks around crater
    ctx.fillStyle = '#52525b';
    ctx.fillRect(-26, -6, 6, 4);
    ctx.fillRect(19, 5, 6, 4);

    // Dual 3D traffic cones (base + cone body + reflective band + shadow)
    [-22, 22].forEach((cx) => {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx + 2, 7, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D base block
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(cx - 6, 3, 12, 3.5);
      // Shaded cone (left lit, right shadow)
      const coneGrad = ctx.createLinearGradient(cx - 5, -13, cx + 5, 4);
      coneGrad.addColorStop(0, '#fb923c');
      coneGrad.addColorStop(0.55, '#ea580c');
      coneGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(cx, -14);
      ctx.lineTo(cx - 5.5, 4);
      ctx.lineTo(cx + 5.5, 4);
      ctx.closePath();
      ctx.fill();

      // Reflective band curved around 3D cone
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx - 3.1, -6);
      ctx.lineTo(cx + 3.1, -6);
      ctx.lineTo(cx + 3.8, -2.5);
      ctx.lineTo(cx - 3.8, -2.5);
      ctx.closePath();
      ctx.fill();
    });

    drawActionTag(ctx, 16, tags.jump, '#facc15');
    return;
  }

  if (obsId === 'candongueiro-parado') {
    // 2. Real 3D Blue-and-White HiAce Minibus (top roof + side wall + front face + 3D tires)
    const blink = Math.sin(nowMs * 0.012) > 0;

    // Ground cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(3, 21, 31, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D Wheels
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-24, 13, 8, 8);
    ctx.fillRect(14, 13, 8, 8);
    ctx.fillRect(22, 9, 6, 7);

    // 3D Extruded Right Side Depth (isometric depth wall)
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.moveTo(20, -14);
    ctx.lineTo(29, -21);
    ctx.lineTo(29, 9);
    ctx.lineTo(20, 17);
    ctx.closePath();
    ctx.fill();

    // Side window strip on right 3D face
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(21.5, -12);
    ctx.lineTo(27.5, -17);
    ctx.lineTo(27.5, -5);
    ctx.lineTo(21.5, -1);
    ctx.closePath();
    ctx.fill();

    // Front main blue chassis
    const bodyGrad = ctx.createLinearGradient(-24, -14, 20, 17);
    bodyGrad.addColorStop(0, '#0ea5e9');
    bodyGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-24, -14, 44, 31, 4);
    ctx.fill();

    // White roof 3D top slab + front fascia
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(-22, -14);
    ctx.lineTo(-13, -23);
    ctx.lineTo(29, -23);
    ctx.lineTo(20, -14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-22, -15, 42, 6);

    // Roof luggage rack 3D bars + cargo box
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-11, -26, 30, 5);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-4, -27, 12, 4);

    // Tinted windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-20, -9, 36, 12, 2);
    ctx.fill();
    // Windshield 3D gloss reflection
    ctx.fillStyle = 'rgba(125, 211, 252, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-17, -8);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-14, 2);
    ctx.lineTo(-19, 2);
    ctx.closePath();
    ctx.fill();

    // Metallic bumper + Luanda Plate
    ctx.fillStyle = '#334155';
    ctx.fillRect(-24, 12, 44, 5);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-12, 6, 20, 6);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LD-24-90', -2, 11);

    // Blinking 3D hazard lights
    ctx.fillStyle = blink ? '#fbbf24' : '#78350f';
    ctx.fillRect(-22, 4, 6, 6);
    ctx.fillRect(12, 4, 6, 6);

    drawActionTag(ctx, 25, tags.dodge, '#ef4444', true);
    return;
  }

  if (obsId === 'taxi-azul-branco') {
    // 3. Real 3D Blue-and-White Luanda Sedan Taxi
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(2, 19, 29, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-22, 11, 7, 7);
    ctx.fillRect(13, 11, 7, 7);
    ctx.fillRect(21, 7, 5, 6);

    // 3D right side extrusion
    ctx.fillStyle = '#075985';
    ctx.beginPath();
    ctx.moveTo(19, -4);
    ctx.lineTo(27, -11);
    ctx.lineTo(27, 7);
    ctx.lineTo(19, 15);
    ctx.closePath();
    ctx.fill();

    // Lower sedan body
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(-23, -4, 42, 19, 3);
    ctx.fill();

    // Hood 3D plane
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(-21, -4);
    ctx.lineTo(-15, -10);
    ctx.lineTo(25, -10);
    ctx.lineTo(19, -4);
    ctx.closePath();
    ctx.fill();

    // White cabin (3D trapezoid)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-17, -8);
    ctx.lineTo(-11, -18);
    ctx.lineTo(19, -18);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();

    // Windshield glass
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-13, -15, 23, 7);

    // 3D glowing yellow TAXI rooftop box
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-7, -23, 15, 5.5);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(8, -24, 3, 5.5);
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 4.8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0.5, -18.5);

    // Glowing headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-20, 2, 6, 4.5);
    ctx.fillRect(10, 2, 6, 4.5);

    drawActionTag(ctx, 21, tags.jump, '#facc15', true);
    return;
  }

  if (obsId === 'zungueira-bacia') {
    // 4. 3D Volumetric Zungueira + Woven 3D Fruit Basin
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 16, 19, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Conical 3D skirt with shading
    const dressGrad = ctx.createLinearGradient(-14, -6, 14, 15);
    dressGrad.addColorStop(0, '#ef4444');
    dressGrad.addColorStop(0.5, '#dc2626');
    dressGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = dressGrad;
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(15, 14);
    ctx.lineTo(-15, 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, 1, 20, 4);

    // 3D spherical head with radial shading
    const headGrad = ctx.createRadialGradient(-2, -14, 1, 0, -12, 8);
    headGrad.addColorStop(0, '#a16207');
    headGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -12, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Tapered 3D basin side wall + top oval rim
    const basinWall = ctx.createLinearGradient(-22, -22, 22, -16);
    basinWall.addColorStop(0, '#f59e0b');
    basinWall.addColorStop(1, '#92400e');
    ctx.fillStyle = basinWall;
    ctx.beginPath();
    ctx.moveTo(-22, -22);
    ctx.lineTo(22, -22);
    ctx.lineTo(14, -15);
    ctx.lineTo(-14, -15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(0, -22, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D piled fruits with specular highlights
    const fruits = [
      { x: -10, y: -24, r: 5, c: '#facc15' },
      { x: 0, y: -26, r: 5.5, c: '#16a34a' },
      { x: 10, y: -24, r: 5, c: '#ef4444' },
      { x: -4, y: -23, r: 4.5, c: '#fb923c' },
    ];
    fruits.forEach((f) => {
      ctx.fillStyle = f.c;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(f.x - 1.5, f.y - 1.5, f.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    });

    drawActionTag(ctx, 19, tags.jump, '#facc15');
    return;
  }

  if (obsId === 'tambor') {
    // 5. Real 3D Metallic Industrial Drum Cylinder
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(3, 15, 19, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cylindrical body with 3D cylindrical gradient
    const drumGrad = ctx.createLinearGradient(-16, 0, 16, 0);
    drumGrad.addColorStop(0, '#991b1b');
    drumGrad.addColorStop(0.32, '#ef4444');
    drumGrad.addColorStop(0.7, '#dc2626');
    drumGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = drumGrad;
    ctx.fillRect(-16, -15, 32, 29);

    // Hazard yellow belt wrapped in 3D
    const bandGrad = ctx.createLinearGradient(-16, 0, 16, 0);
    bandGrad.addColorStop(0, '#a16207');
    bandGrad.addColorStop(0.35, '#fef08a');
    bandGrad.addColorStop(1, '#854d0e');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(-16, -5, 32, 9);

    // Bottom curved 3D rim
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top 3D metallic lid ellipse
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.ellipse(0, -15, 16, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Bung cap
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(6, -15, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    drawActionTag(ctx, 18, tags.jump, '#facc15');
    return;
  }

  if (obsId === 'policia') {
    // 6. Real 3D Police Roadblock Barrier + Flashing Red/Blue Beacons
    const sirenFlash = Math.floor(nowMs / 180) % 2 === 0;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(2, 18, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D A-frame metallic legs
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-20, -6); ctx.lineTo(-24, 16);
    ctx.moveTo(-20, -6); ctx.lineTo(-14, 15);
    ctx.moveTo(20, -6); ctx.lineTo(24, 16);
    ctx.moveTo(20, -6); ctx.lineTo(14, 15);
    ctx.stroke();

    // 3D Top bevel of barrier beam
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-26, -12);
    ctx.lineTo(-21, -16);
    ctx.lineTo(27, -16);
    ctx.lineTo(22, -12);
    ctx.closePath();
    ctx.fill();

    // Front chevron plank (Red & White reflective blocks)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-26, -12, 48, 12);
    for (let sx = -26; sx < 22; sx += 12) {
      ctx.fillStyle = (Math.floor((sx + 26) / 12) % 2 === 0) ? '#dc2626' : '#f8fafc';
      ctx.fillRect(sx, -11, 11, 10);
    }

    // Dual flashing 3D siren domes on top
    ctx.fillStyle = sirenFlash ? '#ef4444' : '#3b82f6';
    ctx.beginPath();
    ctx.arc(-15, -18, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sirenFlash ? '#3b82f6' : '#ef4444';
    ctx.beginPath();
    ctx.arc(15, -18, 4.5, 0, Math.PI * 2);
    ctx.fill();

    drawActionTag(ctx, 19, tags.dodge, '#ef4444');
    return;
  }

  if (obsId === 'balde-agua') {
    // 7. 3D Cylindrical Metallic Water Bucket + Puddle + Splashes
    ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 24, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tapered 3D bucket body
    const bucketGrad = ctx.createLinearGradient(-12, 0, 12, 0);
    bucketGrad.addColorStop(0, '#64748b');
    bucketGrad.addColorStop(0.4, '#e2e8f0');
    bucketGrad.addColorStop(1, '#475569');
    ctx.fillStyle = bucketGrad;
    ctx.beginPath();
    ctx.moveTo(-13, -12);
    ctx.lineTo(13, -12);
    ctx.lineTo(9.5, 10);
    ctx.lineTo(-9.5, 10);
    ctx.closePath();
    ctx.fill();

    // Bottom arc
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(0, 10, 9.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top elliptical rim with 3D water inside
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(0, -12, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(0, -12, 10.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wire handle arch
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -12, 13, Math.PI, 0);
    ctx.stroke();

    drawActionTag(ctx, 16, tags.jump, '#facc15');
    return;
  }

  if (obsId === 'cao-de-rua' || obsId === 'cao-rua') {
    // 8. 3D Volumetric Street Dog (torso + chest + snout + ears + 4 legs + animated tail)
    const wag = Math.sin(nowMs * 0.016) * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 13, 18, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back legs (darker for 3D depth)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-13, 2, 4, 10);
    ctx.fillRect(5, 2, 4, 10);

    // 3D shaded torso
    const dogGrad = ctx.createLinearGradient(-14, -8, 12, 8);
    dogGrad.addColorStop(0, '#f59e0b');
    dogGrad.addColorStop(0.5, '#d97706');
    dogGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = dogGrad;
    ctx.beginPath();
    ctx.roundRect(-15, -7, 25, 13, 5);
    ctx.fill();

    // Front legs
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-10, 3, 4, 10);
    ctx.fillRect(8, 3, 4, 10);

    // Red collar
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(7, -8, 4, 9);

    // 3D Head & snout
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(13, -9, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(14, -9, 9, 6, 2.5);
    ctx.fill();
    // Nose + ear
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(22, -7.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(9, -15);
    ctx.lineTo(13, -21);
    ctx.lineTo(15, -14);
    ctx.closePath();
    ctx.fill();

    // Animated 3D tail
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-22, -12 + wag);
    ctx.stroke();

    drawActionTag(ctx, 16, tags.jump, '#facc15');
    return;
  }

  if (obsId === 'fios-caidos') {
    // 9. Twin 3D Steel Utility Poles + Overhead Crossbeam + Sagging Live Wires & Sparks
    const spark = Math.floor(nowMs / 90) % 2 === 0;

    // Pole ground shadows
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(-28, 12, 6, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(28, 12, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right 3D Metallic Poles
    [-28, 28].forEach((px) => {
      const poleGrad = ctx.createLinearGradient(px - 3, 0, px + 3, 0);
      poleGrad.addColorStop(0, '#334155');
      poleGrad.addColorStop(0.5, '#94a3b8');
      poleGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = poleGrad;
      ctx.fillRect(px - 3, -28, 6, 40);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px - 5, -28, 10, 3);
    });

    // Sagging 3D insulated cables
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-28, -24);
    ctx.bezierCurveTo(-12, -2, 12, -2, 28, -24);
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-28, -20);
    ctx.bezierCurveTo(-12, 2, 12, 2, 28, -20);
    ctx.stroke();

    if (spark) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-5, -5, 4.5, 0, Math.PI * 2);
      ctx.arc(6, -4, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-5, -5, 2, 0, Math.PI * 2);
      ctx.arc(6, -4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    drawActionTag(ctx, 15, tags.slide, '#38bdf8', true);
    return;
  }

  // 10. Real 3D Market Kiosk (Montra) with 3D Striped Awning + Glass Counter
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(3, 19, 27, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3D right side counter wall
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(20, -14);
  ctx.lineTo(27, -20);
  ctx.lineTo(27, 11);
  ctx.lineTo(20, 17);
  ctx.closePath();
  ctx.fill();

  // Front wooden/metal frame
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-23, -14, 43, 31);

  // Reflective 3D display glass
  const glassGrad = ctx.createLinearGradient(-20, -10, 18, 14);
  glassGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
  glassGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(-20, -10, 37, 22);

  // Striped 3D sloped market awning roof
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
    const x1 = -24 + i * 7.5;
    ctx.beginPath();
    ctx.moveTo(x1, -13);
    ctx.lineTo(x1 + 5, -22);
    ctx.lineTo(x1 + 12.5, -22);
    ctx.lineTo(x1 + 7.5, -13);
    ctx.closePath();
    ctx.fill();
  }

  // Neon sign
  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 6.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', -1, 3);

  drawActionTag(ctx, 21, tags.dodge, '#ef4444');
}
