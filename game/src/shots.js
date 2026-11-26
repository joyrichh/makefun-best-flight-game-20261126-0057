import { STEP, FLIGHT, RUNWAY, clamp, angleDelta } from './config.js';
import { createWorld, nextTarget, stepWorld } from './world.js';

export function autopilot(world) {
  const state = world.state;
  const approaching = state.nextRing >= world.rings.length;
  const target = nextTarget(world);
  const distance = Math.hypot(target.x - state.x, target.z - state.z);
  const desiredHeading = approaching ? Math.atan2(-state.x * 1.7, Math.max(220, RUNWAY.threshold + 400 - state.z)) : Math.atan2(target.x - state.x, target.z - state.z);
  const headingError = angleDelta(desiredHeading - state.heading);
  let desiredAltitude = target.y;
  let verticalSpeed = (desiredAltitude - state.y) / Math.max(1.7, distance / state.speed) * 1.4;
  let desiredSpeed = 76;
  let brake = false;
  if (approaching) {
    const wheelAltitude = RUNWAY.elevation + FLIGHT.gearClearance;
    desiredAltitude = wheelAltitude + Math.max(0, RUNWAY.threshold + 230 - state.z) * 0.14;
    verticalSpeed = (desiredAltitude - state.y) * 0.55 - (state.z < RUNWAY.threshold + 200 ? state.speed * 0.115 : 0);
    if (state.z > RUNWAY.threshold + 160) verticalSpeed = (wheelAltitude - state.y) * 0.7 - 0.8;
    desiredSpeed = state.z < 4750 ? 58 : state.z < 5050 ? 44 : 37;
    brake = state.speed > desiredSpeed + 6 || state.z > 4960;
  }
  const wantedThrottle = clamp((desiredSpeed - 32 + (brake ? 27 : 0)) / 68, 0, 1);
  const pitch = Math.asin(clamp(verticalSpeed / Math.max(30, state.speed), -0.29, 0.29)) / FLIGHT.maxPitch;
  return {
    roll: clamp(headingError * 5 - state.roll * 0.45, -1, 1),
    pitch: clamp(pitch, -1, 1),
    throttle: clamp((wantedThrottle - state.throttle) * 9, -1, 1), brake,
  };
}

export function stageShot(name, seed = 1) {
  const scene = ['start', 'play', 'end', 'land'].includes(name) ? name : 'start';
  const world = createWorld(seed, 0);
  const frames = { start: 210, play: 3630, land: 4530, end: 5100 }[scene];
  for (let frame = 0; frame < frames; frame += 1) {
    stepWorld(world, autopilot(world), STEP);
  }
  return { world, screen: scene === 'start' ? 'title' : world.state.finished ? 'gameover' : 'play', scene, best: world.state.success ? world.state.score : 0 };
}
