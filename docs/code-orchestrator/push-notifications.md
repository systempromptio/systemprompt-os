# Push Notifications

## Overview

Push Notifications provide real-time updates from your SystemPrompt Coding Agent to your mobile device. Get instant alerts when tasks complete, fail, or need attention - even when the app is closed.

## Architecture

```
MCP Server → Firebase Cloud Messaging → Mobile Device
     │              │                         │
  Trigger       Route & Queue            Display Alert
  Events        Notifications            Update Badge
```

## Features

### Real-Time Updates
- **Task Status Changes** - Started, completed, failed
- **Agent Progress** - Milestones and important events
- **System Alerts** - Errors, warnings, critical events
- **Custom Notifications** - Test and debug messages

### Rich Notifications
- **Title & Body** - Clear, informative messages
- **Data Payload** - Additional context and metadata
- **Sound & Vibration** - Configurable alerts
- **Badge Updates** - iOS app icon badges

## Setup Guide

### 1. Get Your Push Token

**From Mobile App:**
1. Open SystemPrompt mobile app
2. Navigate to Settings → Developer
3. Find "Push Token" section
4. Copy the token value

**Token Format:**
```
fcm:ABC123...xyz789
```

### 2. Configure Environment

Add to `.env` file:
```bash
# Required
PUSH_TOKEN=your_push_token_here

# Optional (for future FCM integration)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
```

### 3. Test Notifications

```bash
# Send default test notification
npm run send-push

# Custom message
npm run send-push "Task Complete" "Authentication module finished"

# With special characters
npm run send-push "🎉 Success" "All tests passed!"
```

## Notification Types

### Task Notifications

#### Task Started
```json
{
  "title": "Task Started",
  "body": "Implementing authentication module",
  "data": {
    "type": "task_started",
    "taskId": "task_123",
    "tool": "CLAUDECODE"
  }
}
```

#### Task Completed
```json
{
  "title": "✅ Task Complete",
  "body": "Authentication module implemented successfully",
  "data": {
    "type": "task_completed",
    "taskId": "task_123",
    "duration": "15m 32s"
  }
}
```

#### Task Failed
```json
{
  "title": "❌ Task Failed",
  "body": "Error implementing authentication",
  "data": {
    "type": "task_failed",
    "taskId": "task_123",
    "error": "Test failures"
  }
}
```

### Agent Notifications

#### Progress Updates
```json
{
  "title": "Claude Progress",
  "body": "Created auth middleware (50% complete)",
  "data": {
    "type": "agent_progress",
    "sessionId": "session_456",
    "progress": 50
  }
}
```

#### Tool Usage
```json
{
  "title": "Tool Activity",
  "body": "Running tests on auth module",
  "data": {
    "type": "tool_usage",
    "tool": "bash",
    "command": "npm test"
  }
}
```

### System Notifications

#### Warnings
```json
{
  "title": "⚠️ Warning",
  "body": "High memory usage detected",
  "data": {
    "type": "system_warning",
    "metric": "memory",
    "value": "85%"
  }
}
```

#### Errors
```json
{
  "title": "🚨 System Error",
  "body": "Agent session crashed unexpectedly",
  "data": {
    "type": "system_error",
    "component": "agent_manager",
    "severity": "high"
  }
}
```

## Implementation

### Sending Notifications

From within the MCP server:

```typescript
import { sendPushNotification } from './services/push-notifications.js';

// Send task completion notification
await sendPushNotification({
  title: 'Task Complete',
  body: `Task "${task.description}" finished successfully`,
  data: {
    type: 'task_completed',
    taskId: task.id,
    duration: calculateDuration(task)
  }
});
```

### Notification Service

```typescript
class PushNotificationService {
  private fcmToken: string;
  
  async send(notification: PushNotification): Promise<void> {
    // Validate token exists
    if (!this.fcmToken) {
      throw new Error('Push token not configured');
    }
    
    // Build FCM payload
    const payload = {
      message: {
        token: this.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default'
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
    
    // Send via FCM
    await this.sendToFCM(payload);
  }
}
```

## Mobile App Integration

### Handling Notifications

The SystemPrompt mobile app processes notifications:

1. **Foreground** - Shows in-app banner
2. **Background** - System notification
3. **Closed** - Wakes app if permitted

### Deep Linking

Tapping notifications can navigate to:
- Specific task details
- Active session view
- Error logs
- System status

### Notification Actions

iOS/Android support actions:
- **View** - Open task details
- **Dismiss** - Clear notification
- **Stop** - Cancel active task

## Configuration Options

### Notification Preferences

Configure in mobile app:
- Enable/disable by type
- Quiet hours
- Sound preferences
- Vibration patterns

### Server-Side Filtering

Control which events trigger notifications:

```typescript
const NOTIFICATION_RULES = {
  task_completed: true,
  task_failed: true,
  task_started: false,  // Too noisy
  agent_progress: (progress) => progress % 25 === 0,  // Every 25%
  system_error: true,
  system_warning: (severity) => severity === 'high'
};
```

## Testing & Debugging

### Test Script

The included test script helps debug:

```bash
# Show help
npm run send-push -- --help

# Test with defaults
npm run send-push

# Custom notification
npm run send-push "Debug" "Testing push system"
```

### Payload Inspection

Script shows the payload without sending:
```json
{
  "message": {
    "token": "fcm:ABC123...",
    "notification": {
      "title": "Test",
      "body": "Message"
    },
    "data": {
      "type": "test",
      "timestamp": "2024-01-01T10:00:00Z"
    }
  }
}
```

### Troubleshooting

#### Token Issues
- **Invalid Token** - Get fresh token from app
- **Token Expired** - App generates new on launch
- **Wrong Format** - Must start with "fcm:"

#### Delivery Issues
- **Not Receiving** - Check app permissions
- **Delayed** - Network or FCM delays
- **No Sound** - Check device settings

#### Debug Steps
1. Verify token in `.env`
2. Test with script
3. Check mobile app settings
4. Review server logs
5. Inspect FCM console

## Security Considerations

### Token Security
- **Treat as Secret** - Don't commit tokens
- **Rotate Regularly** - Tokens can expire
- **User-Specific** - Each device unique
- **Revocable** - Can invalidate remotely

### Data Privacy
- **Minimal Data** - Only send necessary info
- **No Secrets** - Don't include API keys
- **Encryption** - FCM handles transport
- **Retention** - Notifications expire

### Best Practices
1. Validate tokens before use
2. Handle delivery failures
3. Rate limit notifications
4. Log notification events
5. Monitor delivery rates

## Future Enhancements

### Planned Features

1. **Firebase Admin SDK**
   - Direct FCM integration
   - Batch notifications
   - Topic subscriptions
   - Analytics

2. **Notification Center**
   - History view in app
   - Mark as read
   - Bulk actions
   - Search/filter

3. **Smart Notifications**
   - ML-based importance
   - Bundling similar events
   - Predictive alerts
   - Custom schedules

4. **Multi-Device Support**
   - Send to all devices
   - Device management
   - Selective routing
   - Cross-platform sync

## API Reference

### Notification Object

```typescript
interface PushNotification {
  title: string;              // Max 200 chars
  body: string;               // Max 4000 chars
  data?: Record<string, string>;  // String values only
  priority?: 'high' | 'normal';
  badge?: number;             // iOS only
  sound?: string | boolean;   // Custom or default
  channelId?: string;         // Android only
}
```

### Service Methods

```typescript
// Send single notification
sendNotification(notification: PushNotification): Promise<void>

// Send to multiple tokens
sendMulticast(tokens: string[], notification: PushNotification): Promise<void>

// Subscribe to topic
subscribeToTopic(token: string, topic: string): Promise<void>

// Send to topic
sendToTopic(topic: string, notification: PushNotification): Promise<void>
```