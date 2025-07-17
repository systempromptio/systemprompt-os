/**
 * @fileoverview Service module interface
 * @module src/interfaces/service
 */

import { Module } from './module.js';

export interface ServiceModule<T = any> extends Module {
  type: 'service';
  getService(): T;
}