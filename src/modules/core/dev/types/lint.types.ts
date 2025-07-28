/**
 * Lint error information interface.
 */
export interface LintError {
  path: string;
  errors: number;
  issues: string[];
}
