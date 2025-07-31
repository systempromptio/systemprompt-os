/**
 * String Utility Functions
 * Common string manipulation utilities
 * @module dev/services/type-generation/utils
 */

/**
 * Utility functions for string manipulation
 */
export class StringUtils {
  /**
   * Convert string to PascalCase
   * @param str - Input string
   * @returns PascalCase string
   */
  public toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert string to camelCase
   * @param str - Input string
   * @returns camelCase string
   */
  public toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  /**
   * Get entity name from module name
   * @param moduleName - Module name
   * @returns Entity name
   */
  public getEntityName(moduleName: string): string {
    // Handle special cases
    if (moduleName === 'users') return 'User';
    if (moduleName === 'auth') return 'Auth';
    
    // General case: remove trailing 's' if present
    if (moduleName.endsWith('s')) {
      return this.toPascalCase(moduleName.slice(0, -1));
    }
    
    return this.toPascalCase(moduleName);
  }

  /**
   * Convert module name to service name
   * @param moduleName - Module name
   * @returns Service name
   */
  public getServiceName(moduleName: string): string {
    return `${this.toPascalCase(moduleName)}Service`;
  }

  /**
   * Check if string is snake_case
   * @param str - Input string
   * @returns True if snake_case
   */
  public isSnakeCase(str: string): boolean {
    return /^[a-z]+(_[a-z]+)*$/.test(str);
  }

  /**
   * Check if string is camelCase
   * @param str - Input string
   * @returns True if camelCase
   */
  public isCamelCase(str: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(str);
  }

  /**
   * Check if string is PascalCase
   * @param str - Input string
   * @returns True if PascalCase
   */
  public isPascalCase(str: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
  }
}