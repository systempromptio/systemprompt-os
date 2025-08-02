/**
 * Theme Manager for SystemPrompt OS Frontend.
 * Handles dynamic theme loading and switching.
 */

export interface Theme {
  name: string;
  description: string;
  version: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  animations: Record<string, boolean>;
}

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme | null = null;
  private themes: Map<string, Theme> = new Map();
  private listeners: Set<(theme: Theme) => void> = new Set();

  private constructor() {}

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Load a theme from JSON.
   */
  public async loadTheme(themeName: string): Promise<Theme> {
    try {
      const response = await fetch(`/themes/${themeName}/theme.json`);
      const theme = await response.json() as Theme;
      this.themes.set(themeName, theme);
      return theme;
    } catch (error) {
      console.error(`Failed to load theme ${themeName}:`, error);
      throw error;
    }
  }

  /**
   * Apply a theme to the document.
   */
  public applyTheme(theme: Theme): void {
    this.currentTheme = theme;
    const root = document.documentElement;

    // Apply colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply fonts
    Object.entries(theme.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });

    // Apply animation preferences
    Object.entries(theme.animations).forEach(([key, enabled]) => {
      root.setAttribute(`data-animation-${key}`, String(enabled));
    });

    // Notify listeners
    this.listeners.forEach(listener => listener(theme));

    // Save preference
    localStorage.setItem('systemprompt-theme', theme.name);
  }

  /**
   * Switch to a different theme.
   */
  public async switchTheme(themeName: string): Promise<void> {
    let theme = this.themes.get(themeName);
    if (!theme) {
      theme = await this.loadTheme(themeName);
    }
    this.applyTheme(theme);
  }

  /**
   * Get current theme.
   */
  public getCurrentTheme(): Theme | null {
    return this.currentTheme;
  }

  /**
   * Register a theme change listener.
   */
  public onThemeChange(listener: (theme: Theme) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Initialize with saved or default theme.
   */
  public async initialize(): Promise<void> {
    const savedTheme = localStorage.getItem('systemprompt-theme') || 'default';
    await this.switchTheme(savedTheme);
  }
}