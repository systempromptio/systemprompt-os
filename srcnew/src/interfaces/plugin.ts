/**
 * @fileoverview Plugin module interface
 * @module src/interfaces/plugin
 */

import { Module } from './module.js';

export interface PluginModule extends Module {
  type: 'plugin';
  provides: string | string[];
  requires?: string[];
  load(): Promise<void>;
  unload?(): Promise<void>;
}