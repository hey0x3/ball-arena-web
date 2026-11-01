# Ball Arena Web — implementation plan

Date: 30 October 2026. Status: approved direction; the local v0.2.0 implementation is documented in [IMPLEMENTATION.md](IMPLEMENTATION.md). This document retains the original roadmap; implementation details and the Unity source audit are tracked separately. Deployment remains future work.

## 1. Intended experience

Recreate the existing game's arena as an open-source web simulation. The arena's square geometry, appearance, bounce behavior, contact damage, and recognizable character mechanics are the reference. The website opens directly into the simulator.

Visitors choose two balls, adjust their settings, and watch them fight automatically. There is no player-controlled combat, aiming requirement, campaign, collection economy, summoning, leveling, account requirement, or progression screen. All included characters are available immediately.

The first release is a 1v1 simulator. The engine uses combatant IDs and target selectors so later free-for-all or team modes can be added without changing character definitions. Those modes are later work.

## 2. Screen and controls

```text
+----------------------------------------+---------------------------+
|                                        | CHARACTERS                |
|                                        | Search / roster           |
|                                        | Assign to A / B            |
|          SQUARE ARENA                  |                           |
|                                        | SELECTED BALL             |
|     Balls, HP, weapons, effects         | Appearance / stats        |
|     Optional names and match timer     | Skill 1 / Skill 2 / Skill 3|
|                                        |                           |
|                                        | SIMULATION                |
|                                        | Start / Pause / Restart   |
|                                        | Speed / Seed / Repeat     |
|                                        | Record round              |
|                                        | Import / Export / Add ball|
+----------------------------------------+---------------------------+
```

- On desktop, use the remaining width for the arena and roughly 320–380 px for the sidebar. Fit the square without stretching its physics space. The sidebar scrolls independently.
- Keep controls in the sidebar and small overlays. The main area shows the arena rather than a dashboard or marketing page.
- Show HP and essential skill feedback inside the arena; detailed stats and editing stay in the sidebar.
- Desktop layout is required even in narrow windows: retain the arena and right sidebar side by side, with a 960 px minimum workspace and horizontal scrolling below that width. The 9:16 recording format applies only to exported clips.
- Match the current arena's light and dark presentation. Decorative chamfers stay outside the true rectangular collision boundary.
- Allow keyboard operation of controls, visible focus states, readable labels, and reduced presentation motion.

Current controls: Run, Pause, Reset, independent launch directions, 0.5x/1x/2x/4x speed, seed, randomize seed, sound, Record round, and Download last recording.

The arena loads in a ready state. Run launches both balls at their chosen directions; Reset returns to the starting positions and waits for Run. Character/settings changes also wait for Run. No automatic round repeat is enabled. A round ends on knockout, simultaneous knockout, or a configurable time limit. Proposed neutral-simulator defaults: simultaneous knockout is a draw; timeout is a labeled timeout. This intentionally differs from Unity's player-favored tie rule.

Editing is available before a round or while paused. Applying changes creates a fresh round snapshot and resets transient combat state. Cancel preserves the current round. Recording locks setup changes until the clip finishes.

## 3. Proposed technology

| Concern | Choice | Purpose |
| --- | --- | --- |
| Language | TypeScript with strict checks | Shared contracts for agents, data, UI, and simulation |
| UI | React and ordinary CSS | Sidebar, forms, dialogs, accessible controls |
| Development/build | Vite and npm lockfile | Small static application with familiar contributor tooling |
| Arena rendering | PixiJS, production WebGL renderer | Sprites, rails, weapons, text, particles, one canvas |
| Physics | Planck.js | TypeScript/JavaScript Box2D-style bodies, contacts, and impulses |
| Validation | Zod plus generated JSON Schema | One contract for editing, imports, contributions, and agent tooling |
| Recording | Canvas captureStream and MediaRecorder | Local arena-only video and download |
| Local storage | IndexedDB for packs/assets; small settings in localStorage | Keep visitor characters and presets without accounts |
| Verification | Vitest and Playwright | Simulation rules, content validation, browser integration |

This stack is recommended for the project's small 2D simulation and static hosting needs. PixiJS and Planck.js handle separate rendering and physics concerns. React does not drive per-frame simulation updates.

Select compatible stable package versions and the supported Node LTS during implementation; commit the lockfile. There is no need to install packages during this planning task.

The first release needs no backend, database service, AI API key, or hosted AI agent. An agent works in a contributor's checkout and submits a pull request; browser imports provide immediate local experimentation. A shared online gallery or live publication API would require a separate backend phase.

## 4. Simulation architecture

Keep the simulation independent of React, PixiJS, the DOM, and wall-clock timers. Its input is a validated character catalog, arena preset, seed, and setup. Its output is a state snapshot and events for presentation.

Suggested structure when implementation begins:

```text
src/
  app/                 React layout, sidebar, customization
  simulation/          Fixed-step world, motion, combat, round lifecycle
  skills/              Typed skill registry and effect implementations
  rendering/           Pixi scene and visual event consumers
  recording/           Capture, audio routing, encoding, downloads
  content/             Catalog loading and pack validation
  storage/             Local custom characters and presets
content/characters/    One directory per built-in or contributed character
schemas/               Generated public schemas
templates/             Starter character pack and agent task
tests/                 Headless simulation and browser checks
docs/                  Product and technical documentation
```

Use a 0.02-second fixed physics step initially to match the inspected Unity project. Render independently, normally at display refresh rate, with interpolation. Speed changes how many fixed steps run, not the timestep or damage values. Bound catch-up work; pause when the tab is hidden, and finalize an active recording with an interrupted status rather than promising background capture.

Per tick: process scheduled skill actions; advance physics; collect contact/weapon events; reserve and resolve the full damage batch; resolve knockouts once; emit presentation events. Queue body additions/removals until physics stepping permits them. Stable IDs, event order, seeded randomness, and simulation-time cooldowns make runs reproducible within a pinned build.

Do not promise bit-identical Unity or cross-browser trajectories. A different solver can diverge even with matching values. Acceptance is matching geometry, timings, damage, skill rules, and observed movement behavior against reference cases. Save the seed, engine/content versions, and resolved setup with presets; a seed alone is not a portable replay format.

Preserve mass-dependent knockback, cruise-speed recovery, speed caps, anti-stall behavior, wall rebound correction, per-target hit intervals, and fair simultaneous hit resolution. Presentation events must not apply damage or forces.

## 5. Customizable balls and the three-skill contract

Separate immutable character definitions from runtime instances. Two copies of one character must have independent health, cooldowns, effects, and skill state. Instance overrides never modify the shared definition.

Each character exposes:

- Identity: namespaced ID, display name, description, tags, author, content version.
- Appearance: color, circular body artwork, outline, scale, trail and effect styling, optional sound references.
- Body/combat: HP, radius, mass, cruise speed, maximum speed, contact damage and contact interval.
- Skills: an ordered array of **zero to three** entries. Active and passive mechanics both use these slots. Base contact damage and ordinary movement are shared body rules.
- Per skill: unique slot ID, registered type, name, timing/trigger settings, validated parameters, and visual settings.
- Provenance: artwork/audio sources, credits, and asset license metadata.

The three-skill limit is enforced in the editor, runtime loader, import/export validator, JSON Schema (`maxItems: 3`), and CI. Reject invalid packs with actionable field errors; do not silently truncate them.

Illustrative data shape, not a finalized schema or working character:

```json
{
  "schemaVersion": 1,
  "id": "community:sword-ball",
  "name": "Sword Ball",
  "version": "1.0.0",
  "author": "Contributor",
  "appearance": { "color": "#59c5b1", "body": "assets/body.png" },
  "stats": {
    "maxHp": 100, "radius": 0.4, "mass": 1.2,
    "cruiseSpeed": 4, "maxSpeed": 12,
    "contactDamage": 10, "contactInterval": 0.5
  },
  "skills": [
    {
      "id": "blade", "type": "core:rotating-blade", "name": "Orbiting Blade",
      "params": { "damage": 12, "hitInterval": 0.6, "reachRatio": 1.3 }
    }
  ],
  "assets": { "license": "CC0-1.0", "source": "Original contributor artwork" }
}
```

Starting skill families map to existing characters: wall charge, rotating blade, projectile, periodic shield, magnetic pull, burning trail, reflecting beam, dash/charge, and puck strike. Add reusable status effects such as slow, healing, shields, damage-over-time, and temporary stat changes when a character needs them.

Skills use a typed context for target selection, damage, impulses, projectiles, zones, timers, and visual events. New behavior can register a new TypeScript skill through a pull request. Do not force every future character into a universal scripting language.

This supports future sword, magic, or heavy-weapon characters, including the user's Zelda or Aatrox examples, through artwork and up to three appropriate skills. A named character pack can introduce a new mechanic through the same contribution process.

## 6. Adding and sharing content

Two complementary paths:

1. **Use it immediately:** a visitor or their agent creates a pack from the public schema/template, imports it in the sidebar, previews validation, and saves it in that browser. The editor can also create a ball from scratch or duplicate an existing ball. Export includes configuration and referenced local assets.
2. **Make it available to everyone:** a contributor or their agent adds a character directory to the repository, includes credits and any new skill code, runs checks, and opens a pull request. Merged content appears after the site owner builds and deploys the updated catalog.

Use a portable ZIP pack with `character.json` and an `assets/` directory. Define file count, expanded-size, image-dimension, and numeric limits before shipping the importer. JSON-only imports can use existing installed assets. Detect duplicate IDs and offer explicit replace or duplicate behavior.

Browser-imported packs contain data and media. Executable JavaScript is added through reviewed source contributions, not executed from an imported ZIP. Validate paths and decoded assets; initially accept PNG/WebP artwork and approved audio formats. Keep built-in assets same-origin and imported assets local so character images do not taint the recording canvas.

Publish schema versions, migration errors, a complete example pack, contribution instructions, and one copyable agent prompt. Catalog discovery should pick up a valid new character directory without unrelated core edits.

## 7. One-click recording

**Record round** prepares capture and returns the arena to ready. **Run** starts both capture and the fresh round with the chosen directions. Include a short result tail and finalize the video. Request an automatic download and retain **Download last recording** if browser download handling requires another click. A secondary Stop button ends a clip early.

- Capture the arena canvas directly, including HP, weapons, and visual effects. Exclude the sidebar, cursor, and browser interface.
- Default to a fixed 720×720 recording at 30 fps; offer 1080×1080 after performance validation. Maintain a fixed capture size while recording so viewport resize cannot corrupt it.
- Prove WebGL capture early with animated frames. Use a dedicated capture surface if the chosen rendering path otherwise produces blank frames or cannot retain a fixed size.
- Detect MediaRecorder support and test MIME types with `isTypeSupported`. Prefer a supported WebM or MP4 format and use the actual recorder MIME type for the extension. Universal MP4 conversion is later work.
- Optional arena audio is routed from Web Audio into the recording stream. Canvas capture by itself contains video only. Sound off must still produce a valid silent video; no microphone is needed.
- Use recording states: idle, preparing, recording, finalizing, ready, and failed/interrupted. Handle encoder errors and release tracks, chunks, and object URLs appropriately.
- Default recording playback is 1x. Show duration and file-size progress; initially cap a recording at 240 wall-clock seconds or 256 MiB of retained chunks, whichever comes first. This is bounded in-memory capture, not unlimited disk streaming.
- Make round timeout configurable, initially 180 simulation seconds. A recording cap can end a slow run early, with the reason shown. Each recording captures one round.
- No upload, screen-sharing picker, browser-tab capture, or server-side rendering is required. Unsupported recording environments get a clear explanation while simulation remains usable.

Test playback and downloads in supported desktop Chrome, Edge, and Firefox. Check Safari and mobile separately and document observed support; do not infer codec support from browser names.

## 8. Implementation phases and acceptance

| Phase | Deliverable | Acceptance |
| --- | --- | --- |
| 0 — Plan | This repository, decisions, Unity references, contribution outline | No Unity source/assets changed by the web plan |
| 1 — Arena foundation | Static app, square arena, automatic 1v1, Bumper/Sawblade, pause/speed/restart, early capture spike | Compare real bounces, contact cooldowns, knockback, simultaneous hits; play a nonblank downloaded clip |
| 2 — Custom characters | Registry, zero-to-three skills, editor, storage, pack import/export, schema | A fresh imported character works without core edits; four skills are rejected; mirror instances stay independent |
| 3 — Arena parity and recording | All nine current regular characters, light/dark arena, skill feedback, configurable shrink, complete Record round flow | Run reference cases per skill, shrinking-wall containment, real completed recordings with/without audio |
| 4 — Open-source readiness | Agent template, contributor guide, CI, asset credits, clean-checkout instructions | An outside contributor can add a character from the docs and produce a deployable static build |

Use unit checks for meaningful rules: cooldown timing, damage batching, simultaneous KO, speed changes, restart cleanup, skill limits, and import validation. Browser checks cover roster assignment, customization, persistence, import/export, layout, and recording lifecycle. Inspect actual video playback; a nonempty Blob alone is insufficient proof.

Initial performance target: smooth 60 fps display and 30 fps recording for a 1v1 round on the chosen reference desktop, with bounded projectile/effect counts and no accumulating resources after repeated restarts. Benchmark rather than promise identical performance on every device.

Later additions: larger arenas, multiple combatants/teams, community gallery, URL-shareable presets, tournaments, alternate arena gimmicks, advanced video export, and a hosted agent publication API. These must preserve the three-skill contract.

## 9. Repository and deployment

Working folder/repository name: `ball-arena-web`. Initialize it as an independent local Git repository with branch `main`; choose a GitHub owner and publish the remote when ready. The enclosing Unity repository ignores this directory to avoid an accidental embedded-repository commit.

Proposed license: MIT for new application code and documentation, with explicit per-asset credits/licenses. Use original or appropriately contributed character media; a pack's metadata keeps its provenance visible.

The initial application builds to `dist/`. Deployment remains a separate user action. Keep URLs base-path-aware for GitHub Pages, and avoid server-dependent routing. Do not add automatic publishing during implementation unless requested. A clean standalone clone must work without the Unity project.

## 10. Technical references

Checked 30 October 2026. These support the proposed implementation choices, not a claim that browser behavior has already been tested.

- [PixiJS application and renderer options](https://pixijs.com/8.x/guides/components/application)
- [Planck.js overview](https://piqnt.dev/planck.js/docs/index.html) and [simulation stepping](https://piqnt.dev/planck.js/docs/world/simulation.html)
- [Vite static deployment and GitHub Pages base paths](https://vite.dev/guide/static-deploy)
- [Canvas captureStream and origin-clean requirements](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [MediaRecorder lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) and [format support detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
