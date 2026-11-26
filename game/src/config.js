export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const TAU = Math.PI * 2;
export const FLIGHT = {
  cruise: 76,
  stall: 33,
  maxBank: 0.77,
  maxPitch: 0.31,
  fuelRate: 0.16,
  ringRadius: 83,
  touchdownSpeed: 47,
  touchdownSink: 6.8,
  gearClearance: 13,
};
export const RUNWAY = { x: 0, z: 5680, length: 1040, width: 76, elevation: 8, threshold: 5160, end: 6200 };
export const MISSIONS = [
  { id: 'rally', title: 'Ring Rally', number: '01', subtitle: 'Eight golden gates. One perfect return.', goal: 'Clear all 8 rings, then land at Seroja.', time: 185, fuel: 100, count: 8, accent: '#ffcc62', bonus: 1800 },
  { id: 'tour', title: 'Island Tour', number: '02', subtitle: 'Take the scenic route. Follow the light.', goal: 'Visit 5 island beacons in order, then land.', time: 235, fuel: 100, count: 5, accent: '#83edce', bonus: 2200 },
  { id: 'precision', title: 'Precision Landing', number: '03', subtitle: 'A short tank. A very thin centre line.', goal: 'Land gently and close to the runway centre line.', time: 115, fuel: 24, count: 3, accent: '#ffab84', bonus: 3000 },
];
export const COLORS = { ink: '#082e3b', panel: '#0a3542', cream: '#fff4d5', gold: '#ffce67', mint: '#83edce', muted: '#91b9ba', coral: '#ff9b79' };
export const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
export const mix = (from, to, amount) => from + (to - from) * amount;
export const angleDelta = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const headingDegrees = (heading) => (Math.round(heading * 180 / Math.PI) + 360) % 360;
export const clock = (seconds) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
