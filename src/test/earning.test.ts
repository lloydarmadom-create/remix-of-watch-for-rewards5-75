import { describe, expect, it } from "vitest";

import {
  adWindowState,
  atCoinCap,
  gamepassPriceFor,
  levelProgress,
  robuxReceived,
  streakReward,
  streakState,
} from "@/lib/earning";
import { dailyQuestions, nextTriviaReset } from "@/lib/trivia";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 10, 15, 12);

describe("levels", () => {
  it("gives +1 level per 15 coins earned", () => {
    expect(levelProgress(14).level).toBe(0);
    expect(levelProgress(15).level).toBe(1);
    expect(levelProgress(44).level).toBe(2);
  });
  it("stops at level 100 (1,500 coins)", () => {
    expect(levelProgress(1500).level).toBe(100);
    expect(levelProgress(9000).level).toBe(100);
  });
  it("pauses ads once the balance reaches 1,500 coins", () => {
    expect(atCoinCap(1499)).toBe(false);
    expect(atCoinCap(1500)).toBe(true);
  });
});

describe("daily check-in", () => {
  it("pays 1 coin on regular days and 5 on day 3 and day 7", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(streakReward)).toEqual([1, 1, 5, 1, 1, 1, 5]);
  });
  it("waits 24 hours between check-ins", () => {
    const last = new Date(now - 23 * HOUR).toISOString();
    expect(streakState(2, last, now).canCheckIn).toBe(false);
    expect(streakState(2, new Date(now - 25 * HOUR).toISOString(), now).canCheckIn).toBe(true);
  });
  it("resets the streak to 0 after more than 48 hours", () => {
    expect(streakState(5, new Date(now - 47 * HOUR).toISOString(), now).current).toBe(5);
    expect(streakState(5, new Date(now - 49 * HOUR).toISOString(), now).current).toBe(0);
  });
});

describe("ad limit", () => {
  it("allows 60 ads per rolling 11 hours", () => {
    expect(adWindowState(59, new Date(now - HOUR).toISOString(), now).blocked).toBe(false);
    expect(adWindowState(60, new Date(now - HOUR).toISOString(), now).blocked).toBe(true);
  });
  it("frees a slot when the oldest ad is 11 hours old", () => {
    const s = adWindowState(60, new Date(now - HOUR).toISOString(), now);
    expect(s.resetsAt).toBe(now + 10 * HOUR);
  });
});

describe("Robux tax calculator", () => {
  it("keeps 30% of the Game Pass price", () => {
    expect(robuxReceived(100)).toBe(70);
    expect(robuxReceived(1000)).toBe(700);
  });
  it("finds the price needed to receive a Robux amount", () => {
    expect(gamepassPriceFor(70)).toBe(100);
    expect(gamepassPriceFor(1000)).toBe(1429);
    expect(robuxReceived(gamepassPriceFor(1000))).toBeGreaterThanOrEqual(1000);
  });
});

describe("daily trivia", () => {
  it("shows 3 questions that change every 24 hours", () => {
    const today = dailyQuestions(now);
    expect(today).toHaveLength(3);
    expect(dailyQuestions(now + 1000)).toEqual(today);
    expect(dailyQuestions(now + 24 * HOUR)).not.toEqual(today);
    expect(nextTriviaReset(now)).toBe(Date.UTC(2026, 10, 16));
  });
});
