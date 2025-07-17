/**
 * @fileoverview Utility type transformers and helpers
 * @module types/utils/transformers
 */

/**
 * Type that can be null
 * @template T - Base type
 */
export type Nullable<T> = T | null;

/**
 * Type that can be undefined
 * @template T - Base type
 */
export type Optional<T> = T | undefined;

/**
 * Type that can be null or undefined
 * @template T - Base type
 */
export type Maybe<T> = T | null | undefined;

/**
 * Makes all properties optional recursively
 * @template T - Type to transform
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Makes all properties readonly recursively
 * @template T - Type to transform
 */
export type DeepReadonly<T> = T extends object ? {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;

/**
 * Removes readonly from all properties
 * @template T - Type to transform
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Removes readonly from all properties recursively
 * @template T - Type to transform
 */
export type DeepMutable<T> = T extends object ? {
  -readonly [P in keyof T]: DeepMutable<T[P]>;
} : T;

/**
 * Requires at least one of the specified keys
 * @template T - Base type
 * @template Keys - Keys to require at least one of
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Requires exactly one of the specified keys
 * @template T - Base type
 * @template Keys - Keys to require exactly one of
 */
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

/**
 * Array that must have at least one element
 * @template T - Element type
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Gets the union of all property values
 * @template T - Object type
 */
export type ValueOf<T> = T[keyof T];

/**
 * Gets keys of properties matching a specific type
 * @template T - Object type
 * @template U - Type to match
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Picks properties that match a specific type
 * @template T - Object type
 * @template U - Type to match
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Omits properties that match a specific type
 * @template T - Object type
 * @template U - Type to match
 */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

/**
 * Type-safe Object.entries result
 * @template T - Object type
 */
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Type-safe Object.fromEntries result
 * @template T - Entries array type
 */
export type FromEntries<T extends readonly (readonly [PropertyKey, unknown])[]> = {
  [K in T[number][0]]: Extract<T[number], readonly [K, unknown]>[1];
};

/**
 * Unwraps Promise type
 * @template T - Type to unwrap
 */
export type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

/**
 * Extracts value type from Promise
 * @template T - Promise type
 */
export type PromiseValue<T> = T extends Promise<infer U> ? U : never;

/**
 * Gets return type of async function
 * @template T - Async function type
 */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = 
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

/**
 * Constructor function type
 * @template T - Instance type
 */
export type Constructor<T = {}> = new (...args: unknown[]) => T;

/**
 * Abstract constructor function type
 * @template T - Instance type
 */
export type AbstractConstructor<T = {}> = abstract new (...args: unknown[]) => T;

/**
 * Branded type for nominal typing
 * @template T - Base type
 * @template Brand - Brand string
 */
export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };

/**
 * Creates a branded value
 * @template T - Base type
 * @template Brand - Brand string
 * @param {T} value - Value to brand
 * @returns {Branded<T, Brand>} Branded value
 */
export function createBranded<T, Brand extends string>(value: T): Branded<T, Brand> {
  return value as Branded<T, Brand>;
}

/**
 * Removes undefined values from object
 * @template T - Object type
 * @param {T} obj - Object to filter
 * @returns {object} Object without undefined values
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): {
  [K in keyof T]-?: Exclude<T[K], undefined>;
} {
  const result = {} as { [K in keyof T]-?: Exclude<T[K], undefined> };
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key] as Exclude<T[typeof key], undefined>;
    }
  }
  return result;
}

/**
 * Removes null values from object
 * @template T - Object type
 * @param {T} obj - Object to filter
 * @returns {object} Object without null values
 */
export function removeNull<T extends Record<string, unknown>>(obj: T): {
  [K in keyof T]-?: Exclude<T[K], null>;
} {
  const result = {} as { [K in keyof T]-?: Exclude<T[K], null> };
  for (const key in obj) {
    if (obj[key] !== null) {
      result[key] = obj[key] as Exclude<T[typeof key], null>;
    }
  }
  return result;
}

/**
 * Removes null and undefined values from object
 * @template T - Object type
 * @param {T} obj - Object to filter
 * @returns {object} Object without nullish values
 */
export function removeNullish<T extends Record<string, unknown>>(obj: T): {
  [K in keyof T]-?: NonNullable<T[K]>;
} {
  const result = {} as { [K in keyof T]-?: NonNullable<T[K]> };
  for (const key in obj) {
    if (obj[key] != null) {
      result[key] = obj[key] as NonNullable<T[typeof key]>;
    }
  }
  return result;
}

/**
 * Type-safe Object.entries
 * @template T - Object type
 * @param {T} obj - Object to get entries from
 * @returns {Entries<T>} Type-safe entries array
 */
export function entries<T extends Record<string, unknown>>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}

/**
 * Type-safe Object.fromEntries
 * @template T - Entries array type
 * @param {T} entries - Entries array
 * @returns {FromEntries<T>} Resulting object
 */
export function fromEntries<T extends readonly (readonly [PropertyKey, unknown])[]>(
  entries: T
): FromEntries<T> {
  return Object.fromEntries(entries) as FromEntries<T>;
}

/**
 * Type-safe Object.keys
 * @template T - Object type
 * @param {T} obj - Object to get keys from
 * @returns {(keyof T)[]} Type-safe keys array
 */
export function keys<T extends Record<string, unknown>>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

/**
 * Type-safe Object.values
 * @template T - Object type
 * @param {T} obj - Object to get values from
 * @returns {ValueOf<T>[]} Type-safe values array
 */
export function values<T extends Record<string, unknown>>(obj: T): ValueOf<T>[] {
  return Object.values(obj) as ValueOf<T>[];
}

/**
 * Maps object values while preserving keys
 * @template T - Object type
 * @template U - Result value type
 * @param {T} obj - Object to map
 * @param {Function} fn - Mapping function
 * @returns {Record<keyof T, U>} Mapped object
 */
export function mapObject<T extends Record<string, unknown>, U>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => U
): Record<keyof T, U> {
  const result = {} as Record<keyof T, U>;
  for (const key in obj) {
    result[key] = fn(obj[key], key);
  }
  return result;
}

/**
 * Filters object by predicate
 * @template T - Object type
 * @param {T} obj - Object to filter
 * @param {Function} predicate - Filter predicate
 * @returns {Partial<T>} Filtered object
 */
export function filterObject<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (predicate(obj[key], key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Picks specified keys from object
 * @template T - Object type
 * @template K - Keys to pick
 * @param {T} obj - Source object
 * @param {K[]} keys - Keys to pick
 * @returns {Pick<T, K>} Object with picked keys
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified keys from object
 * @template T - Object type
 * @template K - Keys to omit
 * @param {T} obj - Source object
 * @param {K[]} keys - Keys to omit
 * @returns {Omit<T, K>} Object without omitted keys
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}