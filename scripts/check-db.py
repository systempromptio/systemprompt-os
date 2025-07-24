#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('./state/database.db')
cursor = conn.cursor()

print('\n=== Modules Table ===')
cursor.execute('SELECT name, path, enabled FROM modules')
modules = cursor.fetchall()
for module in modules:
    print(f"Module: {module[0]}, Path: {module[1]}, Enabled: {module[2]}")

print('\n=== CLI Commands Table ===')
cursor.execute('SELECT module_name, command_name, command_path FROM cli_commands LIMIT 10')
commands = cursor.fetchall()
for cmd in commands:
    print(f"Module: {cmd[0]}, Command: {cmd[1]}, Path: {cmd[2]}")

conn.close()