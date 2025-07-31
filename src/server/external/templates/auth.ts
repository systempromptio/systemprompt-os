/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - systemprompt-os/enforce-type-exports violations for LayoutConfig, IdentityProvider, AuthPageConfig
 * - These types need to be moved to a types/ folder per project standards
 */

/**
 * Configuration interface for rendering layout components.
 */
interface LayoutConfig {
  title: string;
  content: string;
  styles: string;
}

/**
 * Identity provider configuration for OAuth authentication.
 */
export interface IdentityProvider {
  id: string;
  name: string;
  url?: string;
}

/**
 * Authentication page configuration options.
 */
export interface AuthPageConfig {
  providers: IdentityProvider[];
  isAuthenticated: boolean;
  userEmail?: string;
  error?: string;
  authorizationRequest?: {
    client_id: string;
    scope: string;
  };
}

/**
 * Mock layout renderer for HTML page structure.
 * @param config - Layout configuration options.
 * @returns Complete HTML page string.
 */
const renderLayout = (config: LayoutConfig): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${config.title}</title>
      <style>${config.styles}</style>
    </head>
    <body>
      ${config.content}
    </body>
    </html>
  `;
};

/**
 * Renders an OAuth provider button.
 * @param provider - The identity provider configuration.
 * @returns HTML string for provider authentication button.
 */
const renderProviderButton = (provider: IdentityProvider): string => {
  const providerName = provider.id.toLowerCase();
  const displayName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
  const icon = providerName === 'google' ? '🔵' : '⚫';

  const authUrl = provider.url || `/oauth2/authorize?provider=${provider.id}`;

  return `
    <a href="${authUrl}" class="provider-button">
      <span class="provider-icon">${icon}</span>
      Continue with ${displayName}
    </a>
  `;
};

/**
 * Renders the login section for unauthenticated users.
 * @param providers - Array of available identity providers.
 * @param error - Optional error message to display.
 * @returns HTML string for login section.
 */
const renderLoginSection = (providers: IdentityProvider[], error?: string): string => {
  const errorHtml = error ? `
    <div class="error-message">
      <span class="error-icon">⚠</span>
      <span>${error}</span>
    </div>
  ` : '';

  const providerButtons = providers
    .map((provider: IdentityProvider): string => {
      return renderProviderButton(provider);
    })
    .join('');

  return `
    <h1>Sign In to SystemPrompt</h1>
    <p class="subtitle">Access your AI operating system</p>
    ${errorHtml}
    <div class="auth-section">
      <h2>Choose Authentication Method</h2>
      <div class="provider-list">${providerButtons}</div>
    </div>
    <div class="info-section">
      <h3>New to SystemPrompt?</h3>
      <p>Sign in with your preferred provider to create an account.</p>
    </div>
    <div class="footer">
      <a href="/">Home</a> • <a href="/config">Status</a>
    </div>
  `;
};

/**
 * Renders the logout section for authenticated users.
 * @param userEmail - The user's email address to display.
 * @returns HTML string for logout section.
 */
const renderLogoutSection = (userEmail?: string): string => {
  const displayEmail = userEmail ?? 'User';

  return `
    <h1>Your Account</h1>
    <p class="subtitle">Manage your SystemPrompt session</p>
    <div class="account-section">
      <div class="account-info">
        <h2>Signed in as</h2>
        <p class="user-email">${displayEmail}</p>
      </div>
      <div class="session-info">
        <div class="session-item">
          <span>Session Status</span>
          <span class="active">Active</span>
        </div>
        <div class="session-item">
          <span>Authentication</span>
          <span>OAuth 2.0</span>
        </div>
      </div>
      <form method="POST" action="/auth/logout" class="logout-form">
        <button type="submit" class="logout-button">Sign Out</button>
      </form>
    </div>
    <div class="footer">
      <a href="/config">Configuration</a> • <a href="/">Home</a>
    </div>
  `;
};

/**
 * Returns CSS styles for authentication pages.
 * @returns CSS styles string for authentication pages.
 */
const getAuthStyles = (): string => {
  return `
    body { font-family: system-ui; margin: 0; padding: 20px; 
           background: #0f172a; color: #f1f5f9; }
    h1, h2, h3 { margin: 0 0 16px 0; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; }
    .auth-section, .account-section { background: #1e293b; padding: 24px; 
                                      border-radius: 8px; margin: 24px 0; }
    .provider-list { display: grid; gap: 12px; }
    .provider-button { display: flex; align-items: center; padding: 12px; 
                       background: #334155; color: white; text-decoration: none; 
                       border-radius: 6px; }
    .provider-icon { margin-right: 8px; }
    .error-message { background: rgba(239, 68, 68, 0.1); padding: 12px; 
                     border-radius: 6px; margin: 16px 0; }
    .error-icon { color: #ef4444; margin-right: 8px; }
    .info-section { margin: 24px 0; padding: 16px; background: #1e293b; 
                    border-radius: 6px; }
    .account-info { margin-bottom: 24px; }
    .user-email { font-size: 18px; font-weight: 600; }
    .session-info { margin: 24px 0; }
    .session-item { display: flex; justify-content: space-between; padding: 8px 0; }
    .active { color: #10b981; }
    .logout-button { width: 100%; padding: 12px; background: #dc2626; color: white; 
                     border: none; border-radius: 6px; cursor: pointer; }
    .footer { margin-top: 32px; text-align: center; color: #64748b; }
    .footer a { color: #3b82f6; text-decoration: none; }
  `;
};

/**
 * Renders the authentication page combining login and registration.
 * @param config - Authentication page configuration options.
 * @returns Complete HTML page for authentication.
 */
export const renderAuthPage = (config: AuthPageConfig): string => {
  const content = config.isAuthenticated
    ? renderLogoutSection(config.userEmail)
    : renderLoginSection(config.providers, config.error);

  return renderLayout({
    title: config.isAuthenticated ? 'Account' : 'Sign In',
    content,
    styles: getAuthStyles(),
  });
};
