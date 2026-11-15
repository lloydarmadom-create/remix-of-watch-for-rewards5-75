// Ad network rotation shown in the app. The database (pick_ad_network) enforces the same
// rules; keep both in step when a rule changes.

export type AdNetworkId = "aads" | "adsterra" | "monetag" | "bitmedia" | "coinzilla" | "custom";

/** Rotation order. The first ready network with room this cycle serves the next ad. */
export const AD_NETWORKS: AdNetworkId[] = ["aads", "adsterra", "monetag", "bitmedia", "coinzilla", "custom"];
export const ADS_PER_NETWORK = 10;
export const FALLBACK_NETWORK: AdNetworkId = "aads";

export const AD_NETWORK_LABEL: Record<AdNetworkId, string> = {
  aads: "A-ADS",
  adsterra: "Adsterra",
  monetag: "Monetag",
  bitmedia: "Bitmedia",
  coinzilla: "Coinzilla",
  custom: "Custom network",
};

export type AdNetworkSettings = {
  aads_enabled: boolean;
  aads_unit_id: string;
  adsterra_enabled: boolean;
  adsterra_code: string;
  monetag_enabled: boolean;
  monetag_code: string;
  bitmedia_enabled: boolean;
  bitmedia_code: string;
  coinzilla_enabled: boolean;
  coinzilla_code: string;
  custom_ad_enabled: boolean;
  custom_ad_name: string;
  custom_ad_code: string;
};

export const isAdUnitId = (unit: string) => /^\d{1,12}$/.test(unit.trim());

export function networkLabel(id: AdNetworkId, s?: Pick<AdNetworkSettings, "custom_ad_name"> | null) {
  if (id === "custom") return s?.custom_ad_name?.trim() || "AdMaven";
  return AD_NETWORK_LABEL[id];
}

/** The banner code saved for a script-based network ("" for A-ADS, which uses a unit ID). */
export function networkCode(id: AdNetworkId, s: AdNetworkSettings) {
  switch (id) {
    case "adsterra":
      return s.adsterra_code;
    case "monetag":
      return s.monetag_code;
    case "bitmedia":
      return s.bitmedia_code;
    case "coinzilla":
      return s.coinzilla_code;
    case "custom":
      return s.custom_ad_code;
    default:
      return "";
  }
}

/** A network is ready when it's switched on and has its unit ID / banner code filled in. */
export function networkReady(id: AdNetworkId, s: AdNetworkSettings) {
  if (id === "aads") return s.aads_enabled && isAdUnitId(s.aads_unit_id);
  const enabled = {
    adsterra: s.adsterra_enabled,
    monetag: s.monetag_enabled,
    bitmedia: s.bitmedia_enabled,
    coinzilla: s.coinzilla_enabled,
    custom: s.custom_ad_enabled,
  }[id];
  return enabled && networkCode(id, s).trim() !== "";
}

/** Which network serves the next ad, given ads already watched per network this 11-hour cycle. */
export function pickAdNetwork(s: AdNetworkSettings, used: Partial<Record<string, number>>): AdNetworkId {
  for (const id of AD_NETWORKS) {
    if (networkReady(id, s) && (used[id] ?? 0) < ADS_PER_NETWORK) return id;
  }
  return FALLBACK_NETWORK;
}

export const asNetwork = (v: unknown): AdNetworkId =>
  typeof v === "string" && (AD_NETWORKS as string[]).includes(v) ? (v as AdNetworkId) : FALLBACK_NETWORK;

/**
 * Full HTML page for a script-based banner. It runs inside a sandboxed frame with no access
 * to the app (no same-origin), so a network's script can never read the player's session.
 */
export function bannerDocument(code: string, width: number, height: number) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width}"><base target="_blank"><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center}</style></head><body>${code}</body></html>`;
}
