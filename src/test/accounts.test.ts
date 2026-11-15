import { describe, expect, it } from "vitest";

import { signUpSchema } from "@/lib/auth-schema";
import { parseReferralCode, referralLink } from "@/lib/referral";
import { supportSchema } from "@/lib/support";

describe("referral links", () => {
  it("reads ?ref=CODE case-insensitively", () => {
    expect(parseReferralCode(" ab12cd34 ")).toBe("AB12CD34");
  });

  it("ignores codes that aren't plain letters and digits", () => {
    expect(parseReferralCode("abc'; drop")).toBeNull();
    expect(parseReferralCode("")).toBeNull();
  });

  it("builds a share link with the code", () => {
    expect(referralLink("https://example.com", "AB12CD34")).toBe("https://example.com/?ref=AB12CD34");
  });
});

describe("sign-up", () => {
  it("requires confirming the player is 13 or older", () => {
    const base = { email: "player@example.com", password: "longenough" };
    expect(signUpSchema.safeParse({ ...base, ageConfirmed: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, ageConfirmed: true }).success).toBe(true);
  });
});

describe("contact support form", () => {
  const valid = {
    sender_name: "Player1",
    reply_email: "player@example.com",
    category: "rewards",
    message: "My reward hasn't arrived yet.",
  };

  it("accepts name, reply email, category and message", () => {
    expect(supportSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a reply email", () => {
    expect(supportSchema.safeParse({ ...valid, reply_email: "" }).success).toBe(false);
  });

  it("rejects unknown categories", () => {
    expect(supportSchema.safeParse({ ...valid, category: "hacks" }).success).toBe(false);
  });
});
