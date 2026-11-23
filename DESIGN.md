---
name: CEA-VIZ
description: Any Singapore property salesperson's recorded transactions, read like a line map.
colors:
  ink: "#1a1a1a"
  ink-soft: "#4a4a4a"
  ink-muted: "#6b6b6b"
  rule: "#e3e3e0"
  stone: "#c9c9c5"
  market-grey: "#b5b5b0"
  wash: "#f5f5f3"
  paper: "#ffffff"
  signal: "#fa9e0d"
  signal-wash: "#fff4e0"
  line-hdb: "#007a3d"
  line-condo: "#d42e12"
  line-landed: "#9d5b25"
  line-ec: "#9900aa"
  line-strata: "#005ec4"
typography:
  wordmark:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "tnum"
  headline:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  body:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    fontFeature: "tnum"
  section-label:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.06em"
  label:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  chip:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.025em"
rounded:
  none: "0px"
  pill: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "40px"
  row: "12px"
  section: "20px"
  block: "32px"
  view: "48px"
components:
  header-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.wordmark}"
  nav-tab:
    textColor: "#b8b8b4"
    padding: "8px 0"
  nav-tab-active:
    textColor: "{colors.paper}"
  search-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 44px"
  filter-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 12px 0 16px"
  filter-pill-active:
    backgroundColor: "{colors.signal-wash}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink-soft}"
  property-chip:
    backgroundColor: "{colors.line-hdb}"
    textColor: "{colors.paper}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    height: "20px"
    padding: "0 8px"
  property-chip-lg:
    height: "24px"
    padding: "0 10px"
  table-row-selected:
    backgroundColor: "{colors.signal-wash}"
  table-row-hover:
    backgroundColor: "{colors.wash}"
  popover:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "8px 12px"
---

# Design System: CEA-VIZ

## Overview

**Creative North Star: "The Line Map"**

A salesperson's record is read the way a commuter reads the MRT network: a near-black wayfinding band across the top, a white ground, and every agent's working towns drawn as stops on their own line. Property types wear line-badge colours, rounded station-code chips that tell HDB from condo at a glance. The world is LTA system map and platform signage, not an analytics template: no KPI cards, no pies, no dataset sidebar.

Density is that of a timetable. Lists are ruled, numbers are tabular and right-aligned, and the eye moves down a column the way it moves down a line. Structure comes from rules, not boxes: a 2px ink rule opens each region, 1px hairlines separate rows, and nothing floats on a shadow except things that genuinely float (a dropdown, a tooltip). Colour is spent on two jobs only: line colours identify property types, and signal orange marks what is live or selected.

The voice is signage. Labels carry the meaning; the interface does not explain itself in captions, footnotes or taglines.

**Key Characteristics:**
- Near-black header band, white ground, flat ruled regions.
- Five line colours, one per property type, used for chips, bars and town markers.
- Signal orange as the single live/selection accent.
- Source Sans 3 throughout, tabular numerals everywhere a number appears.
- Pills for controls and chips; square corners for everything structural.
- The town map: numbered white station markers ringed in line colour on a schematic island.

## Colors

A neutral ink-on-white system with five transit line colours reserved for property types and one orange signal.

### Primary
- **Platform Signal Orange** (signal): the only accent. Active tab underline, active filter border, focus outline on the header band, text selection, input caret, chart hover cursor (at 18% opacity) and the provisional note inside the chart tooltip. Never used for data series.
- **Signal Wash** (signal-wash): the ground of a selected table row and an active filter pill. Selection is a tint, not a fill.

### Secondary
The line palette. Each colour belongs to exactly one property type and carries it wherever that type appears: chip background, bar fill and town-marker ring.
- **HDB Line Green** (line-hdb): HDB.
- **Condo Line Red** (line-condo): Condominium / apartment.
- **Landed Line Brown** (line-landed): Landed.
- **EC Line Purple** (line-ec): Executive condominium.
- **Strata Line Blue** (line-strata): Strata landed.

Unknown types fall back to Ink Soft.

### Neutral
- **Signage Ink** (ink): header band, body text, 2px region rules, the 1px axis line, neutral bar fills, primary button, tooltip ground.
- **Ink Soft** (ink-soft): section labels, secondary values, button hover.
- **Ink Muted** (ink-muted): meta lines, registration numbers, column heads, axis ticks, placeholder text.
- **Hairline** (rule): 1px row and region dividers, chart gridlines.
- **Stone** (stone): control strokes (filter pill, select), scrollbar thumb, and provisional months in the volume chart.
- **Market Grey** (market-grey): the market comparison bar under an agent's own bar.
- **Wash** (wash): bar tracks, row hover, skeleton blocks, the empty-chart ground.
- **Paper** (paper): the page ground and the search pill.

### Named Rules
**The One Signal Rule.** Orange means live or selected and nothing else. It never fills a bar, never colours a series, never decorates.

**The Line Badge Rule.** A line colour always means its property type. Neutral breakdowns (deal type, acting for) are drawn in Signage Ink, never borrowed line colours.

**The Grey Is Provisional Rule.** Within a data series, Stone marks the trailing months still being reported. Grey bars are not a style choice and never mean "less important".

**The Not A Real Line Rule.** Lines borrow the map's grammar but never its identity: no line names, no line codes such as "EW" or "NS".

## Typography

**Display Font:** Source Sans 3 (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Source Sans 3
**Label/Mono Font:** Source Sans 3 with tabular numerals

**Character:** One humanist sans doing signage work. Hierarchy comes from weight and size, not from a second face.

### Hierarchy
- **Wordmark** (700, 20px, tight tracking): the CEA-VIZ wordmark in the header band.
- **Figure** (700, 28px, 1.25): headline numbers in the market figure strip; the agent total uses the 24px headline size.
- **Headline** (700, 24px, 1.25): view titles and the agent's name.
- **Title** (700, 18px): chart titles in the market view.
- **Body** (400, 15px, 1.45): base text; table names at 600.
- **Meta** (400, 14px): counts under titles, row details, bar-list labels.
- **Section Label** (700, 13px, 0.06em, uppercase, Ink Soft): the heading of each profile section and market breakdown, set like a station sign. It is the section's heading, not an eyebrow over another heading.
- **Label** (400 to 600, 12px): column heads, figure labels, registration numbers, axis ticks.
- **Chip** (700, 11px or 13px, 0.025em, white): property station codes.

### Named Rules
**The Tabular Rule.** Every number on screen uses tabular numerals so columns of counts and percentages align like a timetable.

**The Labels Carry It Rule.** No explanatory caption lines, footnotes or taglines under charts and lists. If a reader needs to know what a mark means, the label, the column head or the tooltip says it.

## Layout

A single shell, capped at 1440px, with side gutters of 16px, 24px from 640px and 40px from 1024px. The header band, filter toolbar and footer span full width with their content in the same shell.

The Salespersons view is a two-column timetable-and-detail layout from 1024px: the ranked table takes the flexible column, the agent record a fixed 400px column (440px from 1280px) with a 40px gap. The record column is sticky, scrolls on its own and keeps a stable scrollbar gutter. Below 1024px the record replaces the list on selection, with a "Back to list" control.

The Market view stacks a three-up figure strip, a full-width monthly chart and three breakdown columns (one column below 768px), separated by 48px.

Rhythm: table rows pad 12px vertically; profile sections open with 20px above and below a hairline; main content pads 32px top and bottom. Columns progressively hide on narrow screens (top area from 1280px, mostly-chip column from 768px, with the chip moving under the name on phones).

## Elevation & Depth

Flat. Regions are divided by rules and tonal wash, never lifted. Only elements that genuinely overlay the page cast a shadow.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 8px 24px rgba(0,0,0,0.12)`): filter dropdown menu, which also carries a 1px ink border.
- **Tooltip** (`box-shadow: 0 4px 16px rgba(0,0,0,0.18)`): the chart tooltip on its ink ground.

### Named Rules
**The Ruled Not Raised Rule.** Containers, cards, figures and panels have no shadow. A region begins with a 2px ink rule or a 1px ink border pair; rows separate with 1px hairlines.

## Shapes

Two shapes only. Anything you press or read as a badge is a full pill (9999px): search field, filter pills, buttons, property chips, town markers. Everything structural is square: tables, bars, bar tracks, figure strips, popovers, tooltips, checkboxes.

The signature silhouette is the station lozenge: a white stop with a 3px coloured ring, used as the numbered town marker on the map and beside each town in its list.

## Components

### Buttons
- **Shape:** full pill (9999px).
- **Primary:** Signage Ink ground, white 600 text, 40px tall, 20px side padding; hover shifts to Ink Soft.
- **Text action:** "Clear filters" is 14px 600 Ink Soft with a Stone underline offset 4px; hover darkens text and underline to ink.
- **Focus:** global 2px Signage Ink outline at 2px offset on light grounds; Signal on the ink header band (Signal on white fails 3:1).

### Chips
- **Style:** property station code (HDB, CONDO, LANDED, EC, STRATA) in white 700 uppercase on its line colour, full pill, 20px tall (24px large, beside the agent name).
- **State:** static; the chip names the agent's most frequent type.

### Inputs / Fields
- **Search pill:** white pill, 44px tall, on the ink band, search glyph inset left, clear button inset right. Focus draws a 3px signal ring.
- **Filter pill:** 36px white pill with a Stone stroke, muted field name then the 600 value ("Property Any"), chevron that rotates on open. Hover darkens the stroke to ink; an active filter switches to Signal Wash ground with a signal stroke.
- **Select:** square 32px with Stone stroke, 600 tabular value.
- **Checkbox (in popover):** square 16px; checked is an ink fill with a white check.

### Navigation
- **Header band:** Signage Ink, wordmark left, view tabs, search pill right (search drops beside the wordmark on phones, tabs wrap below).
- **Tabs:** 15px 600; inactive is light grey (#b8b8b4) turning white on hover; active is white with a 3px signal underline.

### Ranked Table
- Column heads 12px 600 muted over a hairline; rows separated by hairlines; rank muted and tabular; name 600 with registration number underneath.
- The deal count sits right-aligned and bold above a 6px Wash track with an ink fill on a shared scale.
- Selected row: Signal Wash; hover: Wash.

### Bar List
- Label left, bold percentage and muted count right, then an 8px square bar on a Wash track: line colour for property type, ink otherwise.
- When compared to the market, a 4px Market Grey bar sits below on the same scale with a tiny "market 43%" label.

### Volume Chart
- Square bars with an 8% gap, hairline horizontal gridlines, an ink baseline, 12px muted ticks, years only for long series. Bars take the agent's line colour (ink in the market view); the trailing provisional months are Stone. No entry animation.

### Town Map (signature)
- A schematic Singapore (main island, Sentosa, Pulau Ubin, Jurong Island) in Wash with a Hairline coast, no basemap, no roads.
- Each of the agent's top towns is a station marker at its approximate centroid: white fill, 3px ring, rank number in 700 tabular ink. Radius grows with the square root of the count (8 to 17 units). Town markers ring in HDB green; district markers ("D19 · Serangoon Garden") ring in the colour of the agent's main private property type.
- Overlapping markers are nudged apart rather than stacked; position is approximate, legibility wins.
- Markers carry no name labels; the rank number links each marker to its row in the list.
- Below the map, a ranked list repeats the same numbered marker beside the place name in 600 and right-aligned tabular count and percentage. Hovering a row or marker fills that marker with its line colour and dims the others to 30%.

### Figure Strip
- A definition list framed top and bottom by 1px ink rules, cells split by hairlines; muted label above a bold tabular figure, with an optional muted sub-figure.

## Do's and Don'ts

### Do:
- **Do** open every region with a 2px ink rule or a pair of 1px ink rules, and divide rows with 1px hairlines.
- **Do** colour property types only with their line colour, everywhere they appear.
- **Do** render the trailing provisional months in Stone and say "Provisional" in the tooltip.
- **Do** set every number in tabular numerals, right-aligned in columns.
- **Do** use pills for controls and chips, square corners for structure.
- **Do** keep transitions to colour and opacity at 150 to 200ms; dim a region to 60% opacity while it updates.
- **Do** let labels carry meaning: name sections and columns precisely instead of adding a caption.

### Don't:
- **Don't** add explanatory captions, footnotes or taglines ("Grey bars: …", "ranked by …").
- **Don't** put shadows on cards, panels or figures; only popovers and tooltips float.
- **Don't** use signal orange as a data colour or decoration.
- **Don't** give lines real MRT names or codes such as "EW" or "NS".
- **Don't** fall back to KPI cards, pie charts or a dataset sidebar.
- **Don't** use a line colour for a neutral breakdown such as deal type or acting for.
