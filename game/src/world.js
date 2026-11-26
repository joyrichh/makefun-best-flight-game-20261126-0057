import { FLIGHT, RUNWAY, MISSIONS, TAU, clamp, mix, angleDelta } from './config.js';

export function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let number = value;
    number = Math.imul(number ^ number >>> 15, number | 1);
    number ^= number + Math.imul(number ^ number >>> 7, number | 61);
    return ((number ^ number >>> 14) >>> 0) / 4294967296;
  };
}

function islandShape(angle, phase) {
  return 1 + Math.sin(angle * 3 + phase) * 0.065 + Math.sin(angle * 7 - phase) * 0.035 + Math.cos(angle * 11 + phase) * 0.018;
}

export function islandHeight(island, positionX, positionZ) {
  const localX = (positionX - island.x) / island.rx;
  const localZ = (positionZ - island.z) / island.rz;
  const radius = Math.hypot(localX, localZ) / islandShape(Math.atan2(localZ, localX), island.phase);
  if (radius >= 1) return 0;
  let height = 3 + Math.pow(Math.max(0, 1 - radius), 1.6) * island.height;
  height += Math.max(0, 1 - radius) * Math.sin(localX * 8 + island.phase) * Math.cos(localZ * 6) * 22;
  if (island.airport) {
    const shoulder = clamp((Math.abs(positionX) - 210) / 370, 0, 1);
    height = mix(8, height, shoulder);
    if (radius > 0.9) height *= (1 - radius) / 0.1;
  }
  return Math.max(1.8, height);
}

function createIsland(random, description) {
  const island = { ...description, phase: random() * TAU };
  island.outline = [];
  island.faces = [];
  const bands = [0, 0.2, 0.4, 0.59, 0.76, 0.88, 0.955, 1, 1.065];
  const sectors = 36;
  const vertices = bands.map((radius, band) => Array.from({ length: sectors }, (_, sector) => {
    const angle = sector / sectors * TAU;
    const irregular = islandShape(angle, island.phase);
    const positionX = island.x + Math.cos(angle) * island.rx * radius * irregular;
    const positionZ = island.z + Math.sin(angle) * island.rz * radius * irregular;
    const positionY = band >= 7 ? 0.6 : band === 6 ? 2 : islandHeight(island, positionX, positionZ);
    return { x: positionX, y: positionY, z: positionZ };
  }));
  for (let band = 1; band < bands.length; band += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const next = (sector + 1) % sectors;
      const first = vertices[band - 1][sector];
      const second = vertices[band][sector];
      const third = vertices[band][next];
      const fourth = vertices[band - 1][next];
      const tint = random();
      island.faces.push({ points: [first, second, third], band, tint });
      if (band > 1) island.faces.push({ points: [first, third, fourth], band, tint: random() });
    }
  }
  island.outline = vertices[7];
  if (island.airport) {
    island.faces = [];
    const spacing = 90;
    const extentX = Math.ceil(island.rx * 1.15 / spacing);
    const extentZ = Math.ceil(island.rz * 1.15 / spacing);
    const pointAt = (gridX, gridZ) => {
      const positionX = island.x + gridX * spacing;
      const positionZ = island.z + gridZ * spacing;
      return { x: positionX, y: islandHeight(island, positionX, positionZ) || 0.6, z: positionZ };
    };
    for (let gridX = -extentX; gridX < extentX; gridX += 1) {
      for (let gridZ = -extentZ; gridZ < extentZ; gridZ += 1) {
        const first = pointAt(gridX, gridZ);
        const second = pointAt(gridX + 1, gridZ);
        const third = pointAt(gridX + 1, gridZ + 1);
        const fourth = pointAt(gridX, gridZ + 1);
        for (const points of [[first, second, third], [first, third, fourth]]) {
          const centreX = points.reduce((sum, point) => sum + point.x / 3, 0);
          const centreZ = points.reduce((sum, point) => sum + point.z / 3, 0);
          const localX = (centreX - island.x) / island.rx;
          const localZ = (centreZ - island.z) / island.rz;
          const radius = Math.hypot(localX, localZ) / islandShape(Math.atan2(localZ, localX), island.phase);
          if (radius > 1.055) continue;
          const band = radius > 0.99 ? 8 : radius > 0.94 ? 7 : radius > 0.86 ? 6 : radius > 0.74 ? 5 : 4;
          island.faces.push({ points, band, tint: random() });
        }
      }
    }
  }
  return island;
}

function routeFor(mission) {
  const coordinates = mission === 1
    ? [[-320, 300, 920], [620, 310, 1830], [-650, 345, 2800], [560, 295, 3710], [0, 235, 4520]]
    : mission === 2
      ? [[0, 172, 4090], [0, 102, 4630], [0, 46, 5020]]
      : [[-120, 290, 720], [150, 335, 1230], [-130, 375, 1760], [-340, 340, 2300], [20, 300, 2840], [320, 325, 3390], [170, 270, 3990], [0, 215, 4560]];
  return coordinates.map(([positionX, positionY, positionZ], index) => ({
    x: positionX, y: positionY, z: positionZ, radius: mission === 1 ? 112 : FLIGHT.ringRadius,
    heading: 0, index, cleared: false,
    name: mission === 1 ? ['Tanjung', 'Mutiara', 'Rimba', 'Pelangi', 'Seroja'][index] : `Gate ${index + 1}`,
  }));
}

export function createWorld(seed = 1, missionIndex = 0) {
  const random = seededRandom(seed);
  const descriptions = [
    { name: 'Tanjung', x: -700, z: 1050, rx: 720, rz: 840, height: 208 },
    { name: 'Mutiara', x: 940, z: 1970, rx: 690, rz: 840, height: 250 },
    { name: 'Rimba', x: -1020, z: 2810, rx: 850, rz: 1000, height: 310 },
    { name: 'Pelangi', x: 1100, z: 3650, rx: 700, rz: 850, height: 245 },
    { name: 'Seroja', x: 0, z: 5650, rx: 1130, rz: 1470, height: 310, airport: true },
    { name: 'Biru', x: -2360, z: 4500, rx: 780, rz: 1100, height: 250 },
    { name: 'Kemiri', x: 2550, z: 5600, rx: 770, rz: 1000, height: 350 },
    { name: 'Embun', x: -1900, z: 7600, rx: 950, rz: 1200, height: 410 },
    { name: 'Lontar', x: 700, z: 8950, rx: 1300, rz: 1250, height: 500 },
    { name: 'Sukun', x: 3250, z: 9300, rx: 1100, rz: 1600, height: 440 },
    { name: 'Karang', x: -2100, z: -950, rx: 1000, rz: 1200, height: 290 },
  ];
  const islands = descriptions.map((description) => createIsland(random, description));
  const props = [];
  for (const island of islands) {
    for (let index = 0; index < 82; index += 1) {
      const angle = random() * TAU;
      const radius = 0.35 + Math.sqrt(random()) * 0.58;
      const positionX = island.x + Math.cos(angle) * island.rx * radius;
      const positionZ = island.z + Math.sin(angle) * island.rz * radius;
      if (island.airport && Math.abs(positionX) < 250) continue;
      props.push({ kind: 'palm', x: positionX, y: islandHeight(island, positionX, positionZ), z: positionZ, height: 27 + random() * 21, lean: random() * 12 - 6, phase: random() * TAU });
    }
    for (let index = 0; index < 8; index += 1) {
      const positionX = island.x + island.rx * (0.3 + random() * 0.34);
      const positionZ = island.z + (random() - 0.5) * island.rz * 0.45;
      if (island.airport && Math.abs(positionX) < 200) continue;
      props.push({ kind: 'house', x: positionX, y: islandHeight(island, positionX, positionZ), z: positionZ, size: 20 + random() * 11, color: index % 3 });
    }
  }
  props.push({ kind: 'tower', x: -128, y: 8, z: 5570, height: 64 });
  props.push({ kind: 'hangar', x: -185, y: 8, z: 5710, size: 88 });
  props.push({ kind: 'windsock', x: 89, y: 8, z: 5240, height: 42 });
  const clouds = Array.from({ length: 30 }, () => ({ x: (random() - 0.5) * 18000, y: 950 + random() * 850, z: -1000 + random() * 18000, size: 240 + random() * 400, phase: random() }));
  const waves = Array.from({ length: 1400 }, () => ({ x: (random() - 0.5) * 17000, z: -1800 + random() * 16500, size: 5 + random() * 23, alpha: 0.08 + random() * 0.18 }));
  const world = { seed, missionIndex, mission: MISSIONS[missionIndex], islands, props, clouds, waves, runway: RUNWAY, rings: routeFor(missionIndex) };
  world.beacons = missionIndex === 1 ? world.rings.map((gate) => ({ kind: 'beacon', x: gate.x, y: terrainHeight(world, gate.x, gate.z), z: gate.z, height: 42, name: gate.name })) : [];
  world.props.push(...world.beacons);
  world.state = {
    x: missionIndex === 2 ? 0 : -200, y: missionIndex === 2 ? 220 : 272, z: missionIndex === 2 ? 3370 : 140,
    heading: missionIndex === 2 ? 0 : 0.07, roll: 0, pitch: 0, speed: missionIndex === 2 ? 65 : 76,
    throttle: missionIndex === 2 ? 0.43 : 0.66, verticalSpeed: 0, fuel: world.mission.fuel, damage: 0,
    elapsed: 0, remaining: world.mission.time, score: 0, nextRing: 0, streak: 0,
    events: [], particles: [], notice: 'Follow the gold. Bring her home.', noticeTime: 5,
    landed: false, crashed: false, finished: false, success: false, brake: false,
    landing: null, failure: '', previous: null, refuels: 0,
  };
  return world;
}

export function terrainHeight(world, positionX, positionZ) {
  let highest = 0;
  for (const island of world.islands) {
    if (Math.abs(positionX - island.x) < island.rx * 1.15 && Math.abs(positionZ - island.z) < island.rz * 1.15) highest = Math.max(highest, islandHeight(island, positionX, positionZ));
  }
  return highest;
}

export function nextTarget(world) {
  return world.rings[world.state.nextRing] || { x: 0, y: 35, z: RUNWAY.threshold + 80, radius: 60, name: 'Seroja runway' };
}

function notify(state, message, duration = 3) {
  state.notice = message;
  state.noticeTime = duration;
}

function emit(world, type, details = {}) {
  world.state.events.push({ type, ...details });
}

function crash(world, cause) {
  const state = world.state;
  state.crashed = true;
  state.finished = true;
  state.failure = cause;
  state.damage = 100;
  emit(world, 'crash');
  const random = seededRandom(world.seed + Math.round(state.elapsed * 100));
  for (let index = 0; index < 45; index += 1) state.particles.push({ x: state.x, y: state.y + 10, z: state.z, vx: (random() - 0.5) * 75, vy: random() * 80, vz: (random() - 0.5) * 75, life: 1 + random() * 2.5, color: index % 3 ? '#ffcf70' : '#253d42' });
}

function touchDown(world) {
  const state = world.state;
  const onRunway = Math.abs(state.x) <= RUNWAY.width / 2 && state.z >= RUNWAY.threshold && state.z <= RUNWAY.end;
  const aligned = Math.abs(angleDelta(state.heading)) < 0.32;
  if (!onRunway || !aligned || state.speed > FLIGHT.touchdownSpeed || state.verticalSpeed < -FLIGHT.touchdownSink || Math.abs(state.roll) > 0.31) {
    let cause = onRunway ? 'Approach too fast. Brake below 91 kt and keep the wings level.' : terrainHeight(world, state.x, state.z) > 1 ? 'Terrain strike. Keep an eye on your altitude tape.' : 'Ditching at sea. Aim for the marked Seroja runway.';
    if (onRunway && state.verticalSpeed < -FLIGHT.touchdownSink) cause = 'Hard landing. Flare gently before the wheels touch.';
    crash(world, cause);
    return;
  }
  const impact = Math.abs(state.verticalSpeed);
  state.damage = clamp(state.damage + Math.max(0, impact - 2.1) * 12 + Math.abs(state.roll) * 50, 0, 100);
  if (state.damage >= 100) {
    crash(world, 'The airframe could not take another hard touchdown.');
    return;
  }
  state.y = RUNWAY.elevation + FLIGHT.gearClearance;
  state.landed = true;
  state.roll = 0;
  state.pitch = 0;
  state.verticalSpeed = 0;
  state.landing = { offset: Math.abs(state.x), sink: impact, speed: state.speed, quality: clamp(1 - Math.abs(state.x) / 38, 0, 1) };
  state.fuel = 100;
  state.refuels += 1;
  const objectivesMet = world.missionIndex === 2 || state.nextRing === world.rings.length;
  if (objectivesMet) {
    const landingBonus = Math.round(world.mission.bonus * (0.5 + state.landing.quality * 0.5));
    const timeBonus = Math.round(state.remaining * 12);
    state.score += landingBonus + timeBonus;
    state.landing.bonus = landingBonus;
    state.landing.timeBonus = timeBonus;
    state.finished = true;
    state.success = true;
    notify(state, 'Welcome home, Cendrawasih-1.', 8);
  } else notify(state, 'Tank topped up. The islands are waiting.', 8);
  emit(world, 'land', { complete: objectivesMet });
}

function checkGates(world, previous) {
  const state = world.state;
  const gate = world.rings[state.nextRing];
  if (!gate) return;
  const oldDepth = previous.z - gate.z;
  const newDepth = state.z - gate.z;
  if (oldDepth <= 0 && newDepth >= 0) {
    const fraction = clamp(-oldDepth / Math.max(0.001, newDepth - oldDepth), 0, 1);
    const positionX = mix(previous.x, state.x, fraction);
    const positionY = mix(previous.y, state.y, fraction);
    if (Math.hypot(positionX - gate.x, positionY - gate.y) < gate.radius) {
      gate.cleared = true;
      state.nextRing += 1;
      state.streak += 1;
      const accuracy = 1 - Math.hypot(positionX - gate.x, positionY - gate.y) / gate.radius;
      const points = Math.round(450 + accuracy * 300 + Math.min(5, state.streak) * 50);
      state.score += points;
      notify(state, state.nextRing === world.rings.length ? 'All clear! Reduce throttle. Land at Seroja.' : `${world.missionIndex === 1 ? gate.name + ' visited' : 'Beautiful line'}  +${points}`, 3.2);
      emit(world, 'ring', { points });
    }
  }
  if (state.z > gate.z + 160 && state.nextRing === gate.index) {
    state.streak = 0;
    notify(state, 'Missed gate — circle around. Follow the bearing arrow.', 3);
  }
}

export function launchFromRunway(world) {
  const state = world.state;
  if (!state.landed || state.finished) return;
  state.landed = false;
  state.y = RUNWAY.elevation + FLIGHT.gearClearance + 8;
  state.speed = 53;
  state.throttle = 0.9;
  state.pitch = 0.12;
  state.damage = Math.max(0, state.damage - 20);
  notify(state, 'Back in the air. Turn back for your next gate.', 5);
}

export function stepWorld(world, controls, delta) {
  const state = world.state;
  state.events = [];
  state.elapsed += delta;
  state.noticeTime = Math.max(0, state.noticeTime - delta);
  for (const particle of state.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.z += particle.vz * delta;
    particle.vy -= 24 * delta;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
  if (state.crashed) return;
  if (state.landed) {
    state.speed = Math.max(0, state.speed - delta * 14);
    state.z = Math.min(RUNWAY.end - 12, state.z + state.speed * delta);
    return;
  }
  if (state.finished) return;
  state.remaining = Math.max(0, state.remaining - delta);
  const previous = { x: state.x, y: state.y, z: state.z };
  state.previous = previous;
  state.throttle = clamp(state.throttle + (controls.throttle || 0) * delta * 0.29, 0, 1);
  if (state.fuel <= 0) state.throttle = 0;
  state.brake = Boolean(controls.brake);
  const targetSpeed = (state.fuel > 0 ? 32 + state.throttle * 68 : 26) - (state.brake ? 27 : 0) - Math.sin(state.pitch) * 20;
  state.speed += (Math.max(22, targetSpeed) - state.speed) * delta * 0.43;
  state.roll = mix(state.roll, clamp(controls.roll || 0, -1, 1) * FLIGHT.maxBank, 1 - Math.exp(-delta * 3.2));
  state.pitch = mix(state.pitch, clamp(controls.pitch || 0, -1, 1) * FLIGHT.maxPitch, 1 - Math.exp(-delta * 2.8));
  const authority = clamp(state.speed / 58, 0.35, 1.2);
  state.heading = angleDelta(state.heading + Math.sin(state.roll) * delta * 0.41 * authority);
  const stallSink = state.speed < FLIGHT.stall ? (FLIGHT.stall - state.speed) * 1.25 : 0;
  state.verticalSpeed = Math.sin(state.pitch) * state.speed - stallSink - Math.abs(state.roll) * 0.9;
  state.x += Math.sin(state.heading) * state.speed * delta;
  state.z += Math.cos(state.heading) * state.speed * delta;
  state.y = Math.min(2100, state.y + state.verticalSpeed * delta);
  state.fuel = Math.max(0, state.fuel - delta * (FLIGHT.fuelRate + state.throttle * 0.14));
  if (state.fuel === 0 && !state.emptyWarning) {
    state.emptyWarning = true;
    notify(state, 'Fuel empty. Keep your speed up and glide to the strip.', 8);
  }
  checkGates(world, previous);
  const ground = terrainHeight(world, state.x, state.z);
  if (state.y <= ground + FLIGHT.gearClearance) touchDown(world);
  if (state.remaining === 0 && !state.finished) {
    state.finished = true;
    state.failure = 'Time is up. The route will still be here for another run.';
    emit(world, 'timeout');
  }
  if (Math.abs(state.x) > 15000 || state.z < -10000 || state.z > 23000) {
    state.finished = true;
    state.failure = 'Outside the rally airspace. Restart and follow the gold.';
    emit(world, 'timeout');
  }
}
