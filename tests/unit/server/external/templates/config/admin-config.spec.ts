/**
 * @fileoverview Unit tests for Admin Configuration Template
 * @module tests/unit/server/external/templates/config/admin-config
 */

import { describe, it, expect } from 'vitest';
import { 
  renderAdminConfig, 
  getAdminConfigStyles, 
  type AdminConfigData 
} from '../../../../../../src/server/external/templates/config/admin-config.js';

describe('AdminConfigData Interface', () => {
  it('should validate valid AdminConfigData object', () => {
    const validData: AdminConfigData = {
      cloudflareUrl: 'https://example.com',
      tunnelStatus: 'Active',
      version: '1.0.0',
      environment: 'production',
      googleConfigured: true,
      githubConfigured: false
    };

    // Type validation - this test ensures the interface is correctly defined
    expect(validData.cloudflareUrl).toBe('https://example.com');
    expect(validData.tunnelStatus).toBe('Active');
    expect(validData.version).toBe('1.0.0');
    expect(validData.environment).toBe('production');
    expect(validData.googleConfigured).toBe(true);
    expect(validData.githubConfigured).toBe(false);
  });

  it('should accept all required properties as strings and booleans', () => {
    const data: AdminConfigData = {
      cloudflareUrl: '',
      tunnelStatus: '',
      version: '',
      environment: '',
      googleConfigured: false,
      githubConfigured: false
    };

    expect(typeof data.cloudflareUrl).toBe('string');
    expect(typeof data.tunnelStatus).toBe('string');
    expect(typeof data.version).toBe('string');
    expect(typeof data.environment).toBe('string');
    expect(typeof data.googleConfigured).toBe('boolean');
    expect(typeof data.githubConfigured).toBe('boolean');
  });
});

describe('renderAdminConfig', () => {
  const baseTestData: AdminConfigData = {
    cloudflareUrl: 'https://test.example.com',
    tunnelStatus: 'Active',
    version: '1.2.3',
    environment: 'production',
    googleConfigured: true,
    githubConfigured: true
  };

  it('should return a non-empty string', () => {
    const result = renderAdminConfig(baseTestData);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain all required HTML structure elements', () => {
    const result = renderAdminConfig(baseTestData);
    
    // Check for main container
    expect(result).toContain('class="config-container"');
    
    // Check for header
    expect(result).toContain('class="config-header"');
    expect(result).toContain('<h1>System Configuration</h1>');
    expect(result).toContain('SystemPrompt OS Control Center');
    
    // Check for main sections
    expect(result).toContain('class="top-section"');
    expect(result).toContain('class="status-card"');
    expect(result).toContain('class="oauth-card"');
    expect(result).toContain('class="summary-card"');
    expect(result).toContain('class="terminal-wrapper"');
    expect(result).toContain('class="command-reference"');
  });

  it('should display data values correctly', () => {
    const testData: AdminConfigData = {
      cloudflareUrl: 'https://custom.domain.com',
      tunnelStatus: 'Active',
      version: '2.1.0',
      environment: 'development',
      googleConfigured: true,
      githubConfigured: false
    };

    const result = renderAdminConfig(testData);
    
    expect(result).toContain('https://custom.domain.com');
    expect(result).toContain('Active');
    expect(result).toContain('2.1.0');
    expect(result).toContain('development');
  });

  describe('Tunnel Status Conditions', () => {
    it('should render active status indicator when tunnel is Active', () => {
      const activeData: AdminConfigData = {
        ...baseTestData,
        tunnelStatus: 'Active'
      };

      const result = renderAdminConfig(activeData);
      
      // Should contain active class for status indicator
      expect(result).toContain('status-indicator active');
      // Should contain active class for status value
      expect(result).toContain('status-value active');
      expect(result).toContain('Active');
    });

    it('should render inactive status indicator when tunnel is not Active', () => {
      const inactiveData: AdminConfigData = {
        ...baseTestData,
        tunnelStatus: 'Inactive'
      };

      const result = renderAdminConfig(inactiveData);
      
      // Should contain inactive class for status indicator
      expect(result).toContain('status-indicator inactive');
      // Should contain inactive class for status value  
      expect(result).toContain('status-value inactive');
      expect(result).toContain('Inactive');
    });

    it('should handle custom tunnel status values', () => {
      const customStatusData: AdminConfigData = {
        ...baseTestData,
        tunnelStatus: 'Connecting'
      };

      const result = renderAdminConfig(customStatusData);
      
      // Should default to inactive for non-Active values
      expect(result).toContain('status-indicator inactive');
      expect(result).toContain('status-value inactive');
      expect(result).toContain('Connecting');
    });

    it('should handle empty tunnel status', () => {
      const emptyStatusData: AdminConfigData = {
        ...baseTestData,
        tunnelStatus: ''
      };

      const result = renderAdminConfig(emptyStatusData);
      
      expect(result).toContain('status-indicator inactive');
      expect(result).toContain('status-value inactive');
    });
  });

  describe('Environment CSS Classes', () => {
    it('should apply production environment class', () => {
      const prodData: AdminConfigData = {
        ...baseTestData,
        environment: 'production'
      };

      const result = renderAdminConfig(prodData);
      expect(result).toContain('env-production');
      expect(result).toContain('production');
    });

    it('should apply development environment class', () => {
      const devData: AdminConfigData = {
        ...baseTestData,
        environment: 'development'
      };

      const result = renderAdminConfig(devData);
      expect(result).toContain('env-development');
      expect(result).toContain('development');
    });

    it('should handle custom environment values', () => {
      const customEnvData: AdminConfigData = {
        ...baseTestData,
        environment: 'staging'
      };

      const result = renderAdminConfig(customEnvData);
      expect(result).toContain('env-staging');
      expect(result).toContain('staging');
    });

    it('should handle empty environment', () => {
      const emptyEnvData: AdminConfigData = {
        ...baseTestData,
        environment: ''
      };

      const result = renderAdminConfig(emptyEnvData);
      expect(result).toContain('env-');
    });
  });

  describe('OAuth Provider Configuration', () => {
    it('should show Google as configured when googleConfigured is true', () => {
      const googleConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: true,
        githubConfigured: false
      };

      const result = renderAdminConfig(googleConfiguredData);
      
      // Google should have configured class and checkmark
      expect(result).toContain('provider-item configured');
      expect(result).toContain('Google');
      expect(result).toContain('✓');
    });

    it('should show Google as not configured when googleConfigured is false', () => {
      const googleNotConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: false,
        githubConfigured: true
      };

      const result = renderAdminConfig(googleNotConfiguredData);
      
      // Should contain Google provider but without configured class on first occurrence
      expect(result).toContain('Google');
      expect(result).toContain('×');
    });

    it('should show GitHub as configured when githubConfigured is true', () => {
      const githubConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: false,
        githubConfigured: true
      };

      const result = renderAdminConfig(githubConfiguredData);
      
      expect(result).toContain('GitHub');
      expect(result).toContain('✓');
    });

    it('should show GitHub as not configured when githubConfigured is false', () => {
      const githubNotConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: true,
        githubConfigured: false
      };

      const result = renderAdminConfig(githubNotConfiguredData);
      
      expect(result).toContain('GitHub');
      expect(result).toContain('×');
    });

    it('should handle both providers configured', () => {
      const bothConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: true,
        githubConfigured: true
      };

      const result = renderAdminConfig(bothConfiguredData);
      
      expect(result).toContain('Google');
      expect(result).toContain('GitHub');
      // Should contain multiple checkmarks for configured providers
      const checkmarks = (result.match(/✓/g) || []).length;
      expect(checkmarks).toBe(2);
    });

    it('should handle both providers not configured', () => {
      const noneConfiguredData: AdminConfigData = {
        ...baseTestData,
        googleConfigured: false,
        githubConfigured: false
      };

      const result = renderAdminConfig(noneConfiguredData);
      
      expect(result).toContain('Google');
      expect(result).toContain('GitHub');
      // Should contain multiple X marks for unconfigured providers
      const xMarks = (result.match(/×/g) || []).length;
      expect(xMarks).toBe(2);
    });
  });

  describe('Terminal and JavaScript Functionality', () => {
    it('should include terminal HTML structure', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('class="terminal-container"');
      expect(result).toContain('class="terminal-header"');
      expect(result).toContain('class="terminal-output"');
      expect(result).toContain('class="terminal-input-line"');
      expect(result).toContain('id="terminal-input"');
    });

    it('should include welcome art with version', () => {
      const versionData: AdminConfigData = {
        ...baseTestData,
        version: '3.2.1'
      };

      const result = renderAdminConfig(versionData);
      
      expect(result).toContain('Welcome to SystemPrompt OS Terminal v3.2.1');
      expect(result).toContain('class="welcome-art"');
    });

    it('should include JavaScript functionality', () => {
      const result = renderAdminConfig(baseTestData);
      
      // Check for key JavaScript functions
      expect(result).toContain('function executeCommand');
      expect(result).toContain('function clearTerminal');
      expect(result).toContain('function toggleFullscreen');
      expect(result).toContain('function loadAvailableCommands');
      expect(result).toContain('function loadSystemSummary');
      expect(result).toContain('function formatOutput');
      expect(result).toContain('function escapeHtml');
    });

    it('should include event listeners', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('addEventListener');
      expect(result).toContain("addEventListener('click'");
      expect(result).toContain("addEventListener('load'");
      expect(result).toContain("addEventListener('keydown'");
    });

    it('should include API endpoints', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('/api/terminal/execute');
      expect(result).toContain('/api/terminal/commands');
      expect(result).toContain('/api/terminal/summary');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle special characters in data fields', () => {
      const specialCharsData: AdminConfigData = {
        cloudflareUrl: 'https://test.com?param=value&other=<script>',
        tunnelStatus: 'Active & Running',
        version: '1.0.0-beta+build.123',
        environment: 'test-env_special',
        googleConfigured: true,
        githubConfigured: false
      };

      const result = renderAdminConfig(specialCharsData);
      
      expect(result).toContain('https://test.com?param=value&other=<script>');
      expect(result).toContain('Active & Running');
      expect(result).toContain('1.0.0-beta+build.123');
      expect(result).toContain('test-env_special');
    });

    it('should handle empty string values', () => {
      const emptyStringsData: AdminConfigData = {
        cloudflareUrl: '',
        tunnelStatus: '',
        version: '',
        environment: '',
        googleConfigured: false,
        githubConfigured: false
      };

      const result = renderAdminConfig(emptyStringsData);
      
      // Should still render structure even with empty values
      expect(result).toContain('class="config-container"');
      expect(result).toContain('class="status-grid"');
      expect(result).toContain('Welcome to SystemPrompt OS Terminal v');
    });

    it('should handle very long string values', () => {
      const longStringsData: AdminConfigData = {
        cloudflareUrl: 'https://very-long-domain-name-that-exceeds-normal-length.example.com/with/very/long/path/segments',
        tunnelStatus: 'This is a very long tunnel status message that might wrap',
        version: '1.0.0-alpha.1.2.3.4.5.6.7.8.9.10.11.12.13.14.15',
        environment: 'very-long-environment-name-for-testing-purposes',
        googleConfigured: true,
        githubConfigured: true
      };

      const result = renderAdminConfig(longStringsData);
      
      expect(result).toContain(longStringsData.cloudflareUrl);
      expect(result).toContain(longStringsData.tunnelStatus);
      expect(result).toContain(longStringsData.version);
      expect(result).toContain(longStringsData.environment);
    });

    it('should handle Unicode characters', () => {
      const unicodeData: AdminConfigData = {
        cloudflareUrl: 'https://测试.example.com',
        tunnelStatus: 'Активный',
        version: '1.0.0-α',
        environment: 'тест',
        googleConfigured: true,
        githubConfigured: false
      };

      const result = renderAdminConfig(unicodeData);
      
      expect(result).toContain('https://测试.example.com');
      expect(result).toContain('Активный');
      expect(result).toContain('1.0.0-α');
      expect(result).toContain('тест');
    });
  });

  describe('Summary Section Elements', () => {
    it('should include summary grid structure', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('class="summary-grid"');
      expect(result).toContain('class="summary-item"');
      expect(result).toContain('class="summary-icon users"');
      expect(result).toContain('class="summary-icon modules"');
      expect(result).toContain('class="summary-icon database"');
      expect(result).toContain('class="summary-icon tools"');
    });

    it('should include summary labels', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('Registered Users');
      expect(result).toContain('Active Modules');
      expect(result).toContain('Database Status');
      expect(result).toContain('MCP Tools');
    });

    it('should include summary value containers', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('id="user-count"');
      expect(result).toContain('id="module-count"');
      expect(result).toContain('id="db-status"');
      expect(result).toContain('id="tool-count"');
    });
  });

  describe('Command Reference Section', () => {
    it('should include command reference structure', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('class="command-reference"');
      expect(result).toContain('Command Reference');
      expect(result).toContain('id="command-grid"');
      expect(result).toContain('class="loading-commands"');
      expect(result).toContain('Loading available commands...');
    });

    it('should include fallback commands', () => {
      const result = renderAdminConfig(baseTestData);
      
      expect(result).toContain('systemprompt --help');
      expect(result).toContain('systemprompt --version');
      expect(result).toContain('systemprompt cli:list');
      expect(result).toContain('systemprompt extension:list');
      expect(result).toContain('systemprompt auth:providers');
      expect(result).toContain('systemprompt database:status');
      expect(result).toContain('systemprompt config:list');
      expect(result).toContain('systemprompt tools:list');
    });
  });
});

describe('getAdminConfigStyles', () => {
  it('should return a non-empty string', () => {
    const result = getAdminConfigStyles();
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain CSS reset and base styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('* {');
    expect(result).toContain('box-sizing: border-box');
    expect(result).toContain('body {');
    expect(result).toContain('margin: 0');
    expect(result).toContain('padding: 0');
  });

  it('should contain main container styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.config-container {');
    expect(result).toContain('.config-header {');
    expect(result).toContain('.top-section {');
  });

  it('should contain card styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.status-card');
    expect(result).toContain('.oauth-card');
    expect(result).toContain('.summary-card');
    expect(result).toContain('.card-header');
  });

  it('should contain status indicator styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.status-indicator');
    expect(result).toContain('.status-indicator.active');
    expect(result).toContain('.status-indicator.inactive');
    expect(result).toContain('@keyframes pulse');
  });

  it('should contain OAuth provider styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.provider-list');
    expect(result).toContain('.provider-item');
    expect(result).toContain('.provider-icon');
    expect(result).toContain('.provider-name');
    expect(result).toContain('.provider-status');
  });

  it('should contain summary section styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.summary-grid');
    expect(result).toContain('.summary-item');
    expect(result).toContain('.summary-icon');
    expect(result).toContain('.summary-content');
    expect(result).toContain('.summary-value');
    expect(result).toContain('.summary-label');
  });

  it('should contain terminal styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.terminal-wrapper');
    expect(result).toContain('.terminal-container');
    expect(result).toContain('.terminal-header');
    expect(result).toContain('.terminal-output');
    expect(result).toContain('.terminal-input');
  });

  it('should contain responsive media queries', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('@media (max-width: 768px)');
  });

  it('should contain animation keyframes', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('@keyframes pulse');
    expect(result).toContain('@keyframes spin');
  });

  it('should contain environment-specific styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.env-production');
    expect(result).toContain('.env-development');
  });

  it('should contain command reference styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.command-reference');
    expect(result).toContain('.command-grid');
    expect(result).toContain('.command-section');
    expect(result).toContain('.command-list');
  });

  it('should contain loading spinner styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.loading-spinner');
    expect(result).toContain('.loading-indicator');
    expect(result).toContain('.loading-commands');
  });

  it('should contain terminal control styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.terminal-ctrl');
    expect(result).toContain('.terminal-tabs');
    expect(result).toContain('.terminal-tab');
    expect(result).toContain('.terminal-controls');
  });

  it('should contain color and theme variables', () => {
    const result = getAdminConfigStyles();
    
    // Check for dark theme colors
    expect(result).toContain('#0a0e27');
    expect(result).toContain('#e2e8f0');
    expect(result).toContain('#1e293b');
    expect(result).toContain('#334155');
  });

  it('should contain fullscreen styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('.terminal-wrapper.fullscreen');
    expect(result).toContain('position: fixed');
    expect(result).toContain('z-index: 1000');
  });

  it('should contain scrollbar styles', () => {
    const result = getAdminConfigStyles();
    
    expect(result).toContain('::-webkit-scrollbar');
    expect(result).toContain('::-webkit-scrollbar-track');
    expect(result).toContain('::-webkit-scrollbar-thumb');
  });

  it('should be valid CSS format', () => {
    const result = getAdminConfigStyles();
    
    // Check for proper CSS structure
    const openBraces = (result.match(/{/g) || []).length;
    const closeBraces = (result.match(/}/g) || []).length;
    expect(openBraces).toBe(closeBraces);
    
    // Should contain selectors and properties
    expect(result).toMatch(/\.[a-zA-Z-]+\s*{/);
    expect(result).toMatch(/[a-zA-Z-]+:\s*[^;]+;/);
  });
});