# FPL Team News Tracker

A personal web page for FPL team **2612117** that shows, for every player in your squad:

- 🔴🟠🟢 **Flags**: red = injured, suspended or unavailable. Amber = doubtful (25–75% chance of playing) or poor recent form (under 180 minutes or under 10 points in the last 5 gameweeks). Green = fine.
- **Injury news** taken straight from FPL.
- **Points in each of the last 5 gameweeks.**
- **Next 3 fixtures**, coloured by difficulty: dark green is easiest, dark red is hardest. Lowercase means away.
- **Transfer ideas**: up to 3 players worth selling, each with 3 in-form, fit replacements in the same position that you can afford (their price plus your bank) and that don't break the 3-players-per-club rule.

The page refreshes itself twice a day. You don't need to do anything.

## One-time setup (about 2 minutes)

1. On GitHub, open this repository and go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab, click **Update FPL tracker** on the left, then **Run workflow**.
4. When it shows a green tick (about a minute), your page is live at
   **https://kinapak-ux.github.io/Claude/**. Bookmark it on your phone.

## Good to know

- **Refresh now:** Actions tab → *Update FPL tracker* → *Run workflow*.
- **Transfers show after the deadline.** FPL only makes your new squad public once the gameweek deadline passes, so transfers appear after that.
- **Selling prices are approximate.** FPL doesn't publish your exact selling price, so the budget uses current price plus bank.
- **Change team:** edit `TEAM_ID` in `.github/workflows/update-tracker.yml`.
- **Change the rules** (number of fixtures, form thresholds and so on): see the settings at the top of `build.py`.
