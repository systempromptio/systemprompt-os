/**
 * TypeScript Parser Module
 * Parses TypeScript files to extract interface and service definitions
 * @module dev/services/type-generation/parsers
 */

import * as ts from 'typescript';
import type { InterfaceField, ServiceInfo, ServiceMethod } from '../types';

/**
 * TypeScript Parser for extracting type information
 */
export class TypeScriptParser {
  /**
   * Parse interface fields from interface body
   * @param interfaceBody - Interface body content
   * @returns Array of interface fields
   */
  public parseInterfaceFields(interfaceBody: string): InterfaceField[] {
    const fields: InterfaceField[] = [];
    const lines = interfaceBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      
      // Parse field: name: type | null;
      const match = trimmed.match(/^(\w+)(\?)?:\s*(.+?)(?:;|$)/);
      if (match) {
        const [, name, optional, typeStr] = match;
        const cleanType = typeStr.trim();
        const nullable = cleanType.includes(' | null');
        const type = cleanType.replace(' | null', '').trim();
        
        fields.push({
          name,
          type,
          optional: optional === '?',
          nullable
        });
      }
    }
    
    return fields;
  }

  /**
   * Parse service file to extract method information
   * @param filePath - Path to service file
   * @param moduleName - Module name
   * @returns Service information or null
   */
  public async parseServiceFile(filePath: string, moduleName: string): Promise<ServiceInfo | null> {
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      lib: ['lib.es2015.d.ts'],
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    });

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return null;

    const serviceName = `${this.toPascalCase(moduleName)}Service`;
    const methods: ServiceMethod[] = [];

    ts.forEachChild(sourceFile, node => {
      if (ts.isClassDeclaration(node) && node.name?.text === serviceName) {
        node.members.forEach(member => {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const methodName = member.name.text;
            
            // Check for private/protected modifiers
            const hasPrivateModifier = member.modifiers?.some(
              modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword
            );
            const hasProtectedModifier = member.modifiers?.some(
              modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword
            );
            
            // Skip private/protected methods and lifecycle methods
            if (hasPrivateModifier || hasProtectedModifier || this.shouldSkipMethod(methodName)) {
              return;
            }

            const params = member.parameters.map(param => {
              const paramName = param.name.getText(sourceFile);
              const paramType = param.type ? param.type.getText(sourceFile) : 'unknown';
              return { name: paramName, type: paramType };
            });

            const returnType = member.type ? member.type.getText(sourceFile) : 'void';

            methods.push({
              name: methodName,
              params,
              returnType
            });
          }
        });
      }
    });

    return methods.length > 0 ? { name: serviceName, methods } : null;
  }

  /**
   * Check if a method should be skipped
   * @param methodName - Method name
   * @returns True if method should be skipped
   */
  private shouldSkipMethod(methodName: string): boolean {
    const skipMethods = [
      'constructor',
      'getInstance',
      'initialize',
      'setLogger',
      'ensureInitialized'
    ];
    
    return methodName.startsWith('_') || skipMethods.includes(methodName);
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
}