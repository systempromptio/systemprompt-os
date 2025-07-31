// Auto-generated Zod schemas for auth module
// Generated on: 2025-07-31T15:11:41.523Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { AuthOauthIdentitiesRowSchema } from './database.generated';

// Auth schema - directly use database row schema
export const AuthSchema = AuthOauthIdentitiesRowSchema;

export const AuthCreateDataSchema = z.object({
  user_id: z.string(),
  provider: z.string(),
  provider_user_id: z.string(),
  provider_email: z.string().nullable(),
  provider_name: z.string().nullable(),
  provider_picture: z.string().nullable(),
});

export const AuthUpdateDataSchema = z.object({
  user_id: z.string().optional(),
  provider: z.string().optional(),
  provider_user_id: z.string().optional(),
  provider_email: z.string().nullable().optional(),
  provider_name: z.string().nullable().optional(),
  provider_picture: z.string().nullable().optional(),
});

// Type inference from schemas
export type Auth = z.infer<typeof AuthSchema>;
export type AuthCreateData = z.infer<typeof AuthCreateDataSchema>;
export type AuthUpdateData = z.infer<typeof AuthUpdateDataSchema>;

// Domain type aliases for easier imports
export type IAuth = Auth;
export type IAuthCreateData = AuthCreateData;
export type IAuthUpdateData = AuthUpdateData;
