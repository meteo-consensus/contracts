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

## Forecast model catalogue

`forecastModelCatalogue` lists the six collected forecast models: `arome_france`, `arome_france_hd`, `arpege_europe`, `ecmwf_ifs`, `icon_eu` and `gfs`. These internal ids are part of the public contract and never change once released; they are not Open-Meteo `models=` ids (that mapping lives in collector). `ForecastModelIdSchema` rejects any other id.

Every value is defined once, with its source URL and verification date as a comment, in [`src/domain/forecast-model-catalogue.ts`](src/domain/forecast-model-catalogue.ts) and [`src/domain/forecast-providers.ts`](src/domain/forecast-providers.ts). A value the official source does not give is `null` and commented « à vérifier » with the URL to check: it is never guessed.

- **Provider family**: models that share their dynamics and physics count as one independent vote. `countIndependentVotes(models)` returns the number of distinct families; AROME France and AROME France HD count as one. A grid change never changes the family.
- **Grid and grid changes**: `grid` is the grid before the first dated change; `gridChanges` lists dated changes in ascending order (ICON-EU moves to its native grid on 30/11/2026, new grid « à vérifier »). `gridAt(model, date)` returns the grid in effect at a date, or `null` when that grid is not known yet. Scores never mix errors from before and after a change.
- **Run cycles**: initialisation hours in UTC, each with its horizon. AROME runs reach about +52 h (`approximate: true`); the other horizons per cycle are « à vérifier ».
- **Collected horizon**: `horizonCollectedHours` is 72 for every model.
- **Native time step**: `nativeSteps` is an ordered list of lead-time ranges (inclusive upper bound, the last one open-ended). `nativeStepAt(model, leadHours)` returns the step in hours, or `null` when the source does not give it.
- **Gust window**: `gustWindowHours` is the period one `wind_gusts_10m` value covers (its preceding maximum): 3 h for ECMWF IFS, 1 h where the Open-Meteo page states it for the model, `null` where it is ambiguous.
- **Unavailable variables**: catalogued variables the model does not provide; `null` when not known.
- **Attribution**: `provider` carries the provider name, its credit line (« Données Météo-France »; `null` where the owner has not set the wording yet) and its licence. `distributorAttribution` is the separate Open-Meteo attribution (« Weather data by Open-Meteo.com », CC BY 4.0), shown wherever the data is served.

The catalogue is frozen and does no I/O.
