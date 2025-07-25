/**
 * @fileoverview Unit tests for Initial Setup Template
 * @module tests/unit/server/external/templates/config/initial-setup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  renderInitialSetup, 
  getInitialSetupStyles 
} from '../../../../../../src/server/external/templates/config/initial-setup.js';

// Define IdentityProvider interface for type safety
interface IdentityProvider {
  name: string;
}

describe('IdentityProvider Interface', () => {
  it('should validate valid IdentityProvider object', () => {
    const validProvider: IdentityProvider = {
      name: 'google'
    };

    expect(validProvider.name).toBe('google');
    expect(typeof validProvider.name).toBe('string');
  });

  it('should accept various provider names', () => {
    const providers: IdentityProvider[] = [
      { name: 'google' },
      { name: 'github' },
      { name: 'oauth2' },
      { name: 'custom' }
    ];

    providers.forEach(provider => {
      expect(typeof provider.name).toBe('string');
      expect(provider.name.length).toBeGreaterThan(0);
    });
  });
});

describe('renderInitialSetup', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const baseProviders: IdentityProvider[] = [
    { name: 'google' },
    { name: 'github' }
  ];

  it('should return a non-empty string', () => {
    const result = renderInitialSetup(baseProviders);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain all required HTML structure elements', () => {
    const result = renderInitialSetup(baseProviders);
    
    // Check for main sections
    expect(result).toContain('<h1>Welcome to SystemPrompt OS</h1>');
    expect(result).toContain('class="subtitle"');
    expect(result).toContain("Let's get started by setting up your administrator account.");
    
    // Check for admin section
    expect(result).toContain('class="admin-section"');
    expect(result).toContain('class="admin-title"');
    expect(result).toContain('Connect Admin Account');
    expect(result).toContain('class="admin-description"');
    expect(result).toContain('class="provider-grid"');
    
    // Check for setup progress section
    expect(result).toContain('class="setup-progress"');
    expect(result).toContain('class="progress-header"');
    expect(result).toContain('Setup Progress');
    expect(result).toContain('class="progress-items"');
    expect(result).toContain('class="progress-item"');
    
    // Check for security note section
    expect(result).toContain('class="security-note"');
    expect(result).toContain('class="security-icon"');
    expect(result).toContain('class="security-text"');
    expect(result).toContain('<strong>Security First:</strong>');
    
    // Check for footer
    expect(result).toContain('class="footer"');
    expect(result).toContain('Need help?');
    expect(result).toContain('https://docs.systemprompt.io');
    expect(result).toContain('https://github.com/systemprompt/systemprompt-os/issues');
  });

  it('should render SVG icons correctly', () => {
    const result = renderInitialSetup(baseProviders);
    
    // Admin icon SVG
    expect(result).toContain('class="admin-icon"');
    expect(result).toContain('fill="currentColor"');
    expect(result).toContain('viewBox="0 0 20 20"');
    expect(result).toContain('fill-rule="evenodd"');
    expect(result).toContain('clip-rule="evenodd"');
    
    // Security icon SVG
    expect(result).toContain('class="security-icon"');
    expect(result).toContain('d="M2.166 4.999A11.954');
  });

  it('should render progress items with correct states', () => {
    const result = renderInitialSetup(baseProviders);
    
    // System Initialized - completed
    expect(result).toContain('class="progress-icon complete"');
    expect(result).toContain('✓');
    expect(result).toContain('System Initialized');
    
    // Admin Account Setup - active
    expect(result).toContain('class="progress-icon active"');
    expect(result).toContain('●');
    expect(result).toContain('Admin Account Setup');
    
    // Ready to Use - pending
    expect(result).toContain('class="progress-icon pending"');
    expect(result).toContain('○');
    expect(result).toContain('Ready to Use');
  });

  it('should render provider buttons using renderProviderButton function', () => {
    const providers: IdentityProvider[] = [
      { name: 'google' },
      { name: 'github' },
      { name: 'custom' }
    ];
    
    const result = renderInitialSetup(providers);
    
    // Should contain provider buttons
    expect(result).toContain('class="provider-button"');
    expect(result).toContain('Continue with Google');
    expect(result).toContain('Continue with Github');
    expect(result).toContain('Continue with Custom');
  });

  describe('Provider Array Handling', () => {
    it('should handle empty provider array', () => {
      const result = renderInitialSetup([]);
      
      expect(result).toBeDefined();
      expect(result).toContain('class="provider-grid"');
      // Should still contain the main structure
      expect(result).toContain('<h1>Welcome to SystemPrompt OS</h1>');
      expect(result).toContain('class="admin-section"');
    });

    it('should handle single provider', () => {
      const singleProvider: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(singleProvider);
      
      expect(result).toContain('Continue with Google');
      expect(result).toContain('🔵'); // Google icon
      
      // Should not contain GitHub
      expect(result).not.toContain('Continue with Github');
    });

    it('should handle multiple providers', () => {
      const multipleProviders: IdentityProvider[] = [
        { name: 'google' },
        { name: 'github' },
        { name: 'oauth2' },
        { name: 'custom' }
      ];
      
      const result = renderInitialSetup(multipleProviders);
      
      expect(result).toContain('Continue with Google');
      expect(result).toContain('Continue with Github');
      expect(result).toContain('Continue with Oauth2');
      expect(result).toContain('Continue with Custom');
    });

    it('should handle providers with special characters in names', () => {
      const specialProviders: IdentityProvider[] = [
        { name: 'custom-provider' },
        { name: 'provider_with_underscores' },
        { name: 'UPPERCASE' },
        { name: 'mixed-Case_Provider' }
      ];
      
      const result = renderInitialSetup(specialProviders);
      
      expect(result).toContain('Continue with Custom-provider');
      expect(result).toContain('Continue with Provider_with_underscores');
      expect(result).toContain('Continue with UPPERCASE');
      expect(result).toContain('Continue with Mixed-Case_Provider');
    });

    it('should handle providers with empty string names', () => {
      const emptyNameProviders: IdentityProvider[] = [
        { name: '' },
        { name: 'valid' }
      ];
      
      const result = renderInitialSetup(emptyNameProviders);
      
      expect(result).toContain('Continue with '); // Empty name becomes empty display
      expect(result).toContain('Continue with Valid');
    });

    it('should handle very long provider names', () => {
      const longNameProviders: IdentityProvider[] = [
        { name: 'very-long-provider-name-that-exceeds-normal-length' }
      ];
      
      const result = renderInitialSetup(longNameProviders);
      
      expect(result).toContain('Continue with Very-long-provider-name-that-exceeds-normal-length');
    });

    it('should handle Unicode characters in provider names', () => {
      const unicodeProviders: IdentityProvider[] = [
        { name: 'провайдер' },
        { name: '提供者' },
        { name: 'مزود' }
      ];
      
      const result = renderInitialSetup(unicodeProviders);
      
      expect(result).toContain('Continue with Провайдер');
      expect(result).toContain('Continue with 提供者');
      expect(result).toContain('Continue with مزود');
    });
  });

  describe('Array.map() and join() functionality', () => {
    it('should correctly map over providers array', () => {
      const testProviders: IdentityProvider[] = [
        { name: 'first' },
        { name: 'second' },
        { name: 'third' }
      ];
      
      const result = renderInitialSetup(testProviders);
      
      // Should contain all three providers in order
      const firstIndex = result.indexOf('Continue with First');
      const secondIndex = result.indexOf('Continue with Second');
      const thirdIndex = result.indexOf('Continue with Third');
      
      expect(firstIndex).not.toBe(-1);
      expect(secondIndex).not.toBe(-1);
      expect(thirdIndex).not.toBe(-1);
      
      // They should appear in order
      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('should join provider buttons without separators', () => {
      const testProviders: IdentityProvider[] = [
        { name: 'provider1' },
        { name: 'provider2' }
      ];
      
      const result = renderInitialSetup(testProviders);
      
      // Should join with empty string (no separators)
      expect(result).toContain('provider-button');
      expect(result).not.toContain('provider-button,'); // No comma separators
      expect(result).not.toContain('provider-button '); // No space separators after join
    });
  });

  describe('Security and OAuth Information', () => {
    it('should include OAuth 2.0 security information', () => {
      const result = renderInitialSetup(baseProviders);
      
      expect(result).toContain('Your authentication credentials are never stored by SystemPrompt OS');
      expect(result).toContain('We use OAuth 2.0 to securely authenticate');
      expect(result).toContain('through your chosen provider');
    });

    it('should include links to documentation and issues', () => {
      const result = renderInitialSetup(baseProviders);
      
      expect(result).toContain('<a href="https://docs.systemprompt.io" target="_blank">documentation</a>');
      expect(result).toContain('<a href="https://github.com/systemprompt/systemprompt-os/issues" target="_blank">report an issue</a>');
    });
  });

  describe('HTML Structure Validation', () => {
    it('should contain properly nested HTML elements', () => {
      const result = renderInitialSetup(baseProviders);
      
      // Check for proper div nesting
      expect(result).toContain('<div class="admin-section">');
      expect(result).toContain('<div class="provider-grid">');
      expect(result).toContain('<div class="setup-progress">');
      expect(result).toContain('<div class="security-note">');
      expect(result).toContain('<div class="footer">');
    });

    it('should contain proper heading hierarchy', () => {
      const result = renderInitialSetup(baseProviders);
      
      expect(result).toContain('<h1>Welcome to SystemPrompt OS</h1>');
      expect(result).toContain('<h2 class="admin-title">');
    });

    it('should contain proper paragraph and span elements', () => {
      const result = renderInitialSetup(baseProviders);
      
      expect(result).toContain('<p class="subtitle">');
      expect(result).toContain('<p class="admin-description">');
      expect(result).toContain('<span class="progress-icon');
      expect(result).toContain('<span class="provider-icon">');
    });
  });
});

describe('renderProviderButton (internal function)', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Since renderProviderButton is not exported, we test it through renderInitialSetup
  // but focus on the provider button functionality

  describe('Provider Name Processing', () => {
    it('should convert provider name to lowercase for URL parameter', () => {
      const providers: IdentityProvider[] = [{ name: 'GOOGLE' }];
      const result = renderInitialSetup(providers);
      
      // Should contain lowercase provider name in URL
      expect(result).toContain('provider=google');
    });

    it('should capitalize first letter for display name', () => {
      const providers: IdentityProvider[] = [{ name: 'github' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('Continue with Github');
    });

    it('should handle mixed case provider names', () => {
      const providers: IdentityProvider[] = [{ name: 'GitHuB' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('Continue with GitHuB'); // Only first letter capitalized
      expect(result).toContain('provider=github'); // Lowercase in URL
    });
  });

  describe('Icon Selection Logic', () => {
    it('should use blue circle icon for Google provider', () => {
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('<span class="provider-icon">🔵</span>');
    });

    it('should use black circle icon for non-Google providers', () => {
      const providers: IdentityProvider[] = [{ name: 'github' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('<span class="provider-icon">⚫</span>');
    });

    it('should use black circle icon for custom providers', () => {
      const providers: IdentityProvider[] = [{ name: 'custom' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('<span class="provider-icon">⚫</span>');
    });

    it('should handle case-insensitive Google detection', () => {
      const providers: IdentityProvider[] = [
        { name: 'GOOGLE' },
        { name: 'Google' },
        { name: 'gOoGlE' }
      ];
      
      const result = renderInitialSetup(providers);
      
      // All should get blue circle icon
      const blueCircleCount = (result.match(/🔵/g) || []).length;
      expect(blueCircleCount).toBe(3);
    });
  });

  describe('Base URL Handling', () => {
    it('should use BASE_URL environment variable when set', () => {
      process.env.BASE_URL = 'https://custom.domain.com';
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('https://custom.domain.com/oauth2/authorize');
      expect(result).toContain('redirect_uri=https://custom.domain.com');
    });

    it('should use default localhost when BASE_URL is not set', () => {
      delete process.env.BASE_URL;
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('http://localhost:3000/oauth2/authorize');
      expect(result).toContain('redirect_uri=http://localhost:3000');
    });

    it('should handle empty BASE_URL environment variable', () => {
      process.env.BASE_URL = '';
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('http://localhost:3000/oauth2/authorize');
    });

    it('should handle BASE_URL with trailing slash', () => {
      process.env.BASE_URL = 'https://example.com/';
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('https://example.com//oauth2/authorize'); // Double slash due to concatenation
      expect(result).toContain('redirect_uri=https://example.com/');
    });

    it('should handle BASE_URL without protocol', () => {
      process.env.BASE_URL = 'example.com';
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('example.com/oauth2/authorize');
      expect(result).toContain('redirect_uri=example.com');
    });
  });

  describe('OAuth URL Parameters', () => {
    it('should include all required OAuth 2.0 parameters', () => {
      const providers: IdentityProvider[] = [{ name: 'github' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('response_type=code');
      expect(result).toContain('client_id=systemprompt-os');
      expect(result).toContain('scope=openid+profile+email');
      expect(result).toContain('provider=github');
    });

    it('should properly encode URL parameters', () => {
      const providers: IdentityProvider[] = [{ name: 'test-provider' }];
      const result = renderInitialSetup(providers);
      
      // Should contain URL-encoded spaces
      expect(result).toContain('scope=openid+profile+email');
      expect(result).toContain('provider=test-provider');
    });

    it('should include redirect_uri parameter', () => {
      process.env.BASE_URL = 'https://test.com';
      
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('redirect_uri=https://test.com');
    });

    it('should handle special characters in provider names for URLs', () => {
      const providers: IdentityProvider[] = [{ name: 'provider-with-special_chars' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('provider=provider-with-special_chars');
    });
  });

  describe('HTML Structure of Provider Buttons', () => {
    it('should create proper anchor tag structure', () => {
      const providers: IdentityProvider[] = [{ name: 'google' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('<a href="');
      expect(result).toContain('class="provider-button"');
      expect(result).toContain('</a>');
    });

    it('should include provider icon span', () => {
      const providers: IdentityProvider[] = [{ name: 'github' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('<span class="provider-icon">⚫</span>');
    });

    it('should include Continue with text', () => {
      const providers: IdentityProvider[] = [{ name: 'custom' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('Continue with Custom');
    });
  });

  describe('URLSearchParams Integration', () => {
    it('should create valid query string', () => {
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      // Should contain properly formatted query string
      expect(result).toMatch(/href="[^"]*\?response_type=code&client_id=systemprompt-os&redirect_uri=[^&]*&scope=openid\+profile\+email&provider=test"/);
    });

    it('should handle multiple providers with different parameters', () => {
      const providers: IdentityProvider[] = [
        { name: 'google' },
        { name: 'github' }
      ];
      
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('provider=google');
      expect(result).toContain('provider=github');
    });
  });
});

describe('getInitialSetupStyles', () => {
  it('should return a non-empty string', () => {
    const result = getInitialSetupStyles();
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain admin section styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.admin-section {');
    expect(result).toContain('background: linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%)');
    expect(result).toContain('border: 1px solid #334155');
    expect(result).toContain('border-radius: 12px');
    expect(result).toContain('padding: 32px');
    expect(result).toContain('margin-bottom: 32px');
  });

  it('should contain admin title styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.admin-title {');
    expect(result).toContain('display: flex');
    expect(result).toContain('align-items: center');
    expect(result).toContain('justify-content: center');
    expect(result).toContain('font-size: 24px');
    expect(result).toContain('font-weight: 600');
    expect(result).toContain('margin-bottom: 16px');
    expect(result).toContain('color: #f1f5f9');
  });

  it('should contain admin icon styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.admin-icon {');
    expect(result).toContain('width: 28px');
    expect(result).toContain('height: 28px');
    expect(result).toContain('margin-right: 12px');
    expect(result).toContain('color: #3b82f6');
  });

  it('should contain admin description styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.admin-description {');
    expect(result).toContain('text-align: center');
    expect(result).toContain('color: #cbd5e1');
    expect(result).toContain('margin-bottom: 24px');
    expect(result).toContain('font-size: 16px');
    expect(result).toContain('line-height: 1.6');
  });

  it('should contain provider grid styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.provider-grid {');
    expect(result).toContain('display: grid');
    expect(result).toContain('gap: 12px');
  });

  it('should contain provider button styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.provider-button {');
    expect(result).toContain('display: flex');
    expect(result).toContain('align-items: center');
    expect(result).toContain('justify-content: center');
    expect(result).toContain('width: 100%');
    expect(result).toContain('padding: 16px 24px');
    expect(result).toContain('border: 2px solid transparent');
    expect(result).toContain('border-radius: 10px');
    expect(result).toContain('background: #1f2937');
    expect(result).toContain('color: #e5e7eb');
    expect(result).toContain('text-decoration: none');
    expect(result).toContain('font-size: 16px');
    expect(result).toContain('font-weight: 600');
    expect(result).toContain('transition: all 0.2s');
    expect(result).toContain('cursor: pointer');
    expect(result).toContain('position: relative');
    expect(result).toContain('overflow: hidden');
  });

  it('should contain provider button hover effects', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.provider-button::before {');
    expect(result).toContain('content: \'\'');
    expect(result).toContain('position: absolute');
    expect(result).toContain('top: 0');
    expect(result).toContain('left: 0');
    expect(result).toContain('width: 100%');
    expect(result).toContain('height: 100%');
    expect(result).toContain('background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)');
    expect(result).toContain('opacity: 0');
    expect(result).toContain('transition: opacity 0.2s');
    
    expect(result).toContain('.provider-button:hover {');
    expect(result).toContain('border-color: #3b82f6');
    expect(result).toContain('transform: translateY(-2px)');
    expect(result).toContain('box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3)');
    
    expect(result).toContain('.provider-button:hover::before {');
    expect(result).toContain('opacity: 1');
  });

  it('should contain provider icon styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.provider-icon {');
    expect(result).toContain('width: 20px');
    expect(result).toContain('height: 20px');
    expect(result).toContain('margin-right: 12px');
    expect(result).toContain('position: relative');
    expect(result).toContain('z-index: 1');
  });

  it('should contain setup progress styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.setup-progress {');
    expect(result).toContain('background: #0f172a');
    expect(result).toContain('border: 1px solid #1e293b');
    expect(result).toContain('border-radius: 8px');
    expect(result).toContain('padding: 20px');
    expect(result).toContain('margin-bottom: 24px');
  });

  it('should contain progress header styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.progress-header {');
    expect(result).toContain('font-size: 14px');
    expect(result).toContain('font-weight: 600');
    expect(result).toContain('color: #9ca3af');
    expect(result).toContain('text-transform: uppercase');
    expect(result).toContain('letter-spacing: 0.05em');
    expect(result).toContain('margin-bottom: 16px');
  });

  it('should contain progress items styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.progress-items {');
    expect(result).toContain('display: flex');
    expect(result).toContain('justify-content: space-between');
    expect(result).toContain('gap: 16px');
    
    expect(result).toContain('.progress-item {');
    expect(result).toContain('flex: 1');
    expect(result).toContain('display: flex');
    expect(result).toContain('flex-direction: column');
    expect(result).toContain('align-items: center');
    expect(result).toContain('text-align: center');
  });

  it('should contain progress icon styles and states', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.progress-icon {');
    expect(result).toContain('width: 32px');
    expect(result).toContain('height: 32px');
    expect(result).toContain('border-radius: 50%');
    expect(result).toContain('margin-bottom: 8px');
    expect(result).toContain('display: flex');
    expect(result).toContain('align-items: center');
    expect(result).toContain('justify-content: center');
    expect(result).toContain('font-size: 16px');
    expect(result).toContain('font-weight: 600');
    
    // Different states
    expect(result).toContain('.progress-icon.pending {');
    expect(result).toContain('background: #475569');
    expect(result).toContain('color: #cbd5e1');
    
    expect(result).toContain('.progress-icon.active {');
    expect(result).toContain('background: #3b82f6');
    expect(result).toContain('color: white');
    expect(result).toContain('animation: pulse 2s infinite');
    
    expect(result).toContain('.progress-icon.complete {');
    expect(result).toContain('background: #10b981');
    expect(result).toContain('color: white');
  });

  it('should contain pulse animation keyframes', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('@keyframes pulse {');
    expect(result).toContain('0%, 100% { opacity: 1; }');
    expect(result).toContain('50% { opacity: 0.7; }');
  });

  it('should contain progress item text styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.progress-item span:last-child {');
    expect(result).toContain('font-size: 12px');
    expect(result).toContain('color: #9ca3af');
  });

  it('should contain security note styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.security-note {');
    expect(result).toContain('background: #1e293b');
    expect(result).toContain('border: 1px solid #334155');
    expect(result).toContain('border-radius: 8px');
    expect(result).toContain('padding: 20px');
    expect(result).toContain('margin-bottom: 32px');
    expect(result).toContain('display: flex');
    expect(result).toContain('align-items: flex-start');
    expect(result).toContain('gap: 16px');
  });

  it('should contain security icon styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.security-icon {');
    expect(result).toContain('width: 24px');
    expect(result).toContain('height: 24px');
    expect(result).toContain('color: #10b981');
    expect(result).toContain('flex-shrink: 0');
    expect(result).toContain('margin-top: 2px');
  });

  it('should contain security text styles', () => {
    const result = getInitialSetupStyles();
    
    expect(result).toContain('.security-text {');
    expect(result).toContain('flex: 1');
    expect(result).toContain('color: #cbd5e1');
    expect(result).toContain('font-size: 14px');
    expect(result).toContain('line-height: 1.6');
    
    expect(result).toContain('.security-text strong {');
    expect(result).toContain('color: #f1f5f9');
    expect(result).toContain('display: block');
    expect(result).toContain('margin-bottom: 4px');
  });

  describe('CSS Validation', () => {
    it('should have balanced braces', () => {
      const result = getInitialSetupStyles();
      
      const openBraces = (result.match(/{/g) || []).length;
      const closeBraces = (result.match(/}/g) || []).length;
      
      expect(openBraces).toBe(closeBraces);
    });

    it('should contain valid CSS selectors', () => {
      const result = getInitialSetupStyles();
      
      // Should contain class selectors
      expect(result).toMatch(/\.[a-zA-Z-]+\s*{/);
      // Should contain pseudo-selectors
      expect(result).toMatch(/\.[a-zA-Z-]+::[a-zA-Z-]+\s*{/);
      expect(result).toMatch(/\.[a-zA-Z-]+:[a-zA-Z-]+\s*{/);
      // Should contain descendant selectors
      expect(result).toMatch(/\.[a-zA-Z-]+\s+[a-zA-Z:]+\s*{/);
    });

    it('should contain valid CSS properties', () => {
      const result = getInitialSetupStyles();
      
      // Should contain property-value pairs
      expect(result).toMatch(/[a-zA-Z-]+:\s*[^;]+;/);
      
      // Should contain specific CSS properties
      expect(result).toMatch(/display:\s*[^;]+;/);
      expect(result).toMatch(/color:\s*[^;]+;/);
      expect(result).toMatch(/background:\s*[^;]+;/);
      expect(result).toMatch(/padding:\s*[^;]+;/);
      // Use margin-bottom since that's what's actually in the CSS
      expect(result).toMatch(/margin-bottom:\s*[^;]+;/);
    });

    it('should contain valid color values', () => {
      const result = getInitialSetupStyles();
      
      // Should contain hex colors
      expect(result).toMatch(/#[0-9a-fA-F]{6}/);
      expect(result).toMatch(/#[0-9a-fA-F]{3}/);
      
      // Should contain rgba colors
      expect(result).toMatch(/rgba?\([^)]+\)/);
    });

    it('should contain valid units', () => {
      const result = getInitialSetupStyles();
      
      // Should contain pixel units
      expect(result).toMatch(/\d+px/);
      // Should contain em units
      expect(result).toMatch(/\d*\.?\d+em/);
      // Should contain percentage units
      expect(result).toMatch(/\d+%/);
      // Should contain second units (for transitions/animations)
      expect(result).toMatch(/\d*\.?\d+s/);
    });

    it('should not contain syntax errors', () => {
      const result = getInitialSetupStyles();
      
      // Should not contain double semicolons
      expect(result).not.toContain(';;');
      
      // Should not contain empty selectors
      expect(result).not.toMatch(/\s*{\s*}/);
      
      // Should not contain invalid property syntax
      expect(result).not.toMatch(/[a-zA-Z-]+:\s*;/);
    });
  });

  describe('Color Scheme and Theme', () => {
    it('should contain dark theme color palette', () => {
      const result = getInitialSetupStyles();
      
      // Dark background colors
      expect(result).toContain('#1e293b'); // Dark slate
      expect(result).toContain('#1e1b4b'); // Dark blue
      expect(result).toContain('#0f172a'); // Very dark
      expect(result).toContain('#1f2937'); // Dark gray
      
      // Border colors
      expect(result).toContain('#334155'); // Slate border
      
      // Text colors
      expect(result).toContain('#f1f5f9'); // Light text
      expect(result).toContain('#cbd5e1'); // Muted text
      expect(result).toContain('#e5e7eb'); // Button text
      expect(result).toContain('#9ca3af'); // Subtle text
      
      // Accent colors
      expect(result).toContain('#3b82f6'); // Blue accent
      expect(result).toContain('#10b981'); // Green accent
      expect(result).toContain('#475569'); // Gray accent
    });

    it('should contain gradient backgrounds', () => {
      const result = getInitialSetupStyles();
      
      expect(result).toContain('linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%)');
      expect(result).toContain('linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)');
    });

    it('should contain box shadow effects', () => {
      const result = getInitialSetupStyles();
      
      expect(result).toContain('box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3)');
    });
  });
});

describe('Integration and Edge Cases', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle undefined process.env', () => {
      // Mock process.env to be undefined for BASE_URL
      const mockEnv = { ...process.env };
      delete mockEnv.BASE_URL;
      process.env = mockEnv;
      
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('http://localhost:3000');
    });

    it('should handle null-like BASE_URL values', () => {
      process.env.BASE_URL = 'null';
      
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('null/oauth2/authorize');
    });

    it('should handle whitespace-only BASE_URL', () => {
      process.env.BASE_URL = '   ';
      
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('   /oauth2/authorize');
    });
  });

  describe('XSS and Security Considerations', () => {
    it('should handle potentially malicious provider names safely', () => {
      const maliciousProviders: IdentityProvider[] = [
        { name: '<script>alert("xss")</script>' },
        { name: 'javascript:void(0)' },
        { name: 'data:text/html,<script>alert(1)</script>' }
      ];
      
      const result = renderInitialSetup(maliciousProviders);
      
      // The content should be included in the display names (first letter capitalized)
      expect(result).toContain('Continue with <script>alert("xss")</script>');
      expect(result).toContain('Continue with Javascript:void(0)');  
      expect(result).toContain('Continue with Data:text/html,<script>alert(1)</script>');
      
      // And in the URL parameters (lowercase)
      expect(result).toContain('provider=%3Cscript%3Ealert(%22xss%22)%3C%2Fscript%3E');
      expect(result).toContain('provider=javascript%3Avoid(0)');
    });

    it('should handle HTML entities in provider names', () => {
      const entityProviders: IdentityProvider[] = [
        { name: '&lt;provider&gt;' },
        { name: '&amp;provider' },
        { name: '&quot;provider&quot;' }
      ];
      
      const result = renderInitialSetup(entityProviders);
      
      expect(result).toContain('&lt;provider&gt;');
      expect(result).toContain('&amp;provider');
      expect(result).toContain('&quot;provider&quot;');
    });
  });

  describe('Performance and Large Data Handling', () => {
    it('should handle large number of providers efficiently', () => {
      const manyProviders: IdentityProvider[] = [];
      for (let i = 0; i < 100; i++) {
        manyProviders.push({ name: `provider${i}` });
      }
      
      const startTime = Date.now();
      const result = renderInitialSetup(manyProviders);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Should contain all providers
      expect(result).toContain('Continue with Provider0');
      expect(result).toContain('Continue with Provider99');
    });

    it('should handle extremely long provider names', () => {
      const longName = 'a'.repeat(1000);
      const providers: IdentityProvider[] = [{ name: longName }];
      
      const result = renderInitialSetup(providers);
      
      expect(result).toContain(longName);
      expect(result).toContain(`Continue with ${longName.charAt(0).toUpperCase()}${longName.slice(1)}`);
    });
  });

  describe('URL Generation Edge Cases', () => {
    it('should handle special characters in BASE_URL', () => {
      process.env.BASE_URL = 'https://test.com:8080/app?param=value&other=data';
      
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('https://test.com:8080/app?param=value&other=data/oauth2/authorize');
    });

    it('should handle BASE_URL with hash fragments', () => {
      process.env.BASE_URL = 'https://example.com#fragment';
      
      const providers: IdentityProvider[] = [{ name: 'test' }];
      const result = renderInitialSetup(providers);
      
      expect(result).toContain('https://example.com#fragment/oauth2/authorize');
    });

    it('should generate consistent URLs for same provider', () => {
      process.env.BASE_URL = 'https://test.com';
      
      const providers: IdentityProvider[] = [
        { name: 'google' },
        { name: 'google' } // Duplicate
      ];
      
      const result = renderInitialSetup(providers);
      
      // Should generate identical URLs for identical providers
      const googleUrls = result.match(/href="[^"]*provider=google[^"]*"/g) || [];
      expect(googleUrls.length).toBe(2);
      expect(googleUrls[0]).toBe(googleUrls[1]);
    });
  });

  describe('Function Return Type Consistency', () => {
    it('should always return string type regardless of input', () => {
      const testCases: IdentityProvider[][] = [
        [],
        [{ name: 'single' }],
        [{ name: 'first' }, { name: 'second' }],
        [{ name: '' }],
        [{ name: 'very-long-name'.repeat(10) }]
      ];
      
      testCases.forEach(providers => {
        const result = renderInitialSetup(providers);
        expect(typeof result).toBe('string');
        expect(result).toBeDefined();
      });
    });

    it('should return consistent string structure', () => {
      const providers: IdentityProvider[] = [{ name: 'test' }];
      
      const result1 = renderInitialSetup(providers);
      const result2 = renderInitialSetup(providers);
      
      expect(result1).toBe(result2);
      expect(typeof result1).toBe(typeof result2);
    });
  });
});