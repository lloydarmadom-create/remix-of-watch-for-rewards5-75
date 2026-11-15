const STORAGE_KEY = "wfr_ref";

/** Normalizes a referral code from a link; returns null when it isn't a valid code. */
export function parseReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

/** Saves ?ref=CODE from the current URL so it survives until sign-up. */
export function captureReferralFromUrl() {
  try {
    const code = parseReferralCode(new URLSearchParams(window.location.search).get("ref"));
    if (code) localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function getStoredReferral(): string | null {
  try {
    return parseReferralCode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function referralLink(origin: string, code: string) {
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}
