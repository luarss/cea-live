# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Singapore property buyers, sellers, landlords and tenants deciding which salesperson to engage. They arrive with a name or registration number from a listing or a referral and want to know whether this agent actually does deals like theirs: the right property type, the right transaction type, the right side of the deal, in the right towns.

Secondary: people following the residential market who want volume and mix trends over time.

Priority confirmed by the owner: agents first, market context second.

## Product Purpose

Turn the CEA "Salespersons' Property Transaction Records (residential)" open dataset into a fast way to check any registered salesperson's track record, set against the whole market. Success: a visitor finds an agent in seconds and leaves with an accurate picture of what that agent specialises in.

## Positioning

Every one of ~1.44M official CEA-recorded transactions since January 2017, attributed to a named, registered salesperson. Agent portals show self-reported reviews and listings; this shows what the regulator recorded.

## Operating Context

- Data source: data.gov.sg, dataset published by the Council for Estate Agencies; refreshed by a scheduled pipeline and redeployed on Render.
- Fields per record: salesperson name, registration number, transaction month, property type (HDB, Condominium/Apartments, Landed, Executive Condominium, Strata Landed), transaction type (Resale, New Sale, Sub-Sale, Whole Rental, Room Rental), represented party (Buyer, Seller, Landlord, Tenant), town, district, general location.
- Granularity is month. The most recent one to two months are incomplete because of reporting lag.

## Capabilities and Constraints

- Market overview: totals, monthly volume series, breakdowns by property type, transaction type and represented party; filterable by those three dimensions.
- Agent ranking by transaction count with search by name or registration number, filterable by the same dimensions.
- Agent profile: totals, active period, monthly activity, breakdowns, top towns.
- The dataset contains no prices, commissions, ratings or outcomes. Never imply them.
- Transaction counts are activity, not quality. Avoid language that ranks agents as "best".
- Stack: React + Vite + Tailwind + Recharts frontend; Express + SQLite backend serving JSON.

## Evidence on Hand

- Live dataset via the backend API (`/api/datasets/...`).
- No testimonials, partnerships or endorsements exist; do not fabricate them. Open: whether to state non-affiliation with CEA on the site (inferred independent, not confirmed).

## Product Principles

1. Lookup first: the path to a specific agent is the shortest path in the product.
2. Show the record, not a verdict: present counts and mix plainly; let the visitor judge.
3. Every agent number is read against the market: an agent's mix means more beside the market's mix.
4. Be honest about the data: label incomplete months, source, and what the data cannot say.
