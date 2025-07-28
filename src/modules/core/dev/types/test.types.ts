/**
 * Test file information interface.
 */
export interface TestFileInfo {
  path: string;
  tests: number;
  skipped: number;
  todos: number;
  coverage: string[];
}
