# contracts

Contrat public : OpenAPI, schémas Zod et types partagés (modèles, variables, unités, consensus). Paquet @meteo-consensus/contracts.

Part of [meteo-consensus](https://github.com/meteo-consensus): the weather API that crosses forecast models and learns which one is reliable where.

## Development

Requirements: Node.js (version in `.node-version`) and pnpm (version in `package.json`, `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm run check
```

## Variable catalogue

`variableCatalogue` lists the eight collected variables. Ids follow the Open-Meteo forecast API names (checked on https://open-meteo.com/en/docs, 09/11/2026) and never change once released: `VariableId` is their literal union and `VariableIdSchema` rejects any other id.

Each variable's canonical unit, height, temporal semantics and bounds are defined once, in [`src/domain/variables.ts`](src/domain/variables.ts) (`variableCatalogue`), and not repeated here so this page cannot drift from the code.

- **Units**: every value stored or served is in its canonical unit. Wind is in m/s (Open-Meteo defaults to km/h: request `wind_speed_unit=ms`).
- **Temporal semantics**: of the canonical forecast value. `instant` is the value at the timestamp; `sum_preceding_1h` and `max_preceding_1h` cover the hour that ends at it. `mean_preceding_10min` is for observations (station wind is a 10-minute mean), which carry their own semantics.
- **Height**: metres above ground. `0` is the surface; `null` means sea level (`pressure_msl`) or the whole column (`cloud_cover`).
- **Wind direction**: meteorological convention, the direction the wind comes from, in degrees clockwise from north. `360` means north and `0` means calm (no direction); consumers exclude calm from direction errors.
- **Bounds**: closed intervals. Humidity, cloud cover and direction are bounded by definition; the others are plausibility bounds, deliberately wider than observed world extremes, that catch corrupt values rather than rare weather.
- **Missing values**: `variableValueSchema(id)` accepts a finite number within the bounds, or `null` for a missing value. A missing value is never 0.

The catalogue is frozen (read-only at runtime and in its types) and does no I/O.
