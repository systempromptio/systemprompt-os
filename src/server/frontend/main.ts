/**
 * SystemPrompt OS Frontend Bootstrap.
 * Initializes the modular frontend system.
 */

import { ThemeManager } from './core/theme-manager';
import { PageRegistry } from './core/page-registry';
import { ComponentRegistry } from './core/component-registry';
import { createHomePage } from './pages/home/home';

// Import styles
import './pages/home/home.css';

/**
 * Initialize the frontend application.
 */
async function initializeApp(): Promise<void> {
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  SystemPrompt OS - Frontend System                     │
│  🤖 Modular, themeable interface for autonomous agents │
│  🎨 Theme-aware components with hot reload            │
│  📦 Module-extensible UI architecture                 │
└─────────────────────────────────────────────────────────┘
  `);

  try {
    // Initialize theme manager
    const themeManager = ThemeManager.getInstance();
    await themeManager.initialize();
    console.log('✅ Theme system initialized');

    // Initialize component registry
    const componentRegistry = ComponentRegistry.getInstance();
    registerCoreComponents(componentRegistry);
    console.log('✅ Component registry initialized');

    // Initialize page registry and router
    const pageRegistry = PageRegistry.getInstance();
    registerCorePages(pageRegistry);
    pageRegistry.initialize();
    console.log('✅ Page routing initialized');

    // Listen for module UI registrations
    listenForModuleRegistrations();

    // Check for backend connectivity
    await checkBackendConnection();

  } catch (error) {
    console.error('Failed to initialize frontend:', error);
    showErrorScreen(error);
  }
}

/**
 * Register core components.
 */
function registerCoreComponents(registry: ComponentRegistry): void {
  // Register status indicator component
  registry.registerComponent({
    name: 'status-indicator',
    factory: (props) => {
      const div = document.createElement('div');
      div.className = 'status-indicator';
      div.innerHTML = `
        <span class="status-dot ${props?.online ? 'online' : 'offline'}"></span>
        <span>${props?.text || 'Status'}</span>
      `;
      return div;
    },
    styles: `
      .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .status-indicator .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--color-error);
      }
      .status-indicator .status-dot.online {
        background: var(--color-success);
        animation: pulse 2s infinite;
      }
    `
  });

  // Register module card component
  registry.registerComponent({
    name: 'module-card',
    factory: (props) => {
      const div = document.createElement('div');
      div.className = 'module-card';
      div.innerHTML = `
        <h3>${props?.title || 'Module'}</h3>
        <p>${props?.description || ''}</p>
        <div class="module-stats">
          ${props?.stats ? Object.entries(props.stats).map(([key, value]) => 
            `<div><strong>${key}:</strong> ${value}</div>`
          ).join('') : ''}
        </div>
      `;
      return div;
    },
    styles: `
      .module-card {
        background: rgba(var(--color-primary-rgb, 246, 147, 60), 0.1);
        border: 1px solid var(--color-primary);
        border-radius: 8px;
        padding: 1rem;
        transition: transform 0.3s ease;
      }
      .module-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(246, 147, 60, 0.2);
      }
      .module-card h3 {
        margin-bottom: 0.5rem;
        color: var(--color-primary);
      }
      .module-card .module-stats {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        opacity: 0.8;
      }
    `
  });
}

/**
 * Register core pages.
 */
function registerCorePages(registry: PageRegistry): void {
  // Register home page
  registry.registerPage({
    id: 'home',
    path: '/',
    title: 'Home',
    component: createHomePage,
    layout: 'default'
  });

  // Register dashboard page (placeholder)
  registry.registerPage({
    id: 'dashboard',
    path: '/dashboard',
    title: 'Dashboard',
    component: async () => {
      const div = document.createElement('div');
      div.className = 'page page-dashboard';
      div.innerHTML = `
        <div class="container">
          <h1>System Dashboard</h1>
          <p>Module status and system metrics will appear here.</p>
          <div id="module-dashboard-widgets"></div>
          <a href="#" data-route="/">Back to Home</a>
        </div>
      `;
      return div;
    },
    layout: 'default'
  });
}

/**
 * Listen for module UI registrations via server events.
 */
function listenForModuleRegistrations(): void {
  // This would connect to the server's event system
  // For now, we'll use a custom event system
  window.addEventListener('module:registerUI', (event: CustomEvent) => {
    const { moduleId, components, pages } = event.detail;
    
    const componentRegistry = ComponentRegistry.getInstance();
    const pageRegistry = PageRegistry.getInstance();
    
    if (components) {
      componentRegistry.registerModuleComponents(moduleId, components);
    }
    
    if (pages) {
      pageRegistry.registerModulePages(moduleId, pages);
    }
    
    console.log(`✅ Module UI registered: ${moduleId}`);
  });
}

/**
 * Check backend connection.
 */
async function checkBackendConnection(): Promise<void> {
  try {
    const response = await fetch('/debug/headers');
    if (response.ok) {
      console.log('✅ Backend connection established');
      
      // Dispatch event for components to update
      window.dispatchEvent(new CustomEvent('backend:connected', {
        detail: { online: true }
      }));
    }
  } catch (error) {
    console.warn('⚠️ Backend connection failed:', error);
    
    // Dispatch event for components to update
    window.dispatchEvent(new CustomEvent('backend:disconnected', {
      detail: { online: false, error }
    }));
  }
}

/**
 * Show error screen.
 */
function showErrorScreen(error: unknown): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="error-screen">
        <h1>Initialization Error</h1>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}