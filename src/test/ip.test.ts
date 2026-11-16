import { describe, expect, it } from "vitest";

import { normalizeIp } from "@/lib/ip";

describe("normalizeIp", () => {
  it("takes the first forwarded address and strips ports", () => {
    expect(normalizeIp("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(normalizeIp("203.0.113.7:51234")).toBe("203.0.113.7");
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups IPv6 devices on the same /64 network together", () => {
    expect(normalizeIp("2001:db8:abcd:12:1111::1")).toBe("2001:db8:abcd:12::/64");
    expect(normalizeIp("[2001:DB8:abcd:12:ffff::9]:443")).toBe("2001:db8:abcd:12::/64");
  });

  it("rejects junk", () => {
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp("unknown")).toBeNull();
    expect(normalizeIp("999.1.1.1")).toBeNull();
  });
});
