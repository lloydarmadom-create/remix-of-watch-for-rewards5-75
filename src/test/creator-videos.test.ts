import { describe, expect, it } from "vitest";

import { REWATCH_HOURS, SUBMIT_GAP_HOURS, UNLOCK_SECONDS, VIDEO_REWARDS, submitCooldown } from "@/lib/creator-videos";

describe("creator video rules", () => {
  it("pays +0.35 creator / +0.30 viewer for a Short", () => {
    expect(VIDEO_REWARDS.short).toEqual({ creator: 0.35, viewer: 0.3 });
  });
  it("pays +0.45 creator / +0.40 viewer for a Full Video", () => {
    expect(VIDEO_REWARDS.full).toEqual({ creator: 0.45, viewer: 0.4 });
  });
  it("locks repeat views for 24 hours", () => {
    expect(REWATCH_HOURS).toBe(24);
  });
  it("allows 1 submission every 24 hours", () => {
    expect(SUBMIT_GAP_HOURS).toBe(24);
    const now = Date.now();
    expect(submitCooldown(new Date(now - 23 * 3600_000).toISOString(), now).canSubmit).toBe(false);
    expect(submitCooldown(new Date(now - 24 * 3600_000 - 1000).toISOString(), now).canSubmit).toBe(true);
  });
  it("unlocks after a 15-second ad", () => {
    expect(UNLOCK_SECONDS).toBe(15);
  });
});
