import type { Register, ThemeSetArgs, ThemeSound, ThemeStyle } from 'claude-code'

import { makeColors } from './make-colors.js'

// Retro Amp: a late-90s desktop MP3 player skin. Gunmetal panels with bevelled
// edges, a green LED display, gold title-bar stripes and a spectrum analyzer
// bouncing behind the conversation. Dark only, as the old skins were.

type Hex = `#${string}`

const LCD: Hex = '#07100a'
const LED: Hex = '#3cff6a'
const GOLD: Hex = '#d9b23a'

const { theme, problems } = makeColors({
  label: 'Retro Amp',
  only: 'dark',
  roles: { accent: '#e8c021', danger: '#ff4a32', success: '#2fe05a', warning: '#ff9d1c', pro: '#7f8cff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0e0e14',
        'surface-1': '#16161f',
        'surface-2': '#1c1c27',
        'surface-3': '#22222e',
        'text-primary': '#dff7d6',
        'text-secondary': '#a9d9a0',
        'text-muted': '#83a87d',
      },
    },
    git: { added: '#2fe05a', removed: '#ff4a32', modified: '#e8c021' },
  },
  codeTheme: { dark: 'monokai' },
})

// The spectrum analyzer: 20 bars pinned to the top right, each bouncing on its
// own slow loop, with a faint oscilloscope trace and scanlines over the rest.
const BARS = Array.from({ length: 20 }, (_, i) => {
  const rest = 0.35 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.4))
  const x = 8 + i * 15
  const h = Math.round(110 * rest)
  const dur = (1.4 + ((i * 37) % 11) / 10).toFixed(2)
  const delay = (-((i * 53) % 17) / 10).toFixed(2)
  return `<rect class="bar" x="${x}" y="${132 - h}" width="11" height="${h}" fill="url(#spec)" style="animation-duration:${dur}s;animation-delay:${delay}s"/>` +
    `<rect class="cap" x="${x}" y="${128 - h}" width="11" height="2" fill="#c8c8d8" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`
}).join('')

const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.bar { transform-box: fill-box; transform-origin: 50% 100%; animation-name: bounce; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-direction: alternate; }
.cap { animation-name: lift; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-direction: alternate; }
.scope { animation: drift 14s linear infinite; }
.glow { animation: breathe 9s ease-in-out infinite alternate; }
@keyframes bounce { from { transform: scaleY(1); } to { transform: scaleY(0.35); } }
@keyframes lift { from { transform: translateY(0); } to { transform: translateY(40px); } }
@keyframes drift { from { transform: translateX(0); } to { transform: translateX(-400px); } }
@keyframes breathe { from { opacity: 0.35; } to { opacity: 0.6; } }
</style>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14141c"/><stop offset="1" stop-color="#08080c"/></linearGradient>
<linearGradient id="spec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4a32"/><stop offset="0.3" stop-color="#e8c021"/><stop offset="0.65" stop-color="#3cff6a"/><stop offset="1" stop-color="#1a9a3a"/></linearGradient>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#ffffff" opacity="0.018"/></pattern>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#3cff6a" stroke-width="0.6" opacity="0.06"/></pattern>
</defs>
<!-- ground -->
<rect width="1600" height="1000" fill="url(#bg)"/>
<rect width="1600" height="1000" fill="url(#grid)"/>
<!-- oscilloscope along the top left -->
<svg x="0" y="0" width="1600" height="1000" viewBox="0 0 800 500" preserveAspectRatio="xMinYMin meet">
<g class="glow"><g class="scope">
<path d="M0 60 C 50 20, 50 100, 100 60 S 150 20, 200 60 S 250 100, 300 60 S 350 20, 400 60 S 450 100, 500 60 S 550 20, 600 60 S 650 100, 700 60 S 750 20, 800 60 S 850 100, 900 60 S 950 20, 1000 60 S 1050 100, 1100 60 S 1150 20, 1200 60" fill="none" stroke="${LED}" stroke-width="1.6"/>
</g></g>
</svg>
<!-- spectrum analyzer in the top right -->
<svg x="0" y="0" width="1600" height="1000" viewBox="0 0 1000 625" preserveAspectRatio="xMaxYMin meet">
<g transform="translate(660 18)">
<rect x="0" y="0" width="316" height="144" rx="2" fill="${LCD}" stroke="#3a3a4c" stroke-width="2"/>
<g transform="translate(0 4)">${BARS}</g>
</g>
</svg>
<rect width="1600" height="1000" fill="url(#scan)"/>
</svg>`

// Bevelled metal: a light top-left edge and a dark bottom-right one.
const bevel = (face: Hex, frame: Hex, lit: Hex, shade: Hex) => [
  { d: 'M0 0H96V96H0Z', color: frame },
  { d: 'M0 0H96V2H2V96H0Z', color: lit },
  { d: 'M94 2H96V96H2V94H94Z', color: shade },
  { d: 'M4 4H92V92H4Z', color: face },
]

const STYLE: ThemeStyle = {
  Text: { fontFamily: ['mono'], fontSize: 14, lineHeight: 22 },
  Heading: { fontFamily: ['mono'], color: GOLD, fontWeight: 'bold', letterSpacing: 1 },
  // The person's message: a bevelled gunmetal button.
  UserMessage: {
    color: '#f1e7bf',
    backgroundColor: '#2a2a3a',
    radius: 0,
    padding: 14,
    fill: { vector: { viewBox: 96, slice: 8, paths: bevel('#2a2a3a', '#3a3a50', '#6e6e8e', '#0b0b12') } },
  },
  // Claude's reply: an LED display under a gold-striped title bar.
  AssistantMessage: {
    color: LED,
    backgroundColor: LCD,
    radius: 0,
    paddingX: 16,
    paddingBottom: 14,
    paddingTop: 26,
    fill: {
      vector: {
        viewBox: 96,
        slice: 18,
        paths: [
          ...bevel('#262634', '#34344a', '#66668a', '#0b0b12'),
          { d: 'M6 4.5H90V5.5H6Z', color: GOLD },
          { d: 'M6 8H90V9H6Z', color: GOLD },
          { d: 'M6 11.5H90V12.5H6Z', color: '#8a7020' as Hex },
          { d: 'M5 16H91V91H5Z', color: LCD },
        ],
      },
    },
  },
  // Tool calls: playlist rows.
  ToolUse: {
    color: '#9ff0a8',
    fontFamily: ['mono'],
    backgroundColor: '#0a0d10',
    borderColor: '#2e2e40',
    borderWidth: 1,
    radius: 0,
    paddingX: 10,
    paddingY: 4,
  },
}

// Chiptune cues and a soft tape hiss, all quiet.
const SOUND: ThemeSound = {
  ambience: {
    layers: [
      { wave: 'pink', drone: true, gain: 0.05, filter: { type: 'lowpass', hz: 1800 } },
      { wave: 'triangle', notes: ['A2', 'E3'], drone: true, gain: 0.05, filter: { type: 'lowpass', hz: 500, to: 900 } },
    ],
    reverb: 0.2,
  },
  cues: {
    send: { layers: [{ wave: 'square', notes: ['C5', 'G5'], step: 0.05, gain: 0.18, release: 0.08 }] },
    tool: { layers: [{ wave: 'square', notes: ['E6'], gain: 0.08, release: 0.03 }] },
    done: { layers: [{ wave: 'square', notes: ['C5', 'E5', 'G5', 'C6'], step: 0.07, gain: 0.16, release: 0.12 }], reverb: 0.2 },
    ask: { layers: [{ wave: 'square', notes: ['G5', 'G5'], step: 0.12, gain: 0.16, release: 0.06 }] },
    error: { layers: [{ wave: 'saw', notes: ['E4'], glide: -12, gain: 0.14, release: 0.35, filter: { type: 'lowpass', hz: 1500 } }] },
    compact: { layers: [{ wave: 'square', notes: ['C6', 'G5', 'E5', 'C5'], step: 0.05, gain: 0.14, release: 0.06 }] },
    click: { layers: [{ wave: 'square', notes: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'], gain: 0.12, release: 0.1 }] },
  },
}

const BASE: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: 'spectrum', glass: { blur: 10, tint: '#0e0e14', opacity: 0.72 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    let set
    try {
      set = await $.theme.set({ ...BASE, style: STYLE, sound: SOUND })
    } catch (error) {
      $.ui.log(String(error))
      set = await $.theme.set(BASE)
    }

    $.ui.status(set.isDrawn ? '▶ RETRO AMP · 128kbps · 44kHz · stereo' : set.reason)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={SCENE} alt="A spectrum analyzer bouncing over a dark grid, with an oscilloscope trace" />
  })
}
