/**
 * Home Page Component for SystemPrompt OS.
 */

import { ComponentRegistry } from '../../core/component-registry';
import { ThemeManager } from '../../core/theme-manager';

export async function createHomePage(): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'page page-home';
  
  const theme = ThemeManager.getInstance().getCurrentTheme();
  const componentRegistry = ComponentRegistry.getInstance();

  // Create matrix background canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'matrix-bg';
  canvas.id = 'matrix';
  container.appendChild(canvas);

  // Main content
  const content = document.createElement('div');
  content.className = 'container';
  content.innerHTML = `
    <div class="logo">SystemPrompt OS</div>
    <div class="subtitle">An operating system for autonomous agents</div>
    
    <div class="status" id="status-container">
      <div><span class="status-dot"></span>System Online</div>
      <div style="margin-top: 0.5rem;">
        <span style="opacity: 0.8;">Port 3000 • API Ready • Database Connected</span>
      </div>
    </div>
    
    <div class="info">
      <p>SystemPrompt OS is running and ready to serve autonomous agents.</p>
      <p>This is an API-first system. Use the CLI or API endpoints below:</p>
      
      <div class="api-links">
        <a href="/debug/headers" target="_blank">Debug Headers</a>
        <a href="/api/echo" target="_blank">API Echo</a>
        <a href="/.well-known/oauth-protected-resource" target="_blank">OAuth Discovery</a>
        <a href="#" data-route="/dashboard">Dashboard</a>
      </div>
      
      <div class="module-components" id="module-components">
        <!-- Dynamic module components will be inserted here -->
      </div>
      
      <div class="mcp-terminal" style="margin-top: 2rem;">
        <h3>MCP HTTP Endpoint</h3>
        <p style="font-size: 0.9rem; opacity: 0.8;">
          SystemPrompt OS provides an HTTP MCP endpoint for executing CLI commands:
        </p>
        <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
          <p style="font-family: monospace; font-size: 0.85rem;">
            <strong>Endpoint:</strong> <code style="color: #f6933c;">POST http://localhost:3000/mcp</code><br>
            <strong>Context:</strong> <code style="color: #f6933c;">X-MCP-Context: cli</code>
          </p>
        </div>
        <div style="margin-top: 1rem;">
          <p style="font-size: 0.85rem;"><strong>Available Contexts:</strong></p>
          <ul style="font-size: 0.85rem; opacity: 0.9;">
            <li><code>default</code> - System information</li>
            <li><code>cli</code> - SystemPrompt CLI tools</li>
          </ul>
          <p style="font-size: 0.85rem; margin-top: 1rem;"><strong>Example: Execute CLI Command</strong></p>
          <pre style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -H "X-MCP-Context: cli" \\
  -d '{
    "method": "call_tool",
    "params": {
      "name": "execute-cli",
      "arguments": {
        "command": "status"
      }
    }
  }'</pre>
          <p style="font-size: 0.85rem; margin-top: 1rem;"><strong>List Available Tools:</strong></p>
          <pre style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -H "X-MCP-Context: cli" \\
  -d '{"method": "list_tools"}'</pre>
        </div>
      </div>
      
      <p style="margin-top: 2rem; font-size: 0.8rem;">
        💻 CLI: <code>./bin/systemprompt --help</code><br>
        📚 Documentation: <a href="https://systemprompt.io">systemprompt.io</a>
      </p>
      
      <div class="theme-switcher">
        <label>Theme: </label>
        <select id="theme-selector">
          <option value="default">Default Orange</option>
          <option value="dark">Dark Mode</option>
          <option value="light">Light Mode</option>
        </select>
      </div>
    </div>
  `;
  
  container.appendChild(content);

  // Initialize matrix animation
  initializeMatrixAnimation(canvas);

  // Load module components
  loadModuleComponents(container);

  // Setup theme switcher
  setupThemeSwitcher(container);

  // Check system status
  checkSystemStatus(container);

  return container;
}

function initializeMatrixAnimation(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Matrix rain effect
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  const charArray = chars.split('');

  const fontSize = 14;
  const columns = canvas.width / fontSize;

  const drops: number[] = [];
  for (let i = 0; i < columns; i++) {
    drops[i] = 1;
  }

  function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Use CSS variable for color
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary') || '#f6933c';
    
    ctx.fillStyle = primaryColor;
    ctx.font = `${fontSize}px monospace`;
    
    for (let i = 0; i < drops.length; i++) {
      const text = charArray[Math.floor(Math.random() * charArray.length)];
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);
      
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  // Check if matrix animation is enabled
  const animationsEnabled = document.documentElement.getAttribute('data-animation-matrix') !== 'false';
  if (animationsEnabled) {
    setInterval(drawMatrix, 50);
  }
}

function loadModuleComponents(container: HTMLElement): void {
  const componentRegistry = ComponentRegistry.getInstance();
  const moduleComponentsDiv = container.querySelector('#module-components');
  
  if (!moduleComponentsDiv) return;

  // This is where modules would register their dashboard widgets
  // For now, we'll show a placeholder
  if (componentRegistry.has('module-status')) {
    const statusWidget = componentRegistry.create('module-status');
    moduleComponentsDiv.appendChild(statusWidget);
  }
}

function setupThemeSwitcher(container: HTMLElement): void {
  const selector = container.querySelector('#theme-selector') as HTMLSelectElement;
  if (!selector) return;

  const themeManager = ThemeManager.getInstance();
  
  selector.addEventListener('change', async (event) => {
    const target = event.target as HTMLSelectElement;
    await themeManager.switchTheme(target.value);
  });
}

async function checkSystemStatus(container: HTMLElement): Promise<void> {
  try {
    const response = await fetch('/debug/headers');
    if (response.ok) {
      console.log('✅ System status: Online');
    }
  } catch (error) {
    console.log('⚠️ System status check failed:', error);
    const statusDiv = container.querySelector('#status-container');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div><span class="status-dot status-offline"></span>System Offline</div>
        <div style="margin-top: 0.5rem;">
          <span style="opacity: 0.8;">Connecting...</span>
        </div>
      `;
    }
  }
}