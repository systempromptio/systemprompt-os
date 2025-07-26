/**
 * Check status arguments interface.
 */
export interface ICheckStatusArgs {
    includeContainers?: boolean;
    includeUsers?: boolean;
    includeResources?: boolean;
    includeTunnels?: boolean;
    includeAuditLog?: boolean;
}

/**
 * CPU information interface.
 */
export interface ICPUInfo {
    model: string;
    cores: number;
    usage: number;
}

/**
 * Memory information interface.
 */
export interface IMemoryInfo {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
}

/**
 * Disk information interface.
 */
export interface IDiskInfo {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
}

/**
 * Resource usage information interface.
 */
export interface IResourceUsage {
    cpu: ICPUInfo;
    memory: IMemoryInfo;
    disk: IDiskInfo;
}

/**
 * MCP service status interface.
 */
export interface IMCPServiceStatus {
    status: string;
    version: string;
    activeSessions: number;
}

/**
 * OAuth service status interface.
 */
export interface IOAuthServiceStatus {
    status: string;
    tunnelActive: boolean;
    providers: string[];
}

/**
 * Docker service status interface.
 */
export interface IDockerServiceStatus {
    status: string;
    version: string;
    containers: number;
}

/**
 * Service status collection interface.
 */
export interface IServiceStatus {
    mcp: IMCPServiceStatus;
    oauth: IOAuthServiceStatus;
    docker?: IDockerServiceStatus;
}

/**
 * Container information interface.
 */
export interface IContainerInfo {
    id: string;
    name: string;
    userId: string;
    status: string;
    created: string;
    tunnelStatus: string;
}

/**
 * User information interface.
 */
export interface IUserInfo {
    id: string;
    email: string;
    name: string;
    roles: string[];
    lastLogin: string;
    isActive: boolean;
    createdAt: string;
    activeContainers: number;
}

/**
 * Tunnel information interface.
 */
export interface ITunnelInfo {
    id: string;
    name: string;
    status: string;
    hostname: string;
    created: string;
}

/**
 * Audit log entry interface.
 */
export interface IAuditLogEntry {
    timestamp: string;
    userId: string;
    action: string;
    resource: string;
    result: string;
}

/**
 * User status database row interface.
 */
export interface IUserStatusRow {
    id: string;
    email: string;
    name?: string;
    roles?: string;
    last_login_at?: string;
    is_active: number;
    created_at: string;
}

/**
 * System status response interface.
 */
export interface ISystemStatus {
    timestamp: string;
    uptime: number;
    platform: string;
    resources: IResourceUsage;
    services: IServiceStatus;
    containers?: IContainerInfo[];
    users?: IUserInfo[];
    tunnels?: ITunnelInfo[];
    auditLog?: IAuditLogEntry[];
}
