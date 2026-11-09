import type {
  ForecastModelDefinition,
  ForecastModelId,
  Horizon,
  RunCycle,
} from "./forecast-model.ts";
import { openMeteoAttribution, providers } from "./forecast-providers.ts";

/*
 * Every filled value cites its source and the date it was checked. Unknown values are `null`
 * with « à vérifier » and the URL to check, never guessed.
 *
 * Run cycles: the source pages give the update interval (« Every 3 hours », « Every 6 hours »);
 * the UTC hours are anchored on `last_run_initialisation_time` and `update_interval_seconds` read
 * on 09/11/2026 from the Open-Meteo metadata API (https://api.open-meteo.com/data/<model>/static/meta.json),
 * documented at https://open-meteo.com/en/docs/model-updates.
 */

export type ForecastModelCatalogue = {
  readonly [K in ForecastModelId]: ForecastModelDefinition<K>;
};

function cyclesEvery(intervalHours: number, horizon: Horizon | null): readonly RunCycle[] {
  return Array.from({ length: 24 / intervalHours }, (_, index) => ({
    utcHour: index * intervalHours,
    horizon,
  }));
}

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
 * AROME runs: the AROME France and AROME France HD meta.json (ids `meteofrance_arome_france0025`
 * and `meteofrance_arome_france_hd`, 09/11/2026) both show the 09 UTC run ending 52 h after its
 * initialisation (`data_end_time` − `last_run_initialisation_time`); the issue (contracts#2)
 * records « environ +52 h ». The horizon of each other AROME cycle is taken as the same and
 * marked approximate.
 */
const aromeHorizon: Horizon = { hours: 52, approximate: true };

export const forecastModelCatalogue: ForecastModelCatalogue = deepFreeze({
  arome_france: {
    id: "arome_france",
    label: "AROME France",
    provider: providers.meteo_france,
    providerFamily: "meteo_france_arome",
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « AROME France France 0.025° (~2.5 km) Hourly 2 days Every 3 hours »
    grid: { label: "0.025° (~2.5 km)", degrees: 0.025, approxKm: 2.5 },
    gridChanges: [],
    // meta.json `meteofrance_arome_france0025` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    cycles: cyclesEvery(3, aromeHorizon),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): temporal resolution « Hourly »
    nativeSteps: [{ untilLeadHours: null, stepHours: 1 }],
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « wind_gusts_10m Preceding hour max »
    gustWindowHours: 1,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): native fields of AROME and ARPEGE
    // include 2 m temperature and humidity, 10 m wind and gusts, mean sea-level pressure, total
    // precipitation and total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  arome_france_hd: {
    id: "arome_france_hd",
    label: "AROME France HD",
    provider: providers.meteo_france,
    providerFamily: "meteo_france_arome",
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « AROME France HD (*) France 0.01° (~1.5 km) Hourly 2 days Every 3 hours »
    grid: { label: "0.01° (~1.5 km)", degrees: 0.01, approxKm: 1.5 },
    gridChanges: [],
    // meta.json `meteofrance_arome_france_hd` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    cycles: cyclesEvery(3, aromeHorizon),
    horizonCollectedHours: 72,
    // meta.json `meteofrance_arome_france_hd` (09/11/2026): temporal_resolution_seconds 3600
    nativeSteps: [{ untilLeadHours: null, stepHours: 1 }],
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
    grid: { label: "0.1° (~11 km)", degrees: 0.1, approxKm: 11 },
    gridChanges: [],
    // meta.json `meteofrance_arpege_europe` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/meteofrance-api
    cycles: cyclesEvery(6, null),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): the table says « Hourly » but the
    // text says « For ARPEGE, values are interpolated from 3 or 6-hourly to 1-hourly values after
    // 72 or 96 hours respectively »: hourly up to 72 h, step after 72 h à vérifier
    nativeSteps: [
      { untilLeadHours: 72, stepHours: 1 },
      { untilLeadHours: null, stepHours: null },
    ],
    // https://open-meteo.com/en/docs/meteofrance-api (09/11/2026): « wind_gusts_10m Preceding hour max »
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
    grid: { label: "9 km (O1280 grid)", degrees: null, approxKm: 9 },
    gridChanges: [],
    // meta.json `ecmwf_ifs` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/ecmwf-api
    cycles: cyclesEvery(6, null),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): « The first 90 forecast hours use
    // 1-hourly data, switching to 3-hourly after 90 hours and 6 hourly after 144 hours »
    nativeSteps: [
      { untilLeadHours: 90, stepHours: 1 },
      { untilLeadHours: 144, stepHours: 3 },
      { untilLeadHours: null, stepHours: 6 },
    ],
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): « wind_gusts_10m Preceding 3-hour max
    // [...] Maximum 3 second wind at 10 m height above ground as a maximum of the preceding 3 hours »
    gustWindowHours: 3,
    // https://open-meteo.com/en/docs/ecmwf-api (09/11/2026): native fields include 2 m temperature
    // and dew point (« Relative humidity and dew point »), 10 m wind and gusts, mean sea-level
    // pressure, total precipitation and total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  icon_eu: {
    id: "icon_eu",
    label: "ICON-EU",
    provider: providers.dwd,
    providerFamily: "dwd_icon",
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « ICON Europe Europe 0.0625° (~7 km) Hourly , 3-hourly after 78 hours 5 days Every 3 hours »
    grid: { label: "0.0625° (~7 km)", degrees: 0.0625, approxKm: 7 },
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « After 30 November 2026, dwd_icon_global,
    // dwd_icon_eu and dwd_icon_d2 will use native grids »; the selector marks « DWD ICON EU
    // (Discontinued 2026-11-30) ». Native grid à vérifier (collector#2 fixture); exact switch
    // instant à vérifier, taken as 30/11/2026 00:00 UTC.
    gridChanges: [{ effectiveFromUtc: "2026-11-30T00:00:00Z", grid: null }],
    // meta.json `dwd_icon_eu` (09/11/2026): last run 09 UTC, update_interval_seconds 10800
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/dwd-api
    cycles: cyclesEvery(3, null),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « Hourly , 3-hourly after 78 hours »
    nativeSteps: [
      { untilLeadHours: 78, stepHours: 1 },
      { untilLeadHours: null, stepHours: 3 },
    ],
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): « wind_gusts_10m Preceding hour max »
    gustWindowHours: 1,
    // https://open-meteo.com/en/docs/dwd-api (09/11/2026): native fields include 2 m temperature and
    // humidity, 10 m wind and gusts, mean sea-level pressure, total precipitation and total cloud
    // cover; only visibility (not catalogued) is dropped after the switch
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
  gfs: {
    id: "gfs",
    label: "GFS",
    provider: providers.noaa_ncep,
    providerFamily: "noaa_gfs",
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026): « GFS 🌍 Global 0.11° (~13 km) Hourly, 3-hourly after 120 hours 16 days Every 6 hours »
    grid: { label: "0.11° (~13 km)", degrees: 0.11, approxKm: 13 },
    gridChanges: [],
    // meta.json `ncep_gfs013` (09/11/2026): last run 06 UTC, update_interval_seconds 21600
    // horizon per cycle à vérifier: https://open-meteo.com/en/docs/gfs-api
    cycles: cyclesEvery(6, null),
    horizonCollectedHours: 72,
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026): « Hourly, 3-hourly after 120 hours »
    nativeSteps: [
      { untilLeadHours: 120, stepHours: 1 },
      { untilLeadHours: null, stepHours: 3 },
    ],
    // à vérifier: https://open-meteo.com/en/docs/gfs-api (09/11/2026) gives two labels,
    // « Preceding hour max » and « Preceding 15 minutes max », without tying either to GFS
    gustWindowHours: null,
    // https://open-meteo.com/en/docs/gfs-api (09/11/2026): native fields of GFS include 2 m
    // temperature and humidity, 10 m wind and gusts, mean sea-level pressure, precipitation and
    // total cloud cover
    unavailableVariables: [],
    distributorAttribution: openMeteoAttribution,
  },
});
