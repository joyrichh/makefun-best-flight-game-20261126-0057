# Nusa Air Rally

[![Make.Fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Live rank](https://make.fun/badge/best-flight-game-20261126-0057/joyrichh/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Live reward](https://make.fun/badge/best-flight-game-20261126-0057/joyrichh/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**A little plane. A whole archipelago.**

An original chase-view flight game about finding a beautiful line through a tropical island chain, and bringing your little propeller plane home. Fly the **Cendrawasih-1** over the fictional Seroja archipelago: golden gates, bright lagoons, palm-covered hills, tiny villages, and a proper island airstrip. All art is procedural Canvas 2D. All sound is synthesized with WebAudio. No engine, library, downloaded asset, external font, or online service is used by the game.

Built for [Make.Fun — Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057).

## Play

With Node.js 22.18 or newer, run `node serve.ts`, then visit **http://localhost:8080** in a desktop browser. Nothing needs installing or compiling. Any static server rooted at `game/` also works. The game makes no external requests. Native ES modules require serving the files rather than opening a `file:` URL.

Choose a mission with the mouse or **1 / 2 / 3**, select **Fly this route**, and read the flight plan. **Enter** advances through the flight desk and briefing. You start airborne with enough speed to fly. Follow the gold bearing indicator and the chart; each checkpoint must be crossed in order. Rings reward a centered line and a streak. After the route, reduce throttle, line up with runway 36, and descend gently. Keep your speed below **91 kt**, wings nearly level, and sink below **6.8 m/s**. Flare with a small nose-up input just before touchdown. The closer you land to the centre line, the larger the landing bonus. Remaining time also scores.

Landing refills the tank. An early safe landing opens a refueling stop and lets you resume the unfinished route. A rough but survivable runway touchdown damages the airframe; a severe impact, sea ditching, or terrain strike ends the flight. Running out of fuel stops the engine but leaves a controllable glide. Stalling below 64 kt adds sink, so do not pull the nose up at idle. The mission clock stops when paused.

## Controls

| Input | Action |
| --- | --- |
| W / Up arrow | Pitch nose up |
| S / Down arrow | Pitch nose down |
| A D / Left Right arrows | Bank left / right and turn |
| Shift | Increase throttle |
| Control | Decrease throttle |
| Hold mouse / drag touch | Steer toward the cursor; above centre pitches up |
| Space | Airbrake |
| P / Escape | Pause / resume; Escape returns from briefing |
| M | Mute / unmute |
| R | Restart the selected sortie |
| Enter | Select / launch / continue |

Touch devices also get throttle, brake, and pause buttons. Best score is kept **in memory for the current page session**, not in cookies or persistent storage. Audio unlocks on the first keypress or click.

## Three Sorties

- **Ring Rally:** eight golden gates, 3:05 on the clock, then land at Seroja.
- **Island Tour:** visit five named island beacons in order, explore the longer route, and return within 3:55.
- **Precision Landing:** start on the inbound leg with only 24% fuel and 1:55. Three approach rings help line up, but touchdown is the objective. Centre-line accuracy earns the biggest bonus.

The always-on HUD includes altitude, airspeed in knots, heading, fuel, airframe condition, throttle, score, time, and checkpoint progress. A luminous artificial horizon, scrolling compass, airspeed and altitude tapes, and route chart are drawn directly on canvas.

## Reproducible Scenes

`?shot=start|play|end|land&seed=1` resets a seeded world and advances the real physics in fixed 1/60-second steps with a simple waypoint-following autopilot. The scene then freezes, so browser timing does not change the frame. `end` is the debrief after a real completed flight; `land` is the final approach. Hand-in screenshots must be uncomposited browser renders, with only JPEG encoding applied. The title selection, restart, and flight controls still work in these views. See `VALIDATION.md` for the actual validation results and this build environment's browser-capture restrictions.

## Hand-in

Run `node main.ts` to copy `game/` and `screenshots/` into `/output` and write the deterministic dossier using the unchanged kit library. For a local output directory, use `MAKEFUN_OUTPUT_DIR=./out node main.ts`. No bundling or submission step is part of the game.

Source responsibilities: `world.js` builds the seeded archipelago and owns physics, checkpoints, fuel, scoring, and collisions; `render.js` projects the world and draws the aircraft, scenery, and instruments; `input.js` handles controls; `audio.js` synthesizes sound; `shots.js` flies reproducible scenes; `main.js` owns the screen state machine and fixed-step loop.

MIT licensed. Original game code and procedural artwork by joyrichh, 2026.
