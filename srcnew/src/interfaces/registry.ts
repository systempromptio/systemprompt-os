/**
 * @fileoverview Module registry interface
 * @module src/interfaces/registry
 */

import { Module } from './module.js';

export interface ModuleRegistry {
  register(module: Module): void;
  get(name: string): Module | undefined;
  getAll(): Module[];
  has(name: string): boolean;
  unregister(name: string): boolean;
}