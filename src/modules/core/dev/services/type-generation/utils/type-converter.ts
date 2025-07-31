/**
 * Type Converter Utility
 * Converts between SQL types and TypeScript/Zod types
 * @module dev/services/type-generation/utils
 */

/**
 * Utility for converting between different type systems
 */
export class TypeConverter {
  /**
   * Convert SQL type to TypeScript type
   * @param sqlType - SQL type string
   * @returns TypeScript type string
   */
  public sqlToTypeScript(sqlType: string): string {
    const type = sqlType.toUpperCase();
    
    if (type.includes('TEXT') || type.includes('VARCHAR') || type.includes('CHAR')) {
      return 'string';
    }
    if (type.includes('INTEGER') || type.includes('INT') || type.includes('REAL') || type.includes('NUMERIC')) {
      return 'number';
    }
    if (type.includes('BOOLEAN') || type.includes('BOOL')) {
      return 'boolean';
    }
    if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATE')) {
      return 'string'; // ISO date strings
    }
    if (type.includes('JSON')) {
      return 'string'; // JSON stored as string
    }
    
    return 'string'; // Default
  }

  /**
   * Convert SQL type to Zod type
   * @param sqlType - SQL type string
   * @param columnName - Column name for context
   * @returns Zod type string
   */
  public sqlToZodType(sqlType: string, columnName: string): string {
    const type = sqlType.toUpperCase();
    
    if (type.includes('TEXT') || type.includes('VARCHAR') || type.includes('CHAR')) {
      // Special handling for email and URL fields
      if (columnName.toLowerCase().includes('email')) {
        return 'z.string().email()';
      }
      if (columnName.toLowerCase().includes('url')) {
        return 'z.string().url()';
      }
      return 'z.string()';
    }
    if (type.includes('INTEGER') || type.includes('INT') || type.includes('REAL') || type.includes('NUMERIC')) {
      return 'z.number()';
    }
    if (type.includes('BOOLEAN') || type.includes('BOOL')) {
      return 'z.boolean()';
    }
    if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATE')) {
      return 'z.string().datetime()';
    }
    if (type.includes('JSON')) {
      return 'z.string()';
    }
    
    return 'z.string()';
  }

  /**
   * Convert TypeScript type to Zod type
   * @param type - TypeScript type
   * @param fieldName - Field name for context
   * @param moduleName - Module name for context
   * @returns Zod type string
   */
  public typeToZodType(type: string, fieldName: string, moduleName: string): string {
    // Basic types
    if (type === 'string') {
      // Add specific validations based on field name
      if (fieldName === 'email') return 'z.string().email()';
      if (fieldName === 'id') return 'z.string().uuid()';
      if (fieldName.includes('url')) return 'z.string().url()';
      if (fieldName.includes('date') || fieldName.includes('timestamp')) return 'z.string().datetime()';
      return 'z.string()';
    }
    
    if (type === 'number') {
      if (fieldName.includes('id') && !fieldName.includes('uuid')) return 'z.number().int()';
      return 'z.number()';
    }
    
    if (type === 'boolean') return 'z.boolean()';
    if (type === 'Date') return 'z.date()';
    
    // Arrays
    if (type.endsWith('[]')) {
      const elementType = type.slice(0, -2);
      return `z.array(${this.typeToZodType(elementType, fieldName, moduleName)})`;
    }
    
    // Check for enum types (e.g., UsersStatus)
    if (type.includes('Status') && type.includes(this.toPascalCase(moduleName))) {
      return `${type}Schema`;
    }
    
    // Object types
    if (type === 'object' || type.startsWith('{')) {
      return 'z.object({})';
    }
    
    // Default to unknown for complex types
    return 'z.unknown()';
  }

  /**
   * Convert TypeScript type to Zod schema
   * @param type - TypeScript type
   * @param paramName - Parameter name
   * @param moduleName - Module name
   * @returns Zod schema string
   */
  public typeToZodSchema(type: string, paramName: string, moduleName: string): string {
    // Handle Promise types
    if (type.startsWith('Promise<') && type.endsWith('>')) {
      const innerType = type.slice(8, -1);
      return `z.promise(${this.typeToZodSchema(innerType, paramName, moduleName)})`;
    }

    // Handle nullable types
    if (type.includes(' | null')) {
      const baseType = type.replace(' | null', '').trim();
      return `${this.typeToZodSchema(baseType, paramName, moduleName)}.nullable()`;
    }

    // Handle array types
    if (type.endsWith('[]')) {
      const elementType = type.slice(0, -2);
      return `z.array(${this.typeToZodSchema(elementType, paramName, moduleName)})`;
    }

    // Map specific interface types
    const typeMap: Record<string, string> = {
      'IUserCreateData': 'UserCreateDataSchema',
      'IUserUpdateData': 'UserUpdateDataSchema',
      'IUser': 'UserSchema',
      [`I${this.getEntityName(moduleName)}CreateData`]: `${this.getEntityName(moduleName)}CreateDataSchema`,
      [`I${this.getEntityName(moduleName)}UpdateData`]: `${this.getEntityName(moduleName)}UpdateDataSchema`,
      [`I${this.getEntityName(moduleName)}`]: `${this.getEntityName(moduleName)}Schema`,
    };

    if (typeMap[type]) {
      return typeMap[type];
    }

    // Basic types
    const basicTypeMap: Record<string, string> = {
      'string': 'z.string()',
      'number': 'z.number()',
      'boolean': 'z.boolean()',
      'void': 'z.void()',
      'unknown': 'z.unknown()',
      'any': 'z.any()',
    };

    return basicTypeMap[type] || 'z.unknown()';
  }

  /**
   * Convert string to PascalCase
   * @param str - Input string
   * @returns PascalCase string
   */
  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Get entity name from module name
   * @param moduleName - Module name
   * @returns Entity name
   */
  private getEntityName(moduleName: string): string {
    // Handle special cases
    if (moduleName === 'users') return 'User';
    if (moduleName === 'auth') return 'Auth';
    
    // General case: remove trailing 's' if present
    if (moduleName.endsWith('s')) {
      return this.toPascalCase(moduleName.slice(0, -1));
    }
    
    return this.toPascalCase(moduleName);
  }
}