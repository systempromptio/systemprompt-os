/**
 * Dashboard page for authenticated users.
 * Provides dashboard endpoint with user information and navigation links.
 * @file Dashboard page for authenticated users.
 * @module server/external/rest/dashboard
 */

import type {
 Request as ExpressRequest,
 Response as ExpressResponse,
 Router
} from 'express';

/**
 * Mock renderLayout for missing module.
 * @param config - Layout configuration object.
 * @param config.title - Page title.
 * @param config.content - HTML content.
 * @param config.styles - CSS styles.
 * @returns HTML string.
 */
const renderLayout = (config: { title: string; content: string; styles: string }): string => {
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
 * Generate base dashboard styles.
 * @returns Base CSS styles for dashboard layout.
 */
const getBaseStyles = (): string => {
  return `
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .user-info {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin: 2rem 0;
    }
    
    .user-info p {
      margin: 0.5rem 0;
    }
    
    .quick-links {
      margin: 2rem 0;
    }
    
    .link-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
  `;
};

/**
 * Generate card styles for dashboard links.
 * @returns CSS styles for link cards.
 */
const getCardStyles = (): string => {
  return `
    .link-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    
    .link-card:hover {
      border-color: #0066cc;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    .link-card h3 {
      margin: 0 0 0.5rem 0;
      color: #333;
    }
    
    .link-card p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }
  `;
};

/**
 * Generate button styles for dashboard.
 * @returns CSS styles for buttons and footer.
 */
const getButtonStyles = (): string => {
  return `
    .logout-button {
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    
    .logout-button:hover {
      background: #c82333;
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #e0e0e0;
      text-align: center;
    }
  `;
};

/**
 * Dashboard-specific styles.
 * @returns CSS styles string for dashboard.
 */
const getDashboardStyles = (): string => {
  return getBaseStyles() + getCardStyles() + getButtonStyles();
};

/**
 * Generate user information section HTML.
 * @param user - Authenticated user object.
 * @returns HTML string for user info section.
 */
const generateUserInfoSection = (user: NonNullable<ExpressRequest['user']>): string => {
  const rolesDisplay = user.roles.length > 0 ? user.roles.join(', ') : 'user';

  return `
    <div class="user-info">
      <h2>Your Account</h2>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>User ID:</strong> ${user.id}</p>
      <p><strong>Roles:</strong> ${rolesDisplay}</p>
    </div>
  `;
};

/**
 * Generate quick links section HTML.
 * @param user - Authenticated user object.
 * @returns HTML string for quick links section.
 */
const generateQuickLinksSection = (user: NonNullable<ExpressRequest['user']>): string => {
  const adminLink = user.roles.includes('admin') ? `
    <a href="/admin" class="link-card">
      <h3>👤 Admin Panel</h3>
      <p>User and system management</p>
    </a>
  ` : '';

  return `
    <div class="quick-links">
      <h2>Quick Links</h2>
      <div class="link-grid">
        <a href="/config" class="link-card">
          <h3>⚙️ Configuration</h3>
          <p>Manage system settings</p>
        </a>
        ${adminLink}
        <a href="/api/docs" class="link-card">
          <h3>📚 API Documentation</h3>
          <p>Explore the API</p>
        </a>
      </div>
    </div>
  `;
};

/**
 * Generate footer section HTML.
 * @returns HTML string for footer section.
 */
const generateFooterSection = (): string => {
  return `
    <div class="footer">
      <form method="POST" action="/auth/logout" style="display: inline;">
        <button type="submit" class="logout-button">Sign Out</button>
      </form>
    </div>
  `;
};

/**
 * Generate complete dashboard content HTML.
 * @param user - Authenticated user object.
 * @returns Complete dashboard HTML content.
 */
const generateDashboardContent = (user: NonNullable<ExpressRequest['user']>): string => {
  const userInfo = generateUserInfoSection(user);
  const quickLinks = generateQuickLinksSection(user);
  const footer = generateFooterSection();

  return `
    <div class="dashboard">
      <h1>Welcome to SystemPrompt OS</h1>
      ${userInfo}
      ${quickLinks}
      ${footer}
    </div>
  `;
};

/**
 * Dashboard endpoint for authenticated users.
 */
export class DashboardEndpoint {
  /**
   * Render the dashboard page.
   * @param req - Express request object.
   * @param res - Express response object.
   */
  public handleDashboard(req: ExpressRequest, res: ExpressResponse): void {
    if (req.user === null || req.user === undefined) {
      res.status(401).send('Unauthorized');
      return;
    }

    const {user} = req;
    const content = generateDashboardContent(user);

    const html = renderLayout({
      title: 'Dashboard',
      content,
      styles: getDashboardStyles()
    });

    res.type('html').send(html);
  }
}

/**
 * Configure dashboard routes.
 * @param router - Express router instance.
 */
export const setupRoutes = (router: Router): void => {
  const dashboardEndpoint = new DashboardEndpoint();

  router.get('/dashboard', (req: ExpressRequest, res: ExpressResponse): void => {
    dashboardEndpoint.handleDashboard(req, res);
  });
};
