/**
 * Identity provider configuration for OAuth authentication.
 */
interface IIdentityProvider {
    name: string;
}

/**
 * Renders an OAuth provider button.
 * @param provider - The identity provider configuration.
 * @returns HTML string for the provider button.
 */
const renderProviderButton = (provider: IIdentityProvider): string => {
  const providerName = provider.name.toLowerCase();
  const displayName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
  const icon = providerName === 'google' ? '🔵' : '⚫';

  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  const authUrl = `${baseUrl}/oauth2/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: 'systemprompt-os',
    redirect_uri: baseUrl,
    scope: 'profile email',
    provider: providerName,
  }).toString()}`;

  return `
    <a href="${authUrl}" class="provider-button">
      <span class="provider-icon">${icon}</span>
      Continue with ${displayName}
    </a>
  `;
};

/**
 * Renders the admin section of the initial setup page.
 * @param providers - Array of available identity providers.
 * @returns HTML string for the admin section.
 */
const renderAdminSection = (providers: IIdentityProvider[]): string => {
  return `
    <div class="admin-section">
      <h2 class="admin-title">
        <svg class="admin-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" 
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
            clip-rule="evenodd" />
        </svg>
        Connect Admin Account
      </h2>
      <p class="admin-description">
        Choose your preferred authentication method to create the administrator account. 
        This account will have full system access and can manage all settings.
      </p>
      
      <div class="provider-grid">
        ${providers
          .map((provider): string => { return renderProviderButton(provider) })
          .join('')}
      </div>
    </div>
  `;
};

/**
 * Renders the setup progress section.
 * @returns HTML string for the setup progress section.
 */
const renderSetupProgress = (): string => {
  return `
    <div class="setup-progress">
      <div class="progress-header">Setup Progress</div>
      <div class="progress-items">
        <div class="progress-item">
          <span class="progress-icon complete">✓</span>
          <span>System Initialized</span>
        </div>
        <div class="progress-item">
          <span class="progress-icon active">●</span>
          <span>Admin Account Setup</span>
        </div>
        <div class="progress-item">
          <span class="progress-icon pending">○</span>
          <span>Ready to Use</span>
        </div>
      </div>
    </div>
  `;
};

/**
 * Renders the security note section.
 * @returns HTML string for the security note section.
 */
const renderSecurityNote = (): string => {
  const securityPath = [
    'M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65',
    '.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682',
    '.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1',
    '1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
  ].join(' ');

  return `
    <div class="security-note">
      <svg class="security-icon" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="${securityPath}" clip-rule="evenodd" />
      </svg>
      <div class="security-text">
        <strong>Security First:</strong> Your authentication credentials are never stored 
        by SystemPrompt OS. We use OAuth 2.0 to securely authenticate through your 
        chosen provider.
      </div>
    </div>
  `;
};

/**
 * Renders the footer section.
 * @returns HTML string for the footer section.
 */
const renderFooter = (): string => {
  const docsUrl = 'https://docs.systemprompt.io';
  const issuesUrl = 'https://github.com/systemprompt/systemprompt-os/issues';

  return `
    <div class="footer">
      <p>Need help? Visit our <a href="${docsUrl}" target="_blank">documentation</a> 
      or <a href="${issuesUrl}" target="_blank">report an issue</a></p>
    </div>
  `;
};

/**
 * Renders the initial setup page when no admin users exist.
 * @param providers - Array of available identity providers for authentication.
 * @returns HTML string for the initial setup page.
 */
export const renderInitialSetup = (providers: IIdentityProvider[]): string => {
  return `
    <h1>Welcome to SystemPrompt OS</h1>
    <p class="subtitle">
      Let's get started by setting up your administrator account.
    </p>

    ${renderAdminSection(providers)}
    ${renderSetupProgress()}
    ${renderSecurityNote()}
    ${renderFooter()}
  `;
};

/**
 * Returns styles for the admin section.
 * @returns CSS string for admin section styles.
 */
const getAdminSectionStyles = (): string => {
  return `
    .admin-section {
      background: linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 32px;
    }
    .admin-title {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #f1f5f9;
    }
    .admin-icon {
      width: 28px;
      height: 28px;
      margin-right: 12px;
      color: #3b82f6;
    }
    .admin-description {
      text-align: center;
      color: #cbd5e1;
      margin-bottom: 24px;
      font-size: 16px;
      line-height: 1.6;
    }
  `;
};

/**
 * Returns styles for provider buttons.
 * @returns CSS string for provider button styles.
 */
const getProviderButtonStyles = (): string => {
  return `
    .provider-grid {
      display: grid;
      gap: 12px;
    }
    .provider-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 16px 24px;
      border: 2px solid transparent;
      border-radius: 10px;
      background: #1f2937;
      color: #e5e7eb;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.2s;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .provider-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, 
        rgba(59, 130, 246, 0.1) 0%, 
        rgba(139, 92, 246, 0.1) 100%);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .provider-button:hover {
      border-color: #3b82f6;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .provider-button:hover::before {
      opacity: 1;
    }
    .provider-icon {
      width: 20px;
      height: 20px;
      margin-right: 12px;
      position: relative;
      z-index: 1;
    }
  `;
};

/**
 * Returns styles for the progress section.
 * @returns CSS string for progress section styles.
 */
const getProgressStyles = (): string => {
  return `
    .setup-progress {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .progress-header {
      font-size: 14px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    .progress-items {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .progress-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .progress-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 600;
    }
    .progress-icon.pending {
      background: #475569;
      color: #cbd5e1;
    }
    .progress-icon.active {
      background: #3b82f6;
      color: white;
      animation: pulse 2s infinite;
    }
    .progress-icon.complete {
      background: #10b981;
      color: white;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .progress-item span:last-child {
      font-size: 12px;
      color: #9ca3af;
    }
  `;
};

/**
 * Returns styles for the security note section.
 * @returns CSS string for security note styles.
 */
const getSecurityNoteStyles = (): string => {
  return `
    .security-note {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 32px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .security-icon {
      width: 24px;
      height: 24px;
      color: #10b981;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .security-text {
      flex: 1;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
    }
    .security-text strong {
      color: #f1f5f9;
      display: block;
      margin-bottom: 4px;
    }
  `;
};

/**
 * Returns CSS styles specific to the initial setup page.
 * @returns CSS string for styling the initial setup page.
 */
export const getInitialSetupStyles = (): string => {
  return [
    getAdminSectionStyles(),
    getProviderButtonStyles(),
    getProgressStyles(),
    getSecurityNoteStyles()
  ].join('\n');
};
