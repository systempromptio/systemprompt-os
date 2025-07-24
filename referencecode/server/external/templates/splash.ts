/**
 * @fileoverview Splash page template for SystemPrompt OS
 * @module server/external/templates/splash
 */

import { renderLayout } from './config/layout.js';

/**
 * Renders the welcome splash page content
 */
export function renderSplashPage(): string {
  const content = `
    <h1>SystemPrompt OS</h1>
    <p class="subtitle">The open-source operating system for AI agents</p>
    
    <div class="hero-section">
      <div class="hero-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
          <path d="M2 17L12 22L22 17"/>
          <path d="M2 12L12 17L22 12"/>
        </svg>
      </div>
      <p class="hero-description">
        Build, deploy, and manage intelligent AI systems with complete control over your infrastructure.
      </p>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h3>Secure by Design</h3>
        <p>Built with security-first principles and OAuth 2.0 authentication</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h3>MCP Compatible</h3>
        <p>Full support for Model Context Protocol servers and integrations</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
          </svg>
        </div>
        <h3>Open Source</h3>
        <p>Community-driven development with transparent governance</p>
      </div>
    </div>

    <div class="cta-section">
      <a href="/auth" class="cta-button primary">
        <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
        </svg>
        Get Started
      </a>
      <a href="/config" class="cta-button secondary">
        <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
        </svg>
        System Status
      </a>
    </div>

    <div class="footer">
      <p>
        <a href="https://docs.systemprompt.io" target="_blank">Documentation</a> • 
        <a href="https://github.com/systemprompt/systemprompt-os" target="_blank">GitHub</a> • 
        <a href="/health">API Health</a>
      </p>
    </div>
  `;

  return renderLayout({
    title: 'Welcome',
    content,
    styles: getSplashStyles()
  });
}

/**
 * Returns CSS styles specific to the splash page
 */
function getSplashStyles(): string {
  return `
    .hero-section {
      text-align: center;
      margin: 60px 0;
    }
    .hero-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 120px;
      margin: 0 auto 24px;
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
      border: 2px solid #3b82f6;
    }
    .hero-icon svg {
      width: 60px;
      height: 60px;
      stroke: #3b82f6;
    }
    .hero-description {
      font-size: 20px;
      color: #cbd5e1;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
    }
    .features-grid {
      display: grid;
      gap: 20px;
      margin: 60px 0;
    }
    .feature-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      transition: all 0.2s;
    }
    .feature-card:hover {
      border-color: #334155;
      transform: translateY(-2px);
    }
    .feature-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.1);
      margin-bottom: 16px;
    }
    .feature-icon svg {
      width: 24px;
      height: 24px;
      color: #3b82f6;
    }
    .feature-card h3 {
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    .feature-card p {
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.5;
    }
    .cta-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 40px 0;
    }
    .cta-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.2s;
    }
    .cta-button.primary {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      border: 2px solid transparent;
    }
    .cta-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
    }
    .cta-button.secondary {
      background: transparent;
      color: #e2e8f0;
      border: 2px solid #334155;
    }
    .cta-button.secondary:hover {
      background: #1e293b;
      border-color: #475569;
    }
    .button-icon {
      width: 20px;
      height: 20px;
    }
  `;
}