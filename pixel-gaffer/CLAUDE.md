# Pixel Gaffer '96

A 90s-style football management game that runs in a phone browser. You manage one club
through a career of seasons across four English-style divisions. It is a plain web page with no
build step and no server: open `index.html` and it runs. Everything is saved in the browser.

About 5,000 lines in total. There is no framework, no bundler and no test suite.

---

## How it is built (plain English)

### The pieces

The page loads ten script files in a fixed order. Each one adds functions and data to the
same shared space, so a later file can use anything an earlier file defined.

| File | What it does |
|---|---|
| `index.html` | The page itself: all the styling (colours, fonts, the scanline background, phone and laptop layouts) and the list of scripts to load. The body is one empty `<main id="app">` that the game fills in. |
| `../scores.js` | Shared with the other family games in this repo. Sends high scores (keepy-uppies, free kicks, career points, achievements) to a family leaderboard if one is set up. Optional. |
| `data.js` | The raw ingredients: first and last names, the 48 made-up clubs with their kit colours, the four divisions, player traits, the six formations, the six playing styles and which style beats which, training types, and the code that makes a player or a whole new world. |
| `engine.js` | The rules of the game: the fixture list, league tables, picking teams, the match simulator, what happens after a match (ratings, injuries, cards, morale), money, the board, the stadium, transfers between computer clubs, the end of season, promotion and relegation, ageing and retirement, job offers. |
| `comps.js` | The extra cups: the Pixel Vase, the Floodlit Cup and two European cups, plus the 16 foreign clubs they need. |
| `pixel.js` | Pixel art drawn in code: club badges, tiny top-down players, the animated match pitch, and the sound effects (all synthesised, no audio files). |
| `minigames.js` | The arcade-style mini-games: take a penalty, save a penalty, a free kick round a wall, keepy-uppy, and a full penalty shoot-out. |
| `scenarios.js` | 96 short "dilemma" stories (24 per division) that pop up during the season, and the code that applies their effects. |
| `features.js` | A grab-bag of extras: save slots and backups, achievements, chiptune music, pixel menu icons, scouting, player comparison, the guided tour, goal highlights, the trophy-lift animation, and loans. |
| `deadline.js` | Transfer deadline day: a timed, fast-paced set of five deals twice a season. |
| `ui.js` | Every screen you see, every button, and the order things happen in each week. The biggest file (about 1,400 lines). |
| `sw.js` + `manifest.webmanifest` + icons | Makes it installable as a phone app and lets it work offline. It always tries the internet first so updates show straight away. |

### The one big object

Everything about a career lives in one object called `W` (the "world"): every club, every
player, the fixtures, results, inbox, news, money, board mood, fans, history and settings.
Saving is just turning `W` into text and storing it in the browser's local storage.
Loading reads it back. A backup is the same text downloaded as a `.json` file.

Players and clubs are looked up by number with two tiny helpers, `P(id)` and `C(id)`.
`me()` is always the user's club.

### How the screens work

There is a second small object, `UI`, that remembers which screen and tab you are on.
`render()` looks at it and rebuilds the whole page as HTML text. Nothing is updated
piece by piece: change a value, call `render()`, and the page is redrawn.

Buttons don't have their own click code. Each one carries a label like `data-a="kickoff"`,
and one listener at the bottom of `ui.js` looks that label up in a big list of actions
called `ACT` and runs it. To find what a button does, search `ui.js` for its label.

Pop-up boxes (player cards, haggling, settings, dilemmas) are "modals" drawn on top of
the page. The mini-games and highlights are full-screen overlays with their own canvas.

### The weekly loop

A season is 33 weeks. Each week is either a league round, an Old Tin Cup round, or a
midweek cup round (the Vase, Floodlit Cup or Europe).

1. You press the big **PLAY / NEXT** button at the top.
2. If it's deadline day (weeks 2 and 23) you go to Deadline Day first.
3. Sometimes (about 45% of weeks, never two weeks running) a dilemma pops up.
4. If you have a game, you see the Match Day screen: scout report, your line-up, maybe a
   press question. You choose **Kick off** (watch it) or **Quick result**.
5. A watched match runs one simulated minute at a time on the animated pitch with
   commentary. Penalties and free kicks for you can become mini-games. You get a half-time
   team talk and can pause to change tactics or make subs.
6. Full time shows the score, scorers, stats and player ratings.
7. Every other match in the country is simulated in the background, money comes in and
   goes out, players recover and train, computer clubs buy and sell, and bids for your
   players may arrive in your inbox.
8. The week report shows your result, your money and a "vidiprinter" of all the scores.
9. After week 33 comes the season review: final position, trophies, awards, promotions
   and relegations, contracts to renew, youth players, and maybe job offers or the sack.

### How a match is decided

Each minute the simulator works out which side has the ball, weighted by midfield strength.
The team with the ball may attack down the left, centre or right, depending on where its
players stand in its formation and where it has chosen to focus. If an attack comes off it
becomes a shot, a free kick or a penalty, and the shooter's skill is compared with the
keeper's. Along the way players tire, pick up cards and injuries, and computer managers
make substitutions and go all-out-attack when losing late on.

A team's strength comes from each player's four skills (pace, tackling, passing, shooting,
plus goalkeeping), scaled by fitness, form, morale and whether he is playing in his proper
position. Then the style matters: each style gets a 6% boost against the two styles it
"beats", and the home side gets 8%.

---

## Every feature

### Starting out
- Title screen with an animated pixel match playing behind the logo.
- New career: type your manager name, pick any of the 48 clubs (each division is labelled
  with a difficulty, from Hard in the Premier to Classic in Division Three).
- Three save slots, each holding a separate career, with load, delete and overwrite.
- Back up a career to a downloaded file, and restore it into any slot.
- "How to play" help page.
- A guided tour on your first week that spotlights each part of the screen.
- Arcade mode from the title screen: play the mini-games without a career.
- Music on/off switch on the title screen.

### The world
- 48 home clubs in four divisions of 12, each with its own name, kit colours and badge pattern.
- 16 foreign clubs from 16 countries, used only in the European cups.
- About 900 generated players with names, ages, positions (GK, DF, MF, FW), four skills,
  potential, wage, contract length, value, fitness, morale, form and sometimes a trait.
- Ten player traits: Engine, Poacher, Brick Wall, Maestro, Hothead, Glass Ankles,
  Dead-ball King, Captain Fantastic, Wonderkid, Cat-like.
- A pool of about 24 free agents, topped up every summer.
- Dates run from August 1996 onwards.

### Home screen
- Next game: opponent, home/away, competition, their league position and form.
- A "tactics check" telling you whether your style beats theirs, with one-tap buttons to switch.
- Derby-day banner with your all-time record against your local rival.
- Alert buttons for messages needing an answer and players injured or suspended.
- Four tiles: league position, board confidence, fan mood, unread messages.
- A scrolling "PIXTEXT" news ticker.
- On taller screens: a mini league table, the next few fixtures, and the latest results.
- Save and quit to menu.

### Squad
- Full squad list with three views (overview, contract, season stats), sortable by any column.
- Summary: weekly wages and how much the TV money covers, squad value, average age,
  average rating, top scorer, contracts running out.
- Player card: skills as bars, potential as stars, fitness, morale, form, value, wage,
  contract, season stats, trait, injury and suspension.
- For your players: transfer list / unlist, offer a new contract, send a young player out
  on loan, release (paying up his contract).
- Players out on loan listed separately.

### Tactics
- Six formations: 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 4-2-4.
- A pitch with your eleven shirts on it; tap a shirt to swap the player. Players out of
  position show in red.
- Five substitutes to choose.
- "Pick best XI" button and an "auto-pick every week" switch.
- Six playing styles (Passing, Long Ball, Counter, High Press, Park the Bus, All-out Attack),
  each beating two others.
- Attack focus: mixed, left, centre or right, with a hint on where the next opponent is weakest.
- Look at any opponent: their likely team on a pitch, style, form, danger man, squad list.

### Transfers
- Transfer market: all players, transfer-listed, free agents or your own, filtered by
  position, "can afford" and "21 and under". Shows the best 60.
- Scouting: other clubs' players show only a rough rating range until you pay to scout
  them (one player, or a whole squad at four times the price).
- Compare a target side by side with your best player in that position.
- Haggling: you bid against the selling chairman, who has three lots of patience and
  gets angrier with low offers.
- Contract talks: he names a weekly wage on a three-year deal.
- Some players refuse to drop down a division.
- Loan players in (fee plus wages, up to three at once) from clubs in your division or one above.
- Computer clubs make bids for your players; you accept or reject in the inbox. Rejecting
  can bring an improved bid. Bids expire after two weeks.
- Computer clubs buy and sell among themselves, reported as news headlines.
- Squad size limits: at most 26, at least 14.

### Deadline Day (twice a season)
- A full-screen "deadline day" with a ticking clock running towards midnight.
- Five quick deals, 12 seconds each: a panic bid for one of your players, a bargain from a
  club needing cash, a free loan, an unhappy player wanting out, a free agent turning up late.
- A "breaking news" ticker of other clubs' panic buys.
- A log of everything you did that night.

### Match day
- Pre-match screen: scout report (formation, style, form, danger man), strength bars
  comparing defence, midfield and attack, your line-up.
- Random press conference question (and a special one before derbies); answers change
  squad morale and board confidence.
- A warning from your assistant if their style beats yours.
- Watch the match live, or take a quick result.

### The live match
- Animated top-down pixel pitch, with a close-up camera or whole-pitch view.
- Scoreboard, minute, possession and shots.
- Scrolling commentary (goals, saves, misses, cards, injuries, subs).
- Three speeds, and a skip-to-the-end button.
- Pause for tactics: change style or formation, make up to three subs.
- Half-time team talk: praise, stay calm, or the hairdryer. The effect depends on the score.
- Extra time and penalties in cup games.
- Match analysis: a heat map of where the ball was, arrows showing how often each side
  attacked down each channel, and where the other side is weakest. Change attack focus from here.
- On laptops the analysis sits beside the pitch.

### Mini-games (inside matches, if switched on)
- Take a penalty: tap to aim, tap for power.
- Save a penalty: tap where to dive.
- Free kick: aim, curl and power to bend it round the wall.
- Penalty shoot-out: five each then sudden death, taking yours and saving theirs.
- A "let the computer decide" button on each.

### After the match
- Full-time page: score, scorers with minutes, possession and shots, player ratings with a star man.
- "Watch the goals" highlights replayed on the pixel pitch.
- A trophy-lift animation with fireworks when you win a cup final.
- Week report: your result, league position, gate money, boxes, shop, wages, TV money,
  injuries, suspensions, players who improved in training, board warnings.
- Vidiprinter of every score that week, grouped by division or cup.

### League and cups
- League tables for all four divisions with promotion and relegation zones.
- Your fixture calendar for the whole season, with results and a hard/fair/easy rating for
  games still to come.
- Five knockout cups:
  - Old Tin Cup: every home club, six rounds, top 16 get byes, final on neutral ground.
  - Pixel Vase: Divisions Two and Three.
  - Floodlit Cup: Division One.
  - Euro Champions Cup: last season's top four Premier sides plus four foreign clubs.
  - Euro Fairs Trophy: the rest of the Premier plus eight foreign clubs.
- Each cup shows its current draw and every past round.
- Prize money for each round won.
- Twelve stats pages: goals, assists, average rating, star-man awards, clean sheets,
  discipline, form table, home table, away table, best attack, best defence, your own club.

### Club
- Training: six focuses (balanced, shooting, defending, passing, fitness, rest) and three
  intensities (light, normal, hard). Young players and Wonderkids improve fastest; hard
  training brings more injuries.
- Drill of the week: play keepy-uppy or five free kicks for a training bonus that week.
- Finances: bank balance, wages, TV money, last gate, ticket price up and down.
- Stadium: capacity, last crowd against demand (how many were turned away), build a small or
  big stand (takes weeks and closes some seats while building), executive boxes and club
  shop at three levels each. Each division has a capacity limit.
- History: board target and mood, local-rivals record, trophy cabinet, career points,
  season-by-season record, achievements.
- Settings: play set pieces yourself, sound, camera, match speed, music, backup, save slots,
  replay the tour, resign.

### The board, fans and career
- The board sets a target each season based on how strong your squad is
  (e.g. win the league, top half, avoid relegation).
- Board confidence moves with every result, your league position, debts and derbies.
- Fan mood moves with results and derbies, and affects crowds and shop takings.
- Each club has one local rival. Derbies bring bigger crowds and more cards, and swing
  fans, board and squad morale. Doing the double (or losing twice) gets its own message.
- End of season: prize money by position, two up and two down in each division,
  champions and golden boot in every division, cup winners.
- Players age; young ones grow towards their potential, older ones decline and retire.
- Contracts run down; you choose who to renew in the summer. Computer clubs renew most of theirs.
- Two or three youth players join your club every summer.
- Loans end and players return home.
- Manager points add up across your career.
- Job offers from bigger clubs after a great season; the sack after a bad one (with one
  grace year in a new job), then offers from clubs at your level or below. You can also resign.

### Inbox and news
- Messages from the chairman, assistant, supporters' trust, stadium manager and others.
- Transfer bids with accept/reject buttons.
- A teletext-style news page ("P302 PIXTEXT FOOTBALL") with headlines and latest results,
  and a mail page ("P101").

### Dilemmas
- 96 short stories, 24 per division, in two sets of 12. Division Three gets tea urns and
  broken mowers; the Premier gets billionaire takeovers and pop singles.
- Each has two to three answers; some are gambles that can go either way.
- Effects can touch fans, squad morale, board, money, fitness, ticket price, ground size,
  training, one player's morale, form, injury, wage or skill, signing a new player,
  selling or listing one, youth intake, or healing injuries.

### Achievements
- 30 achievements kept on the phone across every career, from "first win" to
  "Kings of Europe", "Keepy-uppy legend" and "get the sack". A pop-up appears when unlocked.

### Look, sound and feel
- Pixel fonts (Press Start 2P and VT323 from Google Fonts), dark blue retro palette with scanlines.
- Pixel club badges and player portraits generated from kit colours.
- Pixel icons in the bottom menu (Home, Squad, Tactics, Tables, Club).
- Synthesised sound effects: whistle, kick, crowd roar, "ooh", good and bad jingles.
- Two original chiptune tunes, played live, on the title and season-review screens.
- Swipe left and right to move between the main tabs.
- The phone's back button goes back inside the game instead of leaving it.
- Most screens are designed to fit without scrolling.
- Laptop layout with a sidebar and two columns; keyboard shortcuts (Enter, 1 to 5, Esc).
- If something breaks, a message says so (with where it happened) and the game is saved.
- Installable as an app and playable offline.

---

## Working on it

- No build: edit a file and reload the page. Serve the repo root (not this folder) so
  `../scores.js` loads, e.g. `python3 -m http.server` from the repo root.
- If you add or rename a script, add it to the list in `sw.js` and bump the version
  number in `CACHE` there, or phones will keep the old copy.
- Saves must keep loading: `continueGame` and `cleanSquads` repair older saves. Any new
  field on `W`, a club or a player must cope with being missing.
- Keep the UK, plain-English, 90s tone in all text the player sees.
