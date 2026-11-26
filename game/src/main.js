import { STEP } from './config.js';
import { createWorld, stepWorld, launchFromRunway } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot, autopilot } from './shots.js';

const canvas = document.querySelector('#flight');
const parameters = new URLSearchParams(window.location.search);
const seed = Number(parameters.get('seed') || 1) >>> 0;
const requestedShot = parameters.get('shot');
const audio = createAudio();
const renderer = createRenderer(canvas);
const app = { screen: 'title', missionIndex: 0, best: 0, muted: false, hotspots: [], pointer: null, screenTime: 0 };
let world = createWorld(seed, app.missionIndex);
let shotFrozen = Boolean(requestedShot);
let idleClock = 0;
let accumulator = 0;
let lastTime = 0;

function setScreen(screen) {
  app.screen = screen;
  app.screenTime = 0;
  input.clear();
}

function freshFlight() {
  world = createWorld(seed, app.missionIndex);
  accumulator = 0;
  shotFrozen = false;
  setScreen('play');
  audio.effect('click');
}

function action(name) {
  if (name === 'mute') {
    app.muted = audio.toggle();
    return;
  }
  if (name === 'blur') {
    if (app.screen === 'play' && !shotFrozen) setScreen('paused');
    return;
  }
  if (name.startsWith('mission') || name === 'nextMission') {
    if (!['title', 'briefing'].includes(app.screen)) return;
    app.missionIndex = name === 'nextMission' ? (app.missionIndex + 1) % 3 : Number(name.slice(-1));
    world = createWorld(seed, app.missionIndex);
    if (shotFrozen) {
      for (let frame = 0; frame < 210; frame += 1) stepWorld(world, autopilot(world), STEP);
    }
    audio.effect('click');
    return;
  }
  if (name === 'restart') {
    freshFlight();
    return;
  }
  if (name === 'title') {
    shotFrozen = false;
    world = createWorld(seed, app.missionIndex);
    setScreen('title');
    return;
  }
  if (name === 'pause') {
    if (app.screen === 'play') {
      shotFrozen = false;
      setScreen('paused');
    } else if (app.screen === 'paused') setScreen('play');
    else if (app.screen === 'briefing') setScreen('title');
    return;
  }
  if (name === 'briefing') {
    shotFrozen = false;
    setScreen('briefing');
    audio.effect('click');
    return;
  }
  if (name === 'launch') {
    freshFlight();
    return;
  }
  if (name === 'relaunch') {
    launchFromRunway(world);
    setScreen('play');
    return;
  }
  if (name === 'confirm') {
    if (app.screen === 'title') action('briefing');
    else if (app.screen === 'briefing') freshFlight();
    else if (app.screen === 'paused') setScreen('play');
    else if (app.screen === 'landed' && !world.state.finished) action('relaunch');
    else if (['gameover', 'crashed', 'landed'].includes(app.screen)) action('title');
  }
}

function click(positionX, positionY, down) {
  const area = [...app.hotspots].reverse().find((item) => positionX >= item.x && positionX <= item.x + item.width && positionY >= item.y && positionY <= item.y + item.height);
  if (down && !area && shotFrozen && app.screen === 'play') shotFrozen = false;
  if (!down && area) action(area.action);
}

const input = createInput(canvas, action, click, audio.unlock);
app.pointer = input.pointer;

if (requestedShot) {
  const staged = stageShot(requestedShot, seed);
  world = staged.world;
  app.screen = staged.screen;
  app.best = staged.best;
  document.documentElement.dataset.shot = staged.scene;
}

function events() {
  for (const event of world.state.events) {
    audio.effect(event.type);
    if (world.state.finished) app.best = Math.max(app.best, world.state.score);
    if (event.type === 'crash') setScreen('crashed');
    else if (event.type === 'timeout') setScreen('gameover');
    else if (event.type === 'land') {
      setScreen('landed');
    }
  }
}

function frame(timestamp) {
  const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.08) : 0;
  lastTime = timestamp;
  if (!shotFrozen) {
    app.screenTime += delta;
    accumulator += delta;
    while (accumulator >= STEP) {
      if (app.screen === 'play') {
        stepWorld(world, input.sample(), STEP);
        events();
      } else if (['landed', 'crashed'].includes(app.screen)) {
        stepWorld(world, {}, STEP);
        if (world.state.finished && app.screenTime > 2.5) setScreen('gameover');
      } else if (app.screen === 'title') {
        idleClock += STEP;
        stepWorld(world, autopilot(world), STEP);
        if (idleClock > 15 || world.state.finished) {
          world = createWorld(seed, app.missionIndex);
          idleClock = 0;
        }
      }
      accumulator -= STEP;
    }
  }
  audio.update(world.state, app.screen === 'play');
  renderer.draw(world, app);
  document.documentElement.dataset.screen = app.screen;
  requestAnimationFrame(frame);
}

renderer.draw(world, app);
document.documentElement.dataset.ready = 'true';
window.nusa = { get world() { return world; }, get screen() { return app.screen; }, action, get best() { return app.best; } };
requestAnimationFrame(frame);
