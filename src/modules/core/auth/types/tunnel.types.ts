/**
 * TunnelConfig interface.
 * Configuration options for the OAuth tunnel service.
 */
export interface ITunnelConfig {
  port: number;
  permanentDomain?: string;
  tunnelToken?: string;
  tunnelUrl?: string;
  enableInDevelopment?: boolean;
}

/**
 * TunnelStatus interface.
 * Current status of the tunnel service.
 */
export interface ITunnelStatus {
  active: boolean;
  url?: string | undefined;
  type: 'cloudflared' | 'permanent' | 'none';
  error?: string | undefined;
}

/**
 * Tunnel logger interface.
 * Logger interface for tunnel service operations.
 */
export interface ITunnelLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Tunnel ready event data.
 * Event data emitted when the tunnel is established.
 */
export interface ITunnelReadyEvent {
  url: string | undefined;
  type: 'cloudflared' | 'permanent' | 'none';
  timestamp: string;
}

/**
 * OAuth update event data.
 * Event data emitted when OAuth configuration is updated.
 */
export interface IOAuthUpdateEvent {
  baseUrl: string;
  redirectUri: string;
}
