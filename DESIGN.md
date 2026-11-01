# Design

RehabMind's visual world is a **patient ID wristband**: the calm, printed object people already trust in a hospital. Signing in is identification; the rest of the app keeps its colour and its plainness, and when in doubt removes an element rather than adds one. It should read as healthcare at a glance, without hospital coldness.

## Parts

- **Band** (`AppShell`): the header on every signed-in page. A flat `accent-soft` strip with one hairline: the wristband reduced to its colour. No gradient, shadow, holes or studs.
- **Strap** (`.strap`, `.strap-stud` in `globals.css`): flat mint, sign-in page only, running behind the card. Always `aria-hidden` and hidden when space is short.
- **Page, not panel**: content sits directly on the canvas, separated by whitespace and 1px rules (`border-t`, `divide-y`). This is the default.
- **Label**: a white card, `rounded-card border border-line bg-surface`. Only for what is genuinely one object: the sign-in card, a form group, a tap tile, a white picture ground. Never nest labels, and never box a single figure or row.
- **Figures** (`Facts`): plain type, label above value, at most four at once. Anything further goes under a `details` fold such as "More figures".

## Colour

Tokens live in `@theme` in `globals.css`. Use them rather than raw values.

| Token | Value | Use |
|---|---|---|
| `canvas` | `#f2f5f5` | Page ground |
| `surface` | `#ffffff` | Labels, inputs |
| `ink` / `ink-muted` | `#1c2430` / `#4a5565` | Text |
| `line` / `line-strong` | `#dde3e3` / `#6f7a7b` | Rules / input borders |
| `accent` / `accent-hover` | `#0f6e6e` / `#0b5858` | Primary actions, label strip |
| `accent-soft` | `#e3f0ee` | Quiet emphasis, notes |
| `brand-deep` | `#0a3d3e` | Word chips on photos, AI pipeline map |
| Strap | `#cde9e4` | Strap only |

Teal is the only accent. The one exception is the logo's dot (`#f4b860` on dark and teal, `#c8652b` on light), which appears only in the logo, never in the interface. Success, warning and danger are for state, never decoration. All text pairs meet WCAG 2.1 AA.

## Type

Atkinson Hyperlegible Next throughout: it was designed for low-vision readers, and the audience has aphasia. No second display face. Headings are bold with slight negative tracking. Tabular figures for numbers.

## Depth and shape

- Everything at rest is flat. Only what floats (the sign-in card, dialogs) uses `shadow-float`.
- Radii: `rounded-card` (1.25rem) for labels, `rounded-control` (0.75rem) for controls and inner panels.
- No gradients, no glass, no coloured side borders.

## Motion

One authored moment: on sign-in the strap slides in and the stud presses home. In the app, motion is feedback only (the outcome icon's pop, the speech waveform); no count-ups, spotlights or entrances. The global reduced-motion rule covers everything.

## Rules that outrank the look

- Patient pages fit one screen at laptop sizes without scrolling.
- Targets stay at least 48px (`min-h-target`); patient actions are larger.
- Plain language, and no streak pressure.
- Never imply a real ID or medical record: the wristband's printed details are product truths, not patient data.
