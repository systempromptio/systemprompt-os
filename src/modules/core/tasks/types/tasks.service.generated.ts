// Auto-generated service schemas for tasks module
// Generated on: 2025-07-31T14:34:10.000Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/index';
import { TaskSchema, TaskCreateDataSchema, TaskUpdateDataSchema } from './tasks.module.generated';

// Zod schema for TasksService
export const TasksServiceSchema = z.object({
  addTask: z.function()
    .args(TaskCreateDataSchema.partial())
    .returns(z.promise(TaskSchema)),
  receiveTask: z.function()
    .args(z.array(z.string()).optional())
    .returns(z.promise(TaskSchema.nullable())),
  updateTaskStatus: z.function()
    .args(z.number(), z.unknown())
    .returns(z.promise(z.void())),
  updateTask: z.function()
    .args(z.number(), TaskUpdateDataSchema.partial())
    .returns(z.promise(TaskSchema)),
  getTaskById: z.function()
    .args(z.number())
    .returns(z.promise(TaskSchema.nullable())),
  listTasks: z.function()
    .args(z.object({}).partial().optional())
    .returns(z.promise(z.array(TaskSchema))),
  cancelTask: z.function()
    .args(z.number())
    .returns(z.promise(z.void())),
  getStatistics: z.function()
    .args()
    .returns(z.promise(z.object({
      total: z.number(),
      pending: z.number(),
      inProgress: z.number(),
      completed: z.number(),
      failed: z.number(),
      cancelled: z.number(),
      averageExecutionTime: z.number().optional(),
      tasksByType: z.record(z.number())
    }))),
});

// Zod schema for ITasksModuleExports
export const TasksModuleExportsSchema = z.object({
  service: z.function().returns(TasksServiceSchema),
  TaskStatus: z.any(),
  TaskExecutionStatus: z.any(),
  TaskPriority: z.any()
});

// Zod schema for complete module
export const TasksModuleSchema = createModuleSchema(TasksModuleExportsSchema).extend({
  name: z.literal('tasks'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type ITasksService = z.infer<typeof TasksServiceSchema>;
export type ITasksModuleExports = z.infer<typeof TasksModuleExportsSchema>;