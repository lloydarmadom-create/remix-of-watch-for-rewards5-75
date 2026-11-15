import { describe, expect, it } from "vitest";

import { checkGamepass, precheckRedemption, REWARDS, rewardCooldown, STATUS_LABEL, validateLightningDestination } from "@/lib/payouts";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 10, 15, 12);

describe("reward prices and stock", () => {
  it("20 Sats costs 120 coins and takes 20 Sats from stock", () => {
    expect(REWARDS.sats_20).toMatchObject({ coins: 120, stockCost: 20, payout: 20 });
  });
  it("5 Robux costs 500 coins, needs a 7 Robux Gamepass and takes 7 Robux from stock", () => {
    expect(REWARDS.robux_5).toMatchObject({ coins: 500, gamepassPrice: 7, stockCost: 7, payout: 5 });
  });
  it("10 Robux costs 1,000 coins, needs a 15 Robux Gamepass and takes 15 Robux from stock", () => {
    expect(REWARDS.robux_10).toMatchObject({ coins: 1000, gamepassPrice: 15, stockCost: 15, payout: 10 });
  });
});

describe("cooldowns", () => {
  const sats = [{ category: "sats", status: "pending", created_at: new Date(now - 23 * HOUR).toISOString() }];
  const robux = [{ category: "robux", status: "paid", created_at: new Date(now - 6 * 24 * HOUR).toISOString() }];

  it("Sats cooldown is 24 hours", () => {
    expect(rewardCooldown("sats", sats, now, false).ready).toBe(false);
    expect(rewardCooldown("sats", sats, now + 2 * HOUR, false).ready).toBe(true);
  });
  it("Robux cooldown is 7 days", () => {
    expect(rewardCooldown("robux", robux, now, false).ready).toBe(false);
    expect(rewardCooldown("robux", robux, now + 25 * HOUR, false).ready).toBe(true);
  });
  it("Sats and Robux cooldowns are separate", () => {
    expect(rewardCooldown("robux", sats, now, false).ready).toBe(true);
  });
  it("testing mode skips both cooldowns", () => {
    expect(rewardCooldown("sats", sats, now, true).ready).toBe(true);
    expect(rewardCooldown("robux", robux, now, true).ready).toBe(true);
  });
  it("rejected (refunded) payouts don't start a cooldown", () => {
    const rejected = [{ ...sats[0]!, status: "rejected" }];
    expect(rewardCooldown("sats", rejected, now, false).ready).toBe(true);
  });
});

describe("redeem checks", () => {
  const base = { reward: REWARDS.robux_5, coinBalance: 500, isBanned: false, maintenance: false, testingMode: false, stock: 7, payouts: [], now, robloxUserId: 1 };
  it("allows a redemption with exactly enough coins and stock", () => {
    expect(precheckRedemption(base)).toBeNull();
  });
  it("blocks when coins or stock run short", () => {
    expect(precheckRedemption({ ...base, coinBalance: 499 })).toMatch(/Not enough coins/);
    expect(precheckRedemption({ ...base, stock: 6 })).toMatch(/out of stock/);
  });
  it("only accepts a Gamepass at the exact price, owned by the verified player and on sale", () => {
    const pass = { id: 9, name: "Pass", creatorId: 42, creatorType: "User", price: 7, isForSale: true };
    expect(checkGamepass(pass, 42, 7)).toBeNull();
    expect(checkGamepass({ ...pass, price: 8 }, 42, 7)).toMatch(/exactly 7 Robux/);
    expect(checkGamepass(pass, 43, 7)).toMatch(/isn't owned/);
    expect(checkGamepass({ ...pass, isForSale: false }, 42, 7)).toMatch(/isn't on sale/);
  });
  it("rejects email addresses as Lightning destinations", () => {
    expect(validateLightningDestination("player@gmail.com").ok).toBe(false);
  });
});

it("withdrawal badges read Pending, Paid and Rejected — Refunded", () => {
  expect(STATUS_LABEL).toEqual({ pending: "Pending", paid: "Paid", rejected: "Rejected — Refunded" });
});
