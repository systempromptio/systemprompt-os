import type { CLICommand, CLIContext } from "@/cli/src/types.js";
import { ensureDatabaseInitialized } from "./utils.js";
import { DatabaseService } from "@/modules/core/database/services/database.service.js";
import * as readline from "readline";

export const command: CLICommand = {
  name: "query",
  description: "Execute SQL queries safely (admin only)",
  options: [
    {
      name: "sql",
      alias: "s",
      type: "string",
      description: "SQL query to execute",
    },
    {
      name: "file",
      alias: "f",
      type: "string",
      description: "File containing SQL queries",
    },
    {
      name: "format",
      alias: "o",
      type: "string",
      description: "Output format (table, json, csv)",
      default: "table",
    },
    {
      name: "interactive",
      alias: "i",
      type: "boolean",
      description: "Start interactive SQL shell",
      default: false,
    },
    {
      name: "readonly",
      alias: "r",
      type: "boolean",
      description: "Allow only SELECT queries (safe mode)",
      default: true,
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const { dbService } = await ensureDatabaseInitialized();
      
      // Check if database is initialized
      const isInitialized = await dbService.isInitialized();
      
      if (!isInitialized) {
        console.error("Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize.");
        process.exit(1);
      }

      const readonly = context.args['readonly'] !== false;
      const format = context.args['format'] || "table";
      const interactive = context.args['interactive'] || false;
      const sqlQuery = context.args['sql'];
      const sqlFile = context.args['file'];

      if (interactive) {
        await startInteractiveShell(dbService, readonly, format);
      } else if (sqlFile) {
        await executeFile(dbService, sqlFile, readonly, format);
      } else if (sqlQuery) {
        await executeQuery(dbService, sqlQuery, readonly, format);
      } else {
        console.error("Please provide --sql, --file, or --interactive option.");
        process.exit(1);
      }
    } catch (error) {
      console.error("Error executing query:", (error as Error).message);
      process.exit(1);
    }
  },
};

async function executeQuery(
  dbService: DatabaseService, 
  sql: string, 
  readonly: boolean,
  format: string
): Promise<void> {
  // Safety check for readonly mode
  if (readonly && !isReadOnlyQuery(sql)) {
    console.error("Error: Only SELECT queries are allowed in readonly mode.");
    console.error("Use --readonly=false to execute write queries.");
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    const result = await dbService.query(sql);
    const duration = Date.now() - startTime;

    // Handle different result types
    if (Array.isArray(result) && result.length > 0) {
      // SELECT query with results
      formatOutput(result, format);
      console.log(`\n(${result.length} row${result.length !== 1 ? 's' : ''} in ${duration}ms)`);
    } else {
      // No results or write query
      console.log(`Query executed successfully (${duration}ms)`);
    }
  } catch (error) {
    console.error("Query failed:", (error as Error).message);
    process.exit(1);
  }
}

async function executeFile(
  dbService: DatabaseService,
  filePath: string,
  readonly: boolean,
  format: string
): Promise<void> {
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const queries = content
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    console.log(`Executing ${queries.length} queries from ${filePath}...\n`);

    for (let i = 0; i < queries.length; i++) {
      console.log(`Query ${i + 1}/${queries.length}:`);
      await executeQuery(dbService, queries[i]!, readonly, format);
      console.log("");
    }
  } catch (error) {
    console.error("Error reading file:", (error as Error).message);
    process.exit(1);
  }
}

async function startInteractiveShell(
  dbService: DatabaseService,
  readonly: boolean,
  format: string
): Promise<void> {
  console.log("Starting interactive SQL shell...");
  console.log(`Mode: ${readonly ? 'READONLY' : 'READ-WRITE'}`);
  console.log("Type '.exit' to quit, '.help' for help\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sql> ',
  });

  let multilineQuery = '';

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();

    // Handle commands
    if (trimmed.startsWith('.')) {
      await handleCommand(trimmed, rl);
      rl.prompt();
      return;
    }

    // Accumulate multiline queries
    multilineQuery += `${line  } `;

    // Check if query is complete (ends with semicolon)
    if (trimmed.endsWith(';')) {
      const query = multilineQuery.trim();
      multilineQuery = '';

      try {
        await executeQuery(dbService, query.slice(0, -1), readonly, format);
      } catch (error) {
        console.error("Error:", (error as Error).message);
      }
      
      rl.prompt();
    } else {
      // Continue multiline input
      rl.setPrompt('   ...> ');
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

async function handleCommand(command: string, rl: readline.Interface): Promise<void> {
  switch (command) {
    case '.exit':
    case '.quit':
      rl.close();
      break;
      
    case '.help':
      console.log("\nCommands:");
      console.log("  .exit    Exit the shell");
      console.log("  .help    Show this help message");
      console.log("  .tables  List all tables");
      console.log("\nSQL queries must end with a semicolon (;)");
      console.log("Multi-line queries are supported\n");
      break;
      
    case '.tables': {
      const _dbService = DatabaseService.getInstance();
      
      try {
        let _tables: any[];
        const _dbType = _dbService.getDatabaseType();
        
        if (_dbType === 'sqlite') {
          _tables = await _dbService.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        } else {
          _tables = await _dbService.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
        }
        
        if (_tables.length > 0) {
          console.log("\nTables:");
          _tables.forEach(t => console.log(`  ${t.name || t.tablename}`));
          console.log("");
        } else {
          console.log("\nNo tables found.\n");
        }
      } catch (error) {
        console.error("Error listing tables:", (error as Error).message);
      }
      break;
    }
      
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Type '.help' for help\n");
  }
}

function isReadOnlyQuery(sql: string): boolean {
  const query = sql.trim().toLowerCase();
  const readOnlyKeywords = ['select', 'show', 'describe', 'explain', 'with'];
  
  return readOnlyKeywords.some(keyword => query.startsWith(keyword));
}

function formatOutput(rows: any[], format: string): void {
  if (rows.length === 0) {
    console.log("(0 rows)");
    return;
  }

  switch (format) {
    case 'json':
      console.log(JSON.stringify(rows, null, 2));
      break;
      
    case 'csv': {
      const headers = Object.keys(rows[0]);
      console.log(headers.join(','));
      rows.forEach(row => {
        const values = headers.map(h => {
          const value = row[h];
          if (value === null) {return '';}
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        console.log(values.join(','));
      });
      break;
    }
      
    case 'table':
    default: {
      // Calculate column widths
      const _columns = Object.keys(rows[0]);
      const _widths: Record<string, number> = {};
      
      _columns.forEach(col => {
        _widths[col] = col.length;
        rows.forEach(row => {
          const _value = String(row[col] ?? 'NULL');
          _widths[col] = Math.max(_widths[col]!, _value.length);
        });
      });

      // Print header
      const header = _columns.map(col => col.padEnd(_widths[col]!)).join(' | ');
      console.log(header);
      console.log('-'.repeat(header.length));

      // Print rows
      rows.forEach(row => {
        const values = _columns.map(col => {
          const value = row[col] === null ? 'NULL' : String(row[col]);
          return value.padEnd(_widths[col]!);
        });
        console.log(values.join(' | '));
      });
      break;
    }
  }
}