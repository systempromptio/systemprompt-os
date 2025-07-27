/**
 * Heartbeat status information.
 */
export interface IHeartbeatStatus {
    pid: number;
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    memory: {
        used: number;
        total: number;
  };
    uptime: number;
}

/**
 * Health check response structure.
 */
export interface IHealthResponse {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    service: string;
    version: string;
    heartbeat?: IHeartbeatStatus | null;
    warnings?: string[];
    system: {
        platform: string;
        arch: string;
        nodeVersion: string;
        uptime: number;
        loadAverage: number[];
        memory: {
            total: number;
            free: number;
            used: number;
            percentUsed: number;
    };
        cpu: {
            model: string;
            cores: number;
            speed: number;
    };
        disk?: {
            total: number;
            free: number;
            used: number;
            percentUsed: number;
    };
  };
}
