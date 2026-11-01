# Instructions for coding agents

- This is an independent repository nested inside a Unity project. Work inside this directory. Do not edit the enclosing Unity project unless the user explicitly requests it.
- Read `README.md`, `docs/PLAN.md`, and `docs/IMPLEMENTATION.md` first. Implementation was authorized on 30 October 2026. Keep work local; create a remote or deploy only when requested.
- The product is an automatic arena simulator. Preserve the arena-first screen and right-side character controls.
- A character has zero to three skills total, including passives. Enforce the same limit in UI, loading, schemas, and content checks when implementing.
- Keep simulation logic independent of rendering/UI. Use fixed steps, simulation-time cooldowns, stable event order, and seeded randomness.
- Start movement only from the user's explicit Run action. Startup, character/setup changes, Reset, editor cancellation and preparing a recording must wait. Preserve independent persisted launch angles and their ready-state arena previews; resuming a paused round must retain its current velocity.
- Use immutable character definitions and independent runtime instances. Process simultaneous damage before resolving knockouts.
- Character packs should be easy to create with an agent. Browser imports contain data/media; new executable mechanics are source contributions.
- Preserve direct arena-canvas recording and local downloads. Include capture/playback verification when changing rendering or recording.
- Keep this checkout standalone. Unity reference paths are development context and must not become runtime dependencies.
- Avoid publishing, deploying, or introducing hosted services as part of routine local implementation.
- Add meaningful checks for changed combat, importer, or recording behavior. Do not invent passing checks or claim planned commands already run.
- Character data lives in `content/characters/*/character.json`; discovery is automatic. The shared validator is `src/content/schema.ts`, mechanics are in `src/skills/registry.ts`, and the DOM-free engine is `src/simulation/engine.ts`.
- Run `npm run schema` when changing the shared schema. Required checks are `npm test` and `npm run build`; use `npm run test:e2e` for changes to UI, imports, recording, or rendering.
- Before changing included characters, read `docs/UNITY_PARITY.md` and the matching source audit/targeted tests. Preserve the original trigger conditions, first activation delays, aim locks, hit gates, puck ownership, and approved sprites. Skill readouts must come from simulation state, including in recordings.
