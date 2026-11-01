# Implementation status — v0.2.0

30 October 2026. The approved stack is implemented as a local static application. The original [plan](PLAN.md) remains the design roadmap.

## Working

- React desktop workspace with the arena and right sidebar always side by side, dark/light themes and keyboard-accessible forms. The workspace has a 960 px minimum width and scrolls horizontally in narrower windows; it no longer switches to a stacked phone layout.
- Contender B health above the arena and contender A health below, with accessible live progress bars. A persisted display toggle controls HP numbers on ball bodies in both the live view and recordings.
- Both panels show all skills' live phases, cooldowns, windups, active durations, charge requirements, and readiness bars. These values come from simulation state and are shared with the portrait recorder.
- PixiJS WebGL canvas at a fixed 720×720 backing resolution, matching the reference arena's square field, rails, chassis, quiet floor and HP overlays.
- Clean ball artwork without added perimeter outlines or floating A/B labels. Dartling tracks the displayed target and holds its sampled firing direction through the shot flash. Embertrail uses the original Unity flame sprite, bright capsule segments, and simulation-time flicker/fade.
- Visible activation effects for every skill: Meteorion's windup/comet rush/impact, Bumper's charged wake, blade and muzzle sparks, glass shield facets/absorption/break effects, directional magnetic pull arrows, reflected beam flashes, and Mallet's power-ready/charged puck effects. Effects follow real simulation state, freeze on pause, and appear in square and portrait recordings.
- Planck.js zero-gravity circle bodies, a 0.02-second simulation tick, chosen initial launch angles, mass-dependent impulses, speed recovery/caps, shallow-wall correction, and anti-stall recovery. The headless engine retains seeded launch defaults when angles are omitted.
- Explicit Run/Pause/Reset controls, 0.5x/1x/2x/4x playback, editable seed, configurable timeout, and shrinking walls after 120 simulation seconds. Every fresh round waits for Run; no loading, setup action, editor cancellation or round completion automatically starts another.
- Grab either ball's arrow directly inside the ready arena and drag its tip to aim. Generous hit areas and pointer capture keep the arrow attached while dragging; the visible grips also support keyboard controls. Values persist in browser settings and setup exports; invalid older settings fall back safely. Resuming preserves current velocity; Reset returns to setup for aiming again.
- Full damage batching and neutral simultaneous-KO draws, independent mirror-match state, and fresh worlds on restart.
- All nine regular base characters ported against their Unity definitions and scripts. [UNITY_PARITY.md](UNITY_PARITY.md) and [unity-audit.json](unity-audit.json) document the source, values, and targeted checks. Approved detailed sprites and Sawblade's retained legacy body/weapon are copied unmodified with matching scale, pivots, and tint.
- Character editor for identity, colors/styles, PNG/WebP artwork, stats, named skills and their parameters, credits, and zero to three skills.
- IndexedDB custom characters; portable JSON/ZIP imports, ZIP exports with media, duplicate handling, and import limits.
- Shared Zod validation plus generated JSON Schema. Automatic discovery of contributed character directories and local artwork.
- Record round prepares a fresh recording. Run starts capture and the round at 1x using the chosen launch directions, with optional synthesized arena audio, a result tail and automatic download. Choose a 720×720 square arena clip or a fixed 720×1280 (9:16) portrait with the complete square arena, both live health panels, timer and seed. Portrait composition is independent of viewport size and does not alter physics. Manual early stop and re-download are available.
- Recording uses the supported native codec, fixed capture dimensions, 30 fps request, duration/retained-size caps, cleanup, and interrupted-tab handling. No microphone, screen-sharing picker, or backend is used.
- Standalone npm scripts, pinned dependencies/lockfile, starter pack, agent instructions, MIT license, and CI checks without deployment.

## Verification

`npm test`: core combat/import checks plus controlled Unity character cases covering first activation delays, damage and hit gates, bounce credits, magnetic easing, swept trail crossings, aim locks, one-impulse rushes, shield refreshes, and physical puck strikes/returns. The parity test file also validates the imported base values against the recorded source audit.

`npm run test:e2e`: desktop Chrome checks covering frame advancement/pause, switching, light theme and narrow desktop windows, character editing/storage, three-slot limits, ZIP/artwork round trips, invalid imports, actual video decode/advancing frames/audio, automatic download, HP placement/toggle, fixed portrait dimensions across resize, live skill timers, and all three skill readouts fitting in the panels. A controlled renderer check samples Dartling's actual gold muzzle in four directions and through the shot lock, checks that floating A/B labels are absent, and verifies visible fire pixels and paused flame animation. [Fire preview](embertrail-preview.png).

`npm run build` includes typechecking and validation of the nine characters, starter template, and generated schema, then produces `dist/`. The PixiJS renderer is the largest bundle chunk and currently triggers Vite's size advisory.

`tests/browser/skill-effects.spec.ts` compares actual rendered idle/activated frames for the eight non-trail skills, checks their animation and paused frames, and verifies rendering does not mutate combat. Embertrail is covered by the existing fire renderer case. The portrait download check records Meteorion versus Prism through the first rush and decodes an actual exported frame.

Launch tests verify chosen velocities, readiness without time/skill/puck advancement, paused velocity, option validation and isolation. Browser cases drag the actual arena arrow grips independently, check keyboard input, persisted/exported angles, explicit Run, setup reset/cancel behavior, and recording preparation without movement.

Browser checks use isolated test profiles. Narrow-window checks verify that the desktop workspace stays side by side and its controls remain reachable. Chrome is the recording environment verified so far. Firefox, Safari, Edge, and physical-device capture still need validation.

## Remaining parity and expansion

The regular level-1, attack-100%, mastery-1 loadouts use the audited Unity behavior. Source-specific distinctions are preserved, including travel-direction beams, bounce-triggered magnetism, delayed first activations, shared blade/body hit gates, and physical-only puck strikes. Planck.js is a different physics integration, so frame-identical trajectories are not promised.

Further work: platform checks, additional effect/audio polish, arena hazard/boss presets, progression/mastery extensions, more recording formats/resolutions, custom audio import, gallery/publication services, and multi-combatant modes. Audio currently uses local synthesis. Setup export is a JSON snapshot, not an input/replay protocol. Arbitrary imported code and hosted AI agents are outside this version.

This repository contains the standalone web simulator. Website deployment remains future work. The enclosing Unity source/assets were not modified during implementation.
