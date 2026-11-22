# Retro Amp

A late-90s desktop MP3 player skin for Claude's desktop and mobile apps.

- **Your messages** are raised, bevelled gunmetal buttons with cream text.
- **Claude's replies** sit on a black LED display with green text, under a gold-striped title bar.
- **Tool calls** look like playlist rows; all text is monospace and headings are gold.
- **The backdrop** is a slow-moving spectrum analyzer in the top-right corner, a drifting green oscilloscope trace, a faint grid and scanlines.
- **Code** is highlighted with Monokai.
- **Sound** (off until you click the speaker in the session's title bar): a quiet tape hiss and low hum, plus short chiptune beeps when you send, when Claude finishes, asks, runs a tool or hits an error, and when you click the backdrop.

Dark mode only. The terminal and editors don't draw themes, so it shows in the desktop and mobile apps.

## Install

At the prompt of a terminal Claude Code session:

```
/plugin install retro-amp --marketplace kinapak-ux/Claude
```

Answer `y` to add the marketplace, then pick a scope (user scope applies it everywhere).

From a shell:

```
claude plugin install retro-amp --marketplace kinapak-ux/Claude
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `kinapak-ux/Claude`, then **Add plugin**.

The repository must be readable by whoever installs it; for a private repository they need a GitHub credential on their machine (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Files

- `hooks/register.tsx` — the theme: colors, message styles, the backdrop scene and sounds.
- `hooks/make-colors.js` — the palette builder from Claude Code's plugin-authoring kit; leave as is.
