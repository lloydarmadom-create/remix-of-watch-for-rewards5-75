import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .email("Enter a valid email")
  .max(255, "Email is too long");

export const logInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
});

export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use 72 characters or fewer"),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: "You must be 13 or older to join" }),
  }),
});
