/**
 * @fileoverview Tunnel Service for OAuth Development
 * @module modules/core/auth/services/tunnel-service
 */

import { spawn, spawnSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { tunnelStatus } from "../tunnel-status.js";

/**
 * Tunnel configuration options
 */
export interface TunnelConfig {
  /**
   * Local port to tunnel
   */
  port: number;
  
  /**
   * Permanent domain (if configured)
   */
  permanentDomain?: string;
  
  /**
   * Cloudflare tunnel token (for permanent tunnels)
   */
  tunnelToken?: string;
  
  /**
   * Enable tunnel in development
   */
  enableInDevelopment?: boolean;
}

/**
 * Tunnel status information
 */
export interface TunnelStatus {
  active: boolean;
  url?: string;
  type: "cloudflared" | "permanent" | "none";
  error?: string;
}

/**
 * Logger interface
 */
interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Service for managing Cloudflare tunnels for OAuth development
 * 
 * Automatically creates public URLs for OAuth callbacks when localhost
 * is not suitable (e.g., Google OAuth restrictions).
 */
export class TunnelService extends EventEmitter {
  private readonly config: TunnelConfig;
  private readonly logger?: Logger;
  private tunnelProcess?: ChildProcess;
  private tunnelUrl?: string;
  private status: TunnelStatus = {
    active: false,
    type: "none"
  };

  /**
   * Creates a new TunnelService instance
   * 
   * @param config - Tunnel configuration
   * @param logger - Optional logger instance
   */
  constructor(config: TunnelConfig, logger?: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * Starts the tunnel service
   * 
   * @returns Promise resolving to the public URL
   */
  async start(): Promise<string> {
    // Priority 1: Use permanent domain if configured
    if (this.config.permanentDomain) {
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

    // Priority 2: Check if we should create temporary tunnel
    if (!this.shouldEnableTunnel()) {
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

    // Priority 3: Create temporary cloudflared tunnel
    this.logger?.info("No permanent domain configured, creating temporary tunnel...");
    return this.startCloudflaredTunnel();
  }

  /**
   * Stops the tunnel service
   */
  async stop(): Promise<void> {
    if (this.tunnelProcess) {
      this.logger?.info("Stopping tunnel...");
      this.tunnelProcess.kill();
      this.tunnelProcess = undefined;
      this.tunnelUrl = undefined;
      this.status = {
        active: false,
        type: "none"
      };
      this.emit("stopped");
    }
  }

  /**
   * Gets the current tunnel status
   * 
   * @returns Current tunnel status
   */
  getStatus(): TunnelStatus {
    return { ...this.status };
  }

  /**
   * Gets the public URL for OAuth callbacks
   * 
   * @returns Public URL or localhost URL
   */
  getPublicUrl(): string {
    return this.tunnelUrl || `http://localhost:${this.config.port}`;
  }

  /**
   * Checks if tunnel should be enabled
   * 
   * @returns True if tunnel should be started
   */
  private shouldEnableTunnel(): boolean {
    // Check environment variables
    const enableTunnel = process.env.ENABLE_OAUTH_TUNNEL === "true";
    const isDevelopment = process.env.NODE_ENV !== "production";
    
    // Enable if explicitly requested or in development with OAuth providers configured
    return enableTunnel || (
      isDevelopment && 
      this.config.enableInDevelopment !== false &&
      this.hasOAuthProviders()
    );
  }

  /**
   * Checks if OAuth providers are configured
   * 
   * @returns True if any OAuth provider has credentials
   */
  private hasOAuthProviders(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GITHUB_CLIENT_ID ||
      process.env.OAUTH_TUNNEL_REQUIRED === "true"
    );
  }

  /**
   * Starts a cloudflared tunnel
   * 
   * @returns Promise resolving to the tunnel URL
   */
  private async startCloudflaredTunnel(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger?.info("Starting cloudflared tunnel...");

      // Check if cloudflared is installed
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

      // Start cloudflared with quick tunnel
      const args = ["tunnel", "--url", `http://localhost:${this.config.port}`];
      
      // If tunnel token is provided, use named tunnel
      if (this.config.tunnelToken) {
        args.unshift("--token", this.config.tunnelToken);
      }

      this.tunnelProcess = spawn("cloudflared", args);

      let urlFound = false;
      const tunnelUrlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

      const checkForUrl = (output: string) => {
        if (!urlFound) {
          const match = output.match(tunnelUrlRegex);
          if (match) {
            urlFound = true;
            this.tunnelUrl = match[0];
            this.status = {
              active: true,
              url: this.tunnelUrl,
              type: "cloudflared"
            };
            this.logger?.info(`🚇 Tunnel established: ${this.tunnelUrl}`);
            this.logger?.info(`📍 Public URL: ${this.tunnelUrl}`);
            this.logger?.info(`🔗 OAuth Redirect Base: ${this.tunnelUrl}/oauth2/callback`);
            
            // Update OAuth configuration immediately
            this.updateOAuthProviders(this.tunnelUrl).then(() => {
              this.logger?.info("✅ OAuth providers updated with tunnel URL");
              this.emit("ready", this.tunnelUrl);
              resolve(this.tunnelUrl!);
            }).catch((err) => {
              this.logger?.error("Failed to update OAuth providers:", err);
              this.emit("ready", this.tunnelUrl);
              resolve(this.tunnelUrl!);
            });
          }
        }
      };

      // Parse stdout for tunnel URL
      this.tunnelProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        this.logger?.info(`Cloudflared stdout: ${output.trim()}`);
        checkForUrl(output);
      });

      // Buffer to accumulate stderr output
      let stderrBuffer = "";
      
      // Parse stderr for tunnel URL (cloudflared outputs URL here)
      this.tunnelProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;
        
        // Log stderr output (cloudflared uses stderr for info messages)
        const lines = output.trim().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            this.logger?.info(`Cloudflared: ${line.trim()}`);
          }
        });
        
        // Check accumulated buffer for URL
        checkForUrl(stderrBuffer);
      });

      // Handle process exit
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

      // Handle errors
      this.tunnelProcess.on("error", (error) => {
        this.logger?.error("Cloudflared process error:", error);
        this.status = {
          active: false,
          type: "none",
          error: error.message
        };
        reject(error);
      });

      // Timeout if URL not found
      setTimeout(() => {
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
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Checks if cloudflared is installed
   * 
   * @returns True if cloudflared is available
   */
  private isCloudflaredInstalled(): boolean {
    try {
      const result = spawnSync("cloudflared", ["--version"]);
      return result.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Updates OAuth provider configurations with tunnel URL
   * 
   * @param url - The public tunnel URL
   */
  async updateOAuthProviders(url: string): Promise<void> {
    // Update environment variables for current process
    process.env.BASE_URL = url;
    process.env.OAUTH_REDIRECT_URI = `${url}/oauth2/callback`;
    
    // Update global tunnel status
    tunnelStatus.setBaseUrl(url);
    
    this.logger?.info(`Updated OAuth configuration with tunnel URL: ${url}`);
    this.emit("oauth-updated", {
      baseUrl: url,
      redirectUri: `${url}/oauth2/callback`
    });
  }
}