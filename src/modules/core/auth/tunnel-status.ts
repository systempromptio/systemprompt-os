/**

 * TunnelStatus class.

 */

class TunnelStatus {
  private static instance: TunnelStatus;
  private baseUrl: string | null = null;

  private constructor(): unknown {}

  static getInstance(): TunnelStatus {
    TunnelStatus.instance ||= new TunnelStatus();
    return TunnelStatus.instance;
  }

  /**
 *  * Description.
 */    * Set the current base URL (tunnel or permanent domain).
   * @param url
   */
  setBaseUrl(url: string)) {
    this.baseUrl = url;
    logger.log(`[TunnelStatus] Base URL updated to: ${url}`);
  }

  /**
 *  * Description.
 */    * Get the current base URL.
   */
  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  /**
 *  * Description.
 */    * Get base URL or fallback to default.
   * @param defaultUrl
   */
  getBaseUrlOrDefault(defaultUrl: string): string {
    return this.baseUrl || defaultUrl;
  }
}

export const tunnelStatus = TunnelStatus.getInstance();
