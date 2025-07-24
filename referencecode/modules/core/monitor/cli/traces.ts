#!/usr/bin/env node
/**
 * @fileoverview View traces command
 * @module modules/core/monitor/cli
 */

import { getModuleLoader } from '../../../loader.js';

export const command = {
  name: 'traces',
  description: 'View distributed traces',
  options: [
    {
      name: 'trace-id',
      alias: 't',
      type: 'string',
      description: 'View specific trace by ID'
    },
    {
      name: 'limit',
      alias: 'n',
      type: 'number',
      description: 'Number of traces to show',
      default: 20
    },
    {
      name: 'errors',
      alias: 'e',
      type: 'boolean',
      description: 'Show only error traces'
    },
    {
      name: 'service',
      alias: 's',
      type: 'string',
      description: 'Filter by service name'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      default: 'table',
      choices: ['json', 'yaml', 'table']
    }
  ],
  async execute(context: any) {
    try {
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      const monitorModule = moduleLoader.getModule('monitor');
      if (!monitorModule?.exports?.MonitorService) {
        throw new Error('Monitor module not available');
      }

      const service = monitorModule.exports.MonitorService;

      if (context.options['trace-id']) {
        // Get specific trace
        const spans = await service.getTrace(context.options['trace-id']);
        
        if (context.options.format === 'json') {
          console.log(JSON.stringify(spans, null, 2));
        } else if (context.options.format === 'yaml') {
          console.log(`trace_id: ${context.options['trace-id']}`);
          console.log('spans:');
          spans.forEach((span: any) => {
            console.log(`  - span_id: ${span.span_id}`);
            console.log(`    operation: ${span.operation_name}`);
            console.log(`    service: ${span.service_name}`);
            console.log(`    duration: ${span.duration}ms`);
            console.log(`    status: ${span.status}`);
            if (span.parent_span_id) {
              console.log(`    parent: ${span.parent_span_id}`);
            }
          });
        } else {
          // Table format - show trace tree
          console.log(`Trace ID: ${context.options['trace-id']}\n`);
          
          if (spans.length === 0) {
            console.log('No spans found for this trace');
            return;
          }

          // Build span tree
          const rootSpans = spans.filter((s: any) => !s.parent_span_id);
          
          function printSpan(span: any, indent: number = 0) {
            const prefix = '  '.repeat(indent) + (indent > 0 ? '└─ ' : '');
            const duration = span.duration ? `${span.duration}ms` : 'pending';
            const status = span.status === 'error' ? '✗' : '✓';
            
            console.log(`${prefix}${status} ${span.operation_name} (${span.service_name}) - ${duration}`);
            
            // Print child spans
            spans.filter((s: any) => s.parent_span_id === span.span_id)
              .forEach((child: any) => printSpan(child, indent + 1));
          }
          
          rootSpans.forEach((span: any) => printSpan(span));
        }
      } else {
        // List recent traces
        let traces = await service.getTraces(context.options.limit);
        
        // Apply filters
        if (context.options.errors) {
          traces = traces.filter((t: any) => t.status === 'error');
        }
        if (context.options.service) {
          traces = traces.filter((t: any) => t.service_name === context.options.service);
        }

        if (context.options.format === 'json') {
          console.log(JSON.stringify(traces, null, 2));
        } else if (context.options.format === 'yaml') {
          console.log('traces:');
          traces.forEach((trace: any) => {
            console.log(`  - trace_id: ${trace.trace_id}`);
            console.log(`    operation: ${trace.operation_name}`);
            console.log(`    service: ${trace.service_name}`);
            console.log(`    duration: ${trace.duration}ms`);
            console.log(`    status: ${trace.status}`);
            console.log(`    start_time: ${trace.start_time}`);
          });
        } else {
          // Table format
          if (traces.length === 0) {
            console.log('No traces found');
            return;
          }

          console.log('Recent Traces:\n');
          console.log('Trace ID                              | Operation               | Service      | Duration | Status | Start Time');
          console.log('--------------------------------------|-------------------------|--------------|----------|--------|-------------------------');
          
          traces.forEach((trace: any) => {
            const traceId = trace.trace_id.substring(0, 36);
            const operation = trace.operation_name.substring(0, 23).padEnd(23);
            const service = trace.service_name.substring(0, 12).padEnd(12);
            const duration = trace.duration ? `${trace.duration}ms`.padEnd(8) : 'pending '.padEnd(8);
            const status = trace.status.padEnd(6);
            const startTime = new Date(trace.start_time).toLocaleString();
            
            console.log(`${traceId} | ${operation} | ${service} | ${duration} | ${status} | ${startTime}`);
          });

          console.log(`\nTotal: ${traces.length} trace(s)`);
        }
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};