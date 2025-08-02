/**
 * Page Registry for SystemPrompt OS Frontend.
 * Manages dynamic page registration from modules.
 */

export interface Page {
  id: string;
  path: string;
  title: string;
  component: () => Promise<HTMLElement>;
  moduleId?: string;
  requiresAuth?: boolean;
  layout?: 'default' | 'minimal' | 'full';
}

export class PageRegistry {
  private static instance: PageRegistry;
  private pages: Map<string, Page> = new Map();
  private currentPage: Page | null = null;

  private constructor() {}

  public static getInstance(): PageRegistry {
    if (!PageRegistry.instance) {
      PageRegistry.instance = new PageRegistry();
    }
    return PageRegistry.instance;
  }

  /**
   * Register a page.
   */
  public registerPage(page: Page): void {
    this.pages.set(page.path, page);
    console.log(`[PageRegistry] Registered page: ${page.path} (${page.title})`);
  }

  /**
   * Register multiple pages from a module.
   */
  public registerModulePages(moduleId: string, pages: Omit<Page, 'moduleId'>[]): void {
    pages.forEach(page => {
      this.registerPage({ ...page, moduleId });
    });
  }

  /**
   * Get a page by path.
   */
  public getPage(path: string): Page | undefined {
    return this.pages.get(path);
  }

  /**
   * Get all registered pages.
   */
  public getAllPages(): Page[] {
    return Array.from(this.pages.values());
  }

  /**
   * Navigate to a page.
   */
  public async navigateTo(path: string): Promise<void> {
    const page = this.pages.get(path);
    if (!page) {
      console.error(`Page not found: ${path}`);
      return;
    }

    // Update URL without reload
    window.history.pushState({ path }, page.title, path);
    
    // Load and render page
    await this.renderPage(page);
  }

  /**
   * Render a page.
   */
  private async renderPage(page: Page): Promise<void> {
    this.currentPage = page;
    
    // Get or create app container
    let appContainer = document.getElementById('app');
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app';
      document.body.appendChild(appContainer);
    }

    // Clear current content
    appContainer.innerHTML = '';
    
    // Load page component
    const component = await page.component();
    appContainer.appendChild(component);

    // Update document title
    document.title = `${page.title} - SystemPrompt OS`;
  }

  /**
   * Initialize router.
   */
  public initialize(): void {
    // Handle browser navigation
    window.addEventListener('popstate', (event) => {
      const path = event.state?.path || '/';
      this.navigateTo(path);
    });

    // Handle link clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[data-route]');
      if (link) {
        event.preventDefault();
        const path = link.getAttribute('data-route') || '/';
        this.navigateTo(path);
      }
    });

    // Navigate to initial path
    const initialPath = window.location.pathname || '/';
    this.navigateTo(initialPath);
  }
}