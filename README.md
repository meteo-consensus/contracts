# contracts

Contrat public : OpenAPI, schémas Zod et types partagés (modèles, variables, unités, consensus). Paquet @meteo-consensus/contracts.

Part of [meteo-consensus](https://github.com/meteo-consensus): the weather API that crosses forecast models and learns which one is reliable where.

## Installation

`zod` is a peer dependency: the package does not bring its own copy. Install it yourself, in a version within the peer range declared in `package.json` (`peerDependencies.zod`), next to `@meteo-consensus/contracts`:

```sh
pnpm add @meteo-consensus/contracts zod
```

A single `zod` copy in the consumer keeps the schemas from this package and the consumer's own schemas compatible (`instanceof` checks, schema types). With two copies, a schema built by one is not recognised by the other.

## Development

Requirements: Node.js (version in `.node-version`) and pnpm (version in `package.json`, `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm run check
```

### Build and published files

The package is published compiled (factory ADR 0001, amendment of 09/11/2026), with the same layout as `@meteo-consensus/db`: Node.js refuses to strip types under `node_modules`, so `exports` (`types` then `default`) points at `dist/`, never at `src/`. The package has one entry, the root `@meteo-consensus/contracts` (`dist/index.js`, `dist/index.d.ts`).

- `pnpm run build` empties `dist/` and runs `tsc --project tsconfig.build.json`: `tsconfig.json` with emit on, `declaration`, `rootDir: src`, `outDir: dist`, tests excluded. Relative `.ts` imports become `.js` (`rewriteRelativeImportExtensions`). `dist/` is ignored by Git.
- `prepack` runs the build, so `pnpm pack` and `pnpm publish` (release workflow) always ship a fresh `dist/`.
- `files: ["dist"]`: the tarball holds `package.json`, `README.md` and `dist/` only. No source, test or type test is shipped. pnpm does not pack `CHANGELOG.md` with this `files` list (checked with pnpm 12.17.0); if a pnpm upgrade starts packing it, the tarball test fails before publishing.
- `test/packed-package.test.ts` packs the package with `pnpm pack`, unpacks it into a bare project, imports the root entry with Node's type stripping off (`--no-strip-types`) and compares its exports with `src/index.ts`, and type-checks a consumer against the shipped declarations (`skipLibCheck: false`). It calls the pnpm that runs it (`npm_execpath`), so run the suite through `pnpm run check` or `pnpm test`, not `npx vitest`: without pnpm it stops with an explicit error.

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

## Runs, stations and observations

Zod schemas of the raw data that `collector` writes and `db` stores, each with its type inferred by `z.infer`. Every object is strict (an unknown field is rejected), every time is a `UtcInstant` (`UtcInstantSchema`: UTC to the second with a `Z`, no offset, no local time), and every value is in its variable's canonical unit, within the catalogue bounds, `null` when missing (never 0). `periodEnd` is the instant the value refers to; when the length is non-zero, the period is `]periodStart, periodEnd]`. Field names are camelCase like the catalogues; `db` maps them to its snake_case columns.

- **`ForecastRunSchema`**: `model`, `initTime`, `modificationTime` and `availabilityTime` (Open-Meteo `last_run_modification_time` and `last_run_availability_time`, https://open-meteo.com/en/docs/model-updates, read 09/11/2026), `fetchedAt` (none of the three before `initTime`; the order between modification and availability is « à vérifier » and not enforced) and `sourceApi`, the endpoint that served the run as a bare `https` URL (a query string could carry an API key, so it is rejected) whose host is one of `openMeteoApiHosts` (`api.open-meteo.com`, `customer-api.open-meteo.com`, no port). A new endpoint, such as a self-hosted one (ADR 0003), is added to `openMeteoApiHosts` in a minor release.
- **`ForecastPointSchema`**: a run (`model`, `initTime`) sampled for a station (`numPoste`): requested and grid coordinates, grid elevation returned by the upstream, the `elevation=` sent (`elevationParamM`), `cellSelection` (`land`, `sea` or `nearest`, Open-Meteo `cell_selection`) and the station elevation at request time. The owner decided that the elevation sent is the station elevation; both are kept so a change of rule stays visible.
- **`ForecastValueSchema`**: `validTime`, `leadTimeH` (whole hours, equal to `validTime` − `initTime`, from 0 to `MAX_LEAD_TIME_H` = 72), `value`, `interpolated`. Wind is in m/s: Open-Meteo defaults to km/h, so the collector requests `wind_speed_unit=ms` or converts. `precipitation` and `wind_gusts_10m` (`periodForecastVariables`) also carry `periodEnd` = `validTime` and `periodStart` = `validTime` minus the window from the catalogues: 1 h for precipitation (never `null`), `gustWindowOf(model)` for gusts (3 h for ECMWF IFS). A gust may have `periodStart: null` for any model: the window is not stored, and scoring never pairs that row. A non-null gust start requires a known window (not GFS or AROME France HD today) and matches it. Allowing `null` for every model keeps stored rows parseable when a catalogue window later becomes known. The other variables carry no period.
  - **Consumer rule** (décision du propriétaire du 09/11/2026): a value whose period starts before `initTime` is rejected (precipitation at lead 0, an ECMWF IFS gust in the first 3 h). The collector drops those values before validating the batch, so they never fail it.
- **`StationSchema`**: one version of a station: `numPoste` (`NumPosteSchema`, exactly 8 digits, a string), `name` (1 to 100 characters, no control character, no leading or trailing whitespace; validated as is, never trimmed), coordinates, elevation, `network` (`meteo_france`), `validFrom` and `validTo` (`null` for the current version, otherwise after `validFrom`).
- **`ObservationSchema`**: station, period, variable, value, `quality` (BDClim Q: `0`, `1`, `2`, `9`, or `null` for an empty Q, whether the value is filled or not). The period lasts exactly `observationPeriodMinutes[variable]`: 0 (an instant, `periodStart` = `periodEnd`) for temperature, humidity, pressure and cloud cover; 10 min, [HH h − 10 min ; HH h], for wind speed and direction; 1 h for precipitation and gusts. Per variable:
  - `wind_gusts_10m` requires `gustSource` (`FXI3S` or `FXI`); `FXI3S` also requires `fxi3sComputed` (`STATUS_FXI3S` = 1: computed by a transfer function), `null` exactly when the value is missing. Both sources are stored; `scoring` picks one.
  - `wind_speed_10m`, `wind_direction_10m` and `precipitation` require `periodUnverified`: the 10-minute window of BDClim `FF` and `DD` is verified only for some stations (BDC-7), and the hour covered by `RR1` is assumed, not verified (BDC-6, décision du propriétaire du 09/11/2026). When the flag is `true`, `periodStart` still carries the assumed window; only the flag marks the doubt, and scores read it observation by observation.
  - `cloud_cover` requires `skyObscured`: BDClim `N=9` is stored as `value: null` with `skyObscured: true`, never as 100 %; an obscured sky with a value is rejected. The octas to % conversion and the meaning of `N=9` are « à vérifier » in the factory source sheet.
  - These fields are rejected on any other variable.
- **`ObservationRevisionSchema`**: append-only change of a stored observation, identified by its logical key (`numPoste`, `periodEnd`, `variable`, `gustSource`, `null` outside gusts): old and new value, old and new quality code (each nullable), old and new `fxi3sComputed` for an `FXI3S` gust, old and new `skyObscured` for cloud cover (so an empty `N` that becomes `N=9`, `null` on both sides, is still a revision), and `revisedAt` (not before `periodEnd`). Each side follows the observation rules. A revision that changes nothing is rejected. `periodUnverified` is not revised.
- **Lead time bands**: `leadTimeBandOf(leadTimeH)` returns `{ ok: true, band }` for the fixed bands `0-6` (closed: `[0, 6]`), `6-12`, `12-24`, `24-36`, `36-48` and `48-72` (each `]low, high]`), or `{ ok: false, error: { code: "lead_time_out_of_range" } }` for a negative, non-finite or over-72 h lead.

## Observation source files

`SourceFileSchema` describes one downloaded observation source file and its last update date: the Licence Ouverte 2.0 requires the source and « la date de dernière mise à jour de l'Information réutilisée » wherever the data is reused. `collector` writes it, `db` stores it and `api` reads it for the attribution. The object is strict and its type is inferred by `z.infer` (`SourceFile`).

- **`source`**: `ObservationSourceSchema`, `bdclim_hourly` only. Adding a source is a minor release.
- **`fileKey`**: `SourceFileKeySchema`, the metropolitan department on 2 digits, `01` to `95`, the `<dep>` of `H_<dep>_latest-<AAAA-1>-<AAAA>.csv.gz`. Corsica is the single file `20` (`2A` and `2B` are rejected); overseas keys (3 digits) and `99` are out of scope.
- **`url`**: the downloaded file, a bare `https` URL (no credentials, query or fragment), at most 2048 characters. Its file name must carry `fileKey`: for `bdclim_hourly`, the last path segment starts with `H_<fileKey>_` (key `33` with the URL of `H_13_…` is rejected).
- **`lastModified`**: the `Last-Modified` header of the downloaded file, converted to a `UtcInstant`. The data.gouv `last_modified` metadata can lag it by up to 3 days, so it is not used. It comes from the upstream clock and is not compared with `fetchedAt`.
- **`etag`**: the `ETag` header as received, at most 1024 characters, restricted to the RFC 9110 entity-tag grammar: an optional `W/`, then a quoted string of `%x21 / %x23-7E` (no space, control character, embedded `"` or `obs-text`). `null` when the response has none; `collector` also maps a non-conforming header to `null` (and fetches with a plain GET) rather than rejecting the file.
- **`fetchedAt`**: when the file was downloaded; **`ingestedAt`**: when its rows were stored, `null` until then, never before `fetchedAt`.

Example, from the S3 response headers of `H_33_latest-2025-2026.csv.gz`, 09/11/2026 16:05:36 UTC (`Last-Modified`, `ETag`, and `Date` as `fetchedAt`); `ingestedAt` is our own clock, derived from `fetchedAt` for the example:

```json
{
  "source": "bdclim_hourly",
  "fileKey": "33",
  "url": "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz",
  "lastModified": "2026-11-09T06:44:51Z",
  "etag": "\"a88e9de5467e4fd71bfe705af5500b0e-2\"",
  "fetchedAt": "2026-11-09T16:05:36Z",
  "ingestedAt": "2026-11-09T16:07:36Z"
}
```

## Licence

MIT, see [`LICENSE`](LICENSE). The licence covers this package's code; the data described by its catalogues keeps its own licences and attributions (see the `provider` notices above).
