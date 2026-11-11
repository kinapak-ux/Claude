# FPL Team News Tracker

A personal web page for FPL team **2612117** that shows, for every player in your squad:

- 🔴🟠🟢 **Flags**: red = injured, suspended or unavailable. Amber = doubtful (25–75% chance of playing) or poor recent form (under 180 minutes or under 10 points in the last 5 gameweeks). Green = fine.
- **Injury news** taken straight from FPL.
- **Points in each of the last 5 gameweeks.**
- **Next 3 fixtures**, coloured by difficulty: dark green is easiest, dark red is hardest. Lowercase means away.
- **Transfer ideas**: up to 3 players worth selling, each with 3 in-form, fit replacements in the same position that you can afford (their price plus your bank) and that don't break the 3-players-per-club rule.

It also shows:

- **Captain picks**: your best 3 options for the next gameweek, based on FPL's expected points, form and fixture.
- **Price watch**: price changes this gameweek, plus an estimate of who's likely to rise or fall based on this gameweek's transfers. Treat it as a guide, not a guarantee.
- **Chip planner**: for each chip you haven't used, the estimated chance it pays off in each of the next 8 gameweeks, with the best week highlighted. "Pays off" means your bench scores 15+ (Bench Boost), your captain scores 12+ (Triple Captain), or you'd score 12+ more than your own team (Free Hit). The Wildcard gets a play-or-hold verdict based on how many players need replacing. These are estimates from a simple simulation of your current squad, and double gameweeks announced later will change them.
- **Free transfers**: an estimate of your banked free transfers (next to your bank balance), rebuilt from your transfer history (FPL doesn't publish the exact number).
- **Doubles & blanks**: a warning box for upcoming double and blank gameweeks in the next 8, showing which of your players are affected. Also in the email.
- **Points race**: a chart of everyone's gap to the NLLL leader, gameweek by gameweek. Tap a gameweek for the numbers, or open "Show as table".
- **Mini-leagues**: standings for New Longton Legends (shown as NLLL), which players your rivals start that you don't, who they captain, and your differentials. Pick any manager from the **Compare with** list, or tap them in the table, to see your squads side by side: only you, both, only them. The deadline email also sums up the leader and the managers just above and below you.

- **Live gameweek scores** while matches are on: your live points (with provisional bonus, auto-subs, vice-captain cover and transfer hits), each player's points, and a live New Longton Legends table with everyone's live total, captain and players left to play.

The page refreshes itself twice a day, and about every 10 minutes while matches are on. The page also reloads itself during matches. On the **morning of each deadline** it also emails you a summary.

## One-time setup (about 2 minutes)

1. On GitHub, open this repository and go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab, click **Update FPL tracker** on the left, then **Run workflow**.
4. When it shows a green tick (about a minute), your page is live at
   **https://kinapak-ux.github.io/Claude/**. Bookmark it on your phone.

## Email setup (about 5 minutes, one time)

The email is sent from your own Gmail. It needs an **app password**: a separate password that only this tracker uses and that you can delete at any time.

1. Turn on 2-Step Verification for your Google account if it isn't on already: https://myaccount.google.com/signinoptions/twosv
2. Go to https://myaccount.google.com/apppasswords, type a name like `FPL tracker`, and click **Create**. Copy the 16-letter password it shows.
3. On GitHub, open this repository and go to **Settings → Secrets and variables → Actions → New repository secret**. Add two secrets:
   - Name `GMAIL_ADDRESS`, value: your Gmail address
   - Name `GMAIL_APP_PASSWORD`, value: the 16-letter password
4. Test it: **Actions → Update FPL tracker → Run workflow**, tick **Send the deadline email now**, then **Run workflow**. Check your inbox.

Secrets are private. They never appear on the page or in the code, even though the repository is public.

## Good to know

- **Refresh now:** Actions tab → *Update FPL tracker* → *Run workflow*.
- **Transfers show after the deadline.** FPL only makes your new squad public once the gameweek deadline passes, so transfers appear after that.
- **Selling prices are approximate.** FPL doesn't publish your exact selling price, so the budget uses current price plus bank.
- **Live score timing:** GitHub's scheduled runs can be 5–20 minutes late at busy times (Saturday afternoons especially), so live scores may lag the FPL app a little.
- **Email timing:** sent by the 6–7am (UK) run on deadline day. GitHub's scheduled runs can be up to an hour late at busy times.
- **Change which mini-leagues show:** edit `LEAGUES` in `.github/workflows/update-tracker.yml`. Separate several names with commas, or leave it empty for all private leagues.
- **Change the league's short name** (currently NLLL): edit `LEAGUE_NICKNAMES` in `.github/workflows/update-tracker.yml`.
- **Change team:** edit `TEAM_ID` in `.github/workflows/update-tracker.yml`.
- **Change the chip targets** (for example, 20+ for Bench Boost): see the settings at the top of `chips.py`.
- **Change the rules** (number of fixtures, form thresholds and so on): see the settings at the top of `build.py`.

## Card Battler (card game for the kids)

A fantasy Top Trumps game that 2 to 6 players play on their own phones. It lives in `card-battler/index.html` and is published with the tracker at
**https://kinapak-ux.github.io/Claude/card-battler/** (the old `/top-trumps/` address redirects there)

- One player taps **Host a game** and gets a 4-letter code. The other players open the same page, tap **Join a game** and type the code. The host's phone runs the game, so the host needs to keep the page open.
- You can add computer players to make up the numbers, or tap **Practise against the computer** to play alone.
- 57 cards: 22 Common, 17 Rare, 11 Epic, 6 Legendary and 1 secret Mythic (Aurelion, which turns up in about 1 game in 3). Each card has six stats: Strength, Magic, Intelligence, Wit, Courage and Fear Factor. 37 cards have special powers, such as stealing cards, halving an opponent's number, making the lowest number win, switching the stat, passing everyone's card along, or a Dragon Egg that grows and hatches.
- The deck is balanced by simulation: on average Commons win about 15% of battles, Rares 27%, Epics 39%, Legendaries 50% and the Mythic 70%.
- **Hero cards:** each player can design their own card (creature, home and 280 stat points, no power). If the host switches Hero cards on, they join the deck.
- **Packs:** every game starts with each player opening their pack.
- **Album:** cards from your packs and the battles you win are collected in **Cards & album**.
- **Card style:** Classic, Halloween or Christmas. It defaults to Halloween in October and Christmas in December.
- Game length: Quick (15 rounds), Standard (30 rounds) or Epic Quest (play until one player owns every card).
- Phones connect directly to each other using PeerJS's free connection service, so nobody needs an account. It works best when everyone is on the same Wi-Fi.

## Family games (install them like apps)

All thirteen games, plus Moth Synth, are published with the tracker and can be installed on a phone's home screen, where they open full screen with their own icon:

**Family Arcade**, the front page for all the games, is at **https://kinapak-ux.github.io/Claude/games/**. Each game has its own little looping animation; tap one and it opens with a colour-wipe. It can be installed on a phone too, and it respects the phone's *Reduce motion* setting.

| Game | Address |
|---|---|
| Card Battler | https://kinapak-ux.github.io/Claude/card-battler/ |
| Scoot City | https://kinapak-ux.github.io/Claude/scoot-city/ |
| Skirmish Chess | https://kinapak-ux.github.io/Claude/chess/ |
| Hoop Shot | https://kinapak-ux.github.io/Claude/hoop-shot/ |
| Archery | https://kinapak-ux.github.io/Claude/archery/ |
| Board School (backgammon & Go) | https://kinapak-ux.github.io/Claude/board-school/ |
| Echo Wheel | https://kinapak-ux.github.io/Claude/echo-wheel/ |
| Family Quiz Night | https://kinapak-ux.github.io/Claude/family-quiz/ |
| Battleships | https://kinapak-ux.github.io/Claude/battleships/ |
| Snap Race | https://kinapak-ux.github.io/Claude/snap-race/ |
| Times Table Blaster | https://kinapak-ux.github.io/Claude/times-tables/ |
| Blow Out the Pumpkin | https://kinapak-ux.github.io/Claude/pumpkin/ |
| Pixel Gaffer '96 | https://kinapak-ux.github.io/Claude/pixel-gaffer/ |
| Moth Synth | https://kinapak-ux.github.io/Claude/synth/ |
| Overhead (satellite tracker) | https://kinapak-ux.github.io/Claude/satellites/ |

**To install:** on Android, open the game in Chrome, tap **⋮** and then **Install app** (or **Add to Home screen**). On iPhone, open it in Safari, tap **Share** and then **Add to Home Screen**.

Once a game has been opened, it also works with no signal. The exception is anything that needs other phones, such as Card Battler multiplayer.

Family Quiz Night, Battleships and Snap Race also work like Card Battler: one phone hosts and shows a 4-letter code, and the others join with it. Each also has a no-internet mode (pass-the-phone quiz, Battleships against the computer, Snap practice against computer racers). Their shared code is in `party.js` (connecting phones) and `kit.css` (the look).

Blow Out the Pumpkin: tap **Light the candle**, allow the microphone, then blow on the phone and the candle flickers and goes out. Tap to light it again. Without a microphone, hold a finger on the pumpkin to blow instead. It doesn't send scores to the leaderboard.

**Board School** teaches backgammon and Go, one short lesson at a time, with an owl explaining each step.

- **Backgammon:** 8 lessons (the board, moving, blocked points, hitting, the bar, doubles, bearing off, winning and strategy), each with a real position to play. Then a full game against the computer (easy or normal) or a friend on the same phone. While you play, legal moves glow, **Hint** shows what the owl would play, and **Undo** takes back moves until you tap **End turn**. There's no doubling cube.
- **Go:** 9 lessons (stones, liberties, capturing, escaping atari, ladders, suicide, ko, eyes, scoring). Then a full game on 9×9 or 13×13 against the computer or a friend. Stones in atari get a red ring, **Hint** shows a suggested move, and when both players pass, the owl marks stones it thinks are dead (tap a group to change it) and counts the score (area scoring, 6.5 komi).
- It works with no signal after being opened just once, including the lessons and games against the computer. Scores earned offline are sent the next time the phone is online.
- Finished lessons get a tick, saved on that phone. Games against the computer (won or lost) and the number of lessons finished go to the family leaderboard; games against a friend don't.

Moth Synth is a synthesizer with a loop recorder and a drum machine.

- **Playing:** tap the keys on screen (slide your finger for a glissando; tap lower on a key to play louder), or on a computer use A to ; for the white notes, W E T Y U O P for the black ones, and Z / X to change octave. Switch the bottom bar to **Drum pads** to play 8 drums (or press 1 to 8). **Chord** (in Voice) plays a whole major, minor, 7th or power chord from one key.
- **Looper:** press **Record** (or R). You get a bar of clicks, then it records 1, 2 or 4 bars of whatever you play (keys, pads and the drum machine) and loops it. Press Record again to stack up to 6 layers on top. Each layer keeps its own sound, so change patch between layers. Mute, delete or undo layers, and **Save loop as WAV** to keep it (on a phone it opens the share menu). Space starts and stops. Tempo and loop length are locked while there are layers; clear them to change.
- **Drum machine:** a 16-step grid for kick, snare, clap, hi-hat, open hat, tom, cowbell and zap, with 7 ready-made beats, swing and volume. It plays while the looper is playing.
- **Touch pad:** drag around it to sweep the filter left to right and the resonance, wah, echo or drive up and down.
- **Sound:** two oscillators plus noise, filter with its own envelope, volume envelope, LFO for vibrato and wah, drive, echo and reverb, Poly/Mono with glide, an arpeggiator that locks to the beat (turn on **Latch** to keep it going), 9 patches and **Surprise me**. Turn knobs by dragging up and down; double-click to reset.
- Your sound, beat and settings are remembered on that device; recorded loops are not, so save the WAV if you want to keep one. A USB MIDI keyboard works in Chrome on a computer (**Connect MIDI**). On iPhone, if there's no sound, check the silent switch.

**Overhead** is a live tracker for the satellites passing over where you live.

- **Set your place** the first time you open it: use the phone's location, search for a town or postcode, tap the map, or type coordinates. It's only saved on that phone.
- **Map:** every satellite in the chosen group, moving live. Blue ones are above your horizon right now, green ones might be visible to the naked eye (lit by the Sun while your sky is dark), grey ones are elsewhere. The shaded part of the map is night, and the dashed ring around you shows how far away a satellite at ISS height can be and still be above your horizon. Tap a satellite to see its route (dotted behind, solid ahead, with +10m, +20m marks), the area of Earth that can see it, and a line to you if it's up.
- **Satellite details:** height, speed, distance from you, where it is in your sky (degrees up and which way to look), whether it's in sunlight, and the journey: roughly how far it has travelled since launch (ticking up live), how many times it has gone round the Earth, how far it has gone while you've been watching, and how much of your sky this pass covers. Plus its orbit and the next 6 passes over you, with ✦ marking the ones you might see.
- **Sky dome:** a radar-style map of your whole sky, with straight up in the middle and the horizon at the edge, showing the selected satellite's path across it.
- **Camera:** point your phone at the sky and it draws the satellites where they really are, with an arrow showing which way to turn for the selected one. **Show through the ground** also shows those below the horizon. The Sun is drawn too: if it doesn't line up with the real Sun, use ⟲ ⟳ to correct the compass. On a computer it's a virtual sky you drag around.
- **Lists:** *Above you now* (sorted by height in the sky or by distance, with a name search) and *Coming over in the next 30 min*.
- **Groups:** highlights (space stations, the brightest, and new launches), Starlink, OneWeb, GPS, Galileo, weather, Earth-watching, science, amateur radio, geostationary, or everything (over 10,000, slow on older phones).
- Orbit data comes from CelesTrak. The site downloads a fresh copy every time it rebuilds (twice a day), and the page downloads straight from CelesTrak if that copy is more than a day old. Positions are accurate to a few kilometres.

Online chess works like Card Battler: one player taps **Online** and then **Start a new game**, and the other types in the 5-character code. If either phone drops out, the game pauses until it reconnects. Whoever started the game can reopen it from **Online** and then **Resume**.

The shared high-score boards in Scoot City and Echo Wheel only work in the claude.ai versions. These copies keep scores on each phone instead.

Each game folder holds the page (`index.html`), the app details (`manifest.webmanifest`), the icons, and `sw.js`, which keeps a copy of the game on the phone for offline play.

Pixel Gaffer '96 is a 90s-style football management game with pixel graphics. Pick one of 48 made-up UK clubs across four divisions (Division Three is the easiest place to start) and press **PLAY ▶** each week. Your assistant picks the team until you change it.

- **Matches** play out on a top-down pixel pitch with a camera that follows the ball and teletext-style commentary. You can also take a quick result. At half time you give a team talk, and you can pause to make subs or change formation and style.
- **Mini-games:** when your team gets a penalty or a free kick, you take it yourself: tap to aim, tap for power (and for curl on free kicks). When the other team gets a penalty, you tap where your keeper dives. Cup ties that end level go to a shoot-out you play. You can switch this off in **CLUB → Settings**.
- **More cups as you climb:** everyone plays the Old Tin Cup. Division Two and Three clubs also play the Pixel Vase, Division One the Floodlit Cup, and the Premier Division goes into Europe: last season's top four in the Euro Champions Cup and the rest in the Euro Fairs Trophy, against 16 made-up European clubs. These are played on five midweek nights, so a season is now 33 weeks.
- **Transfer deadline day** (31 August and late January): a ticking clock to midnight, a breaking-news ticker of other clubs' deals, and five quick-fire offers with a countdown each: panic bids for your players, cut-price bargains, free loans, unhappy players wanting out and late free agents.
- **Quick-fire scenarios** (24 for each division) pop up before about one game in three: a broken tea urn or a stray dog in Division Three, up to takeover bids and Hollywood film crews in the Premier. Your answer can change the fans' mood (which affects crowds), squad morale, a player, the board or the bank balance. Some answers are a gamble.
- **The depth:** six playing styles that beat each other like rock-paper-scissors (the scout report before each game tells you which to pick), training focus and intensity, a weekly drill (keepy-uppy or free-kick practice) for a training bonus, young players who grow, transfers where you haggle with chairmen, bids for your players, contracts, ticket prices, the board's target, the Old Tin Cup, promotion and relegation, youth intakes and job offers.
- **Getting around:** five tabs along the bottom (the transfer market is inside Squad, the inbox is on Home). Swipe left and right to move between them, and the phone's back button steps back through the game. A short guided tour runs at the start of a new career (replay it from CLUB › Settings).
- **More depth:** scout players before you bid (other clubs' players show a rough rating like 55-65 until you do), compare a target with your own best player in that position, and loan youngsters out or borrow players for the season.
- **Extras:** goal celebrations, a "Watch the goals" replay after each match, a trophy-lift scene when you win something, chiptune music on the title and season screens, a season calendar with how hard each game looks, a Stats section (top scorers, assists, ratings, star men, clean sheets, discipline, form, home and away tables, best attack and defence, and your own squad's season), three save slots with backup files (CLUB › Settings › Back up this career), and 25 achievements that also go to the family leaderboard.
- **Arcade** (from the title screen) has keepy-uppy, a ten-kick free-kick challenge and a penalty shoot-out on their own.
- The career saves on the phone after every week. Manager points (sent at the end of each season), keepy-uppy and free-kick scores go to the family leaderboard.

## Family leaderboard

Every game except Blow Out the Pumpkin sends its results to one shared leaderboard at
**https://kinapak-ux.github.io/Claude/leaderboard/**. It shows each game's best scores, plus an overall Family Champion (5, 3, 2 and 1 points for the top four on each game's board).

- The scores are kept in a Google Sheet in your own Google Drive, through a small Google Apps Script (`leaderboard/apps-script.txt`). The leaderboard page shows the setup steps until it's connected. Once deployed, its web app address goes into `ENDPOINT` in `scores.js`.
- Each phone keeps its results until they've been sent, so nothing is lost while it's offline or before the sheet is connected.
- Names come from the game (Card Battler, Hoop Shot) or are asked for once per phone. Each phone's name can be changed on the leaderboard page.
- The newer games (Family Quiz, Battleships, Snap Race, Times Table Blaster, Pixel Gaffer, Archery, Board School) need version 2 of the script. To update it, paste the new `leaderboard/apps-script.txt` into the Apps Script editor, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The address stays the same. Until then, those games' scores wait on the phones.
- To fix or remove a score, edit or delete its row in the sheet's **Scores** tab.
- The web app address is in this public repository, so anyone who found it could read or add scores. First names or nicknames are best.
