/**
 *  *  * @file Tunnel Service for OAuth Development.
 * @module modules/core/auth/services/tunnel-service
 */

import type { ChildProcess } from "child_process";
import { spawn, spawnSync } from "child_process";
import { EventEmitter } from "events";
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';
import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from '../constants';

const ZERO = ZERO;
const ONE = ONE;
const TWO = TWO;
const THREE = THREE;

/**
 *  *  * Tunnel configuration options.
 */
/**
 *  *  * TunnelConfig interface.
 */
export interface ITunnelConfig {
    port: number;

    permanentDomain?: string;

    tunnelToken?: string;

    tunnelUrl?: string;

    enableInDevelopment?: boolean;
}

/**
 *  *  * Tunnel status information.
 */
/**
 *  *  * TunnelStatus interface.
 */
export interface ITunnelStatus {
  active: boolean;
  url?: string | undefined;
  type: "cloudflared" | "permanent" | "none";
  error?: string | undefined;
}

/**
 *  *  * Logger interface.
 */
/**
 *  *  * Logger interface.
 */
export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 *  *  * Service for managing Cloudflare tunnels for OAuth development.
 * Automatically creates public URLs for OAuth callbacks when localhost.
 * is not suitable (e.g., Google OAuth restrictions).
 */
/**
 *  *  * TunnelService class.
 */
export class TunnelService extends EventEmitter {
  private static instance: TunnelService;

  /**
   * Get singleton instance
   */
  public static getInstance(): TunnelService {
    TunnelService.instance ??= new TunnelService();
    return TunnelService.instance;
  }

  /**
   * Private constructor
   */
  private constructor() {
    super();
    // Initialize
  }

  private readonly config: ITunnelConfig;
  private readonly logger: ILogger | undefined;
  private tunnelProcess?: ChildProcess;
  private tunnelUrl?: string;
  private status: ITunnelStatus = {
    active: false,
    type: "none"
  };

  /**
 *  *    * Creates a new TunnelService instance.
   * @param config - Tunnel configuration.
   * @param logger - Optional logger instance.
   */

  /**
 *  *    * Starts the tunnel service.
   * @returns Promise resolving to the public URL.
   */
  async start(): Promise<string> {
    /** Priority ONE: Use permanent domain if configured */
    if (this.config.permanentDomain !== undefined) {
      this.status = {
        active: true,
        url: this.config.permanentDomain,
        type: "permanent"
      };
      this.tunnelUrl = this.config.permanentDomain;
      this.logger?.info(`Using permanent OAuth domain: ${this.config.permanentDomain}`);
      this.emit("ready", this.tunnelUrl);
      await this.updateOAuthProviders(this.tunnelUrl);
      return this.tunnelUrl;
    }

    /** Priority TWO: Check if we should create temporary tunnel */
    if (this.shouldEnableTunnel() === false) {
      const localUrl = `http://localhost:${this.config.port}`;
      this.status = {
        active: false,
        url: localUrl,
        type: "none"
      };
      this.logger?.info("OAuth tunnel disabled, using localhost");
      this.logger?.info("Note: Google/GitHub OAuth may not work with localhost");
      return localUrl;
    }

    /** Priority THREE: Create temporary cloudflared tunnel */
    this.logger?.info("No permanent domain configured, creating temporary tunnel...");
    return await this.startCloudflaredTunnel();
  }

  /**
 *  *    * Stops the tunnel service.
   */
  async stop(): Promise<void> {
    if (this.tunnelProcess !== undefined) {
      this.logger?.info("Stopping tunnel...");
      this.tunnelProcess.kill();
      delete this.tunnelProcess;
      delete this.tunnelUrl;
      this.status = {
        active: false,
        type: "none"
      };
      this.emit("stopped");
    }
  }

  /**
 *  *    * Gets the current tunnel status.
   * @returns Current tunnel status.
   */
  getStatus(): TunnelStatus {
    return { ...this.status };
  }

  /**
 *  *    * Gets the public URL for OAuth callbacks.
   * @returns Public URL or localhost URL.
   */
  getPublicUrl(): string {
    return this.tunnelUrl ?? `http://localhost:${this.config.port}`;
  }

  /**
 *  *    * Checks if tunnel should be enabled.
   * @returns True if tunnel should be started.
   */
  private shouldEnableTunnel(): boolean {
    /** Check environment variables */
    const enableTunnel = process.env['ENABLE_OAUTH_TUNNEL'] === "true";
    const isDevelopment = process.env['NODE_ENV'] !== "production";

    /** Enable if explicitly requested or in development with OAuth providers configured */
    return enableTunnel === true
      || (isDevelopment === true
      && this.config.enableInDevelopment !== false
      && this.hasOAuthProviders() === true);
}

  /**
 *  *    * Checks if OAuth providers are configured.
   * @returns True if any OAuth provider has credentials.
   */
  private hasOAuthProviders(): boolean {
    return Boolean(
      process.env['GOOGLE_CLIENT_ID'] !== undefined
      || process.env['GITHUB_CLIENT_ID'] !== undefined
      || process.env['OAUTH_TUNNEL_REQUIRED'] === "true"
    );
  }

  /**
 *  *    * Starts a cloudflared tunnel.
   * @returns Promise resolving to the tunnel URL.
   */
  private async startCloudflaredTunnel(): Promise<string> {
    return await new Promise((resolve, reject) => {
      this.logger?.info("Starting cloudflared tunnel...");

      /** Check if cloudflared is installed */
      if (this.isCloudflaredInstalled() === false) {
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

      /** Start cloudflared with appropriate command */
      let args: string[];

      if (this.config.tunnelToken !== undefined) {
        /** Use named tunnel with token */
        args = ["tunnel", "--no-autoupdate", "run", "--token", this.config.tunnelToken];
      } else {
        /** Use quick tunnel for temporary URLs */
        args = ["tunnel", "--url", `http://localhost:${this.config.port}`];
      }

      this.tunnelProcess = spawn("cloudflared", args);

      let urlFound = false;
      const tunnelUrlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
      const namedTunnelRegex = /INF\s+Registered tunnel connection|Connection [a-f0-9-]+ registered/i;
      const namedTunnelUrlRegex = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.cloudflare[a-z]*\.com|https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

      /** Helper method to handle tunnel ready state */
      /**
 *  *        * handleTunnelReady function
       */
      const handleTunnelReady = () => {
        this.status = {
          active: true,
          url: this.tunnelUrl ?? undefined,
          type: "cloudflared"
        };
        this.logger?.info(`🚇 Tunnel established: ${this.tunnelUrl}`);
        this.logger?.info(`📍 Public URL: ${this.tunnelUrl}`);
        this.logger?.info(`🔗 OAuth Redirect Base: ${this.tunnelUrl}/oauth2/callback`);

        this.emit('tunnel-ready', {
          url: this.tunnelUrl,
          type: this.status.type,
          timestamp: new Date().toISOString()
        });

        this.updateOAuthProviders(this.tunnelUrl!).then(() => {
          this.logger?.info("✅ OAuth providers updated with tunnel URL");
          this.emit("ready", this.tunnelUrl);
        })
        .catch((err) => {
          this.logger?.error("Failed to update OAuth providers:", err);
          this.emit("ready", this.tunnelUrl);
        });
      };

      /**
       * checkForUrl function
       */
      const checkForUrl = (output: string) => {
        if (urlFound === false) {
          if (this.config.tunnelToken === undefined) {
            const match = output.match(tunnelUrlRegex);
            if (match !== null) {
              urlFound = true;
              this.tunnelUrl = match[ZERO];
              handleTunnelReady();
              resolve(this.tunnelUrl);
            }
          }
          else {
            if (output.match(namedTunnelRegex) !== null) {
              this.logger?.info("Named tunnel connection registered");
              /**
               * For token-based tunnels, we don't get the URL in output
               * The URL is pre-configured in Cloudflare dashboard.
               */
              if (urlFound === false) {
                urlFound = true;
                this.logger?.warn("Token-based tunnel connected but URL not available in output");
                this.logger?.warn("Please check your Cloudflare dashboard for the tunnel URL");
                const tunnelIdMatch = output.match(/tunnelID=([a-f0-9-]+)/);
                if (tunnelIdMatch !== null) {
                  this.logger?.warn(`Tunnel ID: ${tunnelIdMatch[ONE]}`);
                }
                this.tunnelUrl = this.config.tunnelUrl ?? "https://tunnel-configured-in-cloudflare.com";
                if (this.config.tunnelUrl === undefined) {
                  this.logger?.error("CLOUDFLARE_TUNNEL_URL not configured!");
                  this.logger?.error("Please set CLOUDFLARE_TUNNEL_URL in your .env file");
                }
                handleTunnelReady();
                resolve(this.tunnelUrl);
              }
            }
            const urlMatch = output.match(namedTunnelUrlRegex);
            if (urlMatch !== null && urlFound === false) {
              urlFound = true;
              this.tunnelUrl = urlMatch[ZERO];
              handleTunnelReady();
              resolve(this.tunnelUrl);
            }
          }
        }
      };

      this.tunnelProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        this.logger?.info(`Cloudflared stdout: ${output.trim()}`);
        checkForUrl(output);
      });

      let stderrBuffer = "";

      this.tunnelProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;

        const lines = output.trim().split('\n');
        lines.forEach(line => {
          if (line.trim() !== '') {
            this.logger?.info(`Cloudflared: ${line.trim()}`);
          }
        });

        checkForUrl(stderrBuffer);
      });

      this.tunnelProcess.on("exit", (code) => {
        this.logger?.info(`Cloudflared exited with code ${code}`);
        this.status = {
          active: false,
          type: "none",
          error: `Process exited with code ${code}`
        };
        this.emit("stopped");

        if (urlFound === false) {
          reject(new Error(`Cloudflared exited without providing URL (code ${code})`));
        }
      });

      this.tunnelProcess.on("error", (error) => {
        this.logger?.error("Cloudflared process error:", error);
        this.status = {
          active: false,
          type: "none",
          error: error.message
        };
        reject(error);
      });

      setTimeout(() => {
        if (urlFound === false) {
          this.stop();
          const error = "Timeout waiting for tunnel URL";
          this.status = {
            active: false,
            type: "none",
            error
          };
          reject(new Error(error));
        }
      }, 30000); // THIRTY second timeout
    });
  }

  /**
 *  *    * Checks if cloudflared is installed.
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

  /**
 *  *    * Updates OAuth provider configurations with tunnel URL.
   * @param url - The public tunnel URL.
   */
  async updateOAuthProviders(url: string): Promise<void> {
    process.env['BASE_URL'] = url;
    process.env['OAUTH_REDIRECT_URI'] = `${url}/oauth2/callback`;

    tunnelStatus.setBaseUrl(url);

    this.logger?.info(`Updated OAuth configuration with tunnel URL: ${url}`);
    this.emit("oauth-updated", {
      baseUrl: url,
      redirectUri: `${url}/oauth2/callback`
    });
  }
}
