# CalcAccu – Claude Development Rules

## Project reference

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the full directory layout, data types, and step-flow description.

## Testing requirements

**Run `npm test` after every change and before every commit.** All tests must pass. CI also runs `npm test` before building — a failing test blocks deployment.

- Test files live in `src/test/` and use `.test.js` / `.test.jsx` extensions.
- Framework: **Vitest** + **@testing-library/react** + **@testing-library/jest-dom**.
- Write tests for any new utility function or logic-bearing component change.
- Component tests mock `papaparse` and `recharts` (both depend on browser APIs not available in jsdom — see `App.navigation.test.jsx` for the pattern).
- Do not commit code that breaks existing tests.

## Common bugs to avoid

- **Props destructuring**: every component must explicitly destructure all props it uses in JSX. The `StrategyConfig` bug (`lang` was passed but not destructured, causing a `ReferenceError` on step 3) is the canonical example.
- **canProceed guards**: `canProceed(step)` in `App.jsx` controls the Next button. Step 2 requires `selectedSizes.length > 0 || customSize`. Do not tighten these guards without updating tests.
- **hourKey format**: `energyPrices.hourKey()` returns `"YYYY-MM-DDTHH"` (local time, not UTC). Price map lookups and simulation must use the same key.
- **Delta computation**: `csvParser.applyMapping` derives per-hour kWh from cumulative meter readings. Negative deltas are clamped to 0 (meter resets). Do not pass raw cumulative values to the simulation.

## Architecture rules

- **No server**: this is a fully static SPA deployed to GitHub Pages. All computation runs in the browser. Do not add backend dependencies.
- **i18n**: user-visible strings must exist in both `en` and `nl` translation objects in `src/i18n.js`. Pass `lang` and `t` as props; never hardcode English strings in components without a Dutch fallback.
- **Simulation is pure**: `runSimulation` in `src/utils/simulation.js` is a pure function. Keep it free of side effects and imports beyond `energyPrices.js`.
- **State lives in App**: all shared state (`hourlyData`, `accuConfig`, `priceConfig`, `homePriority`, `simulationResults`, `activeStep`) is owned by `App.jsx`. Child components receive state via props and call `onChange` callbacks — they do not manage their own copies.

## Branching

Always create new branches from `main`:
```bash
git fetch origin main
git checkout -b <branch-name> origin/main
```
Never branch from another Claude feature branch. If the current HEAD is not on `main`, explicitly base the new branch on `origin/main`. PRs must always target `main`.

## Dev workflow

```bash
npm run dev        # Vite dev server (hot reload)
npm test           # Must pass before committing
npm run lint       # ESLint – fix all warnings before committing
npm run build      # Verify production build succeeds
```

## Deployment

- Push to `main` → auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
- PR branches → preview deployment via `.github/workflows/preview.yml`.
- `VITE_BASE` env var controls the base path (default `/CalcAccu/`).
