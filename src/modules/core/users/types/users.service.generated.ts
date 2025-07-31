// Auto-generated service schemas for users module
// Generated on: 2025-07-31T10:53:14.405Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';
import { UserSchema, UserCreateDataSchema, UserUpdateDataSchema } from './users.module.generated';

// Zod schema for UsersService
export const UsersServiceSchema = z.object({
  createUser: z.function()
    .args(UserCreateDataSchema)
    .returns(z.promise(UserSchema)),
  getUser: z.function()
    .args(z.string())
    .returns(z.promise(UserSchema.nullable())),
  getUserByUsername: z.function()
    .args(z.string())
    .returns(z.promise(UserSchema.nullable())),
  getUserByEmail: z.function()
    .args(z.string())
    .returns(z.promise(UserSchema.nullable())),
  listUsers: z.function()
    .args()
    .returns(z.promise(z.array(UserSchema))),
  updateUser: z.function()
    .args(z.string(), UserUpdateDataSchema)
    .returns(z.promise(UserSchema)),
  deleteUser: z.function()
    .args(z.string())
    .returns(z.promise(z.void())),
  searchUsers: z.function()
    .args(z.string())
    .returns(z.promise(z.array(UserSchema))),
});

// Zod schema for IUsersModuleExports
export const UsersModuleExportsSchema = z.object({
  service: z.function().returns(UsersServiceSchema)
});

// Zod schema for complete module
export const UsersModuleSchema = createModuleSchema(UsersModuleExportsSchema).extend({
  name: z.literal('users'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IUsersService = z.infer<typeof UsersServiceSchema>;
export type IUsersModuleExports = z.infer<typeof UsersModuleExportsSchema>;
