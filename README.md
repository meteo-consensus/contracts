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

| Id                     | Canonical unit | Height (m)       | Temporal semantics | Bounds      |
| ---------------------- | -------------- | ---------------- | ------------------ | ----------- |
| `temperature_2m`       | °C             | 2                | `instant`          | -100 to 70  |
| `relative_humidity_2m` | %              | 2                | `instant`          | 0 to 100    |
| `precipitation`        | mm             | 0                | `sum_preceding_1h` | 0 to 500    |
| `wind_speed_10m`       | m/s            | 10               | `instant`          | 0 to 150    |
| `wind_direction_10m`   | °              | 10               | `instant`          | 0 to 360    |
| `wind_gusts_10m`       | m/s            | 10               | `max_preceding_1h` | 0 to 150    |
| `cloud_cover`          | %              | none             | `instant`          | 0 to 100    |
| `pressure_msl`         | hPa            | none (sea level) | `instant`          | 800 to 1100 |

- **Units**: every value stored or served is in its canonical unit. Wind is in m/s (Open-Meteo defaults to km/h: request `wind_speed_unit=ms`).
- **Temporal semantics**: `instant` is the value at the timestamp; `sum_preceding_1h`, `max_preceding_1h` and `mean_preceding_10min` cover the period that ends at the timestamp.
- **Bounds**: closed intervals. Humidity, cloud cover and direction are bounded by definition; the others are plausibility bounds, deliberately wider than observed world extremes, that catch corrupt values rather than rare weather.
- **Missing values**: `variableValueSchema(id)` accepts a finite number within the bounds, or `null` for a missing value. A missing value is never 0.

The catalogue is frozen (read-only at runtime and in its types) and does no I/O.
