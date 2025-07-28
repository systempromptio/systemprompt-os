/**
 * TypeScript error information interface.
 */
export interface TypeCheckError {
  path: string;
  errors: number;
  issues: string[];
}
