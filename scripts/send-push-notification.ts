#!/usr/bin/env node
/**
 * @file Send push notification test script
 * @module scripts/send-push-notification
 * 
 * @remarks
 * This script sends a test push notification to a device using Firebase Cloud Messaging.
 * It reads the push token from the .env file and sends a notification with customizable content.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Firebase configuration
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'your-project-id';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'your-api-key';
const PUSH_TOKEN = process.env.PUSH_TOKEN;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message: string): void {
  log(`❌ ${message}`, colors.red);
}

function success(message: string): void {
  log(`✅ ${message}`, colors.green);
}

function info(message: string): void {
  log(`ℹ️  ${message}`, colors.blue);
}

async function sendPushNotification() {
  // Check if push token is available
  if (!PUSH_TOKEN) {
    error('No PUSH_TOKEN found in .env file');
    info('To get your push token:');
    info('1. Open the SystemPrompt mobile app');
    info('2. Go to Settings > Developer');
    info('3. Copy your push token');
    info('4. Add it to .env: PUSH_TOKEN=your_token_here');
    process.exit(1);
  }

  info(`Using push token: ${PUSH_TOKEN.substring(0, 20)}...`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const title = args[0] || 'SystemPrompt Test';
  const body = args[1] || 'This is a test notification from your MCP server';
  const data = {
    type: 'test',
    timestamp: new Date().toISOString(),
    source: 'send-push-notification.ts'
  };

  // Notification payload
  const payload = {
    message: {
      token: PUSH_TOKEN,
      notification: {
        title,
        body
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    }
  };

  try {
    info('Sending push notification...');
    
    // Note: In a real implementation, you would use Firebase Admin SDK
    // or make an authenticated request to FCM API
    // For now, we'll show the payload that would be sent
    
    console.log('\nNotification payload:');
    console.log(JSON.stringify(payload, null, 2));
    
    // TODO: Implement actual FCM API call
    // const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${accessToken}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(payload)
    // });

    info('\nTo send this notification:');
    info('1. Set up Firebase Admin SDK credentials');
    info('2. Implement the FCM API call');
    info('3. Or use the mobile app\'s built-in notification testing');
    
    success('\nNotification payload created successfully!');
    
  } catch (err) {
    error(`Failed to send notification: ${err}`);
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run send-push [title] [body]

Examples:
  npm run send-push
  npm run send-push "Task Complete" "Your coding task has finished successfully"
  npm run send-push "Alert" "Agent needs your attention"

Environment variables:
  PUSH_TOKEN     - Your device's FCM push token (required)
  FIREBASE_PROJECT_ID - Firebase project ID
  FIREBASE_API_KEY    - Firebase API key
`);
  process.exit(0);
}

// Run the script
sendPushNotification().catch(err => {
  error(`Unhandled error: ${err}`);
  process.exit(1);
});