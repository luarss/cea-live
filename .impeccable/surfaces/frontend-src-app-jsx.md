---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: ["frontend/src"]
---

## Scope

The whole CEA-VIZ single-page app (Salespersons and Market views). Mode: Operate. Agents first; market context second.

## Direction contract

THESIS: A salesperson's record read like the MRT network: each agent's towns are numbered stations on a schematic island, and property types wear line-badge colours. Refuses the KPI-card-and-pie analytics template and the one-item dataset sidebar.

OWN-WORLD: White ground, near-black (#1a1a1a) wayfinding header band, rounded station-code chips for property types (HDB green, Condo red, Landed brown, EC purple, Strata blue), white station markers ringed in line colour, orange (#fa9e0d) as the single live/selection accent. Source Sans 3 throughout, tabular numerals. No card shadows; 2px ink rules and 1px hairlines divide regions.

STORY: The visitor types a name or registration number, sees where that agent ranks, picks them, and reads their record (volume, side of deal, property mix against the market, towns on a map, monthly activity) without leaving the page. Market view answers what the whole market looks like under the same filters.

FIRST VIEWPORT: Dark header: wordmark left, Salespersons/Market tabs, pill search right. Filter toolbar under it. Left two-thirds: ranked salesperson table (rank, name + reg no, deals on a shared scale, mostly-chip, top town). Right third: sticky agent panel with name, reg no, totals, and the town map; first row preselected.

FORM: Line Map (LTA MRT system map and wayfinding), my top-ranked grounded candidate, chosen by the user over the assigned Master Plan; seed:9e15586622ebb4d4

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

- Signature move: agent's top towns as numbered station markers on a schematic Singapore, ringed in their property-type line colour. Never mistakable for real MRT lines: no line names or codes like "EW"/"NS".
- Data has no prices; trailing one to two months are provisional and must be marked.
- Agent "market share" is computed against all recorded deals, not the visible list.
