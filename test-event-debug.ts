#!/usr/bin/env node
import { HostProxyClient } from './build/services/claude-code/host-proxy-client.js';
import { ClaudeEvent } from './build/types/claude-events.js';

const client = new HostProxyClient();
const events: ClaudeEvent[] = [];

console.log('Testing Claude event capture...\n');

client.execute(
  'echo "Hello from Claude"',
  '/var/www/html/systemprompt-coding-agent',
  (data) => {
    console.log('Stream:', data.trim());
  },
  {},
  'test-session-123',
  'test-task-456',
  (event) => {
    console.log('Event received:', event);
    events.push(event);
  }
).then(result => {
  console.log('\nResult:', result);
  console.log('\nTotal events captured:', events.length);
  console.log('\nEvent types:', events.map(e => e.type));
  
  const processStart = events.find(e => e.type === 'process:start');
  const processEnd = events.find(e => e.type === 'process:end');
  
  if (processStart) {
    console.log('\n✓ Process start captured:', processStart);
  } else {
    console.log('\n❌ No process start event');
  }
  
  if (processEnd) {
    console.log('\n✓ Process end captured');
    console.log('  - Exit code:', processEnd.metadata?.exitCode);
    console.log('  - Has output:', !!processEnd.metadata?.output);
  } else {
    console.log('\n❌ No process end event');
  }
}).catch(err => {
  console.error('Error:', err);
});