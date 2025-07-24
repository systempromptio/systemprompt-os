/**
 * Global tunnel status singleton.
 */
class TunnelStatus {
  private static instance: TunnelStatus;
  private _baseUrl: string | null = null;

  private constructor() {}

  static getInstance(): TunnelStatus {
    TunnelStatus.instance ||= new TunnelStatus();
    return TunnelStatus.instance;
  }

  /**
   * Set the current base URL (tunnel or permanent domain).
   * @param url
   */
  setBaseUrl(url: string): void {
    this._baseUrl = url;
    console.log(`[TunnelStatus] Base URL updated to: ${url}`);
  }

  /**
   * Get the current base URL.
   */
  getBaseUrl(): string | null {
    return this._baseUrl;
  }

  /**
   * Get base URL or fallback to default.
   * @param defaultUrl
   */
  getBaseUrlOrDefault(defaultUrl: string): string {
    return this._baseUrl || defaultUrl;
  }
}

export const tunnelStatus = TunnelStatus.getInstance();
