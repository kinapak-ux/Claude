# PIXTEXT Gaffer

Pixel Gaffer '96 rebuilt as a 1990s teletext service. Every screen is a numbered page
that does one job, and the page numbers are the menu. No build step: open `index.html`.

## How it is built

It borrows the game itself from `../pixel-gaffer/`, unchanged:

| From Pixel Gaffer | What it gives |
|---|---|
| `data.js` | names, clubs, formations, styles, traits, making players and the world |
| `engine.js` | the match simulator, tables, the week, money, board, transfers, end of season |
| `scenarios.js` | the 96 dilemmas |

Its own files:

| File | What it does |
|---|---|
| `index.html` | the telly, the remote control and the styling |
| `screen.js` | draws a page on a 40 x 25 character grid, the header clock, the fastext row, page-number entry, sub-pages, tapping and keyboard |
| `rules.js` | what this version changes (no midweek cups or Europe, a 28-week season, simulated set pieces), saving, and the flow of a week: the red button, dilemmas, the live match, full time, end of season, transfers |
| `pages.js` | every page, plus the page map at the top |
| `sw.js`, `manifest.webmanifest`, icons | installable and offline |

`rules.js` loads after `engine.js` and replaces a few of its functions by declaring them
again (`calendar`, `dateOf`) and fills in the ones `engine.js` expects from the
competitions file that isn't loaded (`setupComps`, `koFixtures`, `userComp` and so on).

### Writing a page

A page function returns `{head, body, foot, fast, focus}`:

- `head` and `foot` rows stay put; `body` is split into sub-pages (1/2, 2/2) if it doesn't fit in 23 rows.
- A row is a string with colour codes, or `{t, a, dh}` where `a` is a page number or a function
  run when the row is tapped, and `dh` makes it double height (it takes two rows).
- Codes: `[r] [g] [y] [b] [m] [c] [w] [k]` text colour, capitals for background (which fills to the end of the row),
  `[*]` flashing, `[/]` reset, `[@300]text[@]` a link to page 300.
- `fast` is up to four `[label, action]` pairs for red, green, yellow and cyan. Red should carry on (`PLAY()`).
- Rows are cut at 40 characters, so keep text short; `wrap()` splits long text.
- Pass names and messages through `clean()` so square brackets can't look like colour codes.

Add a page to `PAGES` at the bottom of `pages.js` (or to `pageFor` for a range of numbers), and to the page map comment at the top.

### Saving

One career, saved in local storage under `pixtext-save` (separate from Pixel Gaffer's slots).
The live match isn't saved: reloading mid-match just means playing that game again.

## Working on it

- Serve the repo root, not this folder, so `../pixel-gaffer/` loads.
- If you add a file, add it to `SHELL` in `sw.js` and bump `CACHE`.
- Changing Pixel Gaffer's `data.js`, `engine.js` or `scenarios.js` changes this game too.
