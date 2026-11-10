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
 * Open-Meteo API hosts a run may be fetched from: the only hosts `ForecastRun.sourceApi` may name.
 * - `api.open-meteo.com`: the free API, https://open-meteo.com/en/docs (10/11/2026), whose request
 *   form targets `https://api.open-meteo.com/v1/forecast`.
 * - `customer-api.open-meteo.com`: the commercial API, https://open-meteo.com/en/pricing
 *   (10/11/2026): « The customer endpoint is customer-api.open-meteo.com; requests include
 *   &apikey=abc123 ». The key travels in the query string, which `sourceApi` rejects.
 * A self-hosted endpoint (ADR 0003) is added here once its host is known: a new accepted value,
 * so a minor release.
 */
export const openMeteoApiHosts = Object.freeze([
  "api.open-meteo.com",
  "customer-api.open-meteo.com",
]);

/**
 * Model providers. Names are those of https://open-meteo.com/en/licence (« Data Sources »,
 * 09/11/2026), which also links each provider's licence. Credits are each provider's own
 * required wording, checked on its pages the same day.
 *
 * Every consensus or score is a modified use of the data: where a provider asks for a mention of
 * modifications (ECMWF, DWD, CC BY 4.0), that wording is set where the derived value is served.
 */
export const providers: { readonly [K in ProviderId]: Provider & { readonly id: K } } =
  Object.freeze({
    meteo_france: Object.freeze({
      id: "meteo_france",
      name: "Météo-France",
      // Owner decision, factory docs/sources.md (09/11/2026): the mention is « Données Météo-France »;
      // the Licence Ouverte 2.0 also requires the date of last update, served with the data.
      credit: Object.freeze({
        kind: "required",
        unmodified: Object.freeze({ text: "Données Météo-France", notices: Object.freeze([]) }),
        // à vérifier — formulation du propriétaire (mention for consensus and scores)
        derived: null,
      }),
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
      // https://apps.ecmwf.int/datasets/licences/general/ (« Terms of Use for ECMWF Open Data
      // Products », 09/11/2026): « The following wording shall be attached to the services created
      // with this ECMWF data product: Copyright statement: Copyright "This service is based on data
      // and products of the European Centre for Medium-Range Weather Forecasts (ECMWF)". Source
      // www.ecmwf.int Licence Statement: [...] Disclaimer: [...] », plus « Where applicable, an
      // indication if the material has been modified ».
      credit: Object.freeze({
        kind: "required",
        unmodified: Object.freeze({
          text: "This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF)",
          notices: Object.freeze([
            Object.freeze({
              kind: "source",
              text: "Source www.ecmwf.int",
              url: "https://www.ecmwf.int",
            }),
            Object.freeze({
              kind: "licence",
              text: "This ECMWF data is published under a Creative Commons Attribution 4.0 International (CC BY 4.0).",
              url: "https://creativecommons.org/licenses/by/4.0/",
            }),
            Object.freeze({
              kind: "disclaimer",
              text: "ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use.",
            }),
          ]),
        }),
        // Same page: « Where applicable, an indication if the material has been modified and an
        // indication of previous modifications »; the CC BY 4.0 terms quoted there: « indicate if
        // changes were made ». The wording of that indication is not fixed by ECMWF:
        // à vérifier — formulation du propriétaire.
        derived: null,
      }),
      // https://www.ecmwf.int/en/forecasts/accessing-forecasts/licences-available (09/11/2026):
      // « ECMWF Open Data — programmatic access to IFS and AIFS model data at 25 km resolution, with
      // 9 km native resolution available from 2026. [...] Licence: CC BY 4.0. »
      // https://www.ecmwf.int/en/forecasts/datasets/open-data (09/11/2026): « Their use is governed
      // by the Creative Commons CC-BY-4.0 licence and the ECMWF Terms of Use ».
      // Coverage à vérifier: https://open-meteo.com/en/docs/ecmwf-api calls its 9 km stream
      // « real-time IFS HRES » and says « The open-data distribution has an additional delay of 2
      // hours compared to the real-time IFS dissemination », so whether that stream is the CC BY 4.0
      // open data is not confirmed. Not blocking for the non-commercial collection (ADR 0003);
      // owner-only decision before any paid offer.
      licence: Object.freeze({
        name: "CC BY 4.0",
        url: "https://www.ecmwf.int/en/forecasts/accessing-forecasts/licences-available",
      }),
    }),
    dwd: Object.freeze({
      id: "dwd",
      name: "Deutscher Wetterdienst (DWD)",
      // https://www.dwd.de/DE/service/rechtliche_hinweise/vorlagen_quellenangabe.html (09/11/2026):
      // the source note « ist unmittelbar an der verwendeten DWD-Information zu platzieren und wie
      // folgt zu gestalten: In Textform: Quelle: Deutscher Wetterdienst » (unmodified use).
      credit: Object.freeze({
        kind: "required",
        unmodified: Object.freeze({
          text: "Quelle: Deutscher Wetterdienst",
          notices: Object.freeze([]),
        }),
        // Same page: « Bei weitergehenden Veränderungen, Bearbeitungen, Neugestaltungen oder
        // sonstigen Abwandlungen erwartet der DWD mindestens eine Nennung des DWD in zentralen
        // Quellenverzeichnissen oder im Impressum. Veränderungshinweise können z. B. lauten:
        // "Datenbasis: Deutscher Wetterdienst, Rasterdaten bildlich wiedergegeben", "Datenbasis:
        // Deutscher Wetterdienst, Einzelwerte gemittelt" [...] ». The change note is ours:
        // à vérifier — formulation du propriétaire.
        derived: null,
      }),
      // https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html (09/11/2026):
      // « Alle frei zugänglichen Geodaten und Geodatendienste [...] dürfen unter den Bedingungen der
      // Lizenz Creative Commons BY 4.0 (CC BY 4.0) unter Beigabe eines Quellenvermerks weiterverwendet
      // werden. »
      licence: Object.freeze({
        name: "CC BY 4.0",
        url: "https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html",
      }),
    }),
    noaa_ncep: Object.freeze({
      id: "noaa_ncep",
      name: "NOAA NCEP",
      // https://www.weather.gov/disclaimer (09/11/2026): « The information on National Weather Service
      // (NWS) Web pages are in the public domain, unless specifically noted otherwise, and may be used
      // without charge for any lawful purpose so long as you do not: 1) claim it is your own [...],
      // 2) use it in a manner that implies an endorsement or affiliation with NOAA/NWS, or 3) modify
      // its content and then present it as official government material ». No credit line required.
      credit: Object.freeze({ kind: "not_required" }),
      licence: Object.freeze({ name: "Public domain", url: "https://www.weather.gov/disclaimer" }),
    }),
  });
