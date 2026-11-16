/**
 * Normalizes a client network address so the same connection always compares equal:
 * first hop of a forwarded list, no port or brackets, lowercase, IPv4-mapped IPv6 unwrapped,
 * and IPv6 cut to its /64 network (one home or phone hotspot).
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  let ip = (raw ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!ip || ip === "unknown") return null;
  // [::1]:443 → ::1
  const bracket = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket?.[1]) ip = bracket[1];
  // 1.2.3.4:5678 → 1.2.3.4
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  ip = ip.replace(/^::ffff:(\d{1,3}(\.\d{1,3}){3})$/, "$1");
  ip = ip.replace(/%.*$/, "");

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip.split(".").every((p) => Number(p) <= 255) ? ip : null;
  }
  if (ip.includes(":") && /^[0-9a-f:]+$/.test(ip)) {
    const [head = "", tail = ""] = ip.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const groups = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
    if (groups.length !== 8) return null;
    return `${groups.slice(0, 4).map((g) => (parseInt(g || "0", 16) || 0).toString(16)).join(":")}::/64`;
  }
  return null;
}
