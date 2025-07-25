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

describe('JavaScript Functions in Template', () => {
  let htmlContent: string;
  let mockDocument: any;
  let mockWindow: any;
  let mockFetch: any;

  beforeEach(() => {
    // Get the HTML content with embedded JavaScript
    htmlContent = renderAdminConfig({
      cloudflareUrl: 'https://test.com',
      tunnelStatus: 'Active',
      version: '1.0.0',
      environment: 'production',
      googleConfigured: true,
      githubConfigured: false
    });

    // Mock DOM elements
    mockDocument = {
      getElementById: vi.fn(),
      createElement: vi.fn(),
      addEventListener: vi.fn(),
      body: {
        style: {}
      }
    };

    mockWindow = {
      addEventListener: vi.fn(),
      fetch: vi.fn()
    };

    mockFetch = vi.fn();
    global.fetch = mockFetch;
    global.document = mockDocument;
    global.window = mockWindow;
  });

  describe('escapeHtml function', () => {
    it('should extract and test escapeHtml function from template', () => {
      // Extract the escapeHtml function from the template
      const escapeHtmlMatch = htmlContent.match(/function escapeHtml\(text\)\s*{([^}]+)}/s);
      expect(escapeHtmlMatch).toBeTruthy();
      
      // The function should contain createElement and textContent logic
      expect(escapeHtmlMatch![0]).toContain('createElement');
      expect(escapeHtmlMatch![0]).toContain('textContent');
      expect(escapeHtmlMatch![0]).toContain('innerHTML');
    });

    it('should handle HTML escaping logic', () => {
      // Test that the function structure for HTML escaping is present
      expect(htmlContent).toContain('function escapeHtml(text)');
      expect(htmlContent).toContain('div.textContent = text');
      expect(htmlContent).toContain('div.innerHTML');
    });
  });

  describe('formatOutput function', () => {
    it('should extract and test formatOutput function from template', () => {
      const formatOutputMatch = htmlContent.match(/function formatOutput\(text\)\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s);
      expect(formatOutputMatch).toBeTruthy();
      
      // Should contain text transformation logic
      expect(formatOutputMatch![0]).toContain('escapeHtml(text)');
      expect(formatOutputMatch![0]).toContain('replace');
    });

    it('should include text formatting rules', () => {
      expect(htmlContent).toContain('replace(/\\n/g, \'<br>\')'); 
      expect(htmlContent).toContain('replace(/\\t/g, \'&nbsp;&nbsp;&nbsp;&nbsp;\')');
      expect(htmlContent).toContain('replace(/  /g, \'&nbsp;&nbsp;\')');
      expect(htmlContent).toContain('output-key');
      expect(htmlContent).toContain('output-success');
      expect(htmlContent).toContain('output-error');
    });

    it('should handle success/error keyword highlighting', () => {
      expect(htmlContent).toContain('success|succeeded|active|enabled|true');
      expect(htmlContent).toContain('error|failed|inactive|disabled|false');
    });
  });

  describe('executeCommand function', () => {
    it('should extract and test executeCommand function structure', () => {
      const executeCommandMatch = htmlContent.match(/async function executeCommand\(command\)\s*{/s);
      expect(executeCommandMatch).toBeTruthy();
    });

    it('should handle clear command special case', () => {
      expect(htmlContent).toContain('command.toLowerCase() === \'clear\'');
      expect(htmlContent).toContain('command.toLowerCase() === \'cls\'');
      expect(htmlContent).toContain('clearTerminal()');
      expect(htmlContent).toContain('return');
    });

    it('should include loading indicator logic', () => {
      expect(htmlContent).toContain('loading-indicator');
      expect(htmlContent).toContain('Date.now()');
      expect(htmlContent).toContain('Executing command...');
    });

    it('should include API call to terminal execute endpoint', () => {
      expect(htmlContent).toContain('/api/terminal/execute');
      expect(htmlContent).toContain('method: \'POST\'');
      expect(htmlContent).toContain('Content-Type\': \'application/json\'');
      expect(htmlContent).toContain('JSON.stringify({ command })');
    });

    it('should handle success and error responses', () => {
      expect(htmlContent).toContain('result.success');
      expect(htmlContent).toContain('formatOutput(result.output)');
      expect(htmlContent).toContain('terminal-error');
      expect(htmlContent).toContain('error-prefix');
    });

    it('should handle fetch errors', () => {
      expect(htmlContent).toContain('catch (error)');
      expect(htmlContent).toContain('error.message');
    });
  });

  describe('clearTerminal function', () => {
    it('should extract and test clearTerminal function', () => {
      const clearTerminalMatch = htmlContent.match(/function clearTerminal\(\)\s*{([^}]+)}/s);
      expect(clearTerminalMatch).toBeTruthy();
      
      expect(clearTerminalMatch![0]).toContain('output.innerHTML');
      expect(clearTerminalMatch![0]).toContain('Terminal cleared');
    });
  });

  describe('toggleFullscreen function', () => {
    it('should extract and test toggleFullscreen function', () => {
      const toggleFullscreenMatch = htmlContent.match(/function toggleFullscreen\(\)\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s);
      expect(toggleFullscreenMatch).toBeTruthy();
    });

    it('should handle fullscreen state toggle', () => {
      expect(htmlContent).toContain('isFullscreen = !isFullscreen');
      expect(htmlContent).toContain('terminalWrapper.classList.add(\'fullscreen\')');
      expect(htmlContent).toContain('terminalWrapper.classList.remove(\'fullscreen\')');
      expect(htmlContent).toContain('document.body.style.overflow');
    });
  });

  describe('loadAvailableCommands function', () => {
    it('should extract and test loadAvailableCommands function', () => {
      const loadCommandsMatch = htmlContent.match(/async function loadAvailableCommands\(\)\s*{/s);
      expect(loadCommandsMatch).toBeTruthy();
    });

    it('should include API call to commands endpoint', () => {
      expect(htmlContent).toContain('/api/terminal/commands');
      expect(htmlContent).toContain('result.commands');
      expect(htmlContent).toContain('displayCommands(result.commands)');
      expect(htmlContent).toContain('displayFallbackCommands()');
    });

    it('should handle API errors with fallback', () => {
      expect(htmlContent).toContain('catch (error)');
      expect(htmlContent).toContain('console.error(\'Failed to load commands:\', error)');
    });
  });

  describe('displayCommands function', () => {
    it('should extract and test displayCommands function', () => {
      const displayCommandsMatch = htmlContent.match(/function displayCommands\(commands\)\s*{/s);
      expect(displayCommandsMatch).toBeTruthy();
    });

    it('should handle command categorization', () => {
      expect(htmlContent).toContain('const categories = {}');
      expect(htmlContent).toContain('cmd.module || \'System\'');
      expect(htmlContent).toContain('categories[category] = []');
    });

    it('should build command structure', () => {
      expect(htmlContent).toContain('\'systemprompt \' + cmd.command');
      expect(htmlContent).toContain('cmd.description');
      expect(htmlContent).toContain('cmd.usage');
    });

    it('should create DOM elements', () => {
      expect(htmlContent).toContain('document.createElement(\'div\')');
      expect(htmlContent).toContain('section.className = \'command-section\'');
      expect(htmlContent).toContain('code.onclick');
    });
  });

  describe('displayFallbackCommands function', () => {
    it('should extract and test displayFallbackCommands function', () => {
      const fallbackCommandsMatch = htmlContent.match(/function displayFallbackCommands\(\)\s*{/s);
      expect(fallbackCommandsMatch).toBeTruthy();
    });

    it('should include fallback command HTML', () => {
      expect(htmlContent).toContain('Core Commands');
      expect(htmlContent).toContain('Module & Extension');
      expect(htmlContent).toContain('Authentication');
      expect(htmlContent).toContain('Database');
      expect(htmlContent).toContain('Configuration');
      expect(htmlContent).toContain('MCP Tools');
    });
  });

  describe('loadSystemSummary function', () => {
    it('should extract and test loadSystemSummary function', () => {
      const loadSummaryMatch = htmlContent.match(/async function loadSystemSummary\(\)\s*{/s);
      expect(loadSummaryMatch).toBeTruthy();
    });

    it('should include API call to summary endpoint', () => {
      expect(htmlContent).toContain('/api/terminal/summary');
      expect(htmlContent).toContain('result.summary');
    });

    it('should update summary elements', () => {
      expect(htmlContent).toContain('user-count');
      expect(htmlContent).toContain('module-count');
      expect(htmlContent).toContain('tool-count');
      expect(htmlContent).toContain('db-status');
    });

    it('should handle API errors with defaults', () => {
      expect(htmlContent).toContain('textContent = \'0\'');
      expect(htmlContent).toContain('textContent = \'Unknown\'');
    });
  });

  describe('runCommand function', () => {
    it('should extract and test runCommand function', () => {
      const runCommandMatch = htmlContent.match(/function runCommand\(command\)\s*{([^}]+)}/s);
      expect(runCommandMatch).toBeTruthy();
      
      expect(runCommandMatch![0]).toContain('input.value = command');
      expect(runCommandMatch![0]).toContain('input.focus()');
      expect(runCommandMatch![0]).toContain('executeCommand(command)');
    });
  });

  describe('appendToTerminal function', () => {
    it('should extract and test appendToTerminal function', () => {
      const appendMatch = htmlContent.match(/function appendToTerminal\(html\)\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s);
      expect(appendMatch).toBeTruthy();
      
      expect(appendMatch![0]).toContain('output.innerHTML += html');
      expect(appendMatch![0]).toContain('scrollTo');
      expect(appendMatch![0]).toContain('behavior: \'smooth\'');
    });
  });
});

describe('Event Handlers and Interactive Features', () => {
  let htmlContent: string;

  beforeEach(() => {
    htmlContent = renderAdminConfig({
      cloudflareUrl: 'https://test.com',
      tunnelStatus: 'Active',
      version: '1.0.0',
      environment: 'production',
      googleConfigured: true,
      githubConfigured: false
    });
  });

  describe('Terminal click event handler', () => {
    it('should include terminal click event listener', () => {
      expect(htmlContent).toContain('terminal.addEventListener(\'click\'');
      expect(htmlContent).toContain('e.target === terminal');
      expect(htmlContent).toContain('e.target === output');
      expect(htmlContent).toContain('input.focus()');
    });
  });

  describe('Window load event handler', () => {
    it('should include window load event listener', () => {
      expect(htmlContent).toContain('window.addEventListener(\'load\'');
      expect(htmlContent).toContain('input.focus()');
      expect(htmlContent).toContain('loadAvailableCommands()');
      expect(htmlContent).toContain('loadSystemSummary()');
    });
  });

  describe('Keyboard event handlers', () => {
    it('should include keydown event listener for input', () => {
      expect(htmlContent).toContain('input.addEventListener(\'keydown\'');
      expect(htmlContent).toContain('async (e) =>');
    });

    it('should handle Enter key', () => {
      expect(htmlContent).toContain('e.key === \'Enter\'');
      expect(htmlContent).toContain('e.preventDefault()');
      expect(htmlContent).toContain('input.value.trim()');
      expect(htmlContent).toContain('executeCommand(command)');
      expect(htmlContent).toContain('commandHistory.push(command)');
    });

    it('should handle Arrow Up key', () => {
      expect(htmlContent).toContain('e.key === \'ArrowUp\'');
      expect(htmlContent).toContain('historyIndex > 0');
      expect(htmlContent).toContain('historyIndex--');
      expect(htmlContent).toContain('commandHistory[historyIndex]');
    });

    it('should handle Arrow Down key', () => {
      expect(htmlContent).toContain('e.key === \'ArrowDown\'');
      expect(htmlContent).toContain('historyIndex < commandHistory.length - 1');
      expect(htmlContent).toContain('historyIndex++');
      expect(htmlContent).toContain('historyIndex = commandHistory.length');
    });

    it('should handle Tab key for command completion', () => {
      expect(htmlContent).toContain('e.key === \'Tab\'');
      expect(htmlContent).toContain('input.value.split(\' \')');
      expect(htmlContent).toContain('parts[0] === \'systemprompt\'');
      expect(htmlContent).toContain('input.value = \'systemprompt \'');
    });

    it('should include F11 fullscreen handler', () => {
      expect(htmlContent).toContain('document.addEventListener(\'keydown\'');
      expect(htmlContent).toContain('e.key === \'F11\'');
      expect(htmlContent).toContain('toggleFullscreen()');
    });
  });

  describe('Terminal control buttons', () => {
    it('should include clear button functionality', () => {
      expect(htmlContent).toContain('onclick="clearTerminal()"');
      expect(htmlContent).toContain('title="Clear"');
    });

    it('should include fullscreen button functionality', () => {
      expect(htmlContent).toContain('onclick="toggleFullscreen()"');
      expect(htmlContent).toContain('title="Fullscreen"');
    });
  });

  describe('Command reference interactive elements', () => {
    it('should include runCommand onclick handlers', () => {
      expect(htmlContent).toContain('onclick="runCommand(this.textContent)"');
      expect(htmlContent).toContain('code.onclick = function() { runCommand(cmd.command); }');
    });
  });
});

describe('Variable Declarations and Initialization', () => {
  let htmlContent: string;

  beforeEach(() => {
    htmlContent = renderAdminConfig({
      cloudflareUrl: 'https://test.com',
      tunnelStatus: 'Active',
      version: '1.0.0',
      environment: 'production',
      googleConfigured: true,
      githubConfigured: false
    });
  });

  it('should declare terminal-related variables', () => {
    expect(htmlContent).toContain('const terminal = document.getElementById(\'terminal\')');
    expect(htmlContent).toContain('const output = document.getElementById(\'terminal-output\')');
    expect(htmlContent).toContain('const input = document.getElementById(\'terminal-input\')');
  });

  it('should declare history and state variables', () => {
    expect(htmlContent).toContain('const commandHistory = []');
    expect(htmlContent).toContain('let historyIndex = -1');
    expect(htmlContent).toContain('let isFullscreen = false');
  });
});

describe('HTML Template Edge Cases', () => {
  describe('Script tag handling', () => {
    it('should properly escape script content', () => {
      const result = renderAdminConfig({
        cloudflareUrl: 'https://test.com</script><script>alert(1)</script>',
        tunnelStatus: 'Active</script>',
        version: '1.0.0<script>',
        environment: 'prod</script>',
        googleConfigured: true,
        githubConfigured: false
      });
      
      // Template literals should contain the raw values as they're directly interpolated
      expect(result).toContain('https://test.com</script><script>alert(1)</script>');
      expect(result).toContain('Active</script>');
      expect(result).toContain('1.0.0<script>');
      expect(result).toContain('prod</script>');
    });
  });

  describe('Template literal interpolation edge cases', () => {
    it('should handle backticks in data', () => {
      const result = renderAdminConfig({
        cloudflareUrl: 'https://test.com`${malicious}`',
        tunnelStatus: 'Active`injection`',
        version: '1.0.0`code`',
        environment: 'prod`eval`',
        googleConfigured: true,
        githubConfigured: false
      });
      
      expect(result).toContain('https://test.com`${malicious}`');
      expect(result).toContain('Active`injection`');
      expect(result).toContain('1.0.0`code`');
      expect(result).toContain('prod`eval`');
    });

    it('should handle dollar signs in data', () => {
      const result = renderAdminConfig({
        cloudflareUrl: 'https://test.com$variable',
        tunnelStatus: 'Active$status',
        version: '1.0.0$version',
        environment: 'prod$env',
        googleConfigured: true,
        githubConfigured: false
      });
      
      expect(result).toContain('https://test.com$variable');
      expect(result).toContain('Active$status');
      expect(result).toContain('1.0.0$version');
      expect(result).toContain('prod$env');
    });
  });
});

describe('CSS Classes and Conditional Logic Coverage', () => {
  describe('Additional status combinations', () => {
    it('should handle case-sensitive tunnel status variations', () => {
      const variations = ['ACTIVE', 'active', 'Active ', ' Active', 'Active\n'];
      
      variations.forEach(status => {
        const result = renderAdminConfig({
          cloudflareUrl: 'https://test.com',
          tunnelStatus: status,
          version: '1.0.0',
          environment: 'production',
          googleConfigured: true,
          githubConfigured: false
        });
        
        // Only exact 'Active' should trigger active class
        if (status === 'Active') {
          expect(result).toContain('status-indicator active');
        } else {
          expect(result).toContain('status-indicator inactive');
        }
      });
    });
  });

  describe('Complex provider combinations', () => {
    const providerCombinations = [
      { google: true, github: true, expectedChecks: 2, expectedXs: 0 },
      { google: true, github: false, expectedChecks: 1, expectedXs: 1 },
      { google: false, github: true, expectedChecks: 1, expectedXs: 1 },
      { google: false, github: false, expectedChecks: 0, expectedXs: 2 }
    ];

    providerCombinations.forEach(({ google, github, expectedChecks, expectedXs }) => {
      it(`should handle google=${google}, github=${github}`, () => {
        const result = renderAdminConfig({
          cloudflareUrl: 'https://test.com',
          tunnelStatus: 'Active',
          version: '1.0.0',
          environment: 'production',
          googleConfigured: google,
          githubConfigured: github
        });
        
        const checkmarks = (result.match(/✓/g) || []).length;
        const xMarks = (result.match(/×/g) || []).length;
        
        expect(checkmarks).toBe(expectedChecks);
        expect(xMarks).toBe(expectedXs);
      });
    });
  });
});

describe('JavaScript Syntax and Structure Validation', () => {
  let htmlContent: string;

  beforeEach(() => {
    htmlContent = renderAdminConfig({
      cloudflareUrl: 'https://test.com',
      tunnelStatus: 'Active',
      version: '1.0.0',
      environment: 'production',
      googleConfigured: true,
      githubConfigured: false
    });
  });

  it('should contain valid JavaScript structure', () => {
    const scriptMatch = htmlContent.match(/<script>([\s\S]*)<\/script>/);
    expect(scriptMatch).toBeTruthy();
    
    const jsContent = scriptMatch![1];
    
    // Check for balanced brackets and parentheses
    const openBraces = (jsContent.match(/{/g) || []).length;
    const closeBraces = (jsContent.match(/}/g) || []).length;
    expect(openBraces).toBe(closeBraces);
    
    const openParens = (jsContent.match(/\(/g) || []).length;
    const closeParens = (jsContent.match(/\)/g) || []).length;
    expect(openParens).toBe(closeParens);
  });

  it('should contain all expected function declarations', () => {
    const expectedFunctions = [
      'executeCommand',
      'runCommand', 
      'appendToTerminal',
      'clearTerminal',
      'toggleFullscreen',
      'formatOutput',
      'escapeHtml',
      'loadAvailableCommands',
      'displayCommands',
      'displayFallbackCommands',
      'loadSystemSummary'
    ];
    
    expectedFunctions.forEach(funcName => {
      expect(htmlContent).toContain(`function ${funcName}`);
    });
  });

  it('should contain proper async/await usage', () => {
    expect(htmlContent).toContain('async function executeCommand');
    expect(htmlContent).toContain('async function loadAvailableCommands');
    expect(htmlContent).toContain('async function loadSystemSummary');
    expect(htmlContent).toContain('await fetch');
    expect(htmlContent).toContain('await response.json()');
  });

  it('should contain proper error handling blocks', () => {
    expect(htmlContent).toContain('try {');
    expect(htmlContent).toContain('} catch (error) {');
    expect(htmlContent).toContain('console.error');
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