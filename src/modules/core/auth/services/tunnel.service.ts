/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - File has 569 lines (max 500) due to comprehensive tunnel management logic
 * - 43 ESLint errors including complex parameter documentation, member ordering
 * - TypeScript compilation passes with relative imports
 *
 * This service manages OAuth tunnel functionality and requires significant refactoring
 * to meet all ESLint rules while maintaining functionality.
 */
/**
 * Tunnel Service for OAuth Development.
 * Manages OAuth tunneling for development environments using cloudflared.
 * @module modules/core/auth/services/tunnel-service
 */

import {
 type ChildProcess, spawn, spawnSync
} from 'child_process';
import { EventEmitter } from 'events';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status';
import { ZERO } from '@/constants/numbers';
import type {
  ITunnelConfig,
  ITunnelLogger,
  ITunnelStatus
} from '@/modules/core/auth/types/tunnel.types';

/**
 * TunnelService class.
 */
export class TunnelService extends EventEmitter {
  private static instance: TunnelService;
  private config: ITunnelConfig;
  private logger: ITunnelLogger | undefined;
  private tunnelProcess?: ChildProcess;
  private tunnelUrl?: string;
  private status: ITunnelStatus = {
    active: false,
    type: 'none'
  };

  /**
   * Private constructor for TunnelService.
   */
  private constructor() {
    super();
    this.config = {
      port: 3000,
      enableInDevelopment: true
    };
    this.logger = undefined;
  }

  /**
   * Gets or creates a singleton instance of TunnelService.
   * @param config - Optional tunnel configuration.
   * @param logger - Optional logger instance.
   * @returns The TunnelService instance.
   */
  public static getInstance(config?: ITunnelConfig, logger?: ITunnelLogger): TunnelService {
    if (TunnelService.instance === undefined) {
      TunnelService.instance = new TunnelService();
      if (config !== null && config !== undefined) {
        TunnelService.instance.config = config;
        TunnelService.instance.logger = logger;
      }
    }
    return TunnelService.instance;
  }

  /**
   * Starts the tunnel service.
   * @returns Promise resolving to the public URL.
   */
  async start(): Promise<string> {
    if (this.config.permanentDomain !== undefined) {
      return this.startPermanentDomain();
    }

    if (!this.shouldEnableTunnel()) {
      return this.startLocalhost();
    }

    this.logger?.info('No permanent domain configured, creating temporary tunnel...');
    return await this.startCloudflaredTunnel();
  }

  /**
   * Starts with permanent domain configuration.
   * @returns The permanent domain URL.
   * @throws {Error} When permanent domain is not configured.
   */
  private startPermanentDomain(): string {
    const { permanentDomain } = this.config;
    if (permanentDomain === null || permanentDomain === undefined || permanentDomain === '') {
      throw new Error('Permanent domain is required but not configured');
    }
    this.status = {
      active: true,
      url: permanentDomain,
      type: "permanent"
    };
    this.tunnelUrl = permanentDomain;
    this.logger?.info(`Using permanent OAuth domain: ${permanentDomain}`);
    this.emit('ready', this.tunnelUrl);
    this.updateOAuthProviders(this.tunnelUrl);
    return this.tunnelUrl;
  }

  /**
   * Stops the tunnel service.
   */
  stop(): void {
    if (this.tunnelProcess !== undefined) {
      this.logger?.info('Stopping tunnel...');
      this.tunnelProcess.kill();
      delete this.tunnelProcess;
      delete this.tunnelUrl;
      this.status = {
        active: false,
        type: 'none'
      };
      this.emit('stopped');
    }
  }

  /**
   * Gets the current tunnel status.
   * @returns Current tunnel status.
   */
  getStatus(): ITunnelStatus {
    return { ...this.status };
  }

  /**
   * Gets the public URL for OAuth callbacks.
   * @returns Public URL or localhost URL.
   */
  getPublicUrl(): string {
    return this.tunnelUrl ?? `http://localhost:${String(this.config.port)}`;
  }

  /**
   * Starts with localhost configuration.
   * @returns The localhost URL.
   */
  private startLocalhost(): string {
    const localUrl = `http://localhost:${String(this.config.port)}`;
    this.status = {
      active: false,
      url: localUrl,
      type: 'none'
    };
    this.logger?.info('OAuth tunnel disabled, using localhost');
    this.logger?.info('Note: Google/GitHub OAuth may not work with localhost');
    return localUrl;
  }

  /**
   * Checks if tunnel should be enabled.
   * @returns True if tunnel should be started.
   */
  private shouldEnableTunnel(): boolean {
    const enableTunnel = process.env.ENABLE_OAUTH_TUNNEL === 'true';
    const isDevelopment = process.env.NODE_ENV !== 'production';

    return enableTunnel
      || isDevelopment
        && this.config.enableInDevelopment !== false
        && this.hasOAuthProviders();
  }

  /**
   * Checks if OAuth providers are configured.
   * @returns True if any OAuth provider has credentials.
   */
  private hasOAuthProviders(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID !== undefined
      || process.env.GITHUB_CLIENT_ID !== undefined
      || process.env.OAUTH_TUNNEL_REQUIRED === 'true'
    );
  }

  /**
   * Updates OAuth provider configurations with tunnel URL.
   * @param url - The public tunnel URL.
   */
  private updateOAuthProviders(url: string): void {
    process.env.BASE_URL = url;
    process.env.OAUTH_REDIRECT_URI = `${url}/oauth2/callback`;

    tunnelStatus.setBaseUrl(url);

    this.logger?.info(`Updated OAuth configuration with tunnel URL: ${url}`);
    this.emit('oauth-updated', {
      baseUrl: url,
      redirectUri: `${url}/oauth2/callback`
    });
  }

  /**
   * Handles tunnel ready event.
   * @param url - Tunnel URL.
   */
  private handleTunnelReady(url: string): void {
    this.tunnelUrl = url;
    this.status = {
      active: true,
      url,
      type: "cloudflared"
    };
    this.logger?.info(`🚇 Tunnel established: ${url}`);
    this.logger?.info(`📍 Public URL: ${url}`);
    this.logger?.info(`🔗 OAuth Redirect Base: ${url}/oauth2/callback`);

    this.emit('tunnel-ready', {
      url,
      type: this.status.type,
      timestamp: new Date().toISOString()
    });

    this.updateOAuthProviders(url);
    this.logger?.info("✅ OAuth providers updated with tunnel URL");
    this.emit("ready", url);
  }

  /**
   * Handles quick tunnel URL detection.
   * @param output - Output to check.
   * @param regex - Regex pattern to match.
   * @returns Matched URL or null.
   */
  private detectQuickTunnelUrl(output: string, regex: RegExp): string | null {
    const match = output.match(regex);
    if (match !== null) {
      return match[ZERO];
    }
    return null;
  }

  /**
   * Handles named tunnel URL detection.
   * @param output - Output to check.
   * @param connectionRegex - Connection regex pattern.
   * @param urlRegex - URL regex pattern.
   * @returns Object with URL and connection status.
   */
  private detectNamedTunnelUrl(
    output: string,
    connectionRegex: RegExp,
    urlRegex: RegExp
  ): { url: string | null; connected: boolean } {
    const connected = Boolean(output.match(connectionRegex));
    const urlMatch = output.match(urlRegex);
    const url = urlMatch?.[ZERO] ?? null;

    if (connected && !url) {
      return this.handleConnectedTunnelWithoutUrl(output);
    }

    return {
 url,
connected
};
  }

  /**
   * Handles the case when tunnel is connected but URL is not available.
   * @param output - The tunnel output to analyze.
   * @returns Tunnel result with fallback URL.
   */
  private handleConnectedTunnelWithoutUrl(output: string): {
    url: string;
    connected: boolean;
  } {
    this.logger?.info("Named tunnel connection registered");
    this.logger?.warn("Token-based tunnel connected but URL not available in output");
    this.logger?.warn("Please check your Cloudflare dashboard for the tunnel URL");

    const tunnelIdMatch = output.match(/tunnelID=([a-f0-9-]+)/);
    const tunnelId = tunnelIdMatch?.[1];
    if (tunnelId) {
      this.logger?.warn(`Tunnel ID: ${tunnelId}`);
    }

    if (!this.config.tunnelUrl) {
      this.logger?.error("CLOUDFLARE_TUNNEL_URL not configured!");
      this.logger?.error("Please set CLOUDFLARE_TUNNEL_URL in your .env file");
    }

    return {
      url: this.config.tunnelUrl ?? "https://tunnel-configured-in-cloudflare.com",
      connected: true
    };
  }

  /**
   * Sets up tunnel process event handlers.
   * @param resolve - Promise resolve function.
   * @param reject - Promise reject function.
   * @returns Object with urlFound flag and timeout ID.
   */
  private setupTunnelHandlers(
    resolve: (value: string) => void,
    reject: (reason: Error) => void
  ): { setUrlFound: (found: boolean) => void; timeoutId: NodeJS.Timeout } {
    const handlerState = this.createHandlerState();
    const checkForUrl = this.createUrlChecker(handlerState, resolve);

    this.setupStdoutHandler(checkForUrl);
    this.setupStderrHandler(handlerState, checkForUrl);
    this.setupExitHandler(handlerState, reject);
    this.setupErrorHandler(reject);

    const timeoutId = this.setupTimeout(handlerState, reject);

    return {
      setUrlFound: (found: boolean): void => { handlerState.urlFound = found; },
      timeoutId
    };
  }

  /**
   * Creates the initial handler state.
   * @returns Handler state object.
   */
  private createHandlerState(): {
    urlFound: boolean;
    stderrBuffer: string;
    tunnelUrlRegex: RegExp;
    namedTunnelRegex: RegExp;
    namedTunnelUrlRegex: RegExp;
  } {
    return {
      urlFound: false,
      stderrBuffer: "",
      tunnelUrlRegex: /https:\/\/[a-z0-9-]+\.trycloudflare\.com/,
      namedTunnelRegex:
        /INF\s+Registered tunnel connection|Connection [a-f0-9-]+ registered/i,
      namedTunnelUrlRegex:
        /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.cloudflare[a-z]*\.com|https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
    };
  }

  /**
   * Creates the URL checker function.
   * @param state - Handler state.
   * @param state.urlFound
   * @param resolve - Promise resolve function.
   * @param state.tunnelUrlRegex
   * @param state.namedTunnelRegex
   * @param state.namedTunnelUrlRegex
   * @returns URL checker function.
   */
  private createUrlChecker(
    state: { urlFound: boolean; tunnelUrlRegex: RegExp; namedTunnelRegex: RegExp; namedTunnelUrlRegex: RegExp },
    resolve: (value: string) => void
  ): (output: string) => void {
    return (output: string): void => {
      if (state.urlFound) { return; }

      if (this.config.tunnelToken === undefined) {
        this.checkQuickTunnel(output, state, resolve);
      } else {
        this.checkNamedTunnel(output, state, resolve);
      }
    };
  }

  /**
   * Checks for quick tunnel URL.
   * @param output - Output to check.
   * @param state - Handler state.
   * @param state.urlFound
   * @param resolve - Promise resolve function.
   * @param state.tunnelUrlRegex
   */
  private checkQuickTunnel(
    output: string,
    state: { urlFound: boolean; tunnelUrlRegex: RegExp },
    resolve: (value: string) => void
  ): void {
    const url = this.detectQuickTunnelUrl(output, state.tunnelUrlRegex);
    if (url !== null) {
      state.urlFound = true;
      this.handleTunnelReady(url);
      resolve(url);
    }
  }

  /**
   * Checks for named tunnel URL.
   * @param output - Output to check.
   * @param state - Handler state.
   * @param state.urlFound
   * @param resolve - Promise resolve function.
   * @param state.namedTunnelRegex
   * @param state.namedTunnelUrlRegex
   */
  private checkNamedTunnel(
    output: string,
    state: { urlFound: boolean; namedTunnelRegex: RegExp; namedTunnelUrlRegex: RegExp },
    resolve: (value: string) => void
  ): void {
    const { url, connected } = this.detectNamedTunnelUrl(
      output,
      state.namedTunnelRegex,
      state.namedTunnelUrlRegex
    );
    if (url !== null || connected) {
      state.urlFound = true;
      const finalUrl = url ?? this.config.tunnelUrl
        ?? "https://tunnel-configured-in-cloudflare.com";
      this.handleTunnelReady(finalUrl);
      resolve(finalUrl);
    }
  }

  /**
   * Sets up stdout handler.
   * @param checkForUrl - URL checker function.
   */
  private setupStdoutHandler(checkForUrl: (output: string) => void): void {
    this.tunnelProcess?.stdout?.on("data", (data: Buffer): void => {
      const output = data.toString();
      this.logger?.info(`Cloudflared stdout: ${output.trim()}`);
      checkForUrl(output);
    });
  }

  /**
   * Sets up stderr handler.
   * @param state - Handler state.
   * @param state.stderrBuffer
   * @param checkForUrl - URL checker function.
   */
  private setupStderrHandler(
    state: { stderrBuffer: string },
    checkForUrl: (output: string) => void
  ): void {
    this.tunnelProcess?.stderr?.on("data", (data: Buffer): void => {
      const output = data.toString();
      state.stderrBuffer += output;

      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (line.trim() !== '') {
          this.logger?.info(`Cloudflared: ${line.trim()}`);
        }
      }

      checkForUrl(state.stderrBuffer);
    });
  }

  /**
   * Sets up exit handler.
   * @param state - Handler state.
   * @param state.urlFound
   * @param reject - Promise reject function.
   */
  private setupExitHandler(
    state: { urlFound: boolean },
    reject: (reason: Error) => void
  ): void {
    this.tunnelProcess?.on("exit", (code): void => {
      this.logger?.info(`Cloudflared exited with code ${String(code)}`);
      this.status = {
        active: false,
        type: "none",
        error: `Process exited with code ${String(code)}`
      };
      this.emit("stopped");

      if (!state.urlFound) {
        reject(new Error(`Cloudflared exited without providing URL (code ${String(code)})`));
      }
    });
  }

  /**
   * Sets up error handler.
   * @param reject - Promise reject function.
   */
  private setupErrorHandler(reject: (reason: Error) => void): void {
    this.tunnelProcess?.on("error", (error): void => {
      this.logger?.error("Cloudflared process error:", error);
      this.status = {
        active: false,
        type: "none",
        error: error.message
      };
      reject(error);
    });
  }

  /**
   * Sets up timeout handler.
   * @param state - Handler state.
   * @param state.urlFound
   * @param reject - Promise reject function.
   * @returns Timeout ID.
   */
  private setupTimeout(
    state: { urlFound: boolean },
    reject: (reason: Error) => void
  ): NodeJS.Timeout {
    return setTimeout((): void => {
      if (!state.urlFound) {
        this.stop();
        const error = "Timeout waiting for tunnel URL";
        this.status = {
          active: false,
          type: "none",
          error
        };
        reject(new Error(error));
      }
    }, 30000);
  }

  /**
   * Starts a cloudflared tunnel.
   * @returns Promise resolving to the tunnel URL.
   */
  private async startCloudflaredTunnel(): Promise<string> {
    return await new Promise((resolve, reject): void => {
      this.logger?.info("Starting cloudflared tunnel...");

      if (!this.isCloudflaredInstalled()) {
        const error = "cloudflared not found. Please install it or use permanent domain.";
        this.logger?.error(error);
        this.status = {
          active: false,
          type: "none",
          error
        };
        reject(new Error(error));
        return;
      }

      let args: string[];
      if (this.config.tunnelToken === undefined) {
        args = ["tunnel", "--url", `http://localhost:${String(this.config.port)}`];
      } else {
        args = ["tunnel", "--no-autoupdate", "run", "--token", this.config.tunnelToken];
      }

      this.tunnelProcess = spawn("cloudflared", args);

      const { timeoutId } = this.setupTunnelHandlers(
        (value: string): void => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject
      );
    });
  }

  /**
   * Checks if cloudflared is installed.
   * @returns True if cloudflared is available.
   */
  private isCloudflaredInstalled(): boolean {
    try {
      const result = spawnSync("cloudflared", ["--version"]);
      return result.status === ZERO;
    } catch {
      return false;
    }
  }
}
