#!/usr/bin/env node
import { HostProxyClient } from './build/services/claude-code/host-proxy-client.js';
import { ClaudeEvent } from './build/types/claude-events.js';
import { writeFileSync } from 'fs';

// When running on host, use 127.0.0.1 instead of host.docker.internal
const client = new HostProxyClient({
  host: '127.0.0.1',
  port: parseInt(process.env.CLAUDE_PROXY_PORT || '9886', 10)
});

const events: ClaudeEvent[] = [];

console.log('Testing Claude event capture...\n');
console.log('Connecting to 127.0.0.1:' + (process.env.CLAUDE_PROXY_PORT || '9886'));

client.execute(
  'Create a simple hello.txt file with the content "Hello from Claude!"',
  '/var/www/html/systemprompt-coding-agent',
  (data) => {
    console.log('Stream:', data.trim());
  },
  {},
  'test-session-123',
  'test-task-456',
  (event) => {
    console.log('\n=== Event received ===');
    console.log('Type:', event.type);
    console.log('Event:', JSON.stringify(event, null, 2));
    events.push(event);
  }
).then(result => {
  console.log('\n=== Final Result ===');
  console.log('Success:', result.success);
  console.log('Has output:', !!result.output);
  console.log('Output length:', result.output?.length || 0);
  console.log('Duration:', result.duration, 'ms');
  console.log('Error:', result.error);
  
  console.log('\n=== Event Summary ===');
  console.log('Total events captured:', events.length);
  console.log('Event types:', events.map(e => e.type));
  
  // Check specific event types
  const processStart = events.find(e => e.type === 'process:start');
  const processEnd = events.find(e => e.type === 'process:end');
  const toolEvents = events.filter(e => e.type === 'tool:start' || e.type === 'tool:end');
  const messageEvents = events.filter(e => e.type === 'message');
  
  if (processStart) {
    console.log('\n✓ Process start captured');
    console.log('  - PID:', (processStart as any).pid);
    console.log('  - Command:', (processStart as any).command);
  } else {
    console.log('\n❌ No process start event');
  }
  
  if (processEnd) {
    console.log('\n✓ Process end captured');
    console.log('  - Exit code:', (processEnd as any).metadata?.exitCode);
    console.log('  - Has output:', !!(processEnd as any).metadata?.output);
    console.log('  - Output preview:', (processEnd as any).metadata?.output?.substring(0, 100) + '...');
  } else {
    console.log('\n❌ No process end event');
  }
  
  if (toolEvents.length > 0) {
    console.log('\n✓ Tool events captured:', toolEvents.length);
    toolEvents.forEach(event => {
      console.log(`  - ${event.type}: ${(event as any).toolName || (event as any).metadata?.toolName}`);
    });
  } else {
    console.log('\n❌ No tool events');
  }
  
  if (messageEvents.length > 0) {
    console.log('\n✓ Message events captured:', messageEvents.length);
    messageEvents.forEach(event => {
      const content = (event as any).content || (event as any).metadata?.content || '';
      console.log(`  - Message preview: ${content.substring(0, 100)}...`);
    });
  } else {
    console.log('\n❌ No message events');
  }
  
  // Write full output to file for inspection
  writeFileSync('test-event-debug-output.json', JSON.stringify({
    result,
    events,
    summary: {
      totalEvents: events.length,
      eventTypes: events.map(e => e.type),
      hasProcessStart: !!processStart,
      hasProcessEnd: !!processEnd,
      toolEventCount: toolEvents.length,
      messageEventCount: messageEvents.length
    }
  }, null, 2));
  
  console.log('\n✓ Full output written to test-event-debug-output.json');
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});