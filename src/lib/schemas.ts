import { z } from "zod";

export const TokenFormSchema = z.object({
  token: z.string().min(1, "API Token is required").trim(),
});

export type TokenFormValues = z.infer<typeof TokenFormSchema>;
