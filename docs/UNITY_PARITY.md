# Unity character behavior reference and port

Audited 30 October 2026 against the existing BallGame C# scripts, character ScriptableObjects, sprite import metadata, scene layer filters, and fixed projectile/fire pools. [unity-audit.json](unity-audit.json) records the source hashes, exact base stats, skill parameters, and approved artwork hashes. The Unity project was read only.

This port uses the regular character definitions at level 1, attack 100%, and mastery 1. Campaign modifiers and higher mastery upgrades are outside this simulator's base loadouts. Character customization can override the base settings.

| Character | Activation and combat rules | Primary Unity source |
| --- | --- | --- |
| Bumper | Real wall-entry impacts of at least 1 speed, with a shared 0.15s corner gate. Credit commits on the following tick. Maximum 3 charges. Next eligible body hit adds capped impulse (2/stack, cap 6) and rounded impulse ×2.5 damage: total 10/15/20/25. A blocked hit preserves charge. | `BumperCharge2D.cs`, `BallCombat2D.cs` |
| Sawblade | Rotating 48-point toothed outline, reach 1.3× body radius, 180°/s. Every side of the blade can hit the opponent's body. Blade and body share one 0.6s attacker/target gate; body contact uses blade damage 12, without adding ordinary body damage. The weapon is physical against walls only, matching the scene's wall-only layer override. | `Sawblade2D.cs`, `BallCombat2D.cs`, `SampleScene.unity` |
| Dartling | First shot after 2.5s; subsequent reloads 2.5s. Aim sampled at firing, straight flight at 8 speed, lifetime 1.5s. Swept 0.26×0.10 capsule including the muzzle segment, nearest wall/target wins, wall wins ties, no push or homing. Four darts per actor; a full pool skips that shot. | `Dartling2D.cs`, `DartProjectile2D.cs` |
| Bulwark | Starts with no shield. First shield at 5s: capacity 25, duration 3s. Recharge runs independently of absorption/expiry; each 5s refresh replaces remaining capacity. Overflow damages HP and breaking/expiring never heals or restarts recharge. | `Bulwark2D.cs` |
| Magnetron | Three qualifying wall bounces start a 1.25s pull. Corner gate 0.15s, minimum impact 1; no charge from rubbing or while pulling. Radius 3, force 8. Pull eases by clamp((surface gap−0.12)/0.65), with no force inside the 0.12 gap. Active time elapses even out of range. | `Magnetron2D.cs` |
| Embertrail | Emit movement segments every 0.1s after at least 0.05 movement. Capsule width 0.22, lifetime 2.5s, fixed 32-segment pool. Clip fire to the live arena with margin max(radius,0.14). Swept target crossings deal 4 damage, with one shared 0.5s gate across all fire owned by that skill. Fire has no physical collider or push. | `Embertrail2D.cs`, `EmbertrailSegment2D.cs` |
| Prism | First beam at 3s and every 3s. At 0.45s before firing, lock the ball's travel direction. Rebuild the ray from its moving origin while preserving that direction. Beam damage 18, range 16, two reflections; corners reflect both axes. Reserve one damage hit for the entire pulse. | `PrismBeam2D.cs` |
| Meteorion | First rush at 4.5s and every 4.5s. Lock the opponent direction during the final 0.7s windup. One impulse sets velocity to 11 in the locked direction; subsequent wall rebounds remain physical. Empowerment lasts 0.6s and is consumed by one eligible body hit: base 10 + bonus 20, push 6. | `MeteorCharge2D.cs` |
| Mallet | One shared neutral puck (radius 0.16, mass 0.25). Deterministic neutral serve at 3.2 speed. Charge for 4s and hold readiness until physical puck contact. Normal stroke 8 damage / speed 7; powered stroke 24 / speed 12. Every actor can return it, including ordinary opponents. One armed damage hit per stroke, 0.18s per-hitter contact gate. Outward contact direction determines the shot; no remote strike, steering or homing. | `Mallet2D.cs`, `AirHockeyPuck2D.cs`, `SetupMallet.cs` |

All periodic skills start with a full first cooldown. Timers use fixed simulation time and pause with the round. Contact damage has no extra invented base impulse: ordinary separation comes from the physical solver. Weapon/body damage reservations are settled before resolving a knockout. Fresh rounds discard projectiles, fire, ownership, pending attacks, shield state and skill timers.

## Artwork

The eight approved detailed PNGs are copied unmodified from `Assets/BallGame/Sprites/Redesign/`. Sawblade deliberately retains its legacy body and separate weapon from `Assets/BallGame/Sprites/`, as the Unity artwork approval required.

Each copied body preserves the import metadata's full-rectangle size, normalized pivot, pixels-per-unit scale and body tint. Detailed bodies are not clipped to a circular mask. Dartling faces its displayed target every frame and holds the sampled shot direction during the 0.18s firing flash, as in `BallBodyArtwork2D.cs` and `Dartling2D.cs`. Procedural projectile characters also aim their muzzle. Sawblade's separate weapon rotates independently. Bumper's three charge indicators occupy the embedded windows from `BumperChargeFeedback.cs`.

The web presentation omits added perimeter rings and the floating A/B actor labels, as requested. Skill progress stays in the health panels; embedded charge lights, shield numbers, weapons, and directional telegraphs remain visible. Embertrail uses the original `Flame.png` sprite and Unity's cropped sprite rectangle, segment width, 18-radian/s flame flicker, and final-half-second opacity curve (1 down to 0.22). Opaque orange/red capsules and a soft glow make the fire readable on both themes. Flame sprites are pooled and freeze with simulation time.

Skill activation feedback is rendered separately from permanent body outlines: Meteorion has gathering windup sparks, its locked warning arrow, a comet wake following actual velocity (including wall rebounds), and empowered-impact sparks. Bumper gains a charged movement wake and release burst; Sawblade shows contact sparks; Dartling flashes at its aimed muzzle. Bulwark presents floating glass shield facets, absorption flashes and break shards. Magnetron shows animated field lines and arrows toward the caster only while force is actually applied. Prism has gathering facets, a bright reflected beam core and reflection flashes. Mallet has orbiting power-ready sparks and a brighter powered puck wake/strike flash. These are web presentation adaptations of the source cues; they do not change combat or reintroduce persistent ball borders.

`src/rendering/skill-effects.ts` reads the existing skill states, particle events and physical velocity. It uses simulation time, never wall-clock time or random frame history, so pausing freezes effects and restarting has no lingering effect state. Effects are clipped to the live arena and drawn into the same canvas used by both recording formats.

These are original assets supplied in the owner's BallGame project, reused in this open-source repository under its MIT license. Artwork source paths and hashes are recorded alongside the definitions. No remote game/franchise art was added.

## Skill readouts

Both health panels show each skill's name, current phase, progress, and rule details. Timed skills show real remaining cooldown/windup/active time. Wall-triggered skills show bounce requirements. Mallet explicitly shows power readiness awaiting physical contact; fire shows active segment count and its shared burn interval.

The portrait recorder uses the same status formatter as the live panels. Its layout reserves space for all three skill slots and fits the complete square arena between the two panels. No independent UI timer predicts skill activation.

## Verification and limits

`tests/unity-parity.test.ts` contains controlled cases for each row above, including muzzle/wall sweeps, shield expiry/refresh, full-rim blade damage and shared gates, corner credit, capped Bumper damage, magnetic easing, swept fire crossings, locked beam/rush directions, and powered/returned puck contacts. Source values are stored in the audit fixture so the standalone repo and CI do not require a Unity installation.

The browser uses Planck.js rather than Unity's physics integration, so trajectories are not certified frame-identical. The web UI uses user-selected starting angles and waits for Run; the headless engine retains seeded defaults when no angles are supplied. Launch speed remains each character's cruise speed. The simulator keeps its neutral simultaneous-KO draw policy. Native solver differences, campaign progression, higher mastery upgrades, and boss/arena hazards are separate from the regular base character behavior documented here.

To deliberately resync source data/art after future Unity changes, run `npx tsx scripts/sync-unity.ts <Unity-project-path>` and review the resulting data, artwork, and audit changes. This is an explicit developer utility, not a runtime or build dependency.
