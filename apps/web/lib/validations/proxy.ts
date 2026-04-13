import { z } from "zod";
import { isValidStellarStrkeyAddress } from "@/lib/stellar/address";

const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const variableValidationSchema = z
  .object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    enum: z.array(z.unknown()).optional()
  })
  .strict()
  .optional();

const variableDefinitionSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  description: z.string(),
  required: z.boolean(),
  default: z.unknown().optional(),
  example: z.unknown().optional(),
  validation: variableValidationSchema
});

export const createProxySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, hyphens"),
  targetUrl: z.string().url(),
  pricingAsset: z.string().min(1).max(128),
  pricingAmount: z.string().min(1).max(64),
  payoutAddress: z
    .string()
    .min(1)
    .max(128)
    .refine(isValidStellarStrkeyAddress, "Invalid Stellar payout address"),
  encryptedHeaders: z.string().optional().nullable(),
  inputSchema: z.record(z.string(), z.unknown()).optional().nullable(),
  outputSchema: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isPublic: z.boolean().optional().default(true),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().max(64).optional().nullable(),
  tags: z.array(z.string().max(64)).max(20).optional().default([]),
  httpMethod: httpMethodSchema.optional().default("GET"),
  variablesSchema: z.array(variableDefinitionSchema).optional().default([]),
  requestBodyTemplate: z.string().max(200_000).optional().nullable(),
  queryParamsTemplate: z.string().max(20_000).optional().nullable(),
  contentType: z.string().max(128).optional().default("application/json"),
  exampleResponse: z.string().max(200_000).optional().nullable()
});

export const updateProxySchema = createProxySchema.partial();
