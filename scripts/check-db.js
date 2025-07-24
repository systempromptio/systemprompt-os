const Database = require('better-sqlite3');
const db = new Database('./state/database.db', { readonly: true });

console.log('\n=== Modules Table ===');
const modules = db.prepare('SELECT name, path, enabled FROM modules').all();
console.log(modules);

console.log('\n=== CLI Commands Table ===');
const commands = db.prepare('SELECT * FROM cli_commands LIMIT 10').all();
console.log(commands);

db.close();