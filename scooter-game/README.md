# Scoot City

A side-on, pixel-art scooter game set across three city levels. Open `index.html` in a browser; there is nothing to install.

## Files

- `scoot-city.html`: the game source (markup, styles and script in one file).
- `index.html`: the standalone page, generated from `scoot-city.html` by `./build.sh`. Rebuild it after editing the source.

## What's in it

- **Levels**: Downtown (midday), Harbour Yards (sunset docks with water gaps) and Midnight Rooftops (gaps, power-line grinds). Finishing a level unlocks the next.
- **Tricks**: jump, then jump again in the air for a boost pop. In the air, Trick 1 is a 360 (tap again for 720/1080), Trick 2 a tailwhip, Down + Trick 1 a backflip, Down + Trick 2 a Superman. Land on rails, pipes and wires to grind.
- **Combos**: jump again within half a second of landing to link tricks. The multiplier is the number of tricks in the chain (up to x10). Landing mid-trick is a bail and loses the combo.
- **Challenges** per level: beat the par time, reach the target score, collect the S-C-O-O-T letters, plus one level-specific goal.
- **Weather**: Clear, Rain, Snow, Gale and Storm. Each changes grip, speed or air control and pays a score multiplier.
- **Scooters**: four decks with different speed, acceleration, pop, trick speed and grip.
- **Pause / options** (Esc, P or the II button): resume, restart, options, main menu. Options cover music, sound, screen shake and touch buttons.
- **High scores**: top 8 per level, saved in the browser.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Push / brake | Right / Left (or D / A) | D-pad or stick |
| Jump, boost in air | Space, Up or W | A |
| Trick 1 / Trick 2 | J or Z / K or X | X / B |
| Flip modifier | Hold Down or S | D-pad down |
| Pause | Esc or P | Start |

Touch screens get on-screen buttons automatically.
