/**
 * @file Tunnel Service for OAuth Development.
 * @module modules/core/auth/services/tunnel-service
 */

import type { ChildProcess } from 'child_process';
import { spawn, spawnSync } from 'child_process';
import { EventEmitter } from 'events';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status';
import { ONE, ZERO } from '@/constants/numbers';
import type {
  IOAuthUpdateEvent,
  ITunnelConfig,
  ITunnelLogger,
  ITunnelStatus
} from '@/modules/core/auth/types/tunnel.types';

/**
 * TunnelService class.
 */
export class TunnelService extends EventEmitter {
  private static instance: TunnelService;
  private readonly config: ITunnelConfig;
  private readonly logger: ITunnelLogger | undefined;
  private tunnelProcess?: ChildProcess;
  private tunnelUrl?: string;
  private status: ITunnelStatus = {
    active: false,
    type: 'none'
  };

  /**
   * Constructor for TunnelService.
   * @param config - Tunnel configuration.
   * @param logger - Optional logger instance.
   */
  constructor(config: ITunnelConfig, logger?: ITunnelLogger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * Gets or creates a singleton instance of TunnelService.
   * @param config - Optional tunnel configuration.
   * @param logger - Optional logger instance.
   * @returns The TunnelService instance.
   */
  public static getInstance(config?: ITunnelConfig, logger?: ITunnelLogger): TunnelService {
    if (!TunnelService.instance && config != null) {
      TunnelService.instance = new TunnelService(config, logger);
    }
    return TunnelService.instance;
  }

  /**
   * Starts the tunnel service.
   * @returns Promise resolving to the public URL.
   */
  async start(): Promise<string> {
    if (this.config.permanentDomain !== undefined) {
      this.status = {
        active: true,
        url: this.config.permanentDomain,
        type: "permanent"
      };
      this.tunnelUrl = this.config.permanentDomain;
      const { permanentDomain } = this.config;
      this.logger?.info(`Using permanent OAuth domain: ${permanentDomain}`);
      this.emit('ready', this.tunnelUrl);
      await this.updateOAuthProviders(this.tunnelUrl);
      return this.tunnelUrl;
    }

    if (!this.shouldEnableTunnel()) {
      const { port } = this.config;
      const localUrl = `http://localhost:${String(port)}`;
      this.status = {
        active: false,
        url: localUrl,
        type: 'none'
      };
      this.logger?.info('OAuth tunnel disabled, using localhost');
      this.logger?.info('Note: Google/GitHub OAuth may not work with localhost');
      return localUrl;
    }

    this.logger?.info('No permanent domain configured, creating temporary tunnel...');
    return await this.startCloudflaredTunnel();
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
    const { port } = this.config;
    return this.tunnelUrl ?? `http://localhost:${String(port)}`;
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
  private async updateOAuthProviders(url: string): Promise<void> {
    process.env.BASE_URL = url;
    process.env.OAUTH_REDIRECT_URI = `${url}/oauth2/callback`;

    tunnelStatus.setBaseUrl(url);

    this.logger?.info(`Updated OAuth configuration with tunnel URL: ${url}`);
    this.emit('oauth-updated', {
      baseUrl: url,
      redirectUri: `${url}/oauth2/callback`
    } as IOAuthUpdateEvent);
  }

  /**
   * Starts a cloudflared tunnel.
   * @returns Promise resolving to the tunnel URL.
   */
  private async startCloudflaredTunnel(): Promise<string> {
    return await new Promise((resolve, reject) => {
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

      if (this.config.tunnelToken !== undefined) {
        args = ["tunnel", "--no-autoupdate", "run", "--token", this.config.tunnelToken];
      } else {
        args = ["tunnel", "--url", `http://localhost:${this.config.port}`];
      }

      this.tunnelProcess = spawn("cloudflared", args);

      let urlFound = false;
      const tunnelUrlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
      const namedTunnelRegex = /INF\s+Registered tunnel connection|Connection [a-f0-9-]+ registered/i;
      const namedTunnelUrlRegex = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.cloudflare[a-z]*\.com|https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

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
        .catch((err: unknown) => {
          this.logger?.error("Failed to update OAuth providers:", err);
          this.emit("ready", this.tunnelUrl);
        });
      };

      const checkForUrl = (output: string) => {
        if (!urlFound) {
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
              if (!urlFound) {
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
            if (urlMatch !== null && !urlFound) {
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

        if (!urlFound) {
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

      const timeoutId = setTimeout(() => {
        if (!urlFound) {
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

      const originalResolve = resolve;
      resolve = (value: string | PromiseLike<string>) => {
        clearTimeout(timeoutId);
        if (typeof value === 'string') {
          originalResolve(value);
        } else {
          value.then((resolvedValue) => { originalResolve(resolvedValue); });
        }
      }
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
}
