import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  { value: "account", label: "Account & sign-in" },
  { value: "rewards", label: "Rewards & payouts" },
  { value: "bug", label: "Bug report" },
  { value: "privacy", label: "Privacy request" },
  { value: "other", label: "Something else" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export const supportSchema = z.object({
  sender_name: z.string().trim().min(1, "Enter your name or username").max(60, "60 characters max"),
  reply_email: z
    .string()
    .trim()
    .min(1, "Enter an email we can reply to")
    .email("Enter a valid email")
    .max(255, "Email is too long"),
  category: z.enum(["account", "rewards", "bug", "privacy", "other"], {
    errorMap: () => ({ message: "Pick a category" }),
  }),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more (10 characters min)")
    .max(2000, "2000 characters max"),
});

export type SupportInput = z.infer<typeof supportSchema>;
