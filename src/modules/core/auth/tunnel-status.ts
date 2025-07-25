/**
 * TunnelStatus class.
 */
class TunnelStatus {
  private static instance: TunnelStatus;
  private baseUrl: string | null = null;

  private constructor() {}

  static getInstance(): TunnelStatus {
    TunnelStatus.instance ||= new TunnelStatus();
    return TunnelStatus.instance;
  }

  /**
   * Set the current base URL (tunnel or permanent domain).
   * @param url
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
    console.log(`[TunnelStatus] Base URL updated to: ${url}`);
  }

  /**
   * Get the current base URL.
   */
  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  /**
   * Get base URL or fallback to default.
   * @param defaultUrl
   */
  getBaseUrlOrDefault(defaultUrl: string): string {
    return this.baseUrl || defaultUrl;
  }
}

export const tunnelStatus = TunnelStatus.getInstance();
