/**
 * Task Resource Types - STUB IMPLEMENTATION
 * TODO: Define proper resource types
 */

export interface TaskResourceContent {
  task: any;
  sessions?: TaskSession[];
  metadata?: TaskMetadata;
}

export interface TaskSession {
  id: string;
  status: string;
  startedAt: Date;
  endedAt?: Date;
}

export interface TaskMetadata {
  version: string;
  lastModified: Date;
  [key: string]: any;
}