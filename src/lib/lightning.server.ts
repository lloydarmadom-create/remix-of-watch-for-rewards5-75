// Sends Lightning payouts through the admin's chosen provider. Server only: the API key
// (LIGHTNING_API_KEY) is read inside these functions and never leaves the server.

export type PayProvider = "zbd" | "blink" | "speed" | "alby";
export type PayResult = { ok: true; ref: string } | { ok: false; error: string };

const TIMEOUT = 20_000;
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** Turns a Lightning Address into a payable invoice for exactly `sats` (LNURL-pay). */
export async function invoiceForAddress(address: string, sats: number): Promise<string> {
  const [user, domain] = address.split("@");
  if (!user || !domain) throw new Error("Not a Lightning Address");
  const meta = await call(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`, {
    headers: { accept: "application/json" },
  });
  const m = rec(meta.body);
  const callback = typeof m["callback"] === "string" ? m["callback"] : null;
  if (meta.status >= 400 || m["tag"] !== "payRequest" || !callback) throw new Error("Wallet didn't return a pay request");
  const url = new URL(callback);
  url.searchParams.set("amount", String(sats * 1000));
  const inv = await call(url.toString(), { headers: { accept: "application/json" } });
  const pr = rec(inv.body)["pr"];
  if (inv.status >= 400 || typeof pr !== "string" || !pr.toLowerCase().startsWith("ln")) {
    throw new Error("Wallet didn't return an invoice");
  }
  return pr;
}

async function payZbd(key: string, invoice: string, sats: number): Promise<PayResult> {
  const r = await call("https://api.zebedee.io/v0/payments", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key },
    body: JSON.stringify({ invoice, amount: String(sats * 1000), description: "Watch For Rewards payout" }),
  });
  const b = rec(r.body);
  const d = rec(b["data"]);
  if (r.status < 300 && b["success"] !== false && d["status"] !== "failed" && d["status"] !== "error") {
    return { ok: true, ref: `zbd:${String(d["id"] ?? "")}` };
  }
  return { ok: false, error: String(b["message"] ?? `ZBD answered ${r.status}`) };
}

async function payAlby(key: string, invoice: string): Promise<PayResult> {
  const r = await call("https://api.getalby.com/payments/bolt11", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ invoice }),
  });
  const b = rec(r.body);
  if (r.status < 300 && !b["error"]) return { ok: true, ref: `alby:${String(b["payment_hash"] ?? "")}` };
  return { ok: false, error: String(b["message"] ?? b["error"] ?? `Alby answered ${r.status}`) };
}

async function payBlink(key: string, invoice: string): Promise<PayResult> {
  const gql = (query: string, variables?: unknown) =>
    call("https://api.blink.sv/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ query, variables }),
    });
  const me = await gql("query { me { defaultAccount { wallets { id walletCurrency } } } }");
  const wallets = (rec(rec(rec(rec(me.body)["data"])["me"])["defaultAccount"])["wallets"] as unknown[] | undefined) ?? [];
  const btc = wallets.map(rec).find((w) => w["walletCurrency"] === "BTC");
  if (!btc?.["id"]) return { ok: false, error: "Blink didn't return a BTC wallet for this API key" };
  const pay = await gql(
    "mutation Pay($input: LnInvoicePaymentInput!) { lnInvoicePaymentSend(input: $input) { status errors { message } } }",
    { input: { walletId: btc["id"], paymentRequest: invoice } },
  );
  const res = rec(rec(rec(pay.body)["data"])["lnInvoicePaymentSend"]);
  if (res["status"] === "SUCCESS" || res["status"] === "ALREADY_PAID") return { ok: true, ref: "blink:success" };
  const errs = (res["errors"] as unknown[] | undefined)?.map((e) => String(rec(e)["message"])).join("; ");
  return { ok: false, error: errs || `Blink payment status ${String(res["status"] ?? pay.status)}` };
}

async function paySpeed(key: string, invoice: string, sats: number): Promise<PayResult> {
  const r = await call("https://api.tryspeed.com/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${key}:`)}` },
    body: JSON.stringify({
      amount: sats,
      currency: "SATS",
      target_currency: "SATS",
      withdraw_method: "lightning",
      withdraw_request: invoice,
      note: "Watch For Rewards payout",
    }),
  });
  const b = rec(r.body);
  if (r.status < 300 && b["status"] !== "failed") return { ok: true, ref: `speed:${String(b["id"] ?? "")}` };
  const errs = rec((b["errors"] as unknown[] | undefined)?.[0]);
  return { ok: false, error: String(errs["message"] ?? b["message"] ?? `Speed answered ${r.status}`) };
}

/** Pays `sats` to a Lightning Address or a bolt11 invoice. Never throws. */
export async function sendSats(provider: PayProvider, destination: string, kind: "address" | "bolt11", sats: number): Promise<PayResult> {
  const key = process.env["LIGHTNING_API_KEY"];
  if (!key) return { ok: false, error: "LIGHTNING_API_KEY is not set" };
  try {
    const invoice = kind === "bolt11" ? destination : await invoiceForAddress(destination, sats);
    switch (provider) {
      case "zbd":
        return await payZbd(key, invoice, sats);
      case "alby":
        return await payAlby(key, invoice);
      case "blink":
        return await payBlink(key, invoice);
      case "speed":
        return await paySpeed(key, invoice, sats);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment failed" };
  }
}

export const hasLightningKey = () => !!process.env["LIGHTNING_API_KEY"];
