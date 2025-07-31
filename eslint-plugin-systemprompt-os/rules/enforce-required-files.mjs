import path from 'path';
import fs from 'fs';

const REQUIRED_FILES = {
  module: ['index.ts', 'module.yaml'],
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure required files exist in module structure',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          customRequirements: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const customRequirements = options.customRequirements || {};
    const requirements = { ...REQUIRED_FILES, ...customRequirements };
    const checkedModules = new Set();
    const checkedFolders = new Set();

    function checkRequiredFiles(node) {
      const filename = context.filename || context.getFilename();
      
      // Skip non-module files
      if (!filename.includes('/src/modules/')) {
        return;
      }

      // Check module-level required files
      // Updated regex to handle subdirectories like /src/modules/core/logger/
      const moduleMatch = filename.match(/^(.*\/src\/modules\/(?:core\/)?[^/]+)\//);
      if (moduleMatch) {
        const modulePath = moduleMatch[1];
        
        if (!checkedModules.has(modulePath)) {
          checkedModules.add(modulePath);
          
          // Check for required module files
          requirements.module.forEach(requiredFile => {
            const filePath = path.join(modulePath, requiredFile);
            if (!fs.existsSync(filePath)) {
              context.report({
                node,
                message: `Module is missing required file: ${requiredFile}`
              });
            }
          });
        }
      }

      // Check folder-level required files
      // Updated regex to handle subdirectories like /src/modules/core/logger/types/
      const folderMatch = filename.match(/^(.*\/src\/modules\/(?:core\/)?[^/]+\/([^/]+))\//);
      if (folderMatch) {
        const folderPath = folderMatch[1];
        const folderType = folderMatch[2];
        
        const folderKey = `${folderPath}:${folderType}`;
        if (!checkedFolders.has(folderKey) && requirements[folderType]) {
          checkedFolders.add(folderKey);
          
          // Check for required folder files
          requirements[folderType].forEach(requiredFile => {
            const filePath = path.join(folderPath, requiredFile);
            if (!fs.existsSync(filePath)) {
              context.report({
                node,
                message: `${folderType} folder is missing required file: ${requiredFile}`
              });
            }
          });
        }
      }
    }

    return {
      Program: checkRequiredFiles
    };
  }
};