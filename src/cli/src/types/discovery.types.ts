/**
 * Interface for module configuration used in command discovery.
 */
export interface IModuleConfig {
  name?: string;
  version?: string;
  cli?: {
    commands?: Array<{
      name: string;
      description: string;
      executor?: string;
      options?: Array<{
        name: string;
        type: 'string' | 'boolean' | 'number' | 'array';
        description: string;
        alias?: string;
        default?: unknown;
        required?: boolean;
        choices?: string[];
      }>;
    }>;
  };
}

/**
 * Command discovery options.
 */
export interface ICommandDiscoveryOptions {
  modulesPath?: string;
}
