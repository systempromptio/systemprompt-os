/**
 * Result type for count queries.
 */
export interface CountQueryResult {
  count: number;
}

/**
 * Type guard to check if a value is a CountQueryResult array.
 * @param value
 */
export function isCountQueryResults(value: unknown): value is CountQueryResult[] {
  return (
    Array.isArray(value)
    && value.length > 0
    && typeof value[0] === 'object'
    && value[0] !== null
    && 'count' in value[0]
    && typeof (value[0] as CountQueryResult).count === 'number'
  );
}
