import { VIEW, clamp } from './config.js';

export function createInput(canvas, onAction, onClick, onGesture) {
  const keys = new Set();
  const touch = new Set();
  const pointer = { x: VIEW.width / 2, y: VIEW.height / 2, held: false, moved: false, startX: 0, startY: 0 };
  const blocked = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'KeyM', 'KeyR', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Tab', 'Enter', 'Digit1', 'Digit2', 'Digit3'];
  function position(event) {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(bounds.width / VIEW.width, bounds.height / VIEW.height);
    pointer.x = (event.clientX - bounds.left - (bounds.width - VIEW.width * scale) / 2) / scale;
    pointer.y = (event.clientY - bounds.top - (bounds.height - VIEW.height * scale) / 2) / scale;
  }
  window.addEventListener('keydown', (event) => {
    if (blocked.includes(event.code)) event.preventDefault();
    onGesture();
    keys.add(event.code);
    if (event.repeat) return;
    const action = { KeyP: 'pause', Escape: 'pause', KeyM: 'mute', KeyR: 'restart', Enter: 'confirm', Digit1: 'mission0', Digit2: 'mission1', Digit3: 'mission2', Tab: 'nextMission' }[event.code];
    if (action) onAction(action);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.held = false;
    onAction('blur');
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    onGesture();
    position(event);
    pointer.held = true;
    pointer.moved = false;
    pointer.startX = pointer.x;
    pointer.startY = pointer.y;
    canvas.setPointerCapture(event.pointerId);
    onClick(pointer.x, pointer.y, true);
  });
  canvas.addEventListener('pointermove', (event) => {
    position(event);
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 8) pointer.moved = true;
  });
  canvas.addEventListener('pointerup', (event) => {
    position(event);
    pointer.held = false;
    if (!pointer.moved) onClick(pointer.x, pointer.y, false);
  });
  canvas.addEventListener('pointercancel', () => { pointer.held = false; });
  document.querySelectorAll('[data-control]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      onGesture();
      touch.add(button.dataset.control);
      button.setPointerCapture(event.pointerId);
    });
    const release = () => touch.delete(button.dataset.control);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => onAction(button.dataset.action)));
  return {
    pointer,
    sample() {
      let roll = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      let pitch = Number(keys.has('ArrowUp') || keys.has('KeyW')) - Number(keys.has('ArrowDown') || keys.has('KeyS'));
      if (pointer.held) {
        roll += clamp((pointer.x - VIEW.width / 2) / 290, -1, 1);
        pitch += clamp((VIEW.height / 2 - pointer.y) / 215, -1, 1);
      }
      return {
        roll: clamp(roll, -1, 1), pitch: clamp(pitch, -1, 1),
        throttle: Number(keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.has('faster')) - Number(keys.has('ControlLeft') || keys.has('ControlRight') || touch.has('slower')),
        brake: keys.has('Space') || touch.has('brake'),
      };
    },
    clear() { keys.clear(); pointer.held = false; touch.clear(); },
  };
}
