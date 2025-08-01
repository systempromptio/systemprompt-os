/**
 * Module Integration Types.
 */

export interface EndpointDefinition {
  protocol: string;
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

export interface ModuleRequest {
  requestId: string;
  method: string;
  path: string;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, string>;
  body: any;
  auth?: {
    authenticated: boolean;
    userId?: string;
    scopes?: string[];
    sessionId?: string;
  };
  moduleId?: string;
  handler?: string;
  [key: string]: any;
}

export interface ModuleResponse {
  data?: any;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
    details?: any;
  };
  streaming?: boolean;
}

export interface MiddlewareEvent {
  phase: 'extract' | 'validate' | 'authorize';
  request: ModuleRequest;
  endpoint?: EndpointDefinition;
  token?: string;
  auth?: any;
  continue: () => void;
  reject: (statusCode: number, message: string) => void;
}
