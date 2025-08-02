/**
 * Component Registry for SystemPrompt OS Frontend.
 * Allows modules to register reusable UI components.
 */

export type ComponentFactory = (props?: any) => HTMLElement;

export interface ComponentDefinition {
  name: string;
  factory: ComponentFactory;
  moduleId?: string;
  styles?: string;
}

export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private components: Map<string, ComponentDefinition> = new Map();
  private styles: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  /**
   * Register a component.
   */
  public registerComponent(definition: ComponentDefinition): void {
    this.components.set(definition.name, definition);
    
    // Register component styles if provided
    if (definition.styles) {
      this.registerStyles(definition.name, definition.styles);
    }

    console.log(`[ComponentRegistry] Registered component: ${definition.name}`);
  }

  /**
   * Register styles for a component.
   */
  private registerStyles(componentName: string, styles: string): void {
    this.styles.set(componentName, styles);
    
    // Inject styles into document
    const styleId = `component-style-${componentName}`;
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = styles;
  }

  /**
   * Create a component instance.
   */
  public create(name: string, props?: any): HTMLElement {
    const definition = this.components.get(name);
    if (!definition) {
      throw new Error(`Component not found: ${name}`);
    }
    
    return definition.factory(props);
  }

  /**
   * Check if a component exists.
   */
  public has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Register module components.
   */
  public registerModuleComponents(moduleId: string, components: Omit<ComponentDefinition, 'moduleId'>[]): void {
    components.forEach(component => {
      this.registerComponent({ ...component, moduleId });
    });
  }

  /**
   * Create a reactive component helper.
   */
  public static createReactiveComponent(
    render: (props: any) => string,
    handlers?: Record<string, (event: Event) => void>
  ): ComponentFactory {
    return (props?: any) => {
      const container = document.createElement('div');
      container.innerHTML = render(props || {});
      
      // Attach event handlers
      if (handlers) {
        Object.entries(handlers).forEach(([selector, handler]) => {
          const elements = container.querySelectorAll(selector);
          elements.forEach(element => {
            const [eventType, ...rest] = selector.split('@');
            const actualSelector = rest.join('@');
            if (eventType && actualSelector) {
              element.addEventListener(eventType, handler);
            }
          });
        });
      }
      
      return container;
    };
  }
}