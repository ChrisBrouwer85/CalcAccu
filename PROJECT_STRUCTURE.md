# CalcAccu – Project Structure

## Overview

CalcAccu is a browser-based battery savings calculator for Home Assistant users in the Netherlands. Users import energy data (CSV or live HA connection), configure battery sizes and strategy, select energy prices, and receive annual savings projections.

## Repository layout

```
CalcAccu/
├── index.html                    # Vite entry point
├── vite.config.js                # Vite + Tailwind config; Vitest test config
├── package.json
├── eslint.config.js
├── sample_ha_energy.csv          # Example Home Assistant energy export
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── main.jsx                  # React root mount
│   ├── App.jsx                   # Root component: step state machine (1→2→3→4→results)
│   ├── App.css
│   ├── index.css                 # Tailwind base styles
│   ├── i18n.js                   # EN/NL translation strings + MONTHS constant
│   │
│   ├── components/
│   │   ├── CSVImport.jsx         # Step 1 – CSV drag-drop + column mapping (tabs: CSV / HA)
│   │   ├── HAImport.jsx          # Step 1 tab – live Home Assistant API connector
│   │   ├── AccuConfig.jsx        # Step 2 – battery size selector + cost/efficiency
│   │   ├── StrategyConfig.jsx    # Step 3 – home vs. sell-to-grid priority slider
│   │   ├── PriceConfig.jsx       # Step 4 – price source (API / static / manual)
│   │   ├── SimulationResults.jsx # Results view – summary cards + charts
│   │   ├── SavingsChart.jsx      # Recharts bar/line savings chart
│   │   └── EnergyFlowChart.jsx   # Recharts monthly energy flow breakdown
│   │
│   ├── utils/
│   │   ├── csvParser.js          # CSV parsing, sensor-id detection, delta computation
│   │   ├── simulation.js         # Hour-by-hour battery simulation engine
│   │   ├── energyPrices.js       # Dutch price history, EnergyZero API fetch, price maps
│   │   └── haConnector.js        # Home Assistant REST API helpers
│   │
│   └── test/
│       ├── setup.js              # Vitest setup: imports @testing-library/jest-dom
│       ├── csvParser.test.js     # Unit tests for csvParser utilities
│       ├── energyPrices.test.js  # Unit tests for energyPrices utilities
│       ├── simulation.test.js    # Unit tests for the simulation engine
│       └── App.navigation.test.jsx  # Integration tests for App step navigation
│
└── .github/
    └── workflows/
        ├── deploy.yml            # GitHub Pages deploy on push to main
        ├── preview.yml           # PR preview deployments
        └── preview-cleanup.yml   # Cleanup stale preview deployments
```

## Step flow (App.jsx state machine)

```
activeStep = 1  →  CSVImport   (upload file or connect HA)
            2  →  AccuConfig   (select battery sizes)
            3  →  StrategyConfig (home priority vs. sell-to-grid)
            4  →  PriceConfig  (static / API / manual prices)
            'results'  →  SimulationResults
```

`canProceed(step)` guards the Next button:
- Step 1: requires `hourlyData.length > 0` (set by `handleDataReady` after "Confirm Mapping")
- Step 2: requires at least one preset size selected OR a custom size entered
- Steps 3–4: always passable

## Key data types

**`hourlyData`** – array of `{ timestamp: Date, solar: number, gridImport: number, gridExport: number }` (kWh per hour)

**`accuConfig`** – `{ selectedSizes: number[], customSize: string, efficiency: number, maxRateKw: number, costPerKwh: number }`

**`priceMap`** – `Map<string, number>` keyed by `hourKey(date)` → `"YYYY-MM-DDTHH"`

**Simulation result** – `{ hourly[], monthly[], totals: { selfSufficiency, ... }, financial: { annualSavings } }`

## Commands

```bash
npm run dev        # Start Vite dev server
npm test           # Run full test suite (Vitest)
npm run test:watch # Vitest watch mode
npm run build      # Production build
npm run lint       # ESLint
```
