# League of Legends fan adaptations

These are automatic arena adaptations of League of Legends abilities. The names and ability concepts reference Riot's [Aatrox](https://www.leagueoflegends.com/en-us/champions/aatrox/), [Ekko](https://www.leagueoflegends.com/en-us/champions/ekko/), [Ahri](https://www.leagueoflegends.com/en-us/champions/ahri/), [Caitlyn](https://www.leagueoflegends.com/en-us/champions/caitlyn/) and [Fizz](https://www.leagueoflegends.com/en-us/champions/fizz/) profiles. Arena distances, damage and cooldowns are tuned for this simulator; they do not claim patch-exact League stats or include items, mana, leveling or additional passive skill slots.

Each champion has exactly three skills. All fifteen mechanics are reusable/customizable registered skill types in the character editor. Every champion belongs to the League of Legends origin category. Readouts use the real simulation state in both health panels and portrait recordings. The arena still waits for Run.

## Aatrox — Q, W, R

| Slot | Skill | Arena behavior |
| --- | --- | --- |
| Q | The Darkin Blade | Three individually aimed, locked-windup sword strikes: a long narrow strike, a wider frontal strike, and a close circular slam. The outer edges of Q1/Q2 and center of Q3 are highlighted sweet spots, with bonus damage and a brief movement stop. Aatrox stops moving during each 0.45s windup and retargets between swings. A completed combo has a 3.2s recovery. |
| W | Infernal Chains | A straight chain projectile deals 6 damage and slows on contact. It marks a diamond-shaped escape zone for 1.5s. Leaving the diamond breaks the tether; staying inside pulls the target to the marked point and deals the second 6 damage. The chain respects walls and untargetability. |
| R | World Ender | A 6s transformation every 10s: animated Darkin wings, 1.25× damage, 1.2× cruise speed, and amplified healing. To give this three-slot Q/W/R kit its drain-tank behavior without adding E or another passive slot, the arena adaptation grants 18% damage leech during R, amplified by 1.5× healing. It does not revive a defeated character. |

Aatrox has 160 HP, 3.6 cruise speed and 6 base contact damage by default. The sword, hit-area previews, sweet spots, impact slashes, chain links, escape diamond and transformation wings are rendered from the same phases and geometry used by combat.

## Ekko — Q, E, R

| Slot | Skill | Arena behavior |
| --- | --- | --- |
| Q | Timewinder | An aimed temporal device deals 7 outbound damage, expands into a short slowing field on impact or maximum travel, then returns toward Ekko's current position for 11 return damage. Each target can be damaged once per leg. The visible spinning device and field follow the actual projectile state. |
| E | Phase Dive | A short dash arms a single enhanced attack. When an opponent is within blink-attack range, Ekko blinks to its edge and delivers base contact damage plus 12 bonus damage. The enhancement expires if unused. It shares the body contact hit gate, preventing an extra body hit from the same strike. |
| R | Chronobreak | A four-second-delayed portrait echo marks Ekko's historical location. After a 0.3s untargetable rewind cast, he returns there, heals 10 plus 35% of actual HP damage taken since that history sample, and deals 24 damage around his arrival. Healing is capped by max HP; arrival is clamped to the current arena. A reverse-time path and clock-shaped explosion show the rewind. |

Ekko has 140 HP, 4.4 cruise speed and 6 base contact damage by default. Position, velocity and cumulative HP damage history are bounded to slightly over four seconds per actor. Pausing freezes history and every effect; fresh rounds discard all old history, devices, chains and combo state.

## Ahri — Q, E, R

| Slot | Skill | Arena behavior |
| --- | --- | --- |
| Q | Orb of Deception | A locked-direction spirit orb travels up to 2.7 units, then returns toward Ahri's current position. It pierces the opponent for 8 damage once per leg. The outbound orb glows violet; the returning orb glows cyan, with separate spinning motes and trails. Cooldown 3.5s. Return damage remains configurable. |
| E | Charm | A 0.15s kiss windup fires a heart up to 3.5 units at 6 units/s. On contact it deals 6 damage and disables the target for 1s, stopping its movement ability or channel and causing it to walk toward Ahri at 1.2 units/s. Circling hearts show the actual charm. Untargetability releases this effect's control. Cooldown 5.8s. |
| R | Spirit Rush | Three individually retargeted 0.16s flank dashes at speed 9, separated by 0.55s. Each fires one homing essence bolt for 7 damage if the opponent is nearby. Nine spirit-tail streaks and a fading wake follow each dash. After the third dash, cooldown is 9s. A disable stops the current dash; remaining recasts wait until Ahri can act. |

Ahri has 135 HP, 4.2 cruise speed and 5 contact damage. Her full passive, W and takedown reset system are omitted. Orb return uses the shared shield/HP damage system because the arena does not model physical/magic resistances; there is no hidden fourth ability.

## Caitlyn — Q, W, R

| Slot | Skill | Arena behavior |
| --- | --- | --- |
| Q | Piltover Peacemaker | Caitlyn holds still for a locked 0.55s rifle windup, then fires a long penetrating shot at speed 9 for up to 5 units. The opponent takes 16 damage once, even if the projectile continues through it. Gold muzzle charge and a narrow shot preview show the same aim as combat. Cooldown 4s. |
| W | Yordle Snap Trap | Places a stationary trap within 2.5 units, leading the opponent's current velocity by its 0.6s arming time and respecting arena bounds. Traps last 7s, with a default pool of 3. Only armed traps trigger. A sprung trap roots for 0.9s without immediate damage, then grants one automatic homing 14-damage Headshot after 0.22s, when Caitlyn is able to act. A marked target and visible bullet show that follow-up. Cooldown 4s. |
| R | Ace in the Hole | A 1s stationary channel tracks and marks the target with a growing scope reticle and aim line. On completion, a visible targeted bullet homes at speed 12 for 26 damage. Disabling Caitlyn or making her target untargetable interrupts the channel; untargetability can also evade a fired bullet. Cooldown 10s. |

Caitlyn has 130 HP, 3.7 cruise speed and 5 contact damage. The trap's one-shot Headshot is part of W's interaction; she has no separate stacking passive and no E. The two-ball arena has no additional enemy to intercept R or subsequent Q target to reduce damage against. Traps have a configurable pool with a hard safety cap of 6 per slot. Roots restrict movement while leaving other casts available.

## Fizz — Q, E, R

| Slot | Skill | Arena behavior |
| --- | --- | --- |
| Q | Urchin Strike | Once a nearby target is in range, Fizz dashes through it at speed 10 toward a body-safe point beyond it. The swept strike applies base contact damage plus 12 once and reserves the contact gate. Collision ghosting permits passage through the other body while Fizz remains targetable to incoming skills. A trident and water wake follow the dash. Cooldown 4.2s. |
| E | Playful / Trickster | A 0.65s untargetable trident vault travels toward a locked landing point up to 1.4 units away. His portrait visibly rises above the trident. Landing ends immunity and creates a single 14-damage splash within 1.05 units, slowing by 35% for 0.8s. Water rings and droplets match the landing. Cooldown 6.5s. |
| R | Chum the Waters | A fish lure travels in a locked direction at speed 5 for up to 4 units. It attaches to the first target touched, slowing it; misses remain a visible ground lure that can still be touched. After 1.5s a shark erupts at the lure, applying one damage event and a 0.5s disable/knock-up. The arena adaptation scales base 22 damage and radius from 1× to a configurable default maximum 1.5× with travel distance. Cooldown 9.5s. |

Fizz has 140 HP, 4.5 cruise speed and 6 contact damage. W, passive mitigation and the optional second E recast are omitted. The automatic E chooses the full vault and splash. All movement destinations are clamped to the current arena. A victim that is untargetable when the shark erupts takes no damage. Expanding water, a circling fin and the emerging toothed shark show the lure's actual phases.

The three new kits were checked against the full ability descriptions embedded on Riot's official champion pages on 2 November 2026. Timing and numerical values above are simulator tuning. Projectiles, dash traces, traps, bolts and return lifetimes are bounded per slot; finishing a round clears all of them.

## Artwork and attribution

The Aatrox and Ekko portraits are the first and second images supplied by the project owner, respectively. Their original PNG bytes are bundled as `content/characters/aatrox/assets/body.png` and `content/characters/ekko/assets/body.png`; the app clips them into circles while drawing. No external image URL is required for playback, exports or recording.

The Ahri, Caitlyn and Fizz portraits are the unmodified official 120×120 PNG champion icons from Riot Data Dragon 16.21.1, stored in each character's `assets/body.png`. Source links: [Ahri](https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/Ahri.png), [Caitlyn](https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/Caitlyn.png), [Fizz](https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/Fizz.png). The manifests retain these credits for exported packs.

All five champions also bundle their three official Riot skill icons as `assets/skill-<slot>.png`, referenced by each skill's `icon` field. They were retrieved unmodified from the Data Dragon 16.21.1 URLs embedded on Riot's champion pages. Asset names are `AatroxQ/W/R.png`, `EkkoQ/E/R.png`, `AhriQ/E/R.png`, `CaitlynQ/W/R.png`, and `FizzQ/E/R.png` under `https://ddragon.leagueoflegends.com/cdn/16.21.1/img/spell/`. For example: [Ahri Q](https://ddragon.leagueoflegends.com/cdn/16.21.1/img/spell/AhriQ.png). These icons appear in the compact health HUD, detailed hover/focus readouts and portrait recordings, and are included in exported packs.

The five champions, League of Legends and all bundled Riot Games artwork remain the property of Riot Games. Those portraits and skill icons are **not covered by this repository's MIT license**. The character manifests record their attribution separately. The simulator code is MIT-licensed. This fan-made project is not affiliated with or endorsed by Riot Games.

## Checks

`tests/champions.test.ts` verifies the exact three-skill loadouts, sword geometries/sweet spots, independent aim locks, chain escape/pull outcomes, active-only transformation modifiers, two-leg projectile hit limits and homing return, consumed blink attacks, historical rewinds, immunity, recent-damage healing, live-arena clamping, pause and bounded independent history.

`tests/browser/champions.spec.ts` checks the supplied portraits, editor settings and all six health-panel rows, compares visible and animated effects for every ability, and decodes an actual 9:16 recording of both full kits. [Ability gallery](league-abilities.png) · [Portrait recording frame](league-portrait.png).

`tests/league-expansion.test.ts` covers the three new loadouts, delayed first casts, orb pass limits/homing, charm movement and disables, three-dash/bolt accounting and interrupts, locked rifle windups, trap arming/root/follow-up/pool limits, tracked snipe channels and evasion, targetable dash-throughs, untargetable hops and splash, delayed attached/missed sharks, pause and independent runtime.

`tests/browser/league-expansion.spec.ts` checks all three portraits, category membership and three-slot editors, compares visible/animated/paused frames for every new ability, and encodes/decodes two actual 9:16 recordings containing all three new full kits. [New ability gallery](league-expansion-abilities.png) · [Ahri/Caitlyn recording](league-expansion-portrait-0.png) · [Fizz recording](league-expansion-portrait-1.png).
