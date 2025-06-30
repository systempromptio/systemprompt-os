/**
 * @file Test Reporter for E2E Tests
 * @module test-reporter
 * 
 * @remarks
 * Provides comprehensive test reporting with HTML and Markdown output
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface TestEvent {
  timestamp: Date;
  type: string;
  message: string;
  data?: any;
}

interface TestRun {
  name: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  status?: 'success' | 'failed' | 'timeout';
  events: TestEvent[];
  metadata: Record<string, any>;
  summary?: {
    duration: number;
    totalLogs: number;
    errors: number;
    resourceUpdates: number;
  };
}

export class TestReporter {
  private tests: Map<string, TestRun> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  startTest(name: string, taskId: string, metadata: Record<string, any> = {}): void {
    this.tests.set(taskId, {
      name,
      taskId,
      startTime: new Date(),
      events: [],
      metadata
    });
  }

  addLog(taskId: string, message: string, type: string = 'LOG'): void {
    const test = this.tests.get(taskId);
    if (!test) return;

    test.events.push({
      timestamp: new Date(),
      type,
      message
    });
  }

  addNotification(taskId: string, type: string, data: any): void {
    const test = this.tests.get(taskId);
    if (!test) return;

    test.events.push({
      timestamp: new Date(),
      type: `NOTIFICATION_${type}`,
      message: `Received ${type} notification`,
      data
    });
  }

  async completeTest(taskId: string, summary: Partial<TestRun['summary']>): Promise<void> {
    const test = this.tests.get(taskId);
    if (!test) return;

    test.endTime = new Date();
    test.status = summary.errors && summary.errors > 0 ? 'failed' : 'success';
    test.summary = {
      duration: test.endTime.getTime() - test.startTime.getTime(),
      totalLogs: test.events.filter(e => e.type === 'TASK_LOG').length,
      errors: 0,
      resourceUpdates: test.events.filter(e => e.type.startsWith('NOTIFICATION_')).length,
      ...summary
    };
  }

  printSummary(): void {
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    for (const test of this.tests.values()) {
      console.log(`\n${test.name}:`);
      console.log(`  Status: ${test.status || 'running'}`);
      if (test.summary) {
        console.log(`  Duration: ${test.summary.duration}ms`);
        console.log(`  Total Logs: ${test.summary.totalLogs}`);
        console.log(`  Resource Updates: ${test.summary.resourceUpdates}`);
        console.log(`  Errors: ${test.summary.errors}`);
      }
    }
  }

  async saveReports(outputDir: string): Promise<{ html: string; markdown: string }> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const htmlPath = path.join(outputDir, `report-${timestamp}.html`);
    const mdPath = path.join(outputDir, `report-${timestamp}.md`);

    const htmlContent = this.generateHTML();
    const mdContent = this.generateMarkdown();

    await fs.writeFile(htmlPath, htmlContent);
    await fs.writeFile(mdPath, mdContent);

    return { html: htmlPath, markdown: mdPath };
  }

  private generateHTML(): string {
    const tests = Array.from(this.tests.values());
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
        .success { background-color: #e7f5e7; }
        .failed { background-color: #ffe7e7; }
        .event { margin: 5px 0; padding: 5px; background: #f5f5f5; }
        .notification { background: #e7e7ff; }
        pre { background: #f0f0f0; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>E2E Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    ${tests.map(test => `
        <div class="test ${test.status || ''}">
            <h2>${test.name}</h2>
            <p><strong>Task ID:</strong> ${test.taskId}</p>
            <p><strong>Status:</strong> ${test.status || 'running'}</p>
            ${test.summary ? `
                <p><strong>Duration:</strong> ${test.summary.duration}ms</p>
                <p><strong>Logs:</strong> ${test.summary.totalLogs}</p>
                <p><strong>Resource Updates:</strong> ${test.summary.resourceUpdates}</p>
            ` : ''}
            
            <h3>Events</h3>
            ${test.events.map(event => `
                <div class="event ${event.type.includes('NOTIFICATION') ? 'notification' : ''}">
                    <strong>${event.timestamp.toISOString()}</strong> [${event.type}] ${event.message}
                    ${event.data ? `<pre>${JSON.stringify(event.data, null, 2)}</pre>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;
  }

  private generateMarkdown(): string {
    const tests = Array.from(this.tests.values());
    
    return `# E2E Test Report

Generated: ${new Date().toISOString()}

${tests.map(test => `
## ${test.name}

- **Task ID:** ${test.taskId}
- **Status:** ${test.status || 'running'}
${test.summary ? `- **Duration:** ${test.summary.duration}ms
- **Total Logs:** ${test.summary.totalLogs}
- **Resource Updates:** ${test.summary.resourceUpdates}
- **Errors:** ${test.summary.errors}` : ''}

### Events

${test.events.map(event => `
**${event.timestamp.toISOString()}** [${event.type}] ${event.message}
${event.data ? `\n\`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\`` : ''}
`).join('\n')}
`).join('\n')}`;
  }
}