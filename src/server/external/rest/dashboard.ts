/**
 * @fileoverview Dashboard page for authenticated users
 * @module server/external/rest/dashboard
 */

import type { Request, Response, Router } from 'express';
import { renderLayout } from '../templates/config/layout.js';

/**
 * Dashboard endpoint for authenticated users
 */
export class DashboardEndpoint {
  /**
   * Render the dashboard page
   */
  public async handleDashboard(req: Request, res: Response): Promise<void> {
    const user = req.user!; // Guaranteed by auth middleware
    
    const content = `
      <div class="dashboard">
        <h1>Welcome to SystemPrompt OS</h1>
        
        <div class="user-info">
          <h2>Your Account</h2>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>User ID:</strong> ${user.id}</p>
          <p><strong>Roles:</strong> ${user.roles.join(', ') || 'user'}</p>
        </div>
        
        <div class="quick-links">
          <h2>Quick Links</h2>
          <div class="link-grid">
            <a href="/config" class="link-card">
              <h3>⚙️ Configuration</h3>
              <p>Manage system settings</p>
            </a>
            ${user.roles.includes('admin') ? `
            <a href="/admin" class="link-card">
              <h3>👤 Admin Panel</h3>
              <p>User and system management</p>
            </a>
            ` : ''}
            <a href="/api/docs" class="link-card">
              <h3>📚 API Documentation</h3>
              <p>Explore the API</p>
            </a>
          </div>
        </div>
        
        <div class="footer">
          <form method="POST" action="/auth/logout" style="display: inline;">
            <button type="submit" class="logout-button">Sign Out</button>
          </form>
        </div>
      </div>
    `;
    
    const html = renderLayout({
      title: 'Dashboard',
      content,
      styles: getDashboardStyles()
    });
    
    res.type('html').send(html);
  }
}

/**
 * Dashboard-specific styles
 */
function getDashboardStyles(): string {
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
}

/**
 * Configure dashboard routes
 */
export function setupRoutes(router: Router): void {
  const dashboardEndpoint = new DashboardEndpoint();
  
  router.get('/dashboard', (req, res) => dashboardEndpoint.handleDashboard(req, res));
  router.get('/', (req, res) => dashboardEndpoint.handleDashboard(req, res)); // Root redirects to dashboard for authenticated users
}