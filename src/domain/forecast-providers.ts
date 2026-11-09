import type { DistributorAttribution, Provider, ProviderId } from "./forecast-model.ts";

/**
 * Open-Meteo, the distributor every model is fetched from (ADR 0003). Its attribution is shown
 * wherever its data is served, in addition to the provider credit.
 * https://open-meteo.com/en/licence (09/11/2026): « API data are offered under Attribution 4.0
 * International (CC BY 4.0) » and « You must include a link next to any location Open-Meteo data
 * are displayed, for example: <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a> ».
 */
export const openMeteoAttribution: DistributorAttribution = Object.freeze({
  text: "Weather data by Open-Meteo.com",
  url: "https://open-meteo.com/",
  licence: Object.freeze({ name: "CC BY 4.0", url: "https://open-meteo.com/en/licence" }),
});

/**
 * Model providers. Names and licence links are those of https://open-meteo.com/en/licence
 * (« Data Sources », 09/11/2026) unless stated otherwise. A `null` credit is user-visible wording
 * the owner has not set yet (« à vérifier »).
 */
export const providers: { readonly [K in ProviderId]: Provider & { readonly id: K } } =
  Object.freeze({
    meteo_france: Object.freeze({
      id: "meteo_france",
      name: "Météo-France",
      // Owner decision, factory docs/sources.md (09/11/2026): the mention is « Données Météo-France ».
      credit: "Données Météo-France",
      // Factory docs/sources.md (09/11/2026): Météo-France models under « Licence Ouverte / Etalab 2.0 »;
      // text checked on the Etalab document below the same day.
      licence: Object.freeze({
        name: "Licence Ouverte / Etalab 2.0",
        url: "https://static.data.gouv.fr/resources/licence-ouverte-2-0/20260909-072646/etalab-licence-ouverte-v2.0.pdf",
      }),
    }),
    ecmwf: Object.freeze({
      id: "ecmwf",
      name: "European Centre for Medium-Range Weather Forecasts (ECMWF)",
      credit: null, // à vérifier: wording for the owner
      // https://www.ecmwf.int/en/forecasts/datasets/open-data (09/11/2026): « Their use is governed
      // by the Creative Commons CC-BY-4.0 licence and the ECMWF Terms of Use »; Open-Meteo links it
      // as « CC-BY Licence ».
      licence: Object.freeze({
        name: "CC BY 4.0",
        url: "https://www.ecmwf.int/en/forecasts/datasets/open-data",
      }),
    }),
    dwd: Object.freeze({
      id: "dwd",
      name: "Deutscher Wetterdienst (DWD)",
      credit: null, // à vérifier: wording for the owner
      // Open-Meteo links « CC-BY Licence » without a version, and the DWD page does not name it in
      // its static content (09/11/2026): name à vérifier on the URL below.
      licence: Object.freeze({
        name: null,
        url: "https://www.dwd.de/EN/service/copyright/copyright_node.html",
      }),
    }),
    noaa_ncep: Object.freeze({
      id: "noaa_ncep",
      name: "NOAA NCEP",
      credit: null, // à vérifier: wording for the owner
      // Open-Meteo links it as « Licence » without a name (09/11/2026): name à vérifier on the URL below.
      licence: Object.freeze({ name: null, url: "https://www.weather.gov/disclaimer" }),
    }),
  });
