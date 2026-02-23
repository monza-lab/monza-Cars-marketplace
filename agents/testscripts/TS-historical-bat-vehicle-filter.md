# TS-HBAT-FILTER

- Objective: verify `vehicleFilter` keeps valid Porsche vehicles and rejects non-vehicle Porsche accessories/parts/literature.
- Prerequisites: project dependencies installed (`npm install`).
- Run command: `npm run test -- src/features/porsche_collector/historical_bat/filter_vehicle.test.ts`
- Expected observations:
  - `2024 Porsche 911 S/T Heritage Design` is kept.
  - Wheels/manuals/engine+transaxle/magazines/sign examples are rejected with `reason: non_vehicle_accessory`.
  - Non-Porsche listing is rejected with `reason: non_porsche`.
- Regression gate: `npm run test -- src/features/porsche_collector/historical_bat`
- Artifact capture: store terminal output in `agents/testscripts/artifacts/` when running in CI/operator sessions.
