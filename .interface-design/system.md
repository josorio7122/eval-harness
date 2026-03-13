# Eval Harness — Design System

## Intent

- **Who**: ML engineer or developer, iterating on prompts and eval criteria at midnight. Not browsing — hunting for failures.
- **What they do**: Create datasets, define grading rubrics, run experiments, scan results to find failures, drill into reasons.
- **Feel**: Precise like a lab notebook. Functional like a terminal. Structured like a spreadsheet. Confidence-inspiring — "I can trust these results."

## Domain Exploration

### Concepts

Evaluation, rubric, verdict, pass/fail, test case, grader, experiment run, dataset schema, accuracy, LLM judge, ground truth, provenance, threshold.

### Color World

Clean white canvas (light mode), phosphor green (passing signal), warning amber (instrument panels), error red (system alerts), saturated blue (primary accent), off-white surfaces (subtle depth). Light mode, cool temperature, desaturated except for semantic signals.

### Signature Element

The **results grid cell** — a dense table where each cell has a 2px colored left-border accent (green/red/amber) and a verdict glyph (✓/✗/!). Hover expands to show the grader rationale in an inline popover. This IS the product.

### Defaults Rejected

| Default                                 | Replacement                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Generic blue primary actions            | Saturated blue accent (hsl 215, 65%, 50%) — precise, not generic               |
| Color-coded status badges (pill-shaped) | Left-border accent on table rows — color at the edge, not inside a badge        |
| Soft shadows and rounded cards          | Subtle borders, minimal radius, structured depth                                |

## Token Architecture

### shadcn CSS Variables

The app uses shadcn's default CSS variable system for base tokens:

```
--background          ← page canvas (white)
--foreground          ← default text
--primary             ← primary button fill
--primary-foreground  ← text on primary
--muted               ← subtle backgrounds
--muted-foreground    ← secondary/supporting text
--card                ← card/panel backgrounds
--card-foreground     ← text on cards
--border              ← default border color
--input               ← input border
--ring                ← focus ring
--accent              ← hover/active surface tint
--accent-foreground   ← text on accent surface
```

### Primary Accent

```
--primary-accent: hsl(215, 65%, 50%)   ← saturated blue — selection, active nav, focus rings
```

### Semantic Colors

```
--pass:           hsl(142, 52%, 44%)       ← phosphor green
--pass-subtle:    hsla(142, 52%, 44%, 0.08)
--pass-fg:        hsl(142, 52%, 34%)       ← darkened for light backgrounds

--fail:           hsl(0, 60%, 52%)         ← deep red
--fail-subtle:    hsla(0, 60%, 52%, 0.08)
--fail-fg:        hsl(0, 60%, 42%)         ← darkened for light backgrounds

--error:          hsl(38, 85%, 52%)        ← instrument amber
--error-subtle:   hsla(38, 85%, 52%, 0.08)
--error-fg:       hsl(38, 85%, 38%)        ← darkened for light backgrounds

--neutral:        hsl(240, 3%, 60%)        ← pending/skipped
--neutral-subtle: hsla(240, 3%, 60%, 0.12)
--neutral-fg:     hsl(240, 4%, 45%)
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

**Borders and subtle backgrounds. No heavy shadows.**

Light mode uses the `--border` token for structural separation and `--muted` surface tint for depth. Elevation is communicated with surface color steps, not drop shadows.

- `0.5px` borders within data structures (table dividers)
- `1px` borders around panels, cards, interactive elements
- `--border` token — never hardcoded hex

## Radius

```
--radius-sm:  3px    ← tags, badges
--radius-md:  4px    ← buttons, inputs
--radius-lg:  6px    ← cards, panels
--radius-xl:  8px    ← modals, popovers
```

## Layout Architecture

### Navigation

Left sidebar (220px, `--background`, `1px` right `--border`). Three sections: Datasets, Graders, Experiments. Active item: blue tint background (`hsla(215, 65%, 50%, 0.08)`) + `--primary-accent` text color. Section headings: 10px, 600, uppercase, `--muted-foreground`.

### List Views (full-page)

All list views use a shared `DataTable` component. Full-page layout — no split panes. Each row is clickable and navigates to a detail page.

- Dense table rows, `1px solid --border` row separator
- Hover: `--muted` fill
- Click row → navigate to detail page (full page replacement, not slide panel)
- Back button in detail page header returns to list

### Dataset Detail

Full-page. Schema fields as definition list above, items table below (or tabbed). No vertical split pane.

### Grader Detail

Full-page. Rubric editor in a `--muted` textarea, mono font, 12px. Auto-grows. Focus: `--ring`. Unsaved changes: `1px solid --fail` left-border on form panel.

### Experiment List

Left-border accent per status: Running (`--primary-accent`), Pass (`--pass`), Fail below threshold (`--fail`), Error (`--error`), Queued (`--neutral`). Running rows show 2px progress line at bottom.

### Results Table (Core View)

Rows = dataset items, Columns = graders. Default sort: fail count descending — failures at top.

**Cell anatomy:**

- Height: 44px
- 2px left-border in semantic color
- Background tint: fail/error cells only (`--fail-subtle`, `--error-subtle`)
- Verdict glyph centered: ✓ (`--pass-fg`), ✗ (`--fail-fg`), ! (`--error-fg`), — (`--neutral-fg`)
- No text labels — glyph + color communicates

**Hover popover** (150ms delay):

- `--card` background, `1px solid --border`, `border-radius: 6px`
- Shows: item key, grader name, model output (mono, 12px), rationale
- Max-width: 320px, anchored to cell

**Aggregate row** (pinned bottom): Each column's pass rate. `--muted` background.

### Aggregate Stats Banner

Above results table, 80px height, `--card` background.

1. Pass rate headline: 24px mono, colored by threshold
2. Cell count: `"120 items × 3 graders = 360 evaluations"`
3. Per-grader breakdown

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
| Lists           | Skeleton rows (3)              | Inset panel + icon + action           | Inset panel + alert + retry | Dense rows       |
| Dataset schema  | Skeleton block                 | Dashed border + "+" button            | Inline alert                | Definition list  |
| Dataset items   | Skeleton rows + visible headers| Inset panel with column headers shown | Alert in table body         | Scrollable table |
| Results table   | Skeleton grid (headers first)  | Centered inset panel                  | Error strip + partial data  | Dense matrix     |
| Aggregate stats | `—` placeholder                | N/A                                   | Error strip                 | Stats + chart    |

**Universal rule**: Error never hides existing data. Show stale data + error bar: `"Last updated 4 min ago · Refresh failed"`.

**Pending cells**: Show `<Skeleton>` — no breathing/pulse animation (not implemented).

## Animation (CSS transitions only)

No JS animation library. All transitions use native CSS `transition` property.

| Element                  | CSS property               | Duration    | Easing      |
| ------------------------ | -------------------------- | ----------- | ----------- |
| Cell hover popover       | opacity, transform (y 4px) | 150ms       | ease-out    |
| Popover dismiss          | opacity                    | 100ms       | ease-in     |
| Nav item active state    | background-color, color    | 150ms       | ease-out    |
| Button hover             | background-color           | 150ms       | ease-out    |
| Row hover fill           | background-color           | 100ms       | ease-out    |
| Tab content switch       | opacity                    | 100ms       | ease-out    |

**Not implemented / not used**:
- Breathing cell animation — pending cells use `<Skeleton>` instead
- Slide panel open/close — navigation is full-page, no side panels
- New row enter animation — lists refresh in place

**Does NOT animate**: Table row reorder, page navigation, form states, badge changes, modal backdrop. If it wouldn't fit in `htop`, it doesn't belong.

## Craft Checks

1. **Swap test**: Remove left-border accents, change to system font, generic blue accent → it becomes a generic admin panel. Those three elements are load-bearing identity.
2. **Squint test**: Fail cells (tinted backgrounds, red borders) cluster at the top. You can locate problems before your eyes focus.
3. **Signature test**: (1) left-border cell accents, (2) progress line at running-experiment row bottom, (3) pinned aggregate row, (4) rubric editor unsaved-state border, (5) full-page DataTable with click-to-detail navigation.
4. **Token test**: Semantic variable names (`--pass-fg`, `--fail-subtle`) communicate domain intent. shadcn base tokens (`--muted`, `--border`) handle structural chrome.
