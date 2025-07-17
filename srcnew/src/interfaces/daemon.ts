/**
 * @fileoverview Daemon module interface
 * @module src/interfaces/daemon
 */

import { Module } from './module.js';

export interface DaemonModule extends Module {
  type: 'daemon';
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}