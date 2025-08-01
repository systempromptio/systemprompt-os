/**
 * HTTP Protocol Types.
 */

export interface HttpEndpoint {
  moduleId: string;
  protocol: 'http';
  method: string;
  path: string | RegExp;
  handler: string;
  auth?: {
    required: boolean;
    roles?: string[];
    scopes?: string[];
    sessionBased?: boolean;
    strategy?: string;
  };
  rateLimit?: {
    window: number;
    max: number;
  };
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
  timeout?: number;
  streaming?: boolean;
  description?: string;
}

export interface HttpRequestContext {
  endpoint: HttpEndpoint;
  request: any; // Express Request
  response: any; // Express Response
  startTime: number;
}
