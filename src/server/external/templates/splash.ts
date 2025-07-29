/**
 * Splash page template for SystemPrompt OS.
 * This module provides the welcome splash page with hero section,
 * feature cards, and call-to-action buttons for SystemPrompt OS.
 * @file Splash page template for SystemPrompt OS.
 * @module server/external/templates/splash
 */

import { renderLayout } from '@/server/external/templates/config/layout';

/**
 * Creates the hero section HTML content.
 * @returns The hero section HTML string.
 */
const createHeroSection = (): string => {
  return `
    <div class="hero-section">
      <div class="hero-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
          <path d="M2 17L12 22L22 17"/>
          <path d="M2 12L12 17L22 12"/>
        </svg>
      </div>
      <p class="hero-description">
        Build, deploy, and manage intelligent AI systems with complete control
        over your infrastructure.
      </p>
    </div>
  `;
};

/**
 * Creates a feature card HTML content.
 * @param options - The feature card options.
 * @param options.icon - The SVG icon content.
 * @param options.title - The feature title.
 * @param options.description - The feature description.
 * @returns The feature card HTML string.
 */
const createFeatureCard = (options: {
  icon: string;
  title: string;
  description: string;
}): string => {
  return `
    <div class="feature-card">
      <div class="feature-icon">
        <svg fill="currentColor" viewBox="0 0 20 20">
          ${options.icon}
        </svg>
      </div>
      <h3>${options.title}</h3>
      <p>${options.description}</p>
    </div>
  `;
};

/**
 * Creates the security feature icon path.
 * @returns The security SVG path string.
 */
const getSecurityIcon = (): string => {
  const p1 = 'M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5';
  const p2 = 'c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7';
  const p3 = 'c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586';
  const p4 = '7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z';
  return `<path fill-rule="evenodd" d="${p1}${p2}${p3} ${p4}" clip-rule="evenodd"/>`;
};

/**
 * Creates the MCP feature icon path.
 * @returns The MCP SVG path string.
 */
const getMcpIcon = (): string => {
  const mcpPath = 'M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4';
  const mcpEnd = 'a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z';
  return `<path fill-rule="evenodd" d="${mcpPath} ${mcpEnd}" clip-rule="evenodd"/>`;
};

/**
 * Creates the open source feature icon path.
 * @returns The open source SVG path string.
 */
const getOpenSourceIcon = (): string => {
  const part1 = 'M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051';
  const part2 = 'a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088';
  const part3 = 'l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z';
  const part4 = 'M3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174';
  const part5 = 'a1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762z';
  const part6 = 'M9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78';
  const part7 = 'a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762';
  const part8 = 'a1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z';
  const part9 = 'M6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z';
  const fullPath = `${part1} ${part2} ${part3}${part4} ${part5}${part6} ${part7} ${part8}${part9}`;
  return `<path d="${fullPath}"/>`;
};

/**
 * Creates the features grid HTML content.
 * @returns The features grid HTML string.
 */
const createFeaturesGrid = (): string => {
  return `
    <div class="features-grid">
      ${createFeatureCard({
        icon: getSecurityIcon(),
        title: 'Secure by Design',
        description: 'Built with security-first principles and OAuth 2.0 authentication'
      })}
      ${createFeatureCard({
        icon: getMcpIcon(),
        title: 'MCP Compatible',
        description: 'Full support for Model Context Protocol servers and integrations'
      })}
      ${createFeatureCard({
        icon: getOpenSourceIcon(),
        title: 'Open Source',
        description: 'Community-driven development with transparent governance'
      })}
    </div>
  `;
};

/**
 * Creates a CTA button HTML content.
 * @param options - The CTA button options.
 * @param options.href - The button link.
 * @param options.className - The button CSS class.
 * @param options.icon - The SVG icon content.
 * @param options.text - The button text.
 * @returns The CTA button HTML string.
 */
const createCtaButton = (options: {
  href: string;
  className: string;
  icon: string;
  text: string;
}): string => {
  return `
    <a href="${options.href}" class="cta-button ${options.className}">
      <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
        ${options.icon}
      </svg>
      ${options.text}
    </a>
  `;
};

/**
 * Creates the user icon path for CTA buttons.
 * @returns The user icon SVG path string.
 */
const getUserIcon = (): string => {
  const iconPath = 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z';
  return `<path fill-rule="evenodd" d="${iconPath}" clip-rule="evenodd"/>`;
};

/**
 * Creates the settings icon path for CTA buttons.
 * @returns The settings icon SVG path string.
 */
const getSettingsIcon = (): string => {
  const g1 = 'M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948';
  const g2 = 'c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978';
  const g3 = 'a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106';
  const g4 = 'a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0';
  const g5 = 'a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106';
  const g6 = 'a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978';
  const g7 = 'a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106';
  const g8 = 'a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z';
  return `<path fill-rule="evenodd" d="${g1}${g2} ${g3} ${g4} ${g5} ${g6} ${g7} ${g8}" clip-rule="evenodd"/>`;
};

/**
 * Creates the CTA section HTML content.
 * @returns The CTA section HTML string.
 */
const createCtaSection = (): string => {
  return `
    <div class="cta-section">
      ${createCtaButton({
        href: '/auth',
        className: 'primary',
        icon: getUserIcon(),
        text: 'Get Started'
      })}
      ${createCtaButton({
        href: '/config',
        className: 'secondary',
        icon: getSettingsIcon(),
        text: 'System Status'
      })}
    </div>
  `;
};

/**
 * Creates the footer HTML content.
 * @returns The footer HTML string.
 */
const createFooter = (): string => {
  return `
    <div class="footer">
      <p>
        <a href="https://docs.systemprompt.io" target="_blank">Documentation</a> • 
        <a href="https://github.com/systemprompt/systemprompt-os" target="_blank">
          GitHub
        </a> • 
        <a href="/health">API Health</a>
      </p>
    </div>
  `;
};

/**
 * Returns hero section CSS styles.
 * @returns The hero section CSS string.
 */
const getHeroStyles = (): string => {
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
  `;
};

/**
 * Returns features section CSS styles.
 * @returns The features section CSS string.
 */
const getFeatureStyles = (): string => {
  return `
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
  `;
};

/**
 * Returns CTA button CSS styles.
 * @returns The CTA section CSS string.
 */
const getCtaStyles = (): string => {
  return `
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
};

/**
 * Returns CSS styles specific to the splash page.
 * @returns The CSS string containing all splash page styles.
 */
const getSplashStyles = (): string => {
  return getHeroStyles() + getFeatureStyles() + getCtaStyles();
};

/**
 * Renders the welcome splash page content.
 * @returns The complete HTML string for the splash page.
 */
export const renderSplashPage = (): string => {
  const content = `
    <h1>SystemPrompt OS</h1>
    <p class="subtitle">The open-source operating system for AI agents</p>
    ${createHeroSection()}
    ${createFeaturesGrid()}
    ${createCtaSection()}
    ${createFooter()}
  `;

  return renderLayout({
    title: 'Welcome',
    content,
    styles: getSplashStyles()
  });
};
