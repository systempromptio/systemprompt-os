import path from 'path';
import fs from 'fs';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that each functional file has a corresponding test file',
      category: 'Testing',
      recommended: true
    },
    fixable: null,
    messages: {
      missingTestFile: 'File "{{filename}}" is missing a corresponding test file at "{{expectedPath}}"',
      testFileWrongLocation: 'Test file for "{{filename}}" should be at "{{expectedPath}}", not "{{actualPath}}"'
    },
    schema: [
      {
        type: 'object',
        properties: {
          testDir: {
            type: 'string',
            default: 'tests/unit',
            description: 'Base directory for test files'
          },
          testSuffixes: {
            type: 'array',
            items: { type: 'string' },
            default: ['.spec.ts', '.test.ts'],
            description: 'Valid test file suffixes'
          },
          excludePatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [
              'index.ts',
              'index.js',
              'types/**',
              'interfaces/**',
              '**/*.d.ts',
              'module.yaml',
              'database/schema.sql',
              'database/migrations/**'
            ],
            description: 'Patterns of files that do not require tests'
          },
          includePatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [
              'services/**/*.ts',
              'repositories/**/*.ts',
              'utils/**/*.ts',
              'cli/**/*.ts',
              'adapters/**/*.ts',
              'executors/**/*.ts'
            ],
            description: 'Patterns of files that must have tests'
          },
          enforceStrictPath: {
            type: 'boolean',
            default: true,
            description: 'Test path must exactly match source path structure'
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const testDir = options.testDir || 'tests/unit';
    const testSuffixes = options.testSuffixes || ['.spec.ts', '.test.ts'];
    const excludePatterns = options.excludePatterns || [
      'index.ts',
      'index.js', 
      'types/**',
      'interfaces/**',
      '**/*.d.ts',
      'module.yaml',
      'database/schema.sql',
      'database/migrations/**'
    ];
    const includePatterns = options.includePatterns || [
      'services/**/*.ts',
      'repositories/**/*.ts',
      'utils/**/*.ts',
      'cli/**/*.ts',
      'adapters/**/*.ts',
      'executors/**/*.ts'
    ];
    const enforceStrictPath = options.enforceStrictPath !== false;

    const filename = context.filename || context.getFilename();
    const sourceCode = context.getSourceCode();
    
    // Skip if this is a test file itself
    if (testSuffixes.some(suffix => filename.includes(suffix))) {
      return {};
    }

    // Skip non-TypeScript/JavaScript files
    if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
      return {};
    }

    // Check if file should be excluded
    function shouldExclude(filePath) {
      const relativePath = path.relative(process.cwd(), filePath);
      const basename = path.basename(filePath);
      
      // Check exclude patterns
      for (const pattern of excludePatterns) {
        if (pattern.includes('**')) {
          // Handle glob patterns
          const regex = new RegExp(
            pattern
              .replace(/\*\*/g, '.*')
              .replace(/\*/g, '[^/]*')
              .replace(/\./g, '\\.')
          );
          if (regex.test(relativePath) || regex.test(basename)) {
            return true;
          }
        } else if (basename === pattern || relativePath.endsWith(pattern)) {
          return true;
        }
      }

      // If we have include patterns, check if file matches any
      if (includePatterns.length > 0) {
        let matches = false;
        for (const pattern of includePatterns) {
          if (pattern.includes('**')) {
            const regex = new RegExp(
              pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\./g, '\\.')
            );
            if (regex.test(relativePath)) {
              matches = true;
              break;
            }
          }
        }
        return !matches;
      }

      return false;
    }

    // Get expected test file path
    function getExpectedTestPath(sourceFile) {
      // Extract path relative to src
      const srcMatch = sourceFile.match(/(.*)\/src\/(.*)/);
      if (!srcMatch) {
        return null;
      }

      const [, projectRoot, relativePath] = srcMatch;
      const fileDir = path.dirname(relativePath);
      const fileName = path.basename(relativePath, path.extname(relativePath));
      
      // Build test file path
      const testFileName = testSuffixes[0]; // Use first suffix as default
      const expectedTestFile = `${fileName}${testFileName}`;
      
      if (enforceStrictPath) {
        // Test path should mirror source path
        return path.join(projectRoot, testDir, fileDir, expectedTestFile);
      } else {
        // Allow test file anywhere in test directory
        return path.join(projectRoot, testDir, '**', expectedTestFile);
      }
    }

    // Check if test file exists
    function checkTestFile() {
      // Skip if we can't determine the filename
      if (!filename || filename === '<input>') {
        return;
      }

      if (shouldExclude(filename)) {
        return;
      }

      const expectedPath = getExpectedTestPath(filename);
      if (!expectedPath) {
        return;
      }

      // Check each possible test suffix
      let testFileExists = false;
      let foundTestPath = null;

      for (const suffix of testSuffixes) {
        const testPath = expectedPath.replace(testSuffixes[0], suffix);
        
        try {
          if (fs.existsSync(testPath)) {
            testFileExists = true;
            foundTestPath = testPath;
            break;
          }
        } catch (err) {
          // Log but continue - file system errors shouldn't break linting
          console.debug(`Error checking test file ${testPath}:`, err.message);
        }
      }

      if (!testFileExists) {
        // Get the first node with location info for reporting
        const firstNode = sourceCode.ast.body[0] || sourceCode.ast;
        
        context.report({
          node: firstNode,
          messageId: 'missingTestFile',
          data: {
            filename: path.relative(process.cwd(), filename),
            expectedPath: path.relative(process.cwd(), expectedPath)
          }
        });
      }
    }

    return {
      'Program:exit': checkTestFile
    };
  }
};