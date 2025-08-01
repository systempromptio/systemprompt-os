# WebSocket Protocol Handler Rules

## Overview

The WebSocket protocol handler enables real-time, bidirectional communication between the server and clients. It's designed for future use cases like live updates, collaborative features, and streaming data.

## Planned Use Cases

1. **Real-time Updates**
   - Module status changes
   - Task progress updates
   - Log streaming
   - System notifications

2. **Collaborative Features**
   - Multiple users working together
   - Shared terminal sessions
   - Live configuration updates

3. **Streaming Data**
   - Continuous monitoring data
   - Real-time metrics
   - Event streams

## Architecture

```typescript
export class WebSocketProtocol implements IProtocolHandler {
  private wss: WebSocketServer;
  private connections: Map<string, IWebSocketConnection>;
  private rooms: Map<string, Set<string>>;
  
  async initialize(serverCore: IServerCore): Promise<void> {
    this.setupWebSocketServer();
    this.listenForBroadcasts(serverCore.eventBus);
  }
}
```

## Connection Management

```typescript
interface IWebSocketConnection {
  id: string;
  ws: WebSocket;
  user?: IUser;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

private handleConnection(ws: WebSocket, request: IncomingMessage) {
  const connection: IWebSocketConnection = {
    id: generateConnectionId(),
    ws,
    subscriptions: new Set(),
    metadata: {}
  };
  
  // Authenticate if token provided
  this.authenticateConnection(connection, request);
  
  // Setup handlers
  ws.on('message', (data) => this.handleMessage(connection, data));
  ws.on('close', () => this.handleDisconnect(connection));
  ws.on('error', (error) => this.handleError(connection, error));
  
  this.connections.set(connection.id, connection);
}
```

## Message Protocol

### Message Format
```typescript
interface IWebSocketMessage {
  id: string;          // Message ID for request/response matching
  type: MessageType;   // 'request' | 'response' | 'event' | 'error'
  action: string;      // Action to perform or event name
  payload?: any;       // Message data
  metadata?: {
    timestamp: number;
    version: string;
  };
}
```

### Request/Response Pattern
```typescript
private async handleMessage(connection: IWebSocketConnection, data: Buffer) {
  try {
    const message = JSON.parse(data.toString()) as IWebSocketMessage;
    
    if (message.type === 'request') {
      const response = await this.handleRequest(connection, message);
      
      connection.ws.send(JSON.stringify({
        id: message.id,
        type: 'response',
        action: message.action,
        payload: response,
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0'
        }
      }));
    }
  } catch (error) {
    this.sendError(connection, error, message?.id);
  }
}
```

## Subscription Model

### Topic Subscription
```typescript
private async handleSubscribe(
  connection: IWebSocketConnection,
  topic: string
) {
  // Check permissions
  const canSubscribe = await this.eventBus.emitAndWait(
    'auth.check.permission',
    {
      user: connection.user,
      resource: topic,
      action: 'subscribe'
    }
  );
  
  if (!canSubscribe) {
    throw new Error('Permission denied');
  }
  
  // Add to subscription
  connection.subscriptions.add(topic);
  
  // Join room for efficient broadcasting
  this.joinRoom(connection.id, topic);
}
```

### Broadcasting
```typescript
// Module emits broadcast event
eventBus.emit(ServerEvents.BROADCAST, {
  topic: 'tasks.update',
  data: {
    taskId: '123',
    status: 'completed'
  },
  filter: {
    roles: ['user', 'admin']
  }
});

// WebSocket handler broadcasts to subscribers
private handleBroadcast(event: IBroadcastEvent) {
  const connections = this.getConnectionsForTopic(event.topic);
  
  const message: IWebSocketMessage = {
    id: generateId(),
    type: 'event',
    action: event.topic,
    payload: event.data,
    metadata: {
      timestamp: Date.now(),
      version: '1.0.0'
    }
  };
  
  connections.forEach(connection => {
    if (this.matchesFilter(connection, event.filter)) {
      connection.ws.send(JSON.stringify(message));
    }
  });
}
```

## Room Management

Rooms enable efficient message broadcasting:

```typescript
private joinRoom(connectionId: string, room: string) {
  if (!this.rooms.has(room)) {
    this.rooms.set(room, new Set());
  }
  this.rooms.get(room)!.add(connectionId);
}

private leaveRoom(connectionId: string, room: string) {
  this.rooms.get(room)?.delete(connectionId);
  
  // Clean up empty rooms
  if (this.rooms.get(room)?.size === 0) {
    this.rooms.delete(room);
  }
}

private broadcastToRoom(room: string, message: IWebSocketMessage) {
  const connectionIds = this.rooms.get(room) || new Set();
  
  connectionIds.forEach(id => {
    const connection = this.connections.get(id);
    if (connection?.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  });
}
```

## Authentication

```typescript
private async authenticateConnection(
  connection: IWebSocketConnection,
  request: IncomingMessage
) {
  // Extract token from query params or headers
  const token = this.extractToken(request);
  
  if (token) {
    try {
      const auth = await this.eventBus.emitAndWait(
        'auth.validate',
        { token },
        { timeout: 5000 }
      );
      
      connection.user = auth.user;
    } catch (error) {
      // Connection allowed but not authenticated
      connection.user = undefined;
    }
  }
}
```

## Error Handling

```typescript
private sendError(
  connection: IWebSocketConnection,
  error: any,
  requestId?: string
) {
  const errorMessage: IWebSocketMessage = {
    id: requestId || generateId(),
    type: 'error',
    action: 'error',
    payload: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An error occurred',
      details: error.expose ? error.details : undefined
    },
    metadata: {
      timestamp: Date.now(),
      version: '1.0.0'
    }
  };
  
  if (connection.ws.readyState === WebSocket.OPEN) {
    connection.ws.send(JSON.stringify(errorMessage));
  }
}
```

## Health and Monitoring

```typescript
private getHealth(): HealthStatus {
  return {
    healthy: this.wss !== undefined,
    connections: this.connections.size,
    rooms: this.rooms.size,
    details: {
      subscriptions: Array.from(this.connections.values())
        .reduce((sum, conn) => sum + conn.subscriptions.size, 0)
    }
  };
}
```

## Rules

1. **Message Validation**
   - Validate all incoming messages
   - Enforce size limits
   - Sanitize payloads

2. **Connection Limits**
   - Limit connections per user
   - Implement rate limiting
   - Clean up inactive connections

3. **Error Isolation**
   - Connection errors don't affect others
   - Graceful error messages
   - No internal details exposed

4. **Performance**
   - Use rooms for efficient broadcasting
   - Implement message batching
   - Binary support for large data

5. **Security**
   - Authenticate connections
   - Authorize subscriptions
   - Encrypt sensitive data

## Future Enhancements

1. **Binary Protocol**
   - Support for binary frames
   - Efficient data serialization
   - Compression support

2. **Presence System**
   - Track user presence
   - "Who's online" features
   - Collaborative cursors

3. **Message History**
   - Replay missed messages
   - Persistent subscriptions
   - Offline support

4. **Scaling**
   - Redis pub/sub for multi-server
   - Sticky sessions
   - Connection migration

## Testing

### Unit Tests
- Connection handling
- Message parsing
- Room management
- Error scenarios

### Integration Tests
- Full connection lifecycle
- Authentication flow
- Broadcasting system
- Subscription management

### Load Tests
- Many concurrent connections
- High message throughput
- Memory usage
- CPU usage