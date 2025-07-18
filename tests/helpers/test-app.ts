import { createApp } from '../../src/server/index.js';
import request, { SuperTest, Test } from 'supertest';
import type { Express } from 'express';

export class TestApp {
  private app: Express;
  public api: SuperTest<Test>;
  private emailsSent: Array<{ to: string; subject: string; body: string }> = [];

  private constructor(app: Express) {
    this.app = app;
    this.api = request(app);
    this.setupEmailInterception();
  }

  static async create(): Promise<TestApp> {
    const app = await createApp();
    return new TestApp(app);
  }

  private setupEmailInterception() {
    // Mock email sending in test environment
    if (process.env.NODE_ENV === 'test') {
      const originalSend = (global as any).sendEmail;
      (global as any).sendEmail = async (email: any) => {
        this.emailsSent.push(email);
        return { success: true, messageId: `test-${Date.now()}` };
      };
    }
  }

  async cleanup() {
    this.emailsSent = [];
    // Add any other cleanup logic here
  }

  getEmailsSent() {
    return [...this.emailsSent];
  }

  clearEmails() {
    this.emailsSent = [];
  }

  async waitForEmail(
    predicate: (email: any) => boolean,
    timeout = 5000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const email = this.emailsSent.find(predicate);
      if (email) return email;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for email');
  }
}