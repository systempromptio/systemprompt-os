/**
 * @fileoverview Admin configuration page template
 * @module server/external/templates/config/admin-config
 */

/**
 * Configuration data for admin page rendering
 */
export interface AdminConfigData {
  cloudflareUrl: string;
  tunnelStatus: string;
  version: string;
  environment: string;
  googleConfigured: boolean;
  githubConfigured: boolean;
}

/**
 * Renders the admin configuration page with full system management options
 */
export function renderAdminConfig(data: AdminConfigData): string {
  return `
    <h1>System Configuration</h1>
    <p class="subtitle">Manage your SystemPrompt OS settings</p>

    <div class="config-section">
      <h2 class="section-header">System Status</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Base URL:</span>
          <span class="status-value">${data.cloudflareUrl}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Tunnel Status:</span>
          <span class="status-value ${data.tunnelStatus === 'Active' ? 'status-active' : 'status-inactive'}">${data.tunnelStatus}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Version:</span>
          <span class="status-value">${data.version}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Environment:</span>
          <span class="status-value">${data.environment}</span>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h2 class="section-header">Administration</h2>
      <div class="admin-actions">
        <a href="/admin/users" class="admin-button">
          <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
          </svg>
          Manage Users
        </a>
        <a href="/mcp" class="admin-button">
          <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
          </svg>
          MCP Servers
        </a>
      </div>
    </div>

    <div class="config-section">
      <h2 class="section-header">OAuth Providers</h2>
      <div class="provider-status">
        <div class="provider-item">
          <span class="provider-name">Google OAuth</span>
          <span class="provider-status ${data.googleConfigured ? 'configured' : 'not-configured'}">
            ${data.googleConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        <div class="provider-item">
          <span class="provider-name">GitHub OAuth</span>
          <span class="provider-status ${data.githubConfigured ? 'configured' : 'not-configured'}">
            ${data.githubConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/docs">Documentation</a> • 
        <a href="/health">Health Check</a> • 
        <a href="/logout">Logout</a>
      </p>
    </div>
  `;
}

/**
 * Returns CSS styles specific to the admin configuration page
 */
export function getAdminConfigStyles(): string {
  return `
    .config-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-header {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #f1f5f9;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .status-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .status-label {
      font-size: 14px;
      color: #9ca3af;
      font-weight: 500;
    }
    .status-value {
      font-size: 16px;
      color: #e2e8f0;
    }
    .status-active {
      color: #10b981;
    }
    .status-inactive {
      color: #ef4444;
    }
    .admin-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .admin-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }
    .admin-button:hover {
      background: #334155;
      border-color: #475569;
      transform: translateY(-1px);
    }
    .button-icon {
      width: 20px;
      height: 20px;
    }
    .provider-status {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .provider-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #1e293b;
      border-radius: 6px;
    }
    .provider-name {
      font-weight: 500;
      color: #e2e8f0;
    }
    .provider-status {
      font-size: 14px;
      font-weight: 500;
    }
    .configured {
      color: #10b981;
    }
    .not-configured {
      color: #ef4444;
    }
  `;
}