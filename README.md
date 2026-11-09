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

`forecastModelCatalogue` lists the six collected forecast models: `arome_france`, `arome_france_hd`, `arpege_europe`, `ecmwf_ifs`, `icon_eu` and `gfs`. These internal ids are part of the public contract and never change once released; they are not Open-Meteo `models=` ids (that mapping lives in collector). `ForecastModelIdSchema` rejects any other id. Adding a model, a `Grid` kind or a `Horizon` basis value (closed unions) is a minor release with a changelog note. `providerIds`, `providerFamilies` and their schemas list the providers and families.

Every value is defined once, with its source URL and verification date as a comment, in [`src/domain/forecast-model-catalogue.ts`](src/domain/forecast-model-catalogue.ts) and [`src/domain/forecast-providers.ts`](src/domain/forecast-providers.ts). **`null` always means unknown** (« à vérifier », commented with the URL to check), never « not applicable » and never guessed; a case that does not apply has its own literal (`"open"`, `"first_run"`) or variant (`Grid` `kind`). The provider table itself is not exported: each model carries its `provider`.

- **Provider family**: models that share their dynamics and physics count as one independent vote. `countIndependentVotes(models)` returns the number of distinct families. AROME France and AROME France HD are the same run on two output grids and count as one. AROME and ARPEGE are separate families, 5 independent votes for the 6 models (décision du propriétaire du 09/11/2026). Their independence is only partial (AROME takes its boundary conditions from ARPEGE, citation « à vérifier »): scoring weights handle that correlation, not the catalogue. A grid change never changes the family.
- **Grid and grid periods**: a grid applies by **run initialisation time**: every lead of a run comes from the grid of that run, even leads valid after a change. `grid` is the grid of runs before the first change; `gridChanges` lists, in strictly ascending order, each change with a stable `id` and the first run initialised on the new grid (`firstRunInitUtc`, validated by `UtcInstantSchema`: UTC to the second with a `Z`). ICON-EU moves to its native grid with the run of 30/11/2026 00 UTC (period `icon_eu_native_2026`; instant and new grid « à vérifier »). `gridPeriodAt(model, runInitUtc)` returns the period `id` (`"initial"` for the base grid), its start (`since`, `"first_run"` for the base period: narrow it before using it as a date) and its grid, so scores keep periods apart even when the new grid is unknown; `gridAt(model, runInitUtc)` returns the grid only. Scores are keyed on the period `id`, which never changes; correcting a `firstRunInitUtc` moves runs between periods and is a re-scoring event.
- **Run cycles**: initialisation hours in UTC, each with its horizon. AROME runs reach +51 h: `basis: "observed"` for the sampled cycles, `"extrapolated"` for the others. The other horizons per cycle are « à vérifier ».
- **Collected horizon**: `horizonCollectedHours` is 72 for every model; the effective cap of a run is the smaller of 72 h and its cycle horizon. When the cycle horizon is unknown, so is the effective cap: completeness is measured on the leads actually received, never against an assumed 72 h.
- **Native time step**: `nativeSteps` is an ordered list of lead-time ranges (inclusive upper bound, the last one `"open"`). `nativeStepAt(model, leadHours)` returns the step in hours, or `null` when the source does not give it.
- **Gust window**: `gustWindowOf(model)` (`gustWindowHours`) is the period one `wind_gusts_10m` value of the model covers (its preceding maximum). It **overrides** the variable catalogue semantics (`max_preceding_1h`, which applies only to sources with no per-model window, such as observations): 3 h for ECMWF IFS, 1 h where the Open-Meteo hourly table gives it. `null` means unknown: that model's gusts are not paired (« données insuffisantes »), never assumed to be 1 h. One window per model holds only within the 72 h cap, since native steps change later.
- **Unavailable variables**: catalogued variables the model does not provide, sourced from each page’s native variables; `null` when not known.
- **Attribution**: `provider` carries the provider name, its licence and its `credit`. A `required` credit has two wordings: `unmodified` for raw per-model values (« Données Météo-France »; the ECMWF service statement; « Quelle: Deutscher Wetterdienst ») and `derived` for consensus and scores, which providers treat as modified use (ECMWF and CC BY 4.0: indicate the changes; DWD: « Datenbasis: Deutscher Wetterdienst, <Veränderungshinweis> »). `derived` is `null` for every provider: « à vérifier — formulation du propriétaire ». Notices are typed (`source`, `licence`, `disclaimer`, with an optional `url`) so a page can link the licence without parsing text. NOAA is `not_required` (public domain); a courtesy credit is the owner's choice. `distributorAttribution` is the separate Open-Meteo attribution (« Weather data by Open-Meteo.com », CC BY 4.0), shown wherever the data is served. The ECMWF CC BY 4.0 licence is confirmed for ECMWF Open Data; whether the real-time 9 km stream Open-Meteo serves is that open data is « à vérifier »: not blocking for non-commercial collection, an owner decision before any paid offer.
- **GFS gusts**: Open-Meteo labels them « Preceding hour max » while the NOAA inventory lists an instantaneous field, so `gustWindowOf(gfs)` is `null` and GFS gust scores are « non publiable » until verified.
- **Errors**: the query helpers throw `RangeError` only for programmer errors (negative lead, invalid date).

The catalogue is frozen and does no I/O.
