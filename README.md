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
- **Mini-leagues**: standings for New Longton Legends, which players your rivals start that you don't, who they captain, and your differentials.

The page refreshes itself twice a day. On the **morning of each deadline** it also emails you a summary.

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
- **Email timing:** sent by the 6–7am (UK) run on deadline day. GitHub's scheduled runs can be up to an hour late at busy times.
- **Change which mini-leagues show:** edit `LEAGUES` in `.github/workflows/update-tracker.yml`. Separate several names with commas, or leave it empty for all private leagues.
- **Change team:** edit `TEAM_ID` in `.github/workflows/update-tracker.yml`.
- **Change the rules** (number of fixtures, form thresholds and so on): see the settings at the top of `build.py`.
