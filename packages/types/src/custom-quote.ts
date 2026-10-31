import { z } from "zod";

export const CUSTOM_QUOTE_FIELD_LIMITS = {
  name: 120,
  phone: 40,
  email: 254,
  product: 120,
  description: 2000,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(max, `Keep your ${label} to ${max} characters.`);
}

export const customQuoteRequestSchema = z.object({
  name: requiredText("name", CUSTOM_QUOTE_FIELD_LIMITS.name),
  phone: requiredText("phone number", CUSTOM_QUOTE_FIELD_LIMITS.phone).refine(
    (value) => (value.match(/\d/g) ?? []).length >= 7,
    "Enter a phone number we can reach you on.",
  ),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(CUSTOM_QUOTE_FIELD_LIMITS.email, "Enter a shorter email address.")
    .email("Enter an email address like name@example.com."),
  neededBy: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (ISO_DATE.test(value) && isRealDate(value)),
      "Enter the date as a real calendar date.",
    ),
  product: requiredText("product or idea", CUSTOM_QUOTE_FIELD_LIMITS.product),
  description: requiredText(
    "description",
    CUSTOM_QUOTE_FIELD_LIMITS.description,
  ),
  company: z.string().max(200),
});

export type CustomQuoteRequest = z.infer<typeof customQuoteRequestSchema>;
export type CustomQuoteField = Exclude<keyof CustomQuoteRequest, "company">;

export function customQuoteFieldErrors(
  input: unknown,
): Partial<Record<CustomQuoteField, string>> {
  const result = customQuoteRequestSchema.safeParse(input);
  if (result.success) return {};

  const errors: Partial<Record<CustomQuoteField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field === "company") continue;
    errors[field as CustomQuoteField] ??= issue.message;
  }
  return errors;
}
