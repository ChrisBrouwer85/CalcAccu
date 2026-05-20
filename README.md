# CalcAccu

**CalcAccu** is a browser-based home battery savings calculator for Dutch solar households. Upload your Home Assistant energy data, configure one or more battery sizes, and get an accurate annual savings projection based on real day-ahead electricity prices.

Live at: **[chrisbrouwer85.github.io/calcaccu](https://chrisbrouwer85.github.io/calcaccu)**

---

## What it does

Most battery calculators assume a fixed self-consumption percentage. CalcAccu uses a **Smart EMS (Energy Management System)** that replays your actual historical energy data hour by hour and dispatches the battery the same way a real EMS would: charge from solar, sell at the most expensive hours of each day, keep a configurable reserve for overnight home use.

**Key outputs:**
- Annual savings in euros (per battery size)
- Payback period in years
- Self-sufficiency percentage (with vs. without battery)
- Monthly energy flow breakdown
- Side-by-side comparison across multiple battery sizes

---

## Features

- **Smart EMS dispatch** — ranks day-ahead hourly prices per calendar day; the battery discharges above its reserve during the top-price hours
- **Configurable sell fraction** — slider from 0% (full self-consumption, never sells) to 100% (empties battery at the single best hour of each day); values in between keep proportional reserve for overnight home use
- **Grid arbitrage** — optional: charge from the grid at the cheapest hours of each day, sell the stored energy at the peak hours
- **EnergyZero API** — fetches real Dutch day-ahead market prices (incl. VAT) per hour
- **Global price cache** — fetched prices are stored in Firestore and shared across all users; no redundant API calls
- **Home Assistant import** — connect live to your HA instance via Long-Lived Access Token and fetch statistics directly
- **CSV import** — upload a Home Assistant energy CSV; maps multiple sensors per direction with per-sensor tariffs
- **Multiple battery sizes** — compare 5/10/15/20 kWh or any custom size in a single run
- **English / Dutch UI** — full i18n with language toggle

---

## How the Smart EMS algorithm works

The simulation iterates over every hour in your dataset. For each calendar day it ranks all 24 buy prices from cheapest (rank 0) to most expensive (rank 1).

```
reserve = capacityKwh × (1 − sellFraction)
```

| Hour type | Condition | Action |
|-----------|-----------|--------|
| **Peak** | rank > (1 − sellFraction) | Export all solar surplus; discharge battery above reserve to grid |
| **Cheap** | rank < sellFraction × 0.5 *(only if grid-charge enabled)* | Maximize self-consumption from solar; top up remaining space from grid |
| **Normal** | everything else | Maximize self-consumption (full charge/discharge priority) |

Home consumption always takes priority — the reserve is a soft floor for *selling*, never for home coverage.

**With flat or unknown prices** (all hours equal, or no price data loaded), all hours are treated as normal: the battery charges from solar and discharges for home use with full priority.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled (for auth + price cache)
- A `.env.local` file with your Firebase config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Install and run

```bash
npm install
npm run dev        # http://localhost:5173
```

### Deploy

Push to `main` → GitHub Actions automatically deploys to GitHub Pages.

```bash
npm run build      # production build in dist/
```

Set `VITE_BASE` to your repo path if deploying to a sub-path (default: `/CalcAccu/`).

---

## Firestore rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /marketPrices/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

`marketPrices` documents are keyed `NL-YYYY-MM` and contain an array of hourly buy prices for that month.

---

## Development

```bash
npm run dev        # Vite dev server with hot reload
npm test           # Vitest unit tests (must pass before every commit)
npm run lint       # ESLint (zero warnings policy)
npm run build      # Production build
```

Tests live in `src/test/`. The simulation engine (`src/utils/simulation.js`) is a pure function with full unit-test coverage.

---

## Data import

### CSV (Home Assistant energy export)

1. In Home Assistant: **Settings → Energy → ⋮ → Download data as CSV**
2. Drop the file on the import screen
3. Map columns to: Solar production, Grid import sensor(s), Grid export sensor(s)
4. Optionally assign a per-sensor tariff (€/kWh) for mixed-tariff contracts

### Home Assistant live connection

1. Generate a Long-Lived Access Token in HA: **Profile → Security → Long-Lived Access Tokens**
2. Enter your HA URL and token on the import screen
3. Select a date range and fetch statistics directly

---

## Energy prices

CalcAccu fetches Dutch day-ahead prices (incl. 21% VAT) from the **EnergyZero API**. Prices are cached per calendar month in Firestore so subsequent loads are instant.

Set the **Feed-in tariff** to your actual net-metering or saldering contract rate. This is the price used when the simulation exports energy to the grid.

---

## Project structure

```
src/
├── components/
│   ├── AccuConfig.jsx          # Battery size + cost settings
│   ├── StrategyConfig.jsx      # Smart EMS sell-fraction slider
│   ├── PriceConfig.jsx         # EnergyZero price loader + feed-in tariff
│   ├── SimulationResults.jsx   # Summary cards, charts, monthly table
│   ├── CSVImport.jsx           # CSV upload + column mapping
│   ├── HAImport.jsx            # Home Assistant live connector
│   └── sim/
│       └── SimulationControls.jsx
├── pages/
│   ├── SimulationPage.jsx      # Main simulation page
│   ├── DataPage.jsx            # Data management
│   └── SettingsPage.jsx        # Account + defaults
├── utils/
│   ├── simulation.js           # Pure hourly simulation engine
│   ├── energyPrices.js         # EnergyZero API fetch + hourKey helper
│   ├── csvParser.js            # CSV parse + delta computation
│   └── haConnector.js          # HA REST API helpers
├── services/
│   ├── marketPrices.js         # Firestore price cache
│   └── preferences.js          # User preferences (Firestore)
└── i18n.js                     # EN/NL translations
```

---

## License

MIT
