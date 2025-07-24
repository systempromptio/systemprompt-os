/**
 * Configuration data for status page rendering.
 */
export interface StatusPageData {
  cloudflareUrl: string;
  tunnelStatus: string;
}

/**
 * Renders the status page for non-admin users with limited system information.
 * @param data
 */
export function renderStatusPage(data: StatusPageData): string {
  return `
    <h1>System Status</h1>
    
    <div class="status-box">
      <div class="status-icon-large">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      </div>
      <h2 class="status-message">System Operational</h2>
      <p class="status-description">All services are running normally</p>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <label class="info-label">Public URL</label>
        <div class="info-value">${data.cloudflareUrl}</div>
      </div>
      <div class="info-item">
        <label class="info-label">Tunnel Status</label>
        <div class="info-value">
          <span class="status-badge ${data.tunnelStatus === 'Active' ? 'badge-active' : 'badge-inactive'}">
            ${data.tunnelStatus}
          </span>
        </div>
      </div>
    </div>

    <div class="access-notice">
      <svg class="notice-icon" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
      </svg>
      <p>You need administrator privileges to access system configuration.</p>
    </div>

    <div class="footer">
      <p>
        <a href="/">Home</a> • 
        <a href="/health">Health Check</a>
      </p>
    </div>
  `;
}

/**
 * Returns CSS styles specific to the status page.
 */
export function getStatusPageStyles(): string {
  return `
    .status-box {
      text-align: center;
      margin: 40px 0;
    }
    .status-icon-large {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.1);
      margin-bottom: 20px;
    }
    .status-icon-large svg {
      width: 48px;
      height: 48px;
      color: #10b981;
    }
    .status-message {
      font-size: 28px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    .status-description {
      font-size: 16px;
      color: #9ca3af;
    }
    .info-grid {
      display: grid;
      gap: 24px;
      margin: 40px 0;
    }
    .info-item {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 20px;
    }
    .info-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .info-value {
      font-size: 18px;
      color: #e2e8f0;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
    }
    .badge-active {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    .badge-inactive {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .access-notice {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 32px 0;
    }
    .notice-icon {
      width: 24px;
      height: 24px;
      color: #60a5fa;
      flex-shrink: 0;
    }
    .access-notice p {
      color: #cbd5e1;
      font-size: 14px;
      margin: 0;
    }
  `;
}
