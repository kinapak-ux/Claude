# Scoot City

A side-on, pixel-art scooter game set around a city. Open `index.html` in a browser; there is nothing to install.

## Files

- `scoot-city.html`: the game source (markup, styles and script in one file).
- `index.html`: the standalone page, generated from `scoot-city.html` by `./build.sh`. Rebuild it after editing the source.

## Levels

Finishing a level unlocks the next (Options has "Unlock all levels").

| Level | Setting | What's new |
| --- | --- | --- |
| Downtown | Midday streets | Tutorial signs, ramps, rails, a trench gap |
| Harbour Yards | Sunset docks | Containers, pipe grinds, water gaps |
| Underground | Tube station | Ticket gates, escalator handrails to grind, track gaps, a train roof |
| Skate Plaza | Park | Quarter pipes, ledges, funbox. A 90-second score attack, no finish line |
| Car Park | Multi-storey | Parked cars and vans, barrier arms, kerb grinds, down ramps you can jump |
| Construction Site | Overcast site | Scaffolding, crane cable and girder grinds, swinging wrecking balls, hard hats to find |
| Market Day | Morning market | Bouncy awnings, stalls and crates, shoppers walking about |
| Canal Towpath | Canal | Arched bridges, lock gate grinds, barges to hop between |
| Shopping Centre | Indoors, after hours | Slippery floors, escalators, glass balconies, fountains, security torches that end your combo |
| Downhill Rush | Steep streets | Long descents, high speed, barriers that need quick reactions |
| Midnight Rooftops | Night | Rooftop gaps, wire grinds, big drops |
| Blackout | Finale | The level collapses behind you while a helicopter spotlight follows. Don't get caught |

**Daily Run** builds a new level every day from the date, with fixed weather, so everyone plays the same course. On the published page, signed-in players share one daily leaderboard; elsewhere scores stay on the device.

Each level has four challenges: a par time (or two score targets on the timed plaza), a target score, collecting S-C-O-O-T, and one special goal.

## Riding

- **Jumping:** jump, then jump again in the air for a boost pop.
- **Tricks:** Trick 1 is a 360 (tap again for 720 or 1080) and Trick 2 a tailwhip. Hold Down with Trick 1 for a backflip, or with Trick 2 for a Superman.
- **Grinds:** land on any rail, pipe, wire, cable, girder, gate, kerb or ledge to grind it.
- **Combos:** jump again within half a second of landing to link a combo. The multiplier counts the tricks in the chain (up to x10). Landing mid-trick is a bail and loses the combo.
- **Turning round:** brake to a stop and keep holding back to turn. Quarter pipes turn you round in the air.

## Riders, power-ups and the level editor

- **Riders:** Street Kid, Robot, Gorilla, Alien, Skeleton and Astronaut, plus seven outfit colours. They unlock with challenge stars (4 per level, 48 in all). Options has "Unlock all riders and colours".
- **Power-ups** appear on long flat stretches:
  - Rocket: faster and pushes for you, 5 s.
  - Super Spring: higher jumps, 8 s.
  - Shield: absorbs one crash.
  - Double Points: 10 s.
  - Magnet: pulls in cans and letters, 10 s.
- **Level editor:** build a level piece by piece. Pieces are flat, kicker, landing ramp, funbox, obstacle (barrier, crate, container, car, van, skip, stall, bouncy awning, ledge, barrel), gap, stairs, slope up and down, drop, and ledge up. Each piece can carry a letter, cans, a rail, a checkpoint, a power-up or a hazard. Choose the setting, test it, save it to Level select, and share it as a `SCOOT1:` code that friends load with Import.

## Options and extras

- **Weather:** Clear, Rain, Snow, Fog, Gale or Storm. Each changes grip, speed, visibility or air control and pays a score multiplier. Indoor levels have no weather.
- **Night:** most outdoor levels can be ridden at night for an extra x1.25.
- **Ghost:** your fastest finish on each level is replayed as a ghost to race. You can turn it off in Options.
- **Scooters:** four decks with different speed, acceleration, pop, trick speed and grip.
- **Pause and options** (Esc, P or the II button): resume, restart, options, main menu. Options cover music, sound, screen shake, full screen, touch buttons and the ghost.
- **High scores:** top 8 per level, saved in the browser.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Push / brake | Right / Left (or D / A) | D-pad or stick |
| Jump, boost in air | Space, Up or W | A |
| Trick 1 / Trick 2 | J or Z / K or X | X / B |
| Flip modifier | Hold Down or S | D-pad down |
| Pause | Esc or P | Start |

Touch screens get on-screen buttons. Slide your thumb from JUMP onto T1 or T2 to trick straight after jumping.
