/**
 * TunnelStatus class.
 * Manages the current tunnel base URL state for OAuth development.
 * Simplified implementation to avoid complex logger dependencies.
 */
class TunnelStatus {
  private static instance: TunnelStatus | undefined;
  private baseUrl: string | null = null;

  /**
   * Private constructor for singleton pattern.
   * Constructor intentionally empty for singleton pattern.
   */
  private constructor() {
    this.baseUrl = null;
  }

  /**
   * Gets the singleton instance of TunnelStatus.
   * @returns The TunnelStatus instance.
   */
  static getInstance(): TunnelStatus {
    TunnelStatus.instance ??= new TunnelStatus();
    return TunnelStatus.instance;
  }

  /**
   * Set the current base URL (tunnel or permanent domain).
   * @param url - The base URL to set.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get the current base URL.
   * @returns The current base URL or null if not set.
   */
  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  /**
   * Get base URL or fallback to default.
   * @param defaultUrl - The default URL to use if base URL is not set.
   * @returns The base URL or the default URL.
   */
  getBaseUrlOrDefault(defaultUrl: string): string {
    return this.baseUrl ?? defaultUrl;
  }
}

export const tunnelStatus = TunnelStatus.getInstance();
