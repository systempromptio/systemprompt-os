/**
 * @fileoverview Admin configuration page template with integrated terminal
 * @module server/external/templates/config/admin-config
 */

/**
 * Configuration data for admin page rendering
 */
export interface AdminConfigData {
  cloudflareUrl: string;
  tunnelStatus: string;
  version: string;
  environment: string;
  googleConfigured: boolean;
  githubConfigured: boolean;
}

/**
 * Renders the admin configuration page with terminal interface
 */
export function renderAdminConfig(data: AdminConfigData): string {
  return `
    <div class="config-container">
      <div class="config-header">
        <h1>System Configuration</h1>
        <p class="subtitle">SystemPrompt OS Control Center</p>
      </div>

      <!-- Top Section: Status & Actions -->
      <div class="top-section">
        <!-- System Status -->
        <div class="status-card">
          <div class="card-header">
            <h3>System Status</h3>
            <div class="status-indicator ${data.tunnelStatus === 'Active' ? 'active' : 'inactive'}"></div>
          </div>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-label">Base URL</span>
              <span class="status-value">${data.cloudflareUrl}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Tunnel Status</span>
              <span class="status-value ${data.tunnelStatus === 'Active' ? 'active' : 'inactive'}">
                ${data.tunnelStatus}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">Version</span>
              <span class="status-value">${data.version}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Environment</span>
              <span class="status-value env-${data.environment}">${data.environment}</span>
            </div>
          </div>
        </div>

        <!-- OAuth Status -->
        <div class="oauth-card">
          <div class="card-header">
            <h3>OAuth Providers</h3>
          </div>
          <div class="provider-list">
            <div class="provider-item ${data.googleConfigured ? 'configured' : ''}">
              <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span class="provider-name">Google</span>
              <span class="provider-status">
                ${data.googleConfigured ? '✓' : '×'}
              </span>
            </div>
            <div class="provider-item ${data.githubConfigured ? 'configured' : ''}">
              <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.164 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              <span class="provider-name">GitHub</span>
              <span class="provider-status">
                ${data.githubConfigured ? '✓' : '×'}
              </span>
            </div>
          </div>
        </div>

        <!-- System Summary -->
        <div class="summary-card">
          <div class="card-header">
            <h3>System Summary</h3>
          </div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-icon users">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                </svg>
              </div>
              <div class="summary-content">
                <div class="summary-value" id="user-count">-</div>
                <div class="summary-label">Registered Users</div>
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-icon modules">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/>
                </svg>
              </div>
              <div class="summary-content">
                <div class="summary-value" id="module-count">-</div>
                <div class="summary-label">Active Modules</div>
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-icon database">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/>
                  <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/>
                  <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/>
                </svg>
              </div>
              <div class="summary-content">
                <div class="summary-value" id="db-status">Active</div>
                <div class="summary-label">Database Status</div>
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-icon tools">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="summary-content">
                <div class="summary-value" id="tool-count">-</div>
                <div class="summary-label">MCP Tools</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Terminal Section -->
      <div class="terminal-wrapper">
        <div class="terminal-container">
          <div class="terminal-header">
            <div class="terminal-tabs">
              <div class="terminal-tab active">
                <svg class="tab-icon" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                </svg>
                <span>Terminal</span>
              </div>
            </div>
            <div class="terminal-controls">
              <button class="terminal-ctrl" onclick="clearTerminal()" title="Clear">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button class="terminal-ctrl" onclick="toggleFullscreen()" title="Fullscreen">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m7-1V4m0 0h-4m4 0l-5 5M4 12v4m0 0h4m-4 0l5-5m7 5l-5-5m5 5v-4m0 4h-4"/>
                </svg>
              </button>
            </div>
          </div>
          <div id="terminal" class="terminal">
            <div id="terminal-output" class="terminal-output">
              <div class="terminal-welcome">
                <pre class="welcome-art">
   ____            _                  ____                            _    
  / ___| _   _ ___| |_ ___ _ __ ___ |  _ \\ _ __ ___  _ __ ___  _ __ | |_  
  \\___ \\| | | / __| __/ _ \\ '_ \` _ \\| |_) | '__/ _ \\| '_ \` _ \\| '_ \\| __| 
   ___) | |_| \\__ \\ ||  __/ | | | | |  __/| | | (_) | | | | | | |_) | |_  
  |____/ \\__, |___/\\__\\___|_| |_| |_|_|   |_|  \\___/|_| |_| |_| .__/ \\__| 
         |___/                                                 |_|         
                </pre>
                <div class="welcome-text">
                  Welcome to SystemPrompt OS Terminal v${data.version}
                  Type 'systemprompt help' to see available commands
                </div>
              </div>
            </div>
            <div class="terminal-input-line">
              <span class="terminal-prompt">
                <span class="prompt-user">admin</span>@<span class="prompt-host">systemprompt</span>:<span class="prompt-path">~</span>$
              </span>
              <input 
                type="text" 
                id="terminal-input" 
                class="terminal-input" 
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Command Reference -->
      <div class="command-reference">
        <h3>Command Reference</h3>
        <div id="command-grid" class="command-grid">
          <!-- Commands will be loaded dynamically -->
          <div class="loading-commands">
            <span class="loading-spinner"></span>
            <span>Loading available commands...</span>
          </div>
        </div>
      </div>
    </div>

    <script>
      // Terminal functionality
      const terminal = document.getElementById('terminal');
      const output = document.getElementById('terminal-output');
      const input = document.getElementById('terminal-input');
      const commandHistory = [];
      let historyIndex = -1;
      let isFullscreen = false;

      // Focus terminal input on click
      terminal.addEventListener('click', (e) => {
        if (e.target === terminal || e.target === output) {
          input.focus();
        }
      });

      // Auto-focus on load
      window.addEventListener('load', () => {
        input.focus();
        loadAvailableCommands();
        loadSystemSummary();
      });

      // Handle command input
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const command = input.value.trim();
          if (command) {
            await executeCommand(command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;
          }
          input.value = '';
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[historyIndex];
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[historyIndex];
          } else {
            historyIndex = commandHistory.length;
            input.value = '';
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // Simple tab completion for commands
          const parts = input.value.split(' ');
          if (parts.length === 1 && parts[0] === 'systemprompt') {
            input.value = 'systemprompt ';
          }
        }
      });

      async function executeCommand(command) {
        // Display command in terminal
        appendToTerminal(\`<div class="terminal-line command-line">
          <span class="terminal-prompt">
            <span class="prompt-user">admin</span>@<span class="prompt-host">systemprompt</span>:<span class="prompt-path">~</span>$
          </span>
          <span class="command-text">\${escapeHtml(command)}</span>
        </div>\`);
        
        try {
          // Special handling for clear command
          if (command.toLowerCase() === 'clear' || command.toLowerCase() === 'cls') {
            clearTerminal();
            return;
          }

          // Loading indicator
          const loadingId = 'loading-' + Date.now();
          appendToTerminal(\`<div id="\${loadingId}" class="loading-indicator">
            <span class="loading-spinner"></span>
            <span>Executing command...</span>
          </div>\`);

          // Execute command via API
          const response = await fetch('/api/terminal/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ command })
          });

          // Remove loading indicator
          document.getElementById(loadingId)?.remove();

          const result = await response.json();
          
          if (result.success) {
            appendToTerminal(\`<div class="terminal-output-text">\${formatOutput(result.output)}</div>\`);
          } else {
            appendToTerminal(\`<div class="terminal-error">
              <span class="error-prefix">Error:</span> \${escapeHtml(result.error)}
            </div>\`);
          }
        } catch (error) {
          appendToTerminal(\`<div class="terminal-error">
            <span class="error-prefix">Error:</span> \${escapeHtml(error.message)}
          </div>\`);
        }
      }

      function runCommand(command) {
        input.value = command;
        input.focus();
        executeCommand(command);
      }

      function appendToTerminal(html) {
        output.innerHTML += html;
        // Smooth scroll to bottom
        output.scrollTo({
          top: output.scrollHeight,
          behavior: 'smooth'
        });
      }

      function clearTerminal() {
        output.innerHTML = \`
          <div class="terminal-welcome">
            <div class="welcome-text">Terminal cleared.</div>
          </div>
        \`;
      }

      function toggleFullscreen() {
        const terminalWrapper = document.querySelector('.terminal-wrapper');
        isFullscreen = !isFullscreen;
        
        if (isFullscreen) {
          terminalWrapper.classList.add('fullscreen');
          document.body.style.overflow = 'hidden';
        } else {
          terminalWrapper.classList.remove('fullscreen');
          document.body.style.overflow = '';
        }
        
        input.focus();
      }

      function formatOutput(text) {
        // Format output for better display
        return escapeHtml(text)
          .replace(/\\n/g, '<br>')
          .replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
          .replace(/  /g, '&nbsp;&nbsp;')
          // Highlight module names
          .replace(/^(\\s*)(\\w+):/gm, '$1<span class="output-key">$2</span>:')
          // Highlight success/error keywords
          .replace(/\\b(success|succeeded|active|enabled|true)\\b/gi, '<span class="output-success">$1</span>')
          .replace(/\\b(error|failed|inactive|disabled|false)\\b/gi, '<span class="output-error">$1</span>');
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // Keyboard shortcut for fullscreen
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
          e.preventDefault();
          toggleFullscreen();
        }
      });

      // Load available commands from CLI scanner
      async function loadAvailableCommands() {
        try {
          const response = await fetch('/api/terminal/commands');
          const result = await response.json();
          
          if (result.success && result.commands) {
            displayCommands(result.commands);
          } else {
            // Fallback to default commands if API fails
            displayFallbackCommands();
          }
        } catch (error) {
          console.error('Failed to load commands:', error);
          displayFallbackCommands();
        }
      }

      function displayCommands(commands) {
        const commandGrid = document.getElementById('command-grid');
        const categories = {};
        
        // Group commands by module/category
        commands.forEach(cmd => {
          const category = cmd.module || 'System';
          if (!categories[category]) {
            categories[category] = [];
          }
          
          // Create full command string
          const fullCommand = 'systemprompt ' + cmd.command;
          const description = cmd.description || '';
          
          categories[category].push({
            command: fullCommand,
            description: description,
            usage: cmd.usage || fullCommand
          });
        });
        
        // Clear loading state and display commands
        commandGrid.innerHTML = '';
        
        Object.entries(categories).forEach(([category, cmds]) => {
          const section = document.createElement('div');
          section.className = 'command-section';
          
          const title = document.createElement('h4');
          title.textContent = category;
          section.appendChild(title);
          
          const list = document.createElement('div');
          list.className = 'command-list';
          
          cmds.forEach(cmd => {
            const code = document.createElement('code');
            code.textContent = cmd.usage;
            code.onclick = function() { runCommand(cmd.command); };
            code.title = cmd.description;
            list.appendChild(code);
          });
          
          section.appendChild(list);
          commandGrid.appendChild(section);
        });
      }

      function displayFallbackCommands() {
        const commandGrid = document.getElementById('command-grid');
        commandGrid.innerHTML = \`
          <div class="command-section">
            <h4>Core Commands</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt --help</code>
              <code onclick="runCommand(this.textContent)">systemprompt --version</code>
              <code onclick="runCommand(this.textContent)">systemprompt cli:list</code>
              <code onclick="runCommand(this.textContent)">systemprompt cli:help</code>
            </div>
          </div>
          <div class="command-section">
            <h4>Module & Extension</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt extension:list</code>
              <code onclick="runCommand(this.textContent)">systemprompt extension:validate</code>
            </div>
          </div>
          <div class="command-section">
            <h4>Authentication</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt auth:providers</code>
              <code onclick="runCommand(this.textContent)">systemprompt auth:db users</code>
              <code onclick="runCommand(this.textContent)">systemprompt auth:role grant</code>
            </div>
          </div>
          <div class="command-section">
            <h4>Database</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt database:status</code>
              <code onclick="runCommand(this.textContent)">systemprompt database:migrate</code>
            </div>
          </div>
          <div class="command-section">
            <h4>Configuration</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt config:list</code>
              <code onclick="runCommand(this.textContent)">systemprompt config:get</code>
              <code onclick="runCommand(this.textContent)">systemprompt config:set</code>
            </div>
          </div>
          <div class="command-section">
            <h4>MCP Tools</h4>
            <div class="command-list">
              <code onclick="runCommand(this.textContent)">systemprompt tools:list</code>
              <code onclick="runCommand(this.textContent)">systemprompt prompts:list</code>
              <code onclick="runCommand(this.textContent)">systemprompt resources:list</code>
            </div>
          </div>
        \`;
      }

      // Load system summary data
      async function loadSystemSummary() {
        try {
          const response = await fetch('/api/terminal/summary');
          const result = await response.json();
          
          if (result.success && result.summary) {
            document.getElementById('user-count').textContent = result.summary.users;
            document.getElementById('module-count').textContent = result.summary.modules;
            document.getElementById('tool-count').textContent = result.summary.tools;
            document.getElementById('db-status').textContent = result.summary.database;
          }
        } catch (error) {
          console.error('Failed to load system summary:', error);
          // Set default values on error
          document.getElementById('user-count').textContent = '0';
          document.getElementById('module-count').textContent = '0';
          document.getElementById('tool-count').textContent = '0';
          document.getElementById('db-status').textContent = 'Unknown';
        }
      }
    </script>
  `;
}

/**
 * Returns CSS styles for the admin configuration page with terminal
 */
export function getAdminConfigStyles(): string {
  return `
    /* Reset and base styles */
    * {
      box-sizing: border-box;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: #0a0e27;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    .config-container {
      width: 100%;
      min-height: 100vh;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    
    /* Header */
    .config-header {
      text-align: center;
      padding: 40px 20px 30px;
      background: linear-gradient(180deg, #0f172a 0%, #0a0e27 100%);
      border-bottom: 1px solid #1e293b;
    }
    
    .config-header h1 {
      font-size: 42px;
      font-weight: 700;
      margin: 0 0 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }
    
    .subtitle {
      color: #94a3b8;
      font-size: 18px;
      margin: 0;
    }
    
    /* Top Section */
    .top-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      padding: 24px;
      width: 100%;
    }
    
    /* Cards */
    .status-card, .oauth-card, .summary-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .status-card:hover, .oauth-card:hover, .summary-card:hover {
      border-color: #334155;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    
    .card-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
    }
    
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    .status-indicator.active {
      background: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
    
    .status-indicator.inactive {
      background: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    
    /* Status Grid */
    .status-grid {
      padding: 24px;
      display: grid;
      gap: 16px;
    }
    
    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #1e293b;
    }
    
    .status-item:last-child {
      border-bottom: none;
    }
    
    .status-label {
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-value {
      color: #e2e8f0;
      font-weight: 600;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }
    
    .status-value.active {
      color: #10b981;
    }
    
    .status-value.inactive {
      color: #ef4444;
    }
    
    .status-value.env-production {
      color: #10b981;
    }
    
    .status-value.env-development {
      color: #fbbf24;
    }
    
    /* OAuth Providers */
    .provider-list {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    /* Summary card specific */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 24px;
    }
    
    .summary-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #1e293b;
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    
    .summary-item:hover {
      background: #334155;
      transform: translateY(-2px);
    }
    
    .summary-icon {
      width: 48px;
      height: 48px;
      padding: 12px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .summary-icon svg {
      width: 24px;
      height: 24px;
    }
    
    .summary-icon.users {
      background: rgba(99, 102, 241, 0.15);
      color: #6366f1;
    }
    
    .summary-icon.modules {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }
    
    .summary-icon.database {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }
    
    .summary-icon.tools {
      background: rgba(251, 146, 60, 0.15);
      color: #fb923c;
    }
    
    .summary-content {
      flex: 1;
    }
    
    .summary-value {
      font-size: 24px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 4px;
    }
    
    .summary-label {
      font-size: 14px;
      color: #94a3b8;
    }
    
    .provider-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      transition: all 0.2s;
    }
    
    .provider-item.configured {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.05);
    }
    
    .provider-icon {
      width: 24px;
      height: 24px;
      color: #64748b;
    }
    
    .provider-item.configured .provider-icon {
      color: #e2e8f0;
    }
    
    .provider-name {
      flex: 1;
      font-weight: 500;
      color: #e2e8f0;
    }
    
    .provider-status {
      font-size: 20px;
      font-weight: 700;
    }
    
    .provider-item.configured .provider-status {
      color: #10b981;
    }
    
    .provider-item:not(.configured) .provider-status {
      color: #ef4444;
    }
    
    
    /* Terminal Section */
    .terminal-wrapper {
      flex: 1;
      padding: 0 24px 24px;
      position: relative;
    }
    
    .terminal-wrapper.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      padding: 0;
      background: #0a0e27;
    }
    
    .terminal-container {
      background: #0a0e27;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      height: 500px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .terminal-wrapper.fullscreen .terminal-container {
      height: 100%;
      border-radius: 0;
      border: none;
    }
    
    .terminal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 0;
    }
    
    .terminal-tabs {
      display: flex;
      flex: 1;
    }
    
    .terminal-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      color: #64748b;
      cursor: pointer;
      border-right: 1px solid #1e293b;
      transition: all 0.2s;
    }
    
    .terminal-tab.active {
      background: #0a0e27;
      color: #e2e8f0;
      border-bottom: 2px solid #667eea;
    }
    
    .tab-icon {
      width: 16px;
      height: 16px;
    }
    
    .terminal-controls {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
    }
    
    .terminal-ctrl {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .terminal-ctrl:hover {
      background: #334155;
      color: #e2e8f0;
    }
    
    .terminal-ctrl svg {
      width: 16px;
      height: 16px;
    }
    
    /* Terminal Content */
    .terminal {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0a0e27;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      overflow: hidden;
    }
    
    .terminal-output {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      overflow-x: hidden;
      line-height: 1.6;
    }
    
    .terminal-output::-webkit-scrollbar {
      width: 10px;
    }
    
    .terminal-output::-webkit-scrollbar-track {
      background: #0f172a;
    }
    
    .terminal-output::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 5px;
    }
    
    .terminal-output::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
    
    .terminal-welcome {
      color: #64748b;
      margin-bottom: 20px;
    }
    
    .welcome-art {
      color: #667eea;
      font-size: 12px;
      line-height: 1.2;
      margin: 0 0 16px;
      opacity: 0.8;
    }
    
    .welcome-text {
      font-size: 14px;
      line-height: 1.6;
    }
    
    .terminal-line {
      margin: 8px 0;
    }
    
    .command-line {
      color: #e2e8f0;
    }
    
    .terminal-prompt {
      color: #64748b;
      margin-right: 8px;
      user-select: none;
    }
    
    .prompt-user {
      color: #10b981;
      font-weight: 600;
    }
    
    .prompt-host {
      color: #667eea;
      font-weight: 600;
    }
    
    .prompt-path {
      color: #fbbf24;
    }
    
    .command-text {
      color: #e2e8f0;
      font-weight: 600;
    }
    
    .terminal-output-text {
      color: #cbd5e1;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 4px 0 16px 0;
    }
    
    .terminal-error {
      color: #ef4444;
      margin: 4px 0 16px 0;
    }
    
    .error-prefix {
      font-weight: 600;
    }
    
    .loading-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      margin: 8px 0;
    }
    
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #334155;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading-commands {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      color: #94a3b8;
    }
    
    .terminal-input-line {
      display: flex;
      align-items: center;
      padding: 16px 20px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
    }
    
    .terminal-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: #e2e8f0;
      font-family: inherit;
      font-size: inherit;
      margin-left: 8px;
    }
    
    /* Output formatting */
    .output-key {
      color: #667eea;
      font-weight: 600;
    }
    
    .output-success {
      color: #10b981;
      font-weight: 600;
    }
    
    .output-error {
      color: #ef4444;
      font-weight: 600;
    }
    
    /* Command Reference */
    .command-reference {
      padding: 24px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
    }
    
    .command-reference h3 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 24px;
      text-align: center;
      color: #f1f5f9;
    }
    
    .command-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin: 0 auto;
    }
    
    .command-section {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
    }
    
    .command-section h4 {
      font-size: 16px;
      font-weight: 600;
      color: #667eea;
      margin: 0 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .command-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .command-list code {
      display: block;
      padding: 10px 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #e2e8f0;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }
    
    .command-list code:hover {
      background: #334155;
      border-color: #475569;
      color: #667eea;
      transform: translateX(4px);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .config-header h1 {
        font-size: 32px;
      }
      
      .top-section {
        grid-template-columns: 1fr;
        padding: 16px;
      }
      
      .terminal-wrapper {
        padding: 0 16px 16px;
      }
      
      .terminal-container {
        height: 400px;
      }
      
      .command-grid {
        grid-template-columns: 1fr;
      }
      
      .action-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;
}