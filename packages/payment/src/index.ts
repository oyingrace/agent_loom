import { z } from "zod";

export const paymentIntentSchema = z.object({
  asset: z.string().min(1),
  amount: z.string().min(1),
  recipient: z.string().min(1),
  nonce: z.string().min(1)
});

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
