# Eval Harness — Design System

## Intent

- **Who**: ML engineer or developer, iterating on prompts and eval criteria at midnight. Not browsing — hunting for failures.
- **What they do**: Create datasets, define grading rubrics, run experiments, scan results to find failures, drill into reasons.
- **Feel**: Precise like a lab notebook. Functional like a terminal. Structured like a spreadsheet. Confidence-inspiring — "I can trust these results."

## Domain Exploration

### Concepts

Evaluation, rubric, verdict, pass/fail, test case, grader, experiment run, dataset schema, accuracy, LLM judge, ground truth, provenance, threshold.

### Color World

Deep slate (terminal backgrounds), phosphor green (passing signal), warning amber (instrument panels), error red (system alerts), steel blue (scientific instruments), off-white (lab notebook paper), ink black (dense data tables). Dark mode, cool temperature, desaturated except for semantic signals.

### Signature Element

The **results grid cell** — a dense, borderless grid where each cell has a 2px colored left-border accent (green/red/amber) and a verdict glyph (✓/✗/!). Hover expands to show the grader rationale in an inline popover. This IS the product.

### Defaults Rejected

| Default                                 | Replacement                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| White card grid with soft shadows       | Dark canvas, borders-only depth, sharp radius (4px)                             |
| Color-coded status badges (pill-shaped) | Left-border accent on table rows — color at the edge, not inside a badge        |
| Blue primary action buttons             | Near-white buttons on dark surfaces — the results speak louder than the buttons |

## Token Architecture

### Foreground

```
--fg-primary:     hsl(240, 5%, 90%)     ← default text
--fg-secondary:   hsl(240, 4%, 66%)     ← supporting text
--fg-tertiary:    hsl(240, 4%, 54%)     ← metadata
--fg-muted:       hsl(240, 3%, 38%)     ← disabled, placeholder
--fg-inverted:    hsl(240, 6%, 7%)      ← text on light surfaces
```

### Background / Surfaces

```
--bg-base:        hsl(240, 6%, 7%)      ← canvas
--bg-surface-1:   hsl(240, 5%, 11%)     ← panels, cards
--bg-surface-2:   hsl(240, 4%, 16%)     ← inputs, table headers
--bg-surface-3:   hsl(240, 3%, 20%)     ← dropdowns, popovers, modals
--bg-inset:       hsl(240, 6%, 5%)      ← recessed areas, empty states
```

### Borders

```
--border-subtle:  rgba(255,255,255,0.05)   ← table row dividers
--border-default: rgba(255,255,255,0.08)   ← card/panel borders
--border-strong:  rgba(255,255,255,0.12)   ← interactive element borders
--border-focus:   hsl(215, 60%, 58%)       ← focus ring (accent)
```

### Accent

```
--accent:         hsl(215, 60%, 58%)       ← steel-blue, selection/focus only
--accent-subtle:  hsla(215, 60%, 58%, 0.12)
--accent-strong:  hsl(215, 60%, 70%)
```

### Semantic Colors

```
--pass:           hsl(142, 52%, 44%)       ← phosphor green
--pass-subtle:    hsla(142, 52%, 44%, 0.08)
--pass-fg:        hsl(142, 52%, 70%)

--fail:           hsl(0, 60%, 52%)         ← deep red
--fail-subtle:    hsla(0, 60%, 52%, 0.10)
--fail-fg:        hsl(0, 60%, 75%)

--error:          hsl(38, 85%, 52%)        ← instrument amber
--error-subtle:   hsla(38, 85%, 52%, 0.10)
--error-fg:       hsl(38, 85%, 75%)

--neutral:        hsl(240, 3%, 40%)        ← pending/skipped
--neutral-subtle: hsla(240, 3%, 40%, 0.15)
--neutral-fg:     hsl(240, 4%, 60%)
```

**Rule**: Semantic colors appear only in three places — result cells, status indicators, and aggregate stats. Nowhere else.

## Typography

```
--font-sans:   'Inter', 'Inter var', system-ui, -apple-system, sans-serif
--font-mono:   'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace
```

| Role            | Size | Weight | Spacing | Font               |
| --------------- | ---- | ------ | ------- | ------------------ |
| Page title      | 16px | 600    | -0.01em | sans               |
| Section heading | 13px | 600    | 0.01em  | sans, uppercase    |
| Body            | 13px | 400    | 0       | sans               |
| Table header    | 11px | 600    | 0.05em  | sans, uppercase    |
| Table cell      | 13px | 400    | 0       | sans               |
| Data / scores   | 13px | 500    | 0       | mono, tabular-nums |
| Stat number     | 24px | 600    | -0.02em | mono, tabular-nums |
| Stat label      | 11px | 500    | 0.04em  | sans, uppercase    |
| Code / rubric   | 12px | 400    | 0       | mono               |
| Badge label     | 11px | 500    | 0.03em  | sans               |

**Critical**: All numeric data uses `font-variant-numeric: tabular-nums` and mono stack. Numbers in columns must align.

## Spacing

Base unit: **4px**

```
--space-1:  4px     --space-5:  20px
--space-2:  8px     --space-6:  24px
--space-3:  12px    --space-8:  32px
--space-4:  16px    --space-10: 40px
```

- Table cell padding: `8px 12px`
- Card padding: `16px`
- Input height: `32px`
- Button height: `32px` default, `28px` compact, `36px` primary CTA

## Depth Strategy

**Borders-only. No shadows. No exceptions.**

Why: Dark canvas, tool aesthetic, terminal feel. Shadows imply physical light which contradicts the precision instrument mental model. Borders communicate structure without physicality.

- `0.5px` borders within data structures (table dividers)
- `1px` borders around panels, cards, interactive elements
- Always `rgba(255,255,255, X)` — never `solid #333`

## Radius

```
--radius-sm:  3px    ← tags, badges
--radius-md:  4px    ← buttons, inputs
--radius-lg:  6px    ← cards, panels
--radius-xl:  8px    ← modals, popovers
```

## Component Patterns

### Navigation

Left sidebar (220px, `--bg-base`, `1px` right border). Three sections: Datasets, Graders, Experiments. Active item: 2px left-border in `--accent`. Section headings: 10px, 600, uppercase, `--fg-tertiary`.

### Dataset List

Dense table rows. Name (primary), item count + field count (mono, secondary), timestamp (tertiary). Hover: `--bg-surface-1` fill. Row separator: `1px solid --border-subtle`.

### Dataset Detail

Two-panel split. Left (30%): schema fields as definition list. Right (70%): items table. Separated by `1px solid --border-default` vertical divider.

### Grader List

Same as dataset list. Type badge (`LLM` in `--accent-subtle` bg) distinguishes grader types.

### Grader Detail

Rubric editor in `--bg-inset` textarea, mono font, 12px. Auto-grows. Focus: `--border-focus`. Unsaved changes: `1px solid --error` left-border on form panel.

### Experiment List

Left-border accent per status: Running (`--accent`), Pass (`--pass`), Fail below threshold (`--fail`), Error (`--error`), Queued (`--neutral`). Running rows show 2px progress line at bottom.

### Results Table (Core View)

Rows = dataset items, Columns = graders. Default sort: fail count descending — failures at top.

**Cell anatomy:**

- Height: 44px
- 2px left-border in semantic color
- Background tint: fail/error cells only (`--fail-subtle`, `--error-subtle`)
- Verdict glyph centered: ✓ (`--pass-fg`), ✗ (`--fail-fg`), ! (`--error-fg`), — (`--neutral-fg`)
- No text labels — glyph + color communicates

**Hover popover** (150ms delay):

- `--bg-surface-3`, `1px solid --border-strong`, `border-radius: 6px`
- Shows: item key, grader name, model output (mono, 12px), rationale
- Max-width: 320px, anchored to cell

**Aggregate row** (pinned bottom): Each column's pass rate + inline mini-bar (Tremor ProgressBar, 8px). `--bg-surface-2` background.

### Aggregate Stats Banner

Above results table, 80px height, `--bg-surface-1`.

1. Pass rate headline: 24px mono, colored by threshold
2. Cell count: `"120 items × 3 graders = 360 evaluations"`
3. Per-grader breakdown: Tremor BarChart

### Pass/Fail/Error Cell (Atomic Unit)

```
Container: 44px height, 8px 12px padding
Left border: 2px solid <semantic-color>
Background: <semantic-subtle> (fail/error only)
Glyph: mono 14px, weight 600, centered
Hover: popover after 150ms delay
```

## States

| View            | Loading                        | Empty                                 | Error                       | Populated        |
| --------------- | ------------------------------ | ------------------------------------- | --------------------------- | ---------------- |
| Lists           | 3 row shimmers                 | Inset panel + icon + action           | Inset panel + alert + retry | Dense rows       |
| Dataset schema  | Block shimmer                  | Dashed border + "+" button            | Inline alert                | Definition list  |
| Dataset items   | Row shimmers + visible headers | Inset panel with column headers shown | Alert in table body         | Scrollable table |
| Results table   | Grid shimmer (headers first)   | Centered inset panel                  | Error strip + partial data  | Dense matrix     |
| Aggregate stats | `—` + Loader2 spinner          | N/A                                   | Error strip                 | Stats + chart    |

**Universal rule**: Error never hides existing data. Show stale data + error bar: `"Last updated 4 min ago · Refresh failed"`.

## Animation (Motion library)

| Element                  | Transition                 | Duration    | Easing      |
| ------------------------ | -------------------------- | ----------- | ----------- |
| Cell hover popover       | opacity 0→1, y 4→0         | 150ms       | ease-out    |
| Popover dismiss          | opacity 1→0                | 100ms       | ease-in     |
| Nav item active          | left-border 0→2px          | 150ms       | ease-out    |
| New experiment row       | height 0→auto, opacity 0→1 | 200ms       | ease-out    |
| Result cell fill (live)  | opacity 0.4→1              | 200ms       | ease-out    |
| Breathing cell (pending) | opacity 0.4↔0.7            | 1500ms loop | ease-in-out |
| Slide panel open         | x 100%→0                   | 250ms       | ease-out    |
| Slide panel close        | x 0→100%                   | 200ms       | ease-in     |
| Tab content switch       | opacity 0→1                | 100ms       | ease-out    |

**Does NOT animate**: Table row reorder, page navigation, form states, badge changes, modal backdrop. If it wouldn't fit in `htop`, it doesn't belong.

## Craft Checks

1. **Swap test**: Remove left-border accents, change to system font, generic blue accent → it becomes a generic admin panel. Those three elements are load-bearing identity.
2. **Squint test**: Fail cells (tinted backgrounds, red borders) cluster at the top. You can locate problems before your eyes focus.
3. **Signature test**: (1) left-border cell accents, (2) progress line at row bottom, (3) pinned aggregate row with mini-bars, (4) rubric editor unsaved-state border, (5) breathing cell animation.
4. **Token test**: Variable names (`--pass-fg`, `--fail-subtle`, `--bg-inset`) sound like a scientific instrument's interface, not `--primary`, `--success`, `--danger`.
