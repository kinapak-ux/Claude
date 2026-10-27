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

All five games are published with the tracker and can be installed on a phone's home screen, where they open full screen with their own icon:

| Game | Address |
|---|---|
| Card Battler | https://kinapak-ux.github.io/Claude/card-battler/ |
| Scoot City | https://kinapak-ux.github.io/Claude/scoot-city/ |
| Skirmish Chess | https://kinapak-ux.github.io/Claude/chess/ |
| Hoop Shot | https://kinapak-ux.github.io/Claude/hoop-shot/ |
| Echo Wheel | https://kinapak-ux.github.io/Claude/echo-wheel/ |

**To install:** on Android, open the game in Chrome, tap **⋮** and then **Install app** (or **Add to Home screen**). On iPhone, open it in Safari, tap **Share** and then **Add to Home Screen**.

Once a game has been opened, it also works with no signal. The exception is anything that needs other phones, such as Card Battler multiplayer.

Online chess works like Card Battler: one player taps **Online** and then **Start a new game**, and the other types in the 5-character code. If either phone drops out, the game pauses until it reconnects. Whoever started the game can reopen it from **Online** and then **Resume**.

The shared high-score boards in Scoot City and Echo Wheel only work in the claude.ai versions. These copies keep scores on each phone instead.

Each game folder holds the page (`index.html`), the app details (`manifest.webmanifest`), the icons, and `sw.js`, which keeps a copy of the game on the phone for offline play.

## Family leaderboard

All five games send their results to one shared leaderboard at
**https://kinapak-ux.github.io/Claude/leaderboard/**. It shows each game's best scores, plus an overall Family Champion (5, 3, 2 and 1 points for the top four on each game's board).

- The scores are kept in a Google Sheet in your own Google Drive, through a small Google Apps Script (`leaderboard/apps-script.txt`). The leaderboard page shows the setup steps until it's connected. Once deployed, its web app address goes into `ENDPOINT` in `scores.js`.
- Each phone keeps its results until they've been sent, so nothing is lost while it's offline or before the sheet is connected.
- Names come from the game (Card Battler, Hoop Shot) or are asked for once per phone. Each phone's name can be changed on the leaderboard page.
- To fix or remove a score, edit or delete its row in the sheet's **Scores** tab.
- The web app address is in this public repository, so anyone who found it could read or add scores. First names or nicknames are best.
