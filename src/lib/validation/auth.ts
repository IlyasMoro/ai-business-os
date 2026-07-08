import * as z from "zod";

export const RegisterSchema = z.object({
  companyName: z
    .string()
    .min(2, { error: "Company name must be at least 2 characters." })
    .trim(),
  name: z
    .string()
    .min(2, { error: "Your name must be at least 2 characters." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters." }),
});

export const LoginSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
});

export type RegisterFormState =
  | {
      errors?: {
        companyName?: string[];
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export const ForgotPasswordSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
});

export const ResetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters." }),
});

export type ForgotPasswordFormState =
  | {
      errors?: {
        email?: string[];
      };
      message?: string;
    }
  | undefined;

export type ResetPasswordFormState =
  | {
      errors?: {
        password?: string[];
      };
      message?: string;
    }
  | undefined;
