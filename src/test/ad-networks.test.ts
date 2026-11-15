import { describe, expect, it } from "vitest";

import { ADS_PER_NETWORK, pickAdNetwork, networkReady, type AdNetworkSettings } from "@/lib/ad-networks";
import { AD_LIMIT } from "@/lib/earning";

const off: AdNetworkSettings = {
  aads_enabled: false,
  aads_unit_id: "",
  adsterra_enabled: false,
  adsterra_code: "",
  monetag_enabled: false,
  monetag_code: "",
  bitmedia_enabled: false,
  bitmedia_code: "",
  coinzilla_enabled: false,
  coinzilla_code: "",
  custom_ad_enabled: false,
  custom_ad_name: "AdMaven",
  custom_ad_code: "",
};
const all: AdNetworkSettings = {
  ...off,
  aads_enabled: true,
  aads_unit_id: "2412345",
  adsterra_enabled: true,
  adsterra_code: "<script>a</script>",
  monetag_enabled: true,
  monetag_code: "<script>m</script>",
  bitmedia_enabled: true,
  bitmedia_code: "<ins>b</ins>",
  coinzilla_enabled: true,
  coinzilla_code: "<div>c</div>",
  custom_ad_enabled: true,
  custom_ad_code: "<script>x</script>",
};

describe("6-network ad rotation", () => {
  it("serves 10 ads per network per cycle, 6 x 10 = 60", () => {
    expect(ADS_PER_NETWORK).toBe(10);
    expect(ADS_PER_NETWORK * 6).toBe(AD_LIMIT);
  });

  it("moves to the next network once one has served 10 ads", () => {
    expect(pickAdNetwork(all, {})).toBe("aads");
    expect(pickAdNetwork(all, { aads: 10 })).toBe("adsterra");
    expect(pickAdNetwork(all, { aads: 10, adsterra: 10, monetag: 10, bitmedia: 10, coinzilla: 10 })).toBe("custom");
  });

  it("skips networks that are switched off or have no code", () => {
    const s = { ...all, adsterra_enabled: false, monetag_code: "   " };
    expect(networkReady("adsterra", s)).toBe(false);
    expect(networkReady("monetag", s)).toBe(false);
    expect(pickAdNetwork(s, { aads: 10 })).toBe("bitmedia");
  });

  it("falls back to A-ADS when every other slot is empty or used up", () => {
    expect(pickAdNetwork({ ...off, aads_enabled: true, aads_unit_id: "1" }, { aads: 10 })).toBe("aads");
    expect(pickAdNetwork(off, {})).toBe("aads");
  });
});
