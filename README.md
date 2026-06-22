<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Award Architect

A brutalist-styled personal tool for travel award points strategy: a real award-search handoff to PointsYeah, an AI-generated strategic brief for the route, and a credit-card-to-airline points transfer yield calculator.

**Personal-use demo** — not intended as a public, high-traffic product. See "Data Source" below for why.

## What it does

1. **Route Intelligence** — enter an origin airport, optional destination (or "search anywhere"), a date range, cabins, and loyalty programs. The app builds a prefilled search URL and opens it on [PointsYeah](https://www.pointsyeah.com), which returns real, live award availability across the programs you selected. This app does not host or fabricate any flight data itself — PointsYeah does the actual searching.
2. **AI Strategic Brief** — alongside the real search, the app separately calls the Gemini API (server-side, via a Vercel function) for 2-3 general strategic tips about the route and program. This is general advice from the model, not live award data — it's clearly labeled as such in the UI.
3. **Yield Calculator** — enter a points balance and a transferable credit card currency (Chase Ultimate Rewards, Amex Membership Rewards, Citi ThankYou Points). The app computes resulting airline miles across each transfer partner. These ratios and bonuses are hardcoded reference values and may drift out of date — verify current bonuses on each program's site before relying on this for a real transfer decision.

## Data Source

There is no public, documented API for real-time award seat availability that's free to use. The two real options are:

- **Seats.aero Pro API** ($9.99/mo) — real API access, but their terms restrict commercial/public use without written permission.
- **PointsYeah** — free, but has no public developer API. It's a finished consumer product you search in a browser, not a data feed.

This app uses the **deep-link handoff** approach: rather than fabricating flight data or scraping PointsYeah (which would violate their terms and break whenever their site changes), it constructs a real PointsYeah search URL from your form inputs and opens it in a new tab. PointsYeah does the actual, live searching.

The URL parameter schema (`departure`, `arrival`, `startDate`, `endDate`, `programs`, `cabins`, `weekend_only`, etc.) was verified against a real, manually-performed PointsYeah search — not guessed. See `buildPointsYeahUrl()` in `src/App.tsx` for the exact mapping and a note on which parameters (`collection`, `mixedCabin`, `sort`, `trip`) are carried over verbatim from that verified sample because their full semantics aren't publicly documented.

**Because this relies on a third party's web app rather than a stable public API, treat it as a personal convenience tool, not a production integration** — if PointsYeah changes their URL structure, the deep link may stop prefilling correctly (it would still open their homepage, just without your search prefilled).

## Architecture

```
Browser (React + Vite)
   │
   ├─ buildPointsYeahUrl(...) → window.open(...)   [real award search, no backend involved]
   │
   └─ fetch('/api/strategy-tips', { ... })
        │
        ▼
      Vercel Serverless Function (api/strategy-tips.ts)
        │
        │  GEMINI_API_KEY read from server-side process.env — never sent to the browser
        ▼
      Gemini API (gemini-3-flash-preview)
```

The Gemini API key lives only in a server-side environment variable, read by `api/strategy-tips.ts` at request time. It is never bundled into the client-side JavaScript, unlike the original AI Studio template this project started from (which inlined the key into the browser bundle via Vite's `define`).

## Run Locally

**Prerequisites:** Node.js, the [Vercel CLI](https://vercel.com/docs/cli) (`npm install -g vercel`)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
3. Run both the frontend and the serverless function together:
   ```bash
   vercel dev
   ```

## Deploy (personal use)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Add an environment variable `GEMINI_API_KEY` with your real key in Project Settings.
4. Deploy. Treat the resulting URL as a personal tool — share it with a small audience (e.g. recruiters reviewing your portfolio) rather than promoting it as a public product, since the PointsYeah handoff isn't a licensed integration.
5. **Recommended:** restrict your Gemini API key to your Vercel domain with a daily quota cap in Google AI Studio / Cloud Console.

## Tech Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS 4
- `@google/genai` (Gemini SDK), called server-side only
- Deployed on Vercel (serverless function for the AI tips route)
