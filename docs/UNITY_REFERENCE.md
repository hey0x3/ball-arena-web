# Unity reference for the web simulator

Inspected 30 October 2026. Paths below are relative to the enclosing Unity project, not this repository. They are reference material for porting; the web repository must become self-contained.

## Arena appearance

Primary visual references:

- `Docs/Design/Arena-Refresh/Arena-Dark.png`
- `Docs/Design/Arena-Refresh/Arena-Light.png`
- `Docs/Design/Arena-Refresh/Wall-Impact.png`
- `Docs/Design/Arena-Refresh/Sudden-Death.png`
- `Docs/Development/Arena-Refresh-Playtest.md`

The inspected dark screenshot shows a square, dark violet arena with thin illuminated rails, chamfered outer hardware, subtle floor marks and center inlay, circular balls, and prominent HP text. The web layout moves selection and detailed controls into the right sidebar.

The bright inner boundary is rectangular. Decorative chamfers do not alter collision geometry. Wall glints only observe collisions. Shrink visuals must follow the active collision boundary while retaining the original outer chassis.

Reference implementation: `Assets/Scripts/BallArenaPresentation.cs`, `BallArenaWallGlint.cs`, and `PhoneScreenBounds.cs`.

## Inspected values and behavior

| Item | Inspected value or rule |
| --- | --- |
| Arena | Fixed square, default 5.2 world units per side |
| Layout | Fit the view to the square; viewport changes do not change combat distances |
| Physics step | 0.02 seconds in `ProjectSettings/TimeManager.asset` |
| Bounce material | Friction 0; bounciness 1 in `Perfect Bounce.physicsMaterial2D` |
| Motion | Mass-dependent impulses, cruise-speed recovery, speed cap, stall recovery |
| Motion source defaults | Recovery rate 3; force recovery delay 0.25 s; collision delay 0.1 s; stall delay 0.15 s; minimum wall rebound angle 15 degrees |
| Contact damage | Per-target cooldown; reciprocal hits reserved before applying either |
| Weapon damage | Queued and settled with the complete damage batch |
| Knockout | Resolve once after the complete damage batch |
| Sudden death | Scene settings start at 120 simulation seconds; shrink duration 60 seconds |
| Shrink minimum | Derived from the largest effective ball/weapon radius |
| Source tie rule | Unity awards simultaneous KOs to the player; proposed web rule is draw |

Source defaults can be overridden in scene/component configuration. During implementation, confirm effective scene values before treating a source default as a final parity value. Inspect collider radius together with transform scale and weapon reach.

Important sources: `BouncingBall2D.cs`, `BallCombat2D.cs`, `BallRoundController.cs`, `BattleSessionController.cs`, `BallCharacterDefinition.cs`, and `Assets/Scenes/SampleScene.unity`.

## Existing regular character roster

These are the inspected base assets, without player-level scaling. All nine currently have 100 maximum HP, a 0.5-second base contact interval, and a maximum speed of 12.

| Character | Contact damage | Cruise speed | Mass | Signature skill | Source |
| --- | ---: | ---: | ---: | --- | --- |
| Bumper | 10 | 4.0 | 1.5 | Wall Charge | `BumperCharge2D.cs` |
| Sawblade | 10 | 4.8 | 1.0 | Rotating Blade | `Sawblade2D.cs` |
| Dartling | 8 | 4.2 | 1.0 | Dart Shot | `Dartling2D.cs`, `DartProjectile2D.cs` |
| Bulwark | 8 | 3.6 | 1.8 | Aegis | `Bulwark2D.cs` |
| Magnetron | 8 | 4.0 | 1.2 | Polar Pull | `Magnetron2D.cs` |
| Embertrail | 8 | 4.4 | 1.0 | Fire Wake | `Embertrail2D.cs`, `EmbertrailSegment2D.cs` |
| Prism | 6 | 4.2 | 0.9 | Refraction | `PrismBeam2D.cs` |
| Meteorion | 10 | 3.7 | 1.7 | Meteor Rush | `MeteorCharge2D.cs` |
| Mallet | 8 | 4.2 | 1.25 | Power Shot | `Mallet2D.cs`, `AirHockeyPuck2D.cs` |

Character definitions: `Assets/BallGame/Characters/*.asset`. Skill sources live in `Assets/Scripts/`.

Each current regular character has one signature ability. The web definition generalizes this to an array of up to three skills. The initial port should retain the original single-skill loadouts as presets.

Bumper baseline: maximum three wall charges, two impulse units per charge, six impulse cap, minimum impact speed one, 0.15-second bounce interval, and 2.5 bonus damage per stored impulse. Its base asset therefore yields 10/15/20/25 damage at zero/one/two/three charges. Check actual qualifying wall collisions, corner handling, cooldown-blocked contacts, and reset behavior when porting.

## Parity checklist for implementation

- Arena scale and ball size ratio match reference captures.
- Visible inner rails coincide with actual wall collisions.
- Wall bounce, corner rebound, prolonged contact, and stall recovery behave sensibly.
- Contact/weapon cooldowns advance on simulation time at every supported speed.
- Impulses respect mass; speed recovery preserves meaningful knockback.
- Both sides' simultaneous attacks survive callback ordering.
- Same-character duels have independent skill state.
- Restart removes old projectiles, trails, timers, puck ownership, and queued attacks.
- Each ported skill has a controlled reference case and an actual running duel.
- Shrink preserves containment, including weapon reach and the Mallet puck.
- HP, skill telegraphs, wall glints, and damage numbers remain readable in both themes.
- Recordings show advancing frames and include the same arena effects seen live.

Arena hazards and Guardian phases are additional reference material in `BallArenaHazards2D.cs`, `IronGuardian2D.cs`, and the Arena-Refresh screenshots. They can become later presets after the regular roster and core arena are complete.

## Boundary of this planning task

No Unity source, scenes, settings, or assets were changed or copied. The only parent-repository change is the ignore entry for this independent nested web repository. Screenshot notes describe saved reference captures, not a fresh live playtest.
