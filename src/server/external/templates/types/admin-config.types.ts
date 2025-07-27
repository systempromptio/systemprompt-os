/**
 * Configuration data for admin page rendering.
 * Contains system status, OAuth provider states, and version information.
 */
export interface IAdminConfigData {
    cloudflareUrl: string;
    tunnelStatus: string;
    version: string;
    environment: string;
    googleConfigured: boolean;
    githubConfigured: boolean;
}
