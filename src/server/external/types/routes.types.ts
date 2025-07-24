/**
 * Route information type containing path, methods, and authentication type.
 */
export interface IRouteInfo {
  path: string;
  methods: string[];
  auth: string;
}

/**
 * Express layer type for internal router stack manipulation.
 */
export interface IExpressLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  name: string;
  handle: {
    stack?: IExpressLayer[];
  };
  regexp: {
    source: string;
  };
}

/**
 * Extended Express application type with internal router access.
 */
export interface IExpressAppWithRouter {
  _router?: {
    stack: IExpressLayer[];
  };
}

/**
 * Extract route information context for route extraction.
 */
export interface IRouteContext {
  routes: IRouteInfo[];
  prefix: string;
  authType: string;
}
