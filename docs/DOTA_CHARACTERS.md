# Pudge: Dota 2 arena adaptation

Pudge has exactly three skills: **Q Meat Hook, W Rot, R Dismember**. His portrait, combat state, effects and cooldowns work in the roster, custom character editor, square recordings and 9:16 recordings. He starts only when the user clicks Run, like every other ball.

Mechanics were checked against [Valve's Pudge page](https://www.dota2.com/hero/pudge) and [official English hero data](https://www.dota2.com/datafeed/herodata?language=english&hero_id=14). The simulator preserves the abilities' defining behavior and uses values tuned for a small, automatic, two-ball arena. It does not reproduce Dota's current patch balance, items, attributes, attack types or talent system.

## Automatic behavior

- **Meat Hook:** after its first 5.5s cooldown, Pudge stops and aims at the opponent for 0.18s. A visible hook and linked chain travel along that locked direction at 7 units/s, up to 4.5 units or the arena wall. The first target hit takes 18 damage and is disabled and physically reeled to a safe gap beside Pudge. A miss visibly retracts too. The hook interrupts Dismember; an interrupted pre-launch windup cancels. An already launched hook completes its return. Untargetability releases the caught target. Only one hook per skill slot can be in flight.
- **Rot:** this is a toggle in Dota; the simulator automatically turns it on when a target touches its 1.15-unit cloud and off when there is no valid target in range. The visible toxic cloud follows Pudge. It slows by 25% and applies 2 damage to the enemy and 2 self-damage every 0.2s. Self-damage leaves at least 1 HP; enemy damage can still kill Pudge. Rot continues during Dismember or a disable, does not share the contact-attack gate, and stops ticking when the simulation pauses. Each new activation starts a fresh tick interval.
- **Dismember:** after a 9s cooldown, waits until the opponent is within 0.55 units of the two bodies' combined radii. Pudge channels for 2.75s, immobilizing himself, disabling the target's movement and active attacks/casts, and pulling it closer at 1.5 units/s. Five 5-damage ticks occur at 0.5s intervals. Each tick heals Pudge for the HP damage actually dealt, up to maximum HP; shield absorption generates no healing. Animated jaws chomp around the opponent and drain motes flow back to Pudge. Disabling the caster, untargetability or moving the target beyond channel reach interrupts it and releases its locks. The cooldown starts on cast, including interrupted casts.

Hook and Dismember reserve Pudge's active casting while executing; Rot can run alongside either. Their movement and disable locks are keyed per actor and slot, so finishing one effect cannot clear another effect's control. Passive effects already in the world continue while a ball is disabled. Damage uses the existing complete damage batch before knockout resolution.

Flesh Heap, Meat Shield, Strength scaling, talents and upgrades are omitted to preserve the three-skill limit. Hook cannot leave the arena, and the current duel has no allies to hook. Imported character packs can reuse all three mechanics and adjust damage, hook windup/reach/speed, Rot tick interval/self-damage/slow, and Dismember duration/reach/pull speed/healing fraction. New executable behavior still requires a source contribution.

## Artwork and attribution

The unmodified [official Valve Pudge portrait](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/pudge.png) is stored at `content/characters/pudge/assets/body.png`. The renderer and health cards preserve its aspect ratio and clip it to a circle. Recording and exported packs use the bundled image; they do not need an external image request.

The compact HUD also bundles the unmodified official [Meat Hook](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/pudge_meat_hook.png), [Rot](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/pudge_rot.png) and [Dismember](https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/pudge_dismember.png) icons as `assets/skill-q.png`, `assets/skill-w.png` and `assets/skill-r.png`. The three `skills[].icon` references survive recording and ZIP export/import with the portrait.

Pudge, Dota 2, the portrait and ability icons are the property of Valve Corporation. The images are **excluded from this repository's MIT license**, as declared in the character manifest. Simulator code and documentation use MIT. This is an unaffiliated fan adaptation.

## Verification

`tests/pudge.test.ts` covers manual Run and first cooldowns, locked hook aim, one-hit physical reeling and misses, untargetability and interrupts, simulation-time Rot ticks and non-lethal self-damage, Dismember range/disable/pull/drain, shield-aware capped healing, Rot during channels, independent lock cleanup and fresh runtime state.

`tests/browser/pudge.spec.ts` checks the three-slot editor, local portrait, visible animation and pause behavior for all three effects and their combination. It also encodes and decodes a real 720×1280 video containing the full kit and its health-panel readouts. [Ability gallery](pudge-abilities.png) · [Decoded recording frame](pudge-portrait.png).
