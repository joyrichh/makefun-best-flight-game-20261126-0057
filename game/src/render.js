import { VIEW, COLORS, RUNWAY, MISSIONS, TAU, clamp, mix, headingDegrees, clock, angleDelta } from './config.js';
import { nextTarget } from './world.js';

const FONT = 'Arial, Helvetica, sans-serif';
const MONO = '"Courier New", monospace';
const terrainPalette = [[59, 132, 92], [59, 132, 92], [64, 146, 96], [77, 158, 103], [91, 171, 109], [124, 186, 117], [168, 202, 137], [249, 224, 167], [70, 204, 183]];
const tintCache = new Map();

function rounded(context, positionX, positionY, width, height, radius = 12) {
  context.beginPath();
  context.roundRect(positionX, positionY, width, height, radius);
}

function panel(context, positionX, positionY, width, height, opacity = 0.9, border = '#8bcab233', radius = 14) {
  rounded(context, positionX, positionY, width, height, radius);
  context.fillStyle = `rgba(6, 38, 49, ${opacity})`;
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = 1;
  context.stroke();
}

function text(context, content, positionX, positionY, size = 16, color = COLORS.cream, weight = 500, align = 'left', family = FONT) {
  context.font = `${weight} ${size}px ${family}`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  context.fillText(content, positionX, positionY);
}

function line(context, points, color, width = 1, close = false) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  if (close) context.closePath();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function polygon(context, points, color, stroke = false) {
  if (points.length < 3) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  if (stroke) {
    context.strokeStyle = color;
    context.lineWidth = 0.65;
    context.stroke();
  }
}

function cameraFor(state, screen) {
  const side = ['title', 'briefing', 'gameover', 'landed'].includes(screen) ? -30 : 0;
  const sine = Math.sin(state.heading);
  const cosine = Math.cos(state.heading);
  const pitch = -0.13 + state.pitch * 0.17;
  return {
    x: state.x - sine * 222 + cosine * side,
    y: state.y + 79 + Math.max(0, -state.pitch) * 70,
    z: state.z - cosine * 222 - sine * side,
    sine, cosine, pitch, pitchSin: Math.sin(pitch), pitchCos: Math.cos(pitch),
    focal: 890, centreX: 640, centreY: 384,
  };
}

function cameraPoint(point, camera) {
  const offsetX = point.x - camera.x;
  const offsetY = point.y - camera.y;
  const offsetZ = point.z - camera.z;
  const forward = offsetX * camera.sine + offsetZ * camera.cosine;
  return { x: offsetX * camera.cosine - offsetZ * camera.sine, y: offsetY * camera.pitchCos - forward * camera.pitchSin, z: forward * camera.pitchCos + offsetY * camera.pitchSin };
}

function project(point, camera) {
  const local = cameraPoint(point, camera);
  const scale = camera.focal / Math.max(1, local.z);
  return { x: camera.centreX + local.x * scale, y: camera.centreY - local.y * scale, depth: local.z, scale };
}

function projectPolygon(points, camera) {
  const localPoints = points.map((point) => cameraPoint(point, camera));
  const clipped = [];
  for (let index = 0; index < localPoints.length; index += 1) {
    const current = localPoints[index];
    const previous = localPoints[(index + localPoints.length - 1) % localPoints.length];
    if ((current.z > 15) !== (previous.z > 15)) {
      const amount = (15 - previous.z) / (current.z - previous.z);
      clipped.push({ x: mix(previous.x, current.x, amount), y: mix(previous.y, current.y, amount), z: 15 });
    }
    if (current.z > 15) clipped.push(current);
  }
  return clipped.map((point) => ({ x: camera.centreX + point.x * camera.focal / point.z, y: camera.centreY - point.y * camera.focal / point.z }));
}

function faceTint(face, depth) {
  const shade = Math.floor(face.tint * 5);
  const fog = Math.floor(clamp((depth - 2800) / 13000, 0, 0.7) * 16);
  const key = `${face.band}:${shade}:${fog}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const base = terrainPalette[face.band];
  const factor = 0.91 + shade * 0.036;
  const color = `rgb(${base.map((channel, index) => Math.round(mix(channel * factor, [166, 208, 183][index], fog / 16))).join(',')})`;
  tintCache.set(key, color);
  return color;
}

function skyAndSea(context, world, camera) {
  const horizon = camera.centreY + Math.tan(camera.pitch) * camera.focal;
  const sky = context.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, '#3d9fc0');
  sky.addColorStop(0.56, '#8cd0d5');
  sky.addColorStop(1, '#e9e6b9');
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  const sunX = 1030 - Math.sin(world.state.heading) * 450;
  const sunY = horizon - 112;
  const glow = context.createRadialGradient(sunX, sunY, 18, sunX, sunY, 190);
  glow.addColorStop(0, '#fff4c6a0');
  glow.addColorStop(0.4, '#fff4c634');
  glow.addColorStop(1, '#fff4c600');
  context.fillStyle = glow;
  context.fillRect(sunX - 200, sunY - 200, 400, 400);
  context.fillStyle = '#fff1b9';
  context.beginPath();
  context.arc(sunX, sunY, 29, 0, TAU);
  context.fill();
  const sea = context.createLinearGradient(0, horizon, 0, VIEW.height);
  sea.addColorStop(0, '#6cbfc0');
  sea.addColorStop(0.22, '#2faeb8');
  sea.addColorStop(0.68, '#159aa9');
  sea.addColorStop(1, '#087e95');
  context.fillStyle = sea;
  context.fillRect(0, horizon, VIEW.width, VIEW.height - horizon);
  context.strokeStyle = '#e5efd870';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, horizon);
  context.lineTo(VIEW.width, horizon);
  context.stroke();
  for (const wave of world.waves) {
    const point = project({ x: wave.x, y: 0.7, z: wave.z }, camera);
    if (point.depth < 25 || point.depth > 13000 || point.x < -100 || point.x > 1380 || point.y > 830) continue;
    const width = Math.min(75, Math.max(1.5, wave.size * point.scale));
    context.strokeStyle = `rgba(192, 246, 220, ${wave.alpha * clamp(point.scale, 0.4, 1.3)})`;
    context.lineWidth = Math.max(0.7, Math.min(2, point.scale));
    context.beginPath();
    context.moveTo(point.x - width / 2, point.y);
    context.quadraticCurveTo(point.x, point.y - Math.min(2, width / 15), point.x + width / 2, point.y);
    context.stroke();
  }
  for (let index = 0; index < 24; index += 1) {
    const positionY = horizon + 3 + index * index * 0.58;
    const width = 9 + index * 4;
    const offset = Math.sin(index * 9.2) * index * 5;
    context.fillStyle = `rgba(255, 239, 175, ${0.13 - index * 0.004})`;
    context.fillRect(sunX + offset - width / 2, positionY, width, 1.4 + index * 0.06);
  }
  const clouds = [...world.clouds].sort((first, second) => second.z - first.z);
  for (const cloud of clouds) {
    const point = project(cloud, camera);
    if (point.depth < 600 || point.x < -500 || point.x > 1780) continue;
    const width = cloud.size * point.scale;
    if (point.y > horizon + 25 || point.y < -300) continue;
    context.fillStyle = '#e4ecd9';
    context.beginPath();
    context.ellipse(point.x, point.y + width * 0.035, width * 0.7, width * 0.115, 0, 0, TAU);
    context.fill();
    context.fillStyle = '#fff9e8';
    for (let puff = 0; puff < 5; puff += 1) {
      const offset = (puff - 2) * width * 0.245;
      const size = width * (0.23 + Math.sin(puff * 3 + cloud.phase) * 0.055);
      context.beginPath();
      context.ellipse(point.x + offset, point.y - Math.sin(puff + cloud.phase) * width * 0.065, size, size * 0.53, 0, 0, TAU);
      context.fill();
    }
  }
  for (let index = 0; index < 5; index += 1) {
    const positionX = 730 + index * 23 - Math.sin(world.state.heading) * 250;
    const positionY = horizon - 55 - Math.sin(index * 1.7) * 14;
    context.strokeStyle = '#356d7855';
    context.lineWidth = 1.1;
    context.beginPath();
    context.moveTo(positionX - 5, positionY + 2);
    context.quadraticCurveTo(positionX - 2, positionY - 1, positionX, positionY + 1);
    context.quadraticCurveTo(positionX + 3, positionY - 2, positionX + 6, positionY + 1);
    context.stroke();
  }
}

function addFace(commands, points, color, camera, stroke = false) {
  const centre = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length, z: total.z + point.z / points.length }), { x: 0, y: 0, z: 0 });
  const depth = cameraPoint(centre, camera).z;
  if (depth < -200 || depth > 15500) return;
  commands.push({ kind: 'face', points, color, depth, stroke });
}

function groundQuad(commands, left, right, start, end, elevation, color, camera) {
  for (let positionZ = start; positionZ < end; positionZ += 64) {
    const far = Math.min(end, positionZ + 64);
    const previousCount = commands.length;
    addFace(commands, [{ x: left, y: elevation, z: positionZ }, { x: right, y: elevation, z: positionZ }, { x: right, y: elevation, z: far }, { x: left, y: elevation, z: far }], color, camera, true);
    if (commands.length > previousCount) commands[commands.length - 1].depth -= 180 + (elevation - RUNWAY.elevation) * 260;
  }
}

function box(commands, positionX, positionY, positionZ, width, height, length, colors, camera) {
  const left = positionX - width / 2;
  const right = positionX + width / 2;
  const near = positionZ - length / 2;
  const far = positionZ + length / 2;
  const top = positionY + height;
  addFace(commands, [{ x: left, y: positionY, z: near }, { x: right, y: positionY, z: near }, { x: right, y: top, z: near }, { x: left, y: top, z: near }], colors[0], camera);
  addFace(commands, [{ x: right, y: positionY, z: near }, { x: right, y: positionY, z: far }, { x: right, y: top, z: far }, { x: right, y: top, z: near }], colors[1], camera);
  addFace(commands, [{ x: left, y: positionY, z: far }, { x: left, y: positionY, z: near }, { x: left, y: top, z: near }, { x: left, y: top, z: far }], colors[1], camera);
  addFace(commands, [{ x: left, y: top, z: near }, { x: right, y: top, z: near }, { x: right, y: top, z: far }, { x: left, y: top, z: far }], colors[2], camera);
}

function runwayCommands(commands, camera) {
  const height = RUNWAY.elevation + 0.7;
  groundQuad(commands, -49, 49, RUNWAY.threshold - 12, RUNWAY.end + 12, height - 0.3, '#bdbb87', camera);
  groundQuad(commands, -38, 38, RUNWAY.threshold, RUNWAY.end, height, '#354b50', camera);
  for (const positionX of [-35, 35]) groundQuad(commands, positionX - 0.7, positionX + 0.7, RUNWAY.threshold + 5, RUNWAY.end - 5, height + 0.08, '#ebeed5', camera);
  for (let positionZ = RUNWAY.threshold + 140; positionZ < RUNWAY.end - 80; positionZ += 94) groundQuad(commands, -1.3, 1.3, positionZ, positionZ + 40, height + 0.1, '#faf1cc', camera);
  for (let index = 0; index < 4; index += 1) {
    for (const side of [-1, 1]) {
      const positionX = side * (8 + index * 7);
      groundQuad(commands, positionX - 2, positionX + 2, RUNWAY.threshold + 15, RUNWAY.threshold + 59, height + 0.11, '#fff4d5', camera);
    }
  }
  for (const side of [-1, 1]) groundQuad(commands, side * 24 - 4, side * 24 + 4, RUNWAY.threshold + 235, RUNWAY.threshold + 300, height + 0.11, '#fff4d5', camera);
  groundQuad(commands, -130, -42, 5580, 5745, height - 0.2, '#919e83', camera);
  groundQuad(commands, -124, -117, 5580, 5745, height + 0.05, '#edca6d', camera);
  const number = project({ x: 0, y: height + 0.1, z: RUNWAY.threshold + 105 }, camera);
  if (number.depth > 20) commands.push({ kind: 'runwayNumber', point: number, depth: number.depth - 410 });
  for (let positionZ = RUNWAY.threshold; positionZ < RUNWAY.end; positionZ += 80) {
    for (const positionX of [-42, 42]) {
      const point = project({ x: positionX, y: height + 1, z: positionZ }, camera);
      if (point.depth > 20) commands.push({ kind: 'light', point, depth: point.depth - 410, color: positionZ === RUNWAY.threshold ? '#83efb7' : '#fff0b1' });
    }
  }
}

function drawPalm(context, palm, camera) {
  const base = project(palm, camera);
  const head = project({ x: palm.x + palm.lean, y: palm.y + palm.height, z: palm.z }, camera);
  if (base.depth < 25 || base.x < -150 || base.x > 1430 || head.y > 900 || base.scale < 0.045) return;
  context.strokeStyle = '#735a3f';
  context.lineWidth = Math.max(1, base.scale * 3.1);
  context.beginPath();
  context.moveTo(base.x, base.y);
  context.quadraticCurveTo(base.x + palm.lean * base.scale * 0.2, head.y + palm.height * base.scale * 0.3, head.x, head.y);
  context.stroke();
  for (let leaf = 0; leaf < 6; leaf += 1) {
    const angle = leaf / 6 * TAU + palm.phase;
    const tip = project({ x: palm.x + palm.lean + Math.cos(angle) * 27, y: palm.y + palm.height - 8, z: palm.z + Math.sin(angle) * 25 }, camera);
    const bendX = mix(head.x, tip.x, 0.48);
    const bendY = Math.min(head.y, tip.y) - 7 * base.scale;
    context.beginPath();
    context.moveTo(head.x, head.y);
    context.quadraticCurveTo(bendX, bendY - 2 * base.scale, tip.x, tip.y);
    context.quadraticCurveTo(bendX, bendY + 5 * base.scale, head.x, head.y + 2 * base.scale);
    context.fillStyle = leaf % 2 ? '#2f8258' : '#4d9b5d';
    context.fill();
  }
  context.fillStyle = '#a3b85f';
  context.beginPath();
  context.arc(head.x, head.y, Math.max(1, base.scale * 2.4), 0, TAU);
  context.fill();
}

function drawWindsock(context, prop, camera, elapsed) {
  const base = project(prop, camera);
  const top = project({ ...prop, y: prop.y + prop.height }, camera);
  line(context, [base, top], '#fff2cf', Math.max(1, base.scale * 2));
  const flutter = Math.sin(elapsed * 4) * 2;
  for (let index = 0; index < 5; index += 1) {
    const start = project({ x: prop.x + index * 6, y: prop.y + prop.height - index * 0.4 + flutter * index / 5, z: prop.z }, camera);
    const end = project({ x: prop.x + (index + 1) * 6, y: prop.y + prop.height - (index + 1) * 0.4 + flutter * (index + 1) / 5, z: prop.z }, camera);
    line(context, [start, end], index % 2 ? '#fff0cb' : '#f48654', Math.max(1, (7 - index) * base.scale));
  }
}

function drawGate(context, gate, camera, active, world) {
  const centre = project(gate, camera);
  if (centre.depth < 20 || centre.depth > 8500) return;
  const points = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = index / 72 * TAU;
    const point = project({ x: gate.x + Math.cos(angle) * gate.radius, y: gate.y + Math.sin(angle) * gate.radius, z: gate.z }, camera);
    points.push(point);
  }
  context.save();
  context.globalAlpha = active ? 1 : 0.43;
  context.shadowColor = '#ffc859';
  context.shadowBlur = active ? 19 : 5;
  line(context, points, '#f9b83c', active ? 8 : 3, true);
  context.shadowBlur = 0;
  line(context, points, '#fff1ae', active ? 2.2 : 1, true);
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * TAU;
    const point = project({ x: gate.x + Math.cos(angle) * gate.radius, y: gate.y + Math.sin(angle) * gate.radius, z: gate.z }, camera);
    context.fillStyle = '#fff9d5';
    context.beginPath();
    context.arc(point.x, point.y, active ? 3.7 : 1.8, 0, TAU);
    context.fill();
  }
  context.restore();
  if (world.missionIndex === 1) {
    const ground = project({ ...gate, y: 3 }, camera);
    context.setLineDash([5, 7]);
    line(context, [centre, ground], '#ffe0a077', 2);
    context.setLineDash([]);
    context.fillStyle = '#ffda71';
    const size = 10;
    polygon(context, [{ x: centre.x, y: centre.y - size }, { x: centre.x + size, y: centre.y }, { x: centre.x, y: centre.y + size }, { x: centre.x - size, y: centre.y }], '#ffda71');
  }
  if (active && centre.x > 80 && centre.x < 1200 && centre.y > 0 && centre.y < 700) {
    const positionY = clamp(centre.y - gate.radius * centre.scale - 25, 263, 600);
    const label = world.missionIndex === 1 ? gate.name.toUpperCase() : `GATE ${String(gate.index + 1).padStart(2, '0')}`;
    panel(context, centre.x - 62, positionY - 20, 124, 29, 0.88, '#ffdc8180', 7);
    text(context, label, centre.x, positionY, 12, COLORS.gold, 700, 'center', MONO);
  }
}

function terrainAndObjects(context, world, camera) {
  const commands = [];
  for (const island of world.islands) {
    const centreDepth = cameraPoint({ x: island.x, y: 0, z: island.z }, camera).z;
    if (centreDepth < -island.rz * 1.4 || centreDepth > 16000) continue;
    for (const face of island.faces) {
      const depth = cameraPoint(face.points[1], camera).z;
      addFace(commands, face.points, faceTint(face, depth), camera, true);
    }
    const outline = island.outline.map((point) => ({ ...point, y: 1.3 }));
    commands.push({ kind: 'coast', points: outline, depth: centreDepth - 0.1 });
  }
  runwayCommands(commands, camera);
  for (const prop of world.props) {
    const depth = cameraPoint(prop, camera).z;
    if (depth < 30 || depth > 8000) continue;
    if (prop.kind === 'palm' || prop.kind === 'windsock') commands.push({ kind: prop.kind, prop, depth });
    else if (prop.kind === 'house') {
      const size = prop.size;
      box(commands, prop.x, prop.y, prop.z, size, size * 0.56, size * 1.15, ['#f6dfad', '#cdbb91', '#eaa777'], camera);
      const ridge = { x: prop.x, y: prop.y + size * 0.98, z: prop.z };
      const roof = prop.color === 1 ? '#c76f48' : prop.color === 2 ? '#d3a355' : '#e38a5d';
      addFace(commands, [{ x: prop.x - size * 0.63, y: prop.y + size * 0.55, z: prop.z - size * 0.67 }, { x: prop.x + size * 0.63, y: prop.y + size * 0.55, z: prop.z - size * 0.67 }, { ...ridge, z: prop.z - size * 0.67 }], roof, camera);
      addFace(commands, [{ x: prop.x - size * 0.63, y: prop.y + size * 0.55, z: prop.z - size * 0.67 }, { ...ridge, z: prop.z - size * 0.67 }, { ...ridge, z: prop.z + size * 0.67 }, { x: prop.x - size * 0.63, y: prop.y + size * 0.55, z: prop.z + size * 0.67 }], '#be764f', camera);
      addFace(commands, [{ x: prop.x + size * 0.63, y: prop.y + size * 0.55, z: prop.z - size * 0.67 }, { ...ridge, z: prop.z - size * 0.67 }, { ...ridge, z: prop.z + size * 0.67 }, { x: prop.x + size * 0.63, y: prop.y + size * 0.55, z: prop.z + size * 0.67 }], roof, camera);
    } else if (prop.kind === 'beacon') {
      for (let level = 0; level < 4; level += 1) {
        const width = 15 - level * 1.6;
        const color = level % 2 ? '#f3ecd0' : '#ed9561';
        box(commands, prop.x, prop.y + level * 9, prop.z, width, 9, width, [color, level % 2 ? '#c9c9a8' : '#ce784a', '#f8d797'], camera);
      }
      box(commands, prop.x, prop.y + 36, prop.z, 17, 7, 17, ['#ffd07a', '#cda45b', '#fff1bc'], camera);
      const light = project({ x: prop.x, y: prop.y + 42, z: prop.z }, camera);
      commands.push({ kind: 'light', point: light, depth: depth - 24, color: '#ffe89b' });
    } else if (prop.kind === 'tower') {
      box(commands, prop.x, prop.y, prop.z, 20, 44, 20, ['#f0dfb4', '#cfccad', '#fff0cc'], camera);
      box(commands, prop.x, prop.y + 44, prop.z, 40, 16, 33, ['#276873', '#348592', '#edca80'], camera);
    } else if (prop.kind === 'hangar') box(commands, prop.x, prop.y, prop.z, 115, 29, 92, ['#b2c2b0', '#9cae9e', '#e9d8ab'], camera);
  }
  world.rings.forEach((gate, index) => {
    if (gate.cleared || index > world.state.nextRing + 3) return;
    commands.push({ kind: 'gate', gate, depth: cameraPoint(gate, camera).z, active: index === world.state.nextRing });
  });
  commands.sort((first, second) => second.depth - first.depth);
  for (const command of commands) {
    if (command.kind === 'face') {
      const points = projectPolygon(command.points, camera);
      if (points.length < 3 || points.every((point) => point.x < -10) || points.every((point) => point.x > 1290) || points.every((point) => point.y > 820)) continue;
      polygon(context, points, command.color, command.stroke);
    } else if (command.kind === 'palm') drawPalm(context, command.prop, camera);
    else if (command.kind === 'windsock') drawWindsock(context, command.prop, camera, world.state.elapsed);
    else if (command.kind === 'gate') drawGate(context, command.gate, camera, command.active, world);
    else if (command.kind === 'coast') {
      for (let index = 0; index < command.points.length; index += 1) {
        const first = project(command.points[index], camera);
        const second = project(command.points[(index + 1) % command.points.length], camera);
        if (first.depth > 30 && second.depth > 30) line(context, [first, second], '#fff2ce6b', 1.15);
      }
    } else if (command.kind === 'runwayNumber') {
      context.save();
      context.translate(command.point.x, command.point.y);
      context.scale(1, 0.52);
      text(context, '36', 0, 0, Math.min(120, 23 * command.point.scale), '#fff2d1', 900, 'center', MONO);
      context.restore();
    } else if (command.kind === 'light') {
      context.fillStyle = command.color;
      context.shadowColor = command.color;
      context.shadowBlur = 4;
      context.beginPath();
      context.arc(command.point.x, command.point.y, Math.max(0.9, command.point.scale * 1.3), 0, TAU);
      context.fill();
      context.shadowBlur = 0;
    }
  }
  for (const particle of world.state.particles) {
    const point = project(particle, camera);
    if (point.depth < 5) continue;
    context.globalAlpha = clamp(particle.life, 0, 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(point.x, point.y, (4 - particle.life) * point.scale * 3, 0, TAU);
    context.fill();
  }
  context.globalAlpha = 1;
}

function aircraft(context, world, camera) {
  const state = world.state;
  const faces = [];
  function planePoint(positionX, positionY, positionZ) {
    const rollX = positionX * Math.cos(state.roll) + positionY * Math.sin(state.roll);
    const rollY = -positionX * Math.sin(state.roll) + positionY * Math.cos(state.roll);
    const pitchY = rollY * Math.cos(state.pitch) + positionZ * Math.sin(state.pitch);
    const pitchZ = positionZ * Math.cos(state.pitch) - rollY * Math.sin(state.pitch);
    return { x: state.x + rollX * Math.cos(state.heading) + pitchZ * Math.sin(state.heading), y: state.y + pitchY, z: state.z - rollX * Math.sin(state.heading) + pitchZ * Math.cos(state.heading) };
  }
  function part(vertices, color) {
    addFace(faces, vertices.map(([positionX, positionY, positionZ]) => planePoint(positionX, positionY, positionZ)), state.crashed ? '#6b7770' : color, camera, true);
  }
  const shade = '#d7dabd';
  const cream = '#fff3d1';
  const orange = '#f5a34e';
  const teal = '#187d80';
  part([[-24, 0, -34], [-5, 1, -27], [5, 1, -27], [24, 0, -34], [24, 0, -40], [-24, 0, -40]], cream);
  part([[-24, 0, -38], [24, 0, -38], [24, 0, -41], [-24, 0, -41]], orange);
  part([[-54, 0, -7], [-9, 3, 11], [9, 3, 11], [54, 0, -7], [53, -1, -18], [10, 0, -10], [-10, 0, -10], [-53, -1, -18]], shade);
  part([[-54, 2, -6], [-9, 5, 12], [9, 5, 12], [54, 2, -6], [53, 2, -15], [10, 3, -7], [-10, 3, -7], [-53, 2, -15]], cream);
  for (const side of [-1, 1]) {
    part([[side * 45, 2.2, -3], [side * 54, 2.2, -6], [side * 53, 2.2, -15], [side * 44, 2.2, -13]], orange);
    part([[side * 34, 3.1, 1], [side * 39, 2.9, -1], [side * 38, 2.9, -12], [side * 33, 3.1, -11]], teal);
  }
  const stations = [[-43, 1.7, 3], [-25, 4, 5], [-6, 7, 8], [17, 7, 10], [34, 5, 6], [42, 2.8, 4]];
  for (let index = 0; index < stations.length - 1; index += 1) {
    const [nearZ, nearWidth, nearHeight] = stations[index];
    const [farZ, farWidth, farHeight] = stations[index + 1];
    part([[-nearWidth, 0, nearZ], [-farWidth, 0, farZ], [0, farHeight, farZ], [0, nearHeight, nearZ]], index > 2 ? '#f5e4bb' : '#f8eac7');
    part([[nearWidth, 0, nearZ], [farWidth, 0, farZ], [0, farHeight, farZ], [0, nearHeight, nearZ]], cream);
    part([[-nearWidth, 0, nearZ], [nearWidth, 0, nearZ], [farWidth, 0, farZ], [-farWidth, 0, farZ]], '#a5bba9');
  }
  part([[-5.7, 6, -2], [-5, 10, 18], [0, 15, 20], [0, 16, 2]], '#19536a');
  part([[5.7, 6, -2], [5, 10, 18], [0, 15, 20], [0, 16, 2]], '#347e8b');
  part([[-5.7, 6, -2], [0, 16, 2], [5.7, 6, -2], [0, 8, -8]], '#183e53');
  part([[-5, 10, 18], [0, 15, 20], [5, 10, 18], [0, 8, 25]], '#77c3c2');
  part([[-1, 2, -40], [-1, 27, -39], [-1, 26, -31], [-1, 6, -22]], orange);
  part([[1, 2, -40], [1, 27, -39], [1, 26, -31], [1, 6, -22]], '#fbc16c');
  part([[-1.2, 13, -39], [-1.2, 20, -39], [-1.2, 19, -32], [-1.2, 12, -28]], teal);
  for (const side of [-1, 1]) {
    const wheel = planePoint(side * 12, -8, 1);
    const strut = planePoint(side * 5, 0, 5);
    const point = project(wheel, camera);
    line(context, [project(strut, camera), point], '#344b4d', 2.5);
    context.fillStyle = '#203b40';
    context.beginPath();
    context.ellipse(point.x, point.y, 2.8 * point.scale, 4.7 * point.scale, -state.roll * 0.5, 0, TAU);
    context.fill();
  }
  faces.sort((first, second) => second.depth - first.depth);
  for (const face of faces) polygon(context, projectPolygon(face.points, camera), face.color, true);
  for (const side of [-1, 1]) {
    const light = project(planePoint(side * 53.5, 2.5, -8), camera);
    context.shadowColor = side < 0 ? '#ff8d72' : '#9dffbf';
    context.shadowBlur = 10;
    context.fillStyle = context.shadowColor;
    context.beginPath();
    context.arc(light.x, light.y, 2.6, 0, TAU);
    context.fill();
  }
  context.shadowBlur = 0;
  const stripe = [[0, 8.7, -22], [0, 9, -8], [0, 16.3, 2], [0, 15.3, 19]].map((point) => project(planePoint(...point), camera));
  line(context, stripe, '#fff5d6', 1.1);
  for (const side of [-1, 1]) {
    const seam = [[side * 13, 4, -4], [side * 44, 2.3, -11]].map((point) => project(planePoint(...point), camera));
    line(context, seam, '#9caa9290', 1);
  }
  const label = project(planePoint(-23, 4.2, -4), camera);
  context.save();
  context.translate(label.x, label.y);
  context.rotate(state.roll * 0.6 - 0.08);
  text(context, 'C — 01', 0, 0, 12, '#246f72', 800, 'center', MONO);
  context.restore();
  if (!state.crashed) {
    const propeller = [];
    for (let index = 0; index <= 32; index += 1) {
      const angle = index / 32 * TAU;
      propeller.push(project(planePoint(Math.cos(angle) * 15, 4 + Math.sin(angle) * 15, 44), camera));
    }
    line(context, propeller, '#fff5cc4f', 2, true);
    const angle = state.elapsed * (18 + state.throttle * 60);
    line(context, [project(planePoint(Math.cos(angle) * 14, 4 + Math.sin(angle) * 14, 44), camera), project(planePoint(-Math.cos(angle) * 14, 4 - Math.sin(angle) * 14, 44), camera)], '#fff2bd85', 4);
  }
  if (state.speed > 55 && !state.landed) {
    for (const side of [-1, 1]) {
      const trail = [0, 1, 2, 3].map((index) => project(planePoint(side * (53 + index * 0.5), 1 - index, -14 - index * 23), camera));
      line(context, trail, '#c9f4e733', 1.2);
    }
  }
}

function emblem(context, positionX, positionY, scale = 1, color = COLORS.gold) {
  context.save();
  context.translate(positionX, positionY);
  context.scale(scale, scale);
  line(context, [{ x: -17, y: -7 }, { x: -5, y: -1 }, { x: 0, y: 7 }, { x: 5, y: -1 }, { x: 17, y: -7 }], color, 2.5);
  line(context, [{ x: -13, y: 1 }, { x: -4, y: 5 }, { x: 0, y: 12 }, { x: 4, y: 5 }, { x: 13, y: 1 }], color, 1.5);
  context.restore();
}

function hotspot(app, positionX, positionY, width, height, action) {
  app.hotspots.push({ x: positionX, y: positionY, width, height, action });
}

function button(context, app, label, positionX, positionY, width, action, gold = true, height = 49) {
  const hovered = app.pointer && app.pointer.x >= positionX && app.pointer.x <= positionX + width && app.pointer.y >= positionY && app.pointer.y <= positionY + height;
  rounded(context, positionX, positionY, width, height, 10);
  context.fillStyle = gold ? hovered ? '#ffe2a0' : COLORS.gold : hovered ? '#1c5260' : '#173e4a';
  context.fill();
  context.strokeStyle = gold ? '#ffe7a8' : '#8bcab255';
  context.lineWidth = 1;
  context.stroke();
  text(context, label, positionX + 19, positionY + height / 2 + 6, 16, gold ? COLORS.ink : COLORS.cream, 750);
  text(context, '→', positionX + width - 23, positionY + height / 2 + 6, 23, gold ? COLORS.ink : COLORS.gold, 500, 'center');
  hotspot(app, positionX, positionY, width, height, action);
}

function stat(context, label, value, unit, positionX, positionY, width = 143) {
  panel(context, positionX, positionY, width, 68, 0.83, '#daedca28', 10);
  text(context, label, positionX + 14, positionY + 20, 10, COLORS.muted, 600, 'left', MONO);
  context.save();
  context.shadowColor = COLORS.mint;
  context.shadowBlur = 8;
  text(context, value, positionX + 13, positionY + 49, 28, COLORS.cream, 700, 'left', MONO);
  context.restore();
  text(context, unit, positionX + width - 12, positionY + 48, 11, COLORS.mint, 600, 'right', MONO);
}

function compass(context, heading) {
  const positionX = 620;
  const positionY = 95;
  const width = 367;
  panel(context, positionX, positionY, width, 49, 0.82, '#daedca28', 9);
  context.save();
  rounded(context, positionX + 5, positionY + 2, width - 10, 44, 7);
  context.clip();
  const centre = positionX + width / 2;
  const degrees = heading * 180 / Math.PI;
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let marker = Math.floor((degrees - 70) / 5) * 5; marker < degrees + 70; marker += 5) {
    const markerX = centre + (marker - degrees) * 3.5;
    const normalized = (marker % 360 + 360) % 360;
    context.fillStyle = normalized % 45 === 0 ? COLORS.gold : '#8ac6bf';
    context.fillRect(markerX, positionY + 31, 1, normalized % 15 === 0 ? 12 : 6);
    if (normalized % 45 === 0) text(context, cardinals[normalized / 45], markerX, positionY + 23, 13, COLORS.mint, 700, 'center', MONO);
    else if (normalized % 15 === 0) text(context, String(normalized).padStart(3, '0'), markerX, positionY + 23, 10, '#a8cebc', 500, 'center', MONO);
  }
  context.restore();
  polygon(context, [{ x: positionX + width / 2 - 5, y: positionY + 1 }, { x: positionX + width / 2 + 5, y: positionY + 1 }, { x: positionX + width / 2, y: positionY + 8 }], COLORS.gold);
}

function artificialHorizon(context, state, centreX, centreY, radius) {
  context.save();
  context.beginPath();
  context.arc(centreX, centreY, radius, 0, TAU);
  context.clip();
  context.translate(centreX, centreY);
  context.rotate(-state.roll);
  context.translate(0, state.pitch * 145);
  context.fillStyle = '#389cc0';
  context.fillRect(-100, -150, 200, 150);
  context.fillStyle = '#966b48';
  context.fillRect(-100, 0, 200, 150);
  line(context, [{ x: -100, y: 0 }, { x: 100, y: 0 }], '#c4edcf', 1.6);
  for (let mark = -3; mark <= 3; mark += 1) {
    if (mark === 0) continue;
    const width = Math.abs(mark) % 2 ? 10 : 19;
    line(context, [{ x: -width, y: mark * 14 }, { x: width, y: mark * 14 }], '#e4f2d4a6', 1);
  }
  context.restore();
  context.strokeStyle = '#83edce99';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centreX, centreY, radius, 0, TAU);
  context.stroke();
  context.strokeStyle = '#193f49';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(centreX, centreY, radius + 4, 0, TAU);
  context.stroke();
  line(context, [{ x: centreX - 27, y: centreY }, { x: centreX - 8, y: centreY }, { x: centreX, y: centreY + 5 }, { x: centreX + 8, y: centreY }, { x: centreX + 27, y: centreY }], COLORS.gold, 3);
  polygon(context, [{ x: centreX - 4, y: centreY - radius + 3 }, { x: centreX + 4, y: centreY - radius + 3 }, { x: centreX, y: centreY - radius + 9 }], COLORS.gold);
}

function instrumentTape(context, positionX, positionY, value, step, label, unit) {
  context.save();
  rounded(context, positionX, positionY, 99, 74, 6);
  context.clip();
  context.fillStyle = '#092b36';
  context.fillRect(positionX, positionY, 99, 74);
  for (let marker = Math.floor(value / step - 3); marker <= Math.ceil(value / step + 3); marker += 1) {
    if (marker < 0) continue;
    const markerY = positionY + 37 + (value - marker * step) / step * 21;
    text(context, String(marker * step).padStart(3, '0'), positionX + 41, markerY + 4, 12, '#90cabb', 500, 'right', MONO);
    line(context, [{ x: positionX + 48, y: markerY }, { x: positionX + 60, y: markerY }], '#88cbb6', 1);
  }
  context.fillStyle = '#1a4b50';
  context.fillRect(positionX + 3, positionY + 24, 91, 26);
  context.strokeStyle = '#99e8c7';
  context.strokeRect(positionX + 3, positionY + 24, 91, 26);
  text(context, Math.round(value).toString().padStart(3, '0'), positionX + 48, positionY + 43, 20, COLORS.mint, 700, 'center', MONO);
  text(context, unit, positionX + 87, positionY + 41, 9, COLORS.muted, 500, 'right', MONO);
  context.restore();
  text(context, label, positionX + 49, positionY - 7, 9, COLORS.muted, 600, 'center', MONO);
}

function instruments(context, state) {
  panel(context, 426, 666, 428, 105, 0.94, '#83edce55', 16);
  instrumentTape(context, 446, 687, state.speed * 1.94384, 10, 'AIRSPEED', 'KT');
  artificialHorizon(context, state, 640, 720, 41);
  instrumentTape(context, 735, 687, state.y, 25, 'ALTIMETER', 'M');
  text(context, 'CENDRAWASIH–1', 640, 780, 9, '#d4e5bd', 500, 'center', MONO);
  text(context, '−', 562, 726, 14, COLORS.mint, 700, 'center');
  text(context, '+', 718, 726, 14, COLORS.mint, 700, 'center');
}

function fuelAndAirframe(context, world, title) {
  const state = world.state;
  const positionX = title ? 875 : 32;
  const width = title ? 158 : 223;
  panel(context, positionX, 666, width, 105, 0.91, '#83edce3b', 12);
  text(context, 'FUEL', positionX + 13, 687, 10, COLORS.muted, 600, 'left', MONO);
  text(context, `${Math.ceil(state.fuel)}%`, positionX + width - 13, 687, 12, state.fuel < 20 ? COLORS.coral : COLORS.mint, 700, 'right', MONO);
  context.fillStyle = '#214d54';
  context.fillRect(positionX + 13, 696, width - 26, 5);
  context.fillStyle = state.fuel < 20 ? COLORS.coral : COLORS.mint;
  context.shadowColor = context.fillStyle;
  context.shadowBlur = 6;
  context.fillRect(positionX + 13, 696, (width - 26) * state.fuel / 100, 5);
  context.shadowBlur = 0;
  text(context, `THR ${Math.round(state.throttle * 100)}%`, positionX + 13, 721, 11, COLORS.cream, 600, 'left', MONO);
  text(context, `${100 - Math.round(state.damage)}% HULL`, positionX + 13, 743, 10, state.damage > 50 ? COLORS.coral : COLORS.muted, 600, 'left', MONO);
  if (!title) {
    text(context, state.brake ? 'BRAKE ON' : 'ENGINE ON', positionX + width - 13, 721, 10, state.brake ? COLORS.gold : COLORS.mint, 500, 'right', MONO);
    text(context, state.verticalSpeed >= 0 ? `↑ ${state.verticalSpeed.toFixed(1)} M/S` : `↓ ${Math.abs(state.verticalSpeed).toFixed(1)} M/S`, positionX + width - 13, 743, 10, COLORS.muted, 500, 'right', MONO);
  }
}

function navigationMap(context, world) {
  const positionX = 1055;
  const positionY = 575;
  const width = 193;
  const height = 196;
  panel(context, positionX, positionY, width, height, 0.91, '#9fdbc145', 13);
  text(context, 'SEROJA CHART', positionX + 13, positionY + 22, 10, COLORS.muted, 600, 'left', MONO);
  text(context, 'N ↑', positionX + width - 13, positionY + 22, 10, COLORS.gold, 700, 'right', MONO);
  const chart = (position) => ({ x: positionX + width / 2 + position.x * 0.025, y: positionY + height - 14 - (position.z - 100) * 0.022 });
  context.save();
  rounded(context, positionX + 4, positionY + 29, width - 8, height - 34, 10);
  context.clip();
  context.strokeStyle = '#7fc9be11';
  context.lineWidth = 1;
  for (let index = 0; index < 6; index += 1) {
    context.beginPath();
    context.moveTo(positionX, positionY + 35 + index * 30);
    context.lineTo(positionX + width, positionY + 35 + index * 30);
    context.stroke();
  }
  for (const island of world.islands) polygon(context, island.outline.map(chart), '#3e7562', false);
  const runwayStart = chart({ x: 0, z: RUNWAY.threshold });
  const runwayEnd = chart({ x: 0, z: RUNWAY.end });
  line(context, [runwayStart, runwayEnd], '#f2e0b3', 3);
  const route = world.rings.map(chart);
  context.setLineDash([2, 4]);
  line(context, [...route, runwayStart], '#edc56a70', 1);
  context.setLineDash([]);
  world.rings.forEach((gate, index) => {
    const point = chart(gate);
    context.beginPath();
    context.arc(point.x, point.y, index === world.state.nextRing ? 4.2 : 2.4, 0, TAU);
    context.strokeStyle = gate.cleared ? '#83edce88' : COLORS.gold;
    context.lineWidth = 1.4;
    context.stroke();
  });
  const aircraftPoint = chart(world.state);
  context.save();
  context.translate(aircraftPoint.x, aircraftPoint.y);
  context.rotate(world.state.heading);
  polygon(context, [{ x: 0, y: -7 }, { x: 5, y: 6 }, { x: 0, y: 3 }, { x: -5, y: 6 }], COLORS.cream);
  context.restore();
  context.restore();
}

function flightHUD(context, world, app) {
  const state = world.state;
  panel(context, 32, 24, 1216, 53, 0.93, '#dbe8b333', 12);
  emblem(context, 62, 47, 0.83);
  text(context, 'NUSA', 88, 49, 19, COLORS.cream, 850);
  text(context, 'AIR RALLY', 150, 49, 11, COLORS.muted, 600, 'left', MONO);
  context.fillStyle = '#a6d5bb33';
  context.fillRect(266, 38, 1, 23);
  text(context, `SORTIE ${world.mission.number}`, 286, 46, 10, COLORS.muted, 600, 'left', MONO);
  text(context, world.mission.title.toUpperCase(), 398, 49, 14, world.mission.accent, 750);
  text(context, 'SCORE', 926, 42, 9, COLORS.muted, 600, 'right', MONO);
  text(context, state.score.toLocaleString('en-US').padStart(5, '0'), 926, 62, 18, COLORS.cream, 700, 'right', MONO);
  text(context, 'TIME LEFT', 1020, 43, 9, COLORS.muted, 600, 'left', MONO);
  text(context, clock(state.remaining), 1160, 57, 26, state.remaining < 30 ? COLORS.coral : COLORS.gold, 750, 'right', MONO);
  const terminalScreen = ['landed', 'crashed', 'gameover'].includes(app.screen);
  if (app.screen === 'title' || app.screen === 'briefing' || terminalScreen) text(context, app.screen === 'title' ? '?' : app.screen === 'briefing' ? '←' : 'R', 1218, 56, 22, COLORS.cream, 600, 'center', MONO);
  else if (app.screen === 'paused') polygon(context, [{ x: 1212, y: 39 }, { x: 1212, y: 58 }, { x: 1227, y: 48.5 }], COLORS.cream);
  else {
    context.fillStyle = COLORS.cream;
    context.fillRect(1210, 40, 4, 17);
    context.fillRect(1221, 40, 4, 17);
  }
  hotspot(app, 1191, 25, 56, 51, app.screen === 'title' ? 'briefing' : app.screen === 'briefing' ? 'title' : terminalScreen ? 'restart' : 'pause');
  stat(context, 'ALTITUDE', Math.round(state.y).toString().padStart(3, '0'), 'M', 32, 95);
  stat(context, 'AIRSPEED', Math.round(state.speed * 1.94384).toString().padStart(3, '0'), 'KT', 188, 95);
  stat(context, 'HEADING', String(headingDegrees(state.heading)).padStart(3, '0'), '°', 344, 95);
  compass(context, state.heading);
  panel(context, 1010, 95, 238, 68, 0.85, '#daedca28', 10);
  const noun = world.missionIndex === 1 ? 'BEACONS' : world.missionIndex === 2 ? 'APPROACH GATES' : 'GOLDEN RINGS';
  text(context, noun, 1024, 116, 10, COLORS.muted, 600, 'left', MONO);
  text(context, `${String(state.nextRing).padStart(2, '0')} / ${String(world.rings.length).padStart(2, '0')}`, 1023, 145, 26, COLORS.gold, 700, 'left', MONO);
  text(context, world.missionIndex === 2 ? 'LAND 36' : 'THEN LAND', 1235, 145, 10, COLORS.mint, 600, 'right', MONO);
  instruments(context, state);
  fuelAndAirframe(context, world, ['title', 'briefing'].includes(app.screen));
  navigationMap(context, world);
  if (app.screen === 'play') {
    const target = nextTarget(world);
    const range = Math.hypot(target.x - state.x, target.z - state.z);
    const bearing = angleDelta(Math.atan2(target.x - state.x, target.z - state.z) - state.heading);
    const approaching = state.nextRing >= world.rings.length;
    const label = approaching ? 'SEROJA · RUNWAY 36' : world.missionIndex === 1 ? target.name.toUpperCase() : `NEXT GATE ${String(state.nextRing + 1).padStart(2, '0')}`;
    panel(context, 492, 179, 340, 50, 0.86, '#ffcf674d', 10);
    context.save();
    context.translate(518, 202);
    context.rotate(clamp(bearing, -1.5, 1.5));
    polygon(context, [{ x: 0, y: -10 }, { x: 7, y: 8 }, { x: 0, y: 4 }, { x: -7, y: 8 }], COLORS.gold);
    context.restore();
    text(context, label, 546, 201, 11, COLORS.gold, 700, 'left', MONO);
    text(context, `${Math.round(range)} M  ·  ${approaching ? 'BRAKE < 91 KT' : Math.round(target.y) + ' M ALT'}`, 546, 218, 10, COLORS.cream, 500, 'left', MONO);
    if (state.noticeTime > 0) {
      const labelWidth = Math.min(430, state.notice.length * 7 + 36);
      panel(context, 32, 184, labelWidth, 34, 0.88, '#83edce40', 9);
      text(context, state.notice, 47, 206, state.notice.length > 56 ? 10 : 11, COLORS.cream, 500, 'left', MONO);
    }
    if (approaching) {
      panel(context, 32, 545, 223, 96, 0.9, '#ffcf6766', 12);
      text(context, 'LANDING CHECKLIST', 47, 567, 11, COLORS.gold, 700, 'left', MONO);
      text(context, `${state.speed < 47 ? 'OK' : '--'} AIRSPEED BELOW 91 KT`, 47, 589, 10, state.speed < 47 ? COLORS.mint : COLORS.cream, 500, 'left', MONO);
      text(context, `${Math.abs(state.roll) < 0.2 ? 'OK' : '--'} WINGS LEVEL · FLARE`, 47, 609, 10, COLORS.cream, 500, 'left', MONO);
      text(context, 'SPACE BRAKE / CTRL IDLE', 47, 628, 9, COLORS.muted, 500, 'left', MONO);
    }
    if (state.speed < 34) {
      panel(context, 521, 260, 238, 35, 0.94, COLORS.coral, 7);
      text(context, 'STALL · LOWER THE NOSE', 640, 282, 12, COLORS.coral, 700, 'center', MONO);
    }
    if (app.pointer && app.pointer.held) {
      context.setLineDash([3, 5]);
      line(context, [{ x: 640, y: 400 }, app.pointer], '#fff3cf70', 1);
      context.setLineDash([]);
      context.strokeStyle = COLORS.cream;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(app.pointer.x, app.pointer.y, 12, 0, TAU);
      context.stroke();
    }
  }
  text(context, 'WASD / ARROWS  FLY     SHIFT / CTRL  THROTTLE     SPACE  BRAKE     P  PAUSE', 32, 791, 9, '#d3e6c8', 500, 'left', MONO);
  text(context, app.muted ? 'M · SOUND OFF' : 'M · SOUND ON', 1246, 790, 10, COLORS.mint, 500, 'right', MONO);
  hotspot(app, 1145, 773, 103, 27, 'mute');
}

function titleScreen(context, world, app) {
  const shade = context.createLinearGradient(0, 0, 580, 0);
  shade.addColorStop(0, '#083544f2');
  shade.addColorStop(0.72, '#083544d4');
  shade.addColorStop(1, '#08354400');
  context.fillStyle = shade;
  context.fillRect(0, 177, 580, 535);
  text(context, 'SEROJA ARCHIPELAGO  /  06:20 LOCAL', 49, 209, 11, COLORS.mint, 600, 'left', MONO);
  text(context, 'NUSA', 43, 307, 106, COLORS.cream, 900);
  text(context, 'AIR RALLY', 48, 368, 54, COLORS.gold, 900);
  text(context, 'A little plane. A whole archipelago.', 51, 401, 18, COLORS.cream, 500);
  text(context, 'CHOOSE YOUR SORTIE', 51, 436, 10, COLORS.muted, 600, 'left', MONO);
  for (let index = 0; index < MISSIONS.length; index += 1) {
    const mission = MISSIONS[index];
    const positionY = 449 + index * 57;
    const selected = index === app.missionIndex;
    panel(context, 49, positionY, 355, 49, selected ? 0.96 : 0.78, selected ? COLORS.gold : '#9fd3b72e', 9);
    text(context, mission.number, 63, positionY + 29, 17, selected ? COLORS.gold : COLORS.muted, 600, 'left', MONO);
    text(context, mission.title, 101, positionY + 21, 16, selected ? COLORS.cream : '#c6d8c5', 700);
    text(context, index === 0 ? '8 RINGS  /  03:05  /  FULL TANK' : index === 1 ? '5 BEACONS  /  03:55  /  EXPLORE' : 'RUNWAY 36  /  01:55  /  LOW FUEL', 101, positionY + 38, 9, selected ? COLORS.mint : COLORS.muted, 500, 'left', MONO);
    if (selected) polygon(context, [{ x: 375, y: positionY + 21 }, { x: 389, y: positionY + 21 }, { x: 389, y: positionY + 34 }], COLORS.gold);
    hotspot(app, 49, positionY, 355, 49, `mission${index}`);
  }
  button(context, app, 'Fly this route', 49, 633, 355, 'briefing');
  text(context, '1–3 SELECT  ·  ENTER TO FLY  ·  HOLD MOUSE TO STEER', 51, 704, 9, '#c9dfc5', 500, 'left', MONO);
  panel(context, 924, 190, 324, 59, 0.76, '#fff2cf40', 10);
  emblem(context, 947, 213, 0.55, COLORS.mint);
  text(context, 'CENDRAWASIH–1', 970, 214, 12, COLORS.cream, 700, 'left', MONO);
  text(context, 'SINGLE ENGINE. ENDLESS BLUE.', 970, 233, 9, COLORS.muted, 500, 'left', MONO);
  if (app.best > 0) text(context, `SESSION BEST  ${app.best.toLocaleString('en-US')}`, 1245, 279, 11, COLORS.gold, 600, 'right', MONO);
}

function briefingScreen(context, world, app) {
  panel(context, 48, 192, 390, 436, 0.97, '#ffcf6770', 18);
  text(context, `FLIGHT PLAN  /  SORTIE ${world.mission.number}`, 72, 225, 11, COLORS.mint, 600, 'left', MONO);
  text(context, world.mission.title, 71, 273, 33, COLORS.cream, 800);
  const goals = world.missionIndex === 0 ? ['Thread eight golden rings in order.', 'Then follow the glide path to Seroja.'] : world.missionIndex === 1 ? ['Follow five island beacons in order.', 'A lighthouse tour with a runway finish.'] : ['Only a quarter tank. Make it count.', 'A gentle touchdown wins the big bonus.'];
  goals.forEach((content, index) => text(context, content, 73, 306 + index * 24, 14, '#cee3ca', 500));
  const instructions = [['W / ↑', 'Nose up'], ['S / ↓', 'Nose down'], ['A D / ← →', 'Bank and turn'], ['SHIFT / CTRL', 'Throttle up / down'], ['HOLD MOUSE', 'Steer toward the cursor'], ['SPACE', 'Airbrake for landing']];
  instructions.forEach(([key, label], index) => {
    text(context, key, 73, 374 + index * 27, 11, COLORS.gold, 700, 'left', MONO);
    text(context, label, 234, 374 + index * 27, 12, COLORS.cream, 500);
  });
  button(context, app, 'Clear for takeoff', 72, 556, 342, 'launch');
  text(context, 'ENTER TO LAUNCH  /  ESC TO GO BACK', 72, 619, 9, COLORS.muted, 500, 'left', MONO);
  hotspot(app, 48, 191, 390, 40, 'title');
}

function resultScreen(context, world, app) {
  const state = world.state;
  const success = state.success;
  const refueling = state.landed && !state.finished;
  const accent = success || refueling ? COLORS.mint : COLORS.coral;
  panel(context, 48, 190, 390, 443, 0.96, accent + '99', 18);
  text(context, refueling ? 'SEROJA GROUND CREW' : success ? 'SORTIE COMPLETE' : state.crashed ? 'AIRCRAFT LOST' : 'SORTIE ENDED', 73, 223, 11, accent, 700, 'left', MONO);
  text(context, refueling ? 'A fresh tank.' : success ? 'Home, sweet' : 'One more', 70, 277, 43, COLORS.cream, 850);
  text(context, refueling ? 'A new horizon.' : success ? 'island.' : 'flight?', 70, 324, 43, success ? COLORS.gold : COLORS.cream, 850);
  if (success) {
    text(context, state.score.toLocaleString('en-US'), 72, 388, 47, COLORS.gold, 750, 'left', MONO);
    text(context, 'SORTIE POINTS', 74, 409, 10, COLORS.muted, 600, 'left', MONO);
    const landing = state.landing;
    text(context, `CENTRE LINE    ${landing.offset.toFixed(1)} M`, 74, 444, 13, COLORS.mint, 600, 'left', MONO);
    text(context, `TOUCHDOWN      ${landing.sink.toFixed(1)} M/S`, 74, 469, 12, COLORS.cream, 500, 'left', MONO);
    text(context, `LANDING +${landing.bonus}  TIME +${landing.timeBonus}`, 74, 495, 11, COLORS.muted, 500, 'left', MONO);
    text(context, `SESSION BEST  ${Math.max(app.best, state.score).toLocaleString('en-US')}`, 74, 528, 11, COLORS.gold, 600, 'left', MONO);
  } else if (refueling) {
    text(context, 'Refueled to 100%. Airframe serviced.', 74, 375, 14, COLORS.mint, 500);
    text(context, 'Your route is not quite finished.', 74, 406, 14, COLORS.cream, 500);
    text(context, `${state.nextRing} / ${world.rings.length} CHECKPOINTS CLEARED`, 74, 450, 13, COLORS.gold, 600, 'left', MONO);
  } else {
    const words = state.failure.split(' ');
    let content = '';
    let positionY = 372;
    context.font = `500 14px ${FONT}`;
    for (const word of words) {
      if (context.measureText(content + word).width > 326) {
        text(context, content.trim(), 74, positionY, 14, '#d7e1c7', 500);
        positionY += 23;
        content = '';
      }
      content += word + ' ';
    }
    text(context, content.trim(), 74, positionY, 14, '#d7e1c7', 500);
    text(context, `${state.score.toLocaleString('en-US')} POINTS  /  ${state.nextRing} GATES`, 74, 478, 17, COLORS.gold, 700, 'left', MONO);
    text(context, 'A good pilot always flies again.', 74, 515, 13, COLORS.muted, 500);
  }
  button(context, app, refueling ? 'Back to the islands' : 'Fly another sortie', 72, 556, 342, refueling ? 'relaunch' : 'title');
  text(context, 'R RESTART  ·  ENTER CONTINUE', 74, 619, 10, COLORS.muted, 500, 'left', MONO);
}

function pausedScreen(context, world, app) {
  context.fillStyle = '#052c3a80';
  context.fillRect(0, 175, VIEW.width, 475);
  panel(context, 434, 255, 412, 315, 0.98, '#ffcf6770', 18);
  text(context, 'HOLDING PATTERN', 640, 292, 11, COLORS.mint, 600, 'center', MONO);
  text(context, 'Take a breath.', 640, 343, 37, COLORS.cream, 800, 'center');
  text(context, 'Your plane and the clock are paused.', 640, 380, 14, COLORS.muted, 500, 'center');
  button(context, app, 'Resume flight', 462, 412, 356, 'pause');
  button(context, app, 'Return to flight desk', 462, 476, 356, 'title', false);
  text(context, 'P / ESC RESUME   ·   R RESTART   ·   M SOUND', 640, 549, 10, COLORS.muted, 500, 'center', MONO);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d', { alpha: false });
  let pixelRatio = 1;
  function resize() {
    pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * pixelRatio);
    canvas.height = Math.round(window.innerHeight * pixelRatio);
  }
  window.addEventListener('resize', resize);
  resize();
  return {
    draw(world, app) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = '#082e3b';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
      context.setTransform(scale, 0, 0, scale, (canvas.width - VIEW.width * scale) / 2, (canvas.height - VIEW.height * scale) / 2);
      context.save();
      context.beginPath();
      context.rect(0, 0, VIEW.width, VIEW.height);
      context.clip();
      app.hotspots = [];
      const camera = cameraFor(world.state, app.screen);
      skyAndSea(context, world, camera);
      terrainAndObjects(context, world, camera);
      aircraft(context, world, camera);
      flightHUD(context, world, app);
      if (app.screen === 'title') titleScreen(context, world, app);
      else if (app.screen === 'briefing') briefingScreen(context, world, app);
      else if (app.screen === 'paused') pausedScreen(context, world, app);
      else if (['landed', 'crashed', 'gameover'].includes(app.screen)) resultScreen(context, world, app);
      context.restore();
      const hovered = app.pointer && app.hotspots.some((area) => app.pointer.x >= area.x && app.pointer.x <= area.x + area.width && app.pointer.y >= area.y && app.pointer.y <= area.y + area.height);
      canvas.style.cursor = hovered ? 'pointer' : app.screen === 'play' ? 'crosshair' : 'default';
    },
  };
}
