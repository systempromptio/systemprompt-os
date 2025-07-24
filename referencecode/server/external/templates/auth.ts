/**
 * @fileoverview Authentication page templates for SystemPrompt OS
 * @module server/external/templates/auth
 */

import { renderLayout } from './config/layout.js';
import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';

/**
 * Authentication page configuration
 */
export interface AuthPageConfig {
  providers: IdentityProvider[];
  isAuthenticated: boolean;
  userEmail?: string;
  error?: string;
}

/**
 * Renders the authentication page combining login and registration
 */
export function renderAuthPage(config: AuthPageConfig): string {
  const content = config.isAuthenticated
    ? renderLogoutSection(config.userEmail)
    : renderLoginSection(config.providers, config.error);

  return renderLayout({
    title: config.isAuthenticated ? 'Account' : 'Sign In',
    content,
    styles: getAuthStyles(),
  });
}

/**
 * Renders the login/register section for unauthenticated users
 */
function renderLoginSection(providers: IdentityProvider[], error?: string): string {
  return `
    <h1>Sign In to SystemPrompt</h1>
    <p class="subtitle">Access your AI operating system</p>

    ${error ? `
    <div class="error-message">
      <svg class="error-icon" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
      </svg>
      <span>${error}</span>
    </div>
    ` : ''}

    <div class="auth-section">
      <div class="section-header">
        <svg class="section-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
        </svg>
        <h2>Choose Authentication Method</h2>
      </div>
      
      <div class="provider-list">
        ${providers.map(provider => renderProviderButton(provider)).join('')}
      </div>
    </div>

    <div class="info-section">
      <div class="info-card">
        <svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        <div class="info-content">
          <h3>New to SystemPrompt?</h3>
          <p>Sign in with your preferred provider to automatically create an account. Your first login registers you as a new user.</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/">Back to Home</a> • 
        <a href="/config">System Status</a>
      </p>
    </div>
  `;
}

/**
 * Renders the logout section for authenticated users
 */
function renderLogoutSection(userEmail?: string): string {
  return `
    <h1>Your Account</h1>
    <p class="subtitle">Manage your SystemPrompt session</p>

    <div class="account-section">
      <div class="account-info">
        <div class="account-avatar">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="account-details">
          <h2>Signed in as</h2>
          <p class="user-email">${userEmail || 'User'}</p>
        </div>
      </div>

      <div class="session-info">
        <div class="session-item">
          <span class="session-label">Session Status</span>
          <span class="session-value active">Active</span>
        </div>
        <div class="session-item">
          <span class="session-label">Authentication Method</span>
          <span class="session-value">OAuth 2.0</span>
        </div>
      </div>

      <form method="POST" action="/auth/logout" class="logout-form">
        <button type="submit" class="logout-button">
          <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
          </svg>
          Sign Out
        </button>
      </form>
    </div>

    <div class="footer">
      <p>
        <a href="/config">Configuration</a> • 
        <a href="/">Home</a>
      </p>
    </div>
  `;
}

/**
 * Renders an OAuth provider button
 */
function renderProviderButton(provider: IdentityProvider): string {
  const providerName = provider.name.toLowerCase();
  const displayName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
  const icon = providerName === 'google' ? '🔵' : '⚫';

  // Use the tunnel URL if available
  const baseUrl = tunnelStatus.getBaseUrlOrDefault('http://localhost:3000');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'auth-client',
    redirect_uri: `${baseUrl}/auth/callback`,
    scope: 'openid profile email',
    state: 'auth-flow',
    provider: providerName,
  });

  return `
    <a href="/oauth2/authorize?${params.toString()}" class="provider-button">
      <span class="provider-icon">${icon}</span>
      Continue with ${displayName}
    </a>
  `;
}

/**
 * Returns CSS styles specific to the authentication pages
 */
function getAuthStyles(): string {
  return `
    .auth-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 32px;
      margin: 40px 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .section-icon {
      width: 24px;
      height: 24px;
      color: #3b82f6;
    }
    .section-header h2 {
      font-size: 20px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }
    .provider-list {
      display: grid;
      gap: 12px;
    }
    .provider-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 16px 24px;
      border: 2px solid #334155;
      border-radius: 10px;
      background: #1e293b;
      color: #e5e7eb;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .provider-button:hover {
      background: #334155;
      border-color: #475569;
      transform: translateY(-1px);
    }
    .provider-icon {
      width: 20px;
      height: 20px;
      margin-right: 12px;
    }
    .info-section {
      margin: 32px 0;
    }
    .info-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      gap: 16px;
    }
    .info-icon {
      width: 24px;
      height: 24px;
      color: #60a5fa;
      flex-shrink: 0;
    }
    .info-content h3 {
      font-size: 16px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0 0 8px 0;
    }
    .info-content p {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.5;
      margin: 0;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0;
    }
    .error-icon {
      width: 20px;
      height: 20px;
      color: #ef4444;
      flex-shrink: 0;
    }
    .error-message span {
      color: #fca5a5;
      font-size: 14px;
    }
    
    /* Account/Logout styles */
    .account-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 32px;
      margin: 40px 0;
    }
    .account-info {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #1e293b;
    }
    .account-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .account-avatar svg {
      width: 32px;
      height: 32px;
      color: #3b82f6;
    }
    .account-details h2 {
      font-size: 14px;
      font-weight: 500;
      color: #9ca3af;
      margin: 0 0 4px 0;
    }
    .user-email {
      font-size: 20px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }
    .session-info {
      display: grid;
      gap: 16px;
      margin-bottom: 32px;
    }
    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #1e293b;
    }
    .session-label {
      font-size: 14px;
      color: #9ca3af;
    }
    .session-value {
      font-size: 14px;
      font-weight: 500;
      color: #e2e8f0;
    }
    .session-value.active {
      color: #10b981;
    }
    .logout-form {
      margin: 0;
    }
    .logout-button {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .logout-button:hover {
      background: #b91c1c;
      transform: translateY(-1px);
    }
    .button-icon {
      width: 20px;
      height: 20px;
    }
  `;
}