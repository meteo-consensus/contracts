import type {
  ForecastModelDefinition,
  ForecastModelId,
  Horizon,
  RunCycle,
} from "./forecast-model.ts";
import { openMeteoAttribution, providers } from "./forecast-providers.ts";

/*
 * Every filled value cites its source and the date it was checked. `null` always means unknown
 * (« à vérifier », with the URL to check), never guessed.
 *
 * Run cycles: the source pages give the update interval (« Every 3 hours », « Every 6 hours »);
 * the UTC hours are anchored on `last_run_initialisation_time` and `update_interval_seconds` read
 * on 09/11/2026 from the Open-Meteo metadata API (https://api.open-meteo.com/data/<model>/static/meta.json),
 * documented at https://open-meteo.com/en/docs/model-updates.
 *
 * Gust window: the 1 h windows below come from the generic hourly table of each Open-Meteo page
 * (« wind_gusts_10m Preceding hour max »), which applies to every model of the page.
 */

export type ForecastModelCatalogue = {
  readonly [K in ForecastModelId]: ForecastModelDefinition<K>;
};

/**
 * Last lead, in hours, of a run described by the Open-Meteo metadata API. `data_end_time` is the
 * first hour after the last step: for the 09 UTC AROME run of 09/11/2026 it gives 52 h after
 * initialisation while Météo-France publishes leads up to 51 h (see `aromeHorizon`). Internal to
 * the catalogue (not exported by the package); a `RangeError` is a programmer error.
 */
export function lastLeadFromDataEnd(initUnixSeconds: number, dataEndUnixSeconds: number): number {
  const whole = (seconds: number) => Number.isInteger(seconds / 3600);
  if (
    !whole(initUnixSeconds) ||
    !whole(dataEndUnixSeconds) ||
    dataEndUnixSeconds <= initUnixSeconds
  ) {
    throw new RangeError("Metadata times must be whole hours with the end after the start");
  }
  return (dataEndUnixSeconds - initUnixSeconds) / 3600 - 1;
}

function cyclesEvery(
  intervalHours: number,
  horizonOf: (utcHour: number) => Horizon | null,
): readonly RunCycle[] {
  return Array.from({ length: 24 / intervalHours }, (_, index) => {
    const utcHour = index * intervalHours;
    return { utcHour, horizon: horizonOf(utcHour) };
  });
}

const unknownHorizon = (): null => null;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

/*
 * AROME horizon, +51 h, observed on 09/11/2026 for:
 * - the 09 UTC run of both AROME models: meta.json `meteofrance_arome_france0025` and
 *   `meteofrance_arome_france_hd`, `last_run_initialisation_time` 1794214800 and `data_end_time`
 *   1794402000 (`lastLeadFromDataEnd` = 51);
 * - the 09 UTC run of AROME France on https://www.data.gouv.fr/datasets/paquets-arome-resolution-0-025deg:
 *   « 00h-06h, [...], 43h-48h et 49h-51h », last file `arome__0025__HP1__49H51H__2026-11-09T09:00:00Z`;
 * - the 06 UTC run of AROME HD on https://www.data.gouv.fr/datasets/paquets-arome-resolution-0-01deg:
 *   last file `arome__001__HP1__51H__2026-11-09T06:00:00Z`.
 * Other cycles are not sampled: they are extrapolated to the same +51 h (`basis: "extrapolated"`).
 */
const aromeHorizon =
  (observedUtcHours: readonly number[]) =>
  (utcHour: number): Horizon => ({
    hours: lastLeadFromDataEnd(1794214800, 1794402000),
    basis: observedUtcHours.includes(utcHour) ? "observed" : "extrapolated",
  });

export const forecastModelCatalogue: ForecastModelCatalogue = deepFreeze({
  arome_france: {
    id: "arome_france",
    label: "AROME France",
    provider: providers.meteo_france,
    providerFamily: "meteo_france_arome",
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « AROME France France 0.025° (~2.5 km) Hourly 2 days Every 3 hours »
    grid: { kind: "lat_lon", label: "0.025° (~2.5 km)", degrees: 0.025, approxKm: 2.5 },
    gridChanges: [],
    // meta.json `meteofrance_arome_france0025` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    cycles: cyclesEvery(3, aromeHorizon([9])),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): temporal resolution « Hourly »;
    // data.gouv « Paquets Arome - Résolution 0,025° » (09/11/2026): « Pas de temps : 1h »
    nativeSteps: [{ untilLeadHours: "open", stepHours: 1 }],
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026), hourly table: « wind_gusts_10m Preceding hour max »
    gustWindowHours: 1,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026), « Native Model Variables » of
    // AROME and ARPEGE: 2 m temperature and relative humidity, 10 m U and V wind, 10 m gusts, mean
    // sea-level pressure, total precipitation, total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  arome_france_hd: {
    id: "arome_france_hd",
    label: "AROME France HD",
    provider: providers.meteo_france,
    providerFamily: "meteo_france_arome",
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « AROME France HD (*) France 0.01° (~1.5 km) Hourly 2 days Every 3 hours »
    grid: { kind: "lat_lon", label: "0.01° (~1.5 km)", degrees: 0.01, approxKm: 1.5 },
    gridChanges: [],
    // meta.json `meteofrance_arome_france_hd` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    cycles: cyclesEvery(3, aromeHorizon([6, 9])),
    horizonCollectedHours: 72,
    // meta.json `meteofrance_arome_france_hd` (09/11/2026): temporal_resolution_seconds 3600
    nativeSteps: [{ untilLeadHours: "open", stepHours: 1 }],
    // à vérifier: https://open-meteo.com/en/docs/meteofrance-api (09/11/2026) says « The AROME France
    // HD model [...] carry only a reduced set of native fields » without listing them, so neither
    // the gusts nor their window are confirmed for this model
    gustWindowHours: null,
    unavailableVariables: null,
    distributorAttribution: openMeteoAttribution,
  },
  arpege_europe: {
    id: "arpege_europe",
    label: "ARPEGE Europe",
    provider: providers.meteo_france,
    providerFamily: "meteo_france_arpege",
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « ARPEGE Europe Europe 0.1° (~11 km) Hourly 4 days Every 6 hours »
    grid: { kind: "lat_lon", label: "0.1° (~11 km)", degrees: 0.1, approxKm: 11 },
    gridChanges: [],
    // meta.json `meteofrance_arpege_europe` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/meteofrance-api
    cycles: cyclesEvery(6, unknownHorizon),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): the table says « Hourly » for
    // ARPEGE Europe, but the text says « For ARPEGE, values are interpolated from 3 or 6-hourly to
    // 1-hourly values after 72 or 96 hours respectively » without naming ARPEGE World or Europe.
    // Both agree on hourly up to 72 h; the step after 72 h is à vérifier
    nativeSteps: [
      { untilLeadHours: 72, stepHours: 1 },
      { untilLeadHours: "open", stepHours: null },
    ],
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026), hourly table: « wind_gusts_10m Preceding hour max »
    gustWindowHours: 1,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): same native fields as AROME France
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  ecmwf_ifs: {
    id: "ecmwf_ifs",
    label: "ECMWF IFS HRES",
    provider: providers.ecmwf,
    providerFamily: "ecmwf_ifs",
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): « IFS HRES 🌍 Global 9 km (O1280 grid) [...] 15 days Every 6 hours »
    grid: { kind: "reduced_gaussian", label: "9 km (O1280 grid)", approxKm: 9 },
    gridChanges: [],
    // meta.json `ecmwf_ifs` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/ecmwf-api
    cycles: cyclesEvery(6, unknownHorizon),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): « The first 90 forecast hours use
    // 1-hourly data, switching to 3-hourly after 90 hours and 6 hourly after 144 hours »
    nativeSteps: [
      { untilLeadHours: 90, stepHours: 1 },
      { untilLeadHours: 144, stepHours: 3 },
      { untilLeadHours: "open", stepHours: 6 },
    ],
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): « wind_gusts_10m Preceding 3-hour max
    // [...] Maximum 3 second wind at 10 m height above ground as a maximum of the preceding 3 hours »
    gustWindowHours: 3,
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026), « Native Model Variables » of IFS:
    // 2 m temperature and dew point (used for « Relative humidity and dew point »), 10 m U and V
    // wind, 10 m gusts, mean sea-level pressure, total precipitation, total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  icon_eu: {
    id: "icon_eu",
    label: "ICON-EU",
    provider: providers.dwd,
    providerFamily: "dwd_icon",
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « ICON Europe Europe 0.0625° (~7 km) Hourly , 3-hourly after 78 hours 5 days Every 3 hours »
    grid: { kind: "lat_lon", label: "0.0625° (~7 km)", degrees: 0.0625, approxKm: 7 },
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « After 30 November 2026, dwd_icon_global,
    // dwd_icon_eu and dwd_icon_d2 will use native grids »; the selector marks « DWD ICON EU
    // (Discontinued 2026-11-30) ». « After 30 November » reads either as the first run of 30/11
    // 00 UTC (the « Discontinued 2026-11-30 » date) or of 01/12 00 UTC: first run on the native
    // grid à vérifier, taken as 30/11/2026 00 UTC. Native grid à vérifier (collector#2 fixture).
    gridChanges: [
      { id: "icon_eu_native_2026", firstRunInitUtc: "2026-11-30T00:00:00Z", grid: null },
    ],
    // meta.json `dwd_icon_eu` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/dwd-api
    cycles: cyclesEvery(3, unknownHorizon),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « Hourly , 3-hourly after 78 hours »
    nativeSteps: [
      { untilLeadHours: 78, stepHours: 1 },
      { untilLeadHours: "open", stepHours: 3 },
    ],
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026), hourly table: « wind_gusts_10m Preceding hour max »
    gustWindowHours: 1,
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026), « Native Model Variables » of ICON: 2 m
    // temperature and relative humidity, 10 m U and V wind, 10 m gusts, mean sea-level pressure,
    // total precipitation, total cloud cover; only visibility (not catalogued) goes after the switch
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  gfs: {
    id: "gfs",
    label: "GFS",
    provider: providers.noaa_ncep,
    providerFamily: "noaa_gfs",
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026): « GFS 🌍 Global 0.11° (~13 km) Hourly, 3-hourly after 120 hours 16 days Every 6 hours »
    grid: { kind: "lat_lon", label: "0.11° (~13 km)", degrees: 0.11, approxKm: 13 },
    gridChanges: [],
    // meta.json `ncep_gfs013` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/gfs-api
    cycles: cyclesEvery(6, unknownHorizon),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026): « Hourly, 3-hourly after 120 hours »
    nativeSteps: [
      { untilLeadHours: 120, stepHours: 1 },
      { untilLeadHours: "open", stepHours: 3 },
    ],
    // à vérifier: https://open-meteo.com/en/docs/gfs-api (09/11/2026) shows « Preceding hour max »
    // in its hourly table and « Preceding 15 minutes max » in its 15-minutely section, which belongs
    // to the 15-minutely models of the page (GFS is « Hourly » in its table); the issue
    // (contracts#2) keeps GFS unknown because of the two labels: owner to confirm 1 h
    gustWindowHours: null,
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026), « Native Model Variables » of GFS and
    // HRRR: 2 m temperature and relative humidity, 10 m U and V wind, 10 m gusts, mean sea-level
    // pressure, precipitation, total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
});
