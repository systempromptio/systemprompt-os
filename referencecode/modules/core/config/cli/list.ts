/**
 * @fileoverview List configuration values CLI command
 * @module modules/core/config/cli/list
 */

import { ConfigModule } from '../index.js';

/**
 * Format configuration as tree
 */
function formatTree(obj: any, prefix: string = ''): string {
  let output = '';
  const entries = Object.entries(obj);
  
  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1;
    const linePrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      output += `${linePrefix}${key}/\n`;
      output += formatTree(value, childPrefix);
    } else {
      const displayValue = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
      output += `${linePrefix}${key}: ${displayValue}\n`;
    }
  });
  
  return output;
}

/**
 * Execute list command
 */
async function execute(options: { format?: string }): Promise<void> {
  const format = options.format || 'tree';
  
  // Create a temporary config module instance
  const configModule = new ConfigModule();
  await configModule.initialize();
  
  const allConfig = configModule.get();
  
  if (!allConfig || Object.keys(allConfig).length === 0) {
    console.log('No configuration values found.');
    return;
  }
  
  console.log('\nConfiguration Values:');
  console.log('====================\n');
  
  switch (format) {
    case 'json':
      console.log(JSON.stringify(allConfig, null, 2));
      break;
      
    case 'yaml': {
      // Simple YAML-like output
      const formatYaml = (obj: any, indent: number = 0): string => {
        let output = '';
        Object.entries(obj).forEach(([key, value]) => {
          const spaces = ' '.repeat(indent);
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            output += `${spaces}${key}:\n`;
            output += formatYaml(value, indent + 2);
          } else {
            output += `${spaces}${key}: ${JSON.stringify(value)}\n`;
          }
        });
        return output;
      };
      const yamlOutput = formatYaml(allConfig);
      console.log(yamlOutput);
      break;
    }
      
    case 'tree':
    default:
      console.log(formatTree(allConfig));
      break;
  }
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute
};