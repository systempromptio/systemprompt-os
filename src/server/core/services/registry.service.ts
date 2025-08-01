/**
 * Service Registry.
 * Manages services available to the server.
 */

export class ServiceRegistry {
  private readonly services: Map<string, any> = new Map();

  /**
   * Register a service.
   * @param name
   * @param service
   */
  register(name: string, service: any): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, service);
  }

  /**
   * Get a service.
   * @param name
   */
  get<T = any>(name: string): T | undefined {
    return this.services.get(name);
  }

  /**
   * Check if service exists.
   * @param name
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Unregister a service.
   * @param name
   */
  unregister(name: string): boolean {
    return this.services.delete(name);
  }

  /**
   * Get all service names.
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services.
   */
  clear(): void {
    this.services.clear();
  }
}
