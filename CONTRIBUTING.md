# Contributing characters and skills

The v0.3 simulator includes the schema, importer, templates, and checks below. Character and skill contributions are welcome. Read [implementation status](docs/IMPLEMENTATION.md) for the current parity limits.

## Character contributions

The workflow is:

1. Fork and clone this repository. Work on a branch.
2. Copy `templates/character/character.json` into `content/characters/<folder>/character.json`. Characters are discovered automatically; no catalog list needs editing.
3. Give the character a stable namespaced ID, appearance, stats, and zero to three skills. Set the optional `origin` string to its game or universe (for example, `League of Legends`, `Dota 2`, or `Original creations`). Origins create roster filter categories automatically; the editor exposes this field and packs preserve it. Older community packs without it appear under Original creations.
4. Optionally add PNG/WebP artwork to the character's `assets/` folder, set `appearance.body` to its relative path, and include author, source, and license metadata. Each skill can also declare an optional `icon` path, such as `assets/skill-q.png`. Icons are loaded, recorded and exported with the same media validation as portraits; omitted icons use a matching built-in symbol. Current audio is synthesized rather than imported.
5. Reuse registered skills when they fit. Add a typed skill implementation if the character needs new mechanics.
6. Validate the pack, simulate it against a reference opponent, and check restart behavior.
7. Open a pull request with the character's behavior, screenshots or a short recording, and validation results.

The browser importer lets creators try packs before proposing them for the shared catalog. Importing does not publish a ball for other visitors. Merged pull requests become public site content after a later deployment.

For local use, import a JSON definition with procedural art, or ZIP `character.json` and `assets/` together, keeping the manifest at the ZIP root. Export finished packs from the sidebar. Browser creations are stored in IndexedDB; export backups before clearing browser data. Duplicate IDs offer Replace or Keep both. Browser imports of the reserved `core:` namespace become community copies.

Pack limits: 10 MiB input, 20 MiB declared expanded size, 32 entries, 4 MiB per artwork file, maximum image dimensions 2048×2048. Accepted files are `character.json` and PNG/WebP artwork under `assets/`.

## Rules for character data

- Maximum three skill entries, counting active and passive skills.
- Store definitions as immutable data; HP, timers, charges, and projectiles belong to runtime instances.
- Expose meaningful parameters so visitors can customize the ball.
- Keep asset references relative to the pack and include required credits.
- Avoid remote media dependencies that can break canvas recording.
- Imported packs contain data/media; new executable mechanics enter through source contributions.

## New skill mechanics

Extend `skillTypes`, defaults, labels, and parameter presentation in `src/content/schema.ts`, then register typed behavior in `src/skills/registry.ts`. The DOM-free engine is `src/simulation/engine.ts`; add visuals in `src/rendering/arena.ts` or `src/rendering/skill-effects.ts` when needed. Run `npm run schema` after schema changes.

Use the typed skill context and shared damage/effect APIs. Use simulation ticks and seeded randomness. Keep drawing, audio, DOM operations, and storage outside combat logic.

Describe triggers, targeting, damage, cooldown, duration, limits, stacking, ownership, and cleanup. Verify mirror matches, pause, speed changes, simultaneous hits, and restart. Add focused checks for new behavior rather than duplicating implementation details in tests.

## AI-agent handoff template

A contributor can give their coding agent this task:

```text
Read AGENTS.md, docs/IMPLEMENTATION.md, src/content/schema.ts, and an existing pack.
Add a new character named [NAME] under content/characters/[ID].
Appearance: [DESCRIPTION OR PROVIDED ASSETS].
Base stats: [VALUES].
Skills, maximum three: [TRIGGERS, EFFECTS, TIMINGS, AND LIMITS].
Reuse registered skills where appropriate. If a new mechanic is needed, implement
it through the typed simulation skill API and document its parameters and cleanup.
Include asset credits and license metadata. Validate the content, run the relevant
checks, and show the character working in a simulation. Prepare a reviewable diff.
Do not deploy or publish it.
```

## Developer commands

Use `npm run dev`, `npm run build`, `npm run typecheck`, `npm run validate:content`, `npm test`, and `npm run test:e2e`. Browser tests use installed Google Chrome locally and on Windows CI, including its H.264/AAC codecs. MP4 tests check consecutive decoded frames and exact timestamps under artificial rendering stalls, in addition to downloads and audio.

The included CI validates content and the three-skill limit, typechecks, runs simulation and browser checks, and builds the static app. Recording tests decode actual downloaded video and inspect changing frames. CI does not deploy.

## Skill parameters

Each skill has a unique `id`, registered `type`, customizable `name`, and numeric `damage`, `cooldown`, `duration`, `power`, and `range` values. Optional mechanic-specific parameters include `windup`, `maxCharges`, `impulseCap`, `minimumImpact`, `damagePerImpulse`, `bounceInterval`, `rotationSpeed`, `reflections`, `emitInterval`, `poolSize`, and `powerDamage`. Keep unused values at template defaults. The editor shows the relevant settings. Repeated types are allowed in separate slots with independent state; blade/body hit reservations still share their attacker/target gate.

| Type | Parameters used |
| --- | --- |
| `wall-charge` | Wall-charge count, impulse per charge and cap, damage/impulse coefficient, minimum impact and bounce gate; eligible body contact consumes stored power |
| `rotating-blade` | Full toothed-rim damage, shared body/blade hit interval, reach multiplier, rotation speed |
| `projectile` | Damage, first-shot/reload interval, lifetime, shot speed (`power`), per-actor pool size |
| `shield` | Capacity (`damage`), refresh interval, duration |
| `magnet` | Required wall bounces (`maxCharges`), duration, force (`power`), range; close-range force easing |
| `trail` | Damage, shared per-target burn interval, lifetime, capsule width (`range`), emit interval, segment pool size |
| `beam` | Damage, first-shot/shot interval, travel-direction aim-lock windup (`duration`), ray length (`range`), reflection count |
| `dash` | Bonus contact damage, interval, target-lock windup, rush duration, impulse (`power`), rush speed (`range`); single empowered hit |
| `puck` | Normal damage and speed (`range`), power-charge interval, power damage and speed (`power`); only physical contact strikes the puck |
| `darkin-blade` | Three sword strikes, windup, recast interval, range, sweet-spot damage multiplier and movement-stop duration |
| `infernal-chains` | Skillshot damage/speed/range, slow, diamond size and escape time, conditional pull and second hit |
| `world-ender` | Active duration, damage/speed/healing multipliers and active-only damage leech |
| `timewinder` | Outbound/return damage, speed/range, field duration, slow fraction and duration; one hit per leg |
| `phase-dive` | Dash speed/time, blink-attack range, enhancement window and consumed bonus damage |
| `chronobreak` | History length (1–4s), untargetable cast time, capped recent-damage healing, arrival damage and radius |
| `meat-hook` | One locked-aim hook, windup, damage, speed (`power`), reach (`range`), cooldown; physical disable/reel and return |
| `rot` | Proximity-toggled cloud, radius (`range`), damage and non-lethal `selfDamage` per `tickInterval`, slow fraction |
| `dismember` | Damage per `tickInterval`, cooldown, channel duration, extra cast reach (`range`), pull speed (`power`), actual-damage healing fraction (`healRatio`) |
| `orb-of-deception` | Outbound/return damage, speed/reach and cooldown; piercing orb hits once per leg and homes to its moving owner |
| `charm` | Heart windup/speed/reach/damage, charm duration, disable and movement toward its caster |
| `spirit-rush` | Dash count (`maxCharges`), speed/time, recast interval, bolt range/damage and post-combo cooldown |
| `piltover-peacemaker` | Locked rifle windup, shot speed/reach and once-per-target piercing damage |
| `yordle-snap-trap` | Placement range, arming time, lifetime/pool, root duration and follow-up headshot damage |
| `ace-in-the-hole` | Targeted channel, reach, homing bullet speed and damage; disabled/untargetable interruption |
| `urchin-strike` | Targeted dash-through reach/speed and consumed on-hit damage; collision ghosting grants no immunity |
| `playful-trickster` | Untargetable vault time/reach, landing splash damage/radius and slow fraction/duration |
| `chum-the-waters` | Lure speed/reach, shark delay, base damage/radius, travel multiplier, slow and knock-up |

Included loadouts follow [the Unity parity reference](docs/UNITY_PARITY.md). Changes to their behavior should preserve the recorded source rules and targeted tests. Health panels and portrait recordings share `src/skills/status.ts`, so new mechanics should expose meaningful trigger/readiness information there.

New source/documentation contributions follow the repository's MIT license. Media retains its explicitly declared license and attribution.
