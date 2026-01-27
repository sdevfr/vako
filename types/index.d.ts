/**
 * Vako - Ultra-modern Node.js framework
 * TypeScript definitions
 */

import { Express, Request, Response, NextFunction } from 'express';

// ============= CORE TYPES =============

export interface VakoOptions {
  port?: number;
  wsPort?: number;
  viewsDir?: string;
  staticDir?: string;
  routesDir?: string;
  isDev?: boolean;
  watchDirs?: string[];
  errorLog?: string;
  showStack?: boolean;
  autoInstall?: boolean;
  security?: SecurityOptions;
  layouts?: LayoutOptions;
  plugins?: PluginOptions;
  prefetch?: PrefetchOptions;
  autoUpdater?: AutoUpdaterOptions;
}

export interface SecurityOptions {
  helmet?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
    message?: string;
  };
  cors?: {
    origin?: string[] | boolean;
    credentials?: boolean;
  };
}

export interface LayoutOptions {
  enabled?: boolean;
  layoutsDir?: string;
  defaultLayout?: string;
  extension?: string;
  sections?: string[];
  cache?: boolean;
}

export interface PluginOptions {
  enabled?: boolean;
  autoLoad?: boolean;
  pluginsDir?: string;
  whitelist?: string[];
  supportTypeScript?: boolean;
}

export interface PrefetchOptions {
  enabled?: boolean;
  maxConcurrent?: number;
  notifyUser?: boolean;
  cacheRoutes?: boolean;
  prefetchDelay?: number;
}

export interface AutoUpdaterOptions {
  enabled?: boolean;
  checkOnStart?: boolean;
  autoUpdate?: boolean;
  updateChannel?: 'stable' | 'beta' | 'alpha';
  securityUpdates?: boolean;
  showNotifications?: boolean;
  backupCount?: number;
  checkInterval?: number;
}

// ============= APP CLASS =============

export interface RouteHandler {
  (req: Request, res: Response, next?: NextFunction): void | Promise<void>;
}

export interface RouteHandlers {
  get?: RouteHandler | RouteHandler[];
  post?: RouteHandler | RouteHandler[];
  put?: RouteHandler | RouteHandler[];
  delete?: RouteHandler | RouteHandler[];
  patch?: RouteHandler | RouteHandler[];
  all?: RouteHandler | RouteHandler[];
}

export class App {
  express: Express;
  app: Express;
  logger: Logger;
  layoutManager: LayoutManager;
  routeManager: RouteManager;
  pluginManager: PluginManager;
  options: VakoOptions;

  constructor(options?: VakoOptions);

  // Route management
  loadRoutes(routesDir?: string): this;
  createRoute(method: string, path: string, handler: RouteHandler | RouteHandler[], options?: any): void;
  deleteRoute(method: string, path: string): void;
  updateRoute(method: string, path: string, handler: RouteHandler): void;
  listRoutes(): Array<{ method: string; path: string }>;

  // Layout management
  createLayout(name: string, content: string): void;
  deleteLayout(name: string): void;
  listLayouts(): string[];
  reloadLayouts(): void;
  renderWithCustomLayout(res: Response, view: string, layout: string, data?: any): void;
  renderWithoutLayout(res: Response, view: string, data?: any): void;

  // Plugin management
  loadPlugin(plugin: string | Plugin, config?: any): Promise<void>;
  unloadPlugin(pluginName: string): Promise<void>;
  reloadPlugin(pluginName: string, config?: any): Promise<void>;
  listPlugins(): PluginInfo[];

  // Logging
  log(type: LogType, message: string, details?: string): void;

  // Server
  listen(port?: number): void;
  stop(): void;

  // Middleware
  use(middleware: any): void;
}

// ============= PLUGIN SYSTEM =============

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  defaultConfig?: any;

  load?(app: App, config: any, context: PluginContext): Promise<void> | void;
  unload?(app: App, config: any): Promise<void> | void;
  activate?(app: App, config: any): Promise<void> | void;
  deactivate?(app: App, config: any): Promise<void> | void;
}

export interface PluginContext {
  // Hooks
  hook(hookName: string, callback: Function): void;
  removeHook(hookName: string, callback: Function): void;

  // Routes and middleware
  addRoute(method: string, path: string, ...handlers: RouteHandler[]): void;
  addMiddleware(middleware: RouteHandler): void;
  addCommand(name: string, handler: Function, description?: string): void;

  // Logging
  log(type: LogType, message: string, details?: string): void;

  // Plugin access
  getPlugin(name: string): PluginInfo | undefined;
  listPlugins(): PluginInfo[];

  // Configuration
  getConfig(): any;
  updateConfig(config: any): void;

  // Storage
  storage: {
    set(key: string, value: any): void;
    set(data: Record<string, any>): void;
    get(key?: string, defaultValue?: any): any;
    delete(key: string): void;
    clear(): void;
  };
}

export interface PluginInfo {
  name: string;
  version: string;
  loaded: boolean;
  active: boolean;
  config?: any;
}

export type LogType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'server' 
  | 'route' 
  | 'dev' 
  | 'file' 
  | 'reload' 
  | 'create' 
  | 'delete' 
  | 'install';

// ============= UTILITY FUNCTIONS =============

export function createApp(options?: VakoOptions): App;
export function startDev(options?: VakoOptions): App;
export function start(options?: VakoOptions): App;

// ============= NEXT.JS ADAPTER =============

export interface NextJsAdapterOptions {
  nextApp: any; // Next.js App instance
  enableVakoRoutes?: boolean;
  enableVakoPlugins?: boolean;
  routePrefix?: string;
}

export class NextJsAdapter {
  constructor(options: NextJsAdapterOptions);
  
  // Integrate Vako routes with Next.js
  integrateRoutes(vakoApp: App): void;
  
  // Use Vako plugins in Next.js
  usePlugins(vakoApp: App): void;
  
  // Create Next.js API route handler from Vako route
  createApiHandler(vakoHandler: RouteHandler): (req: Request, res: Response) => Promise<void>;
  
  // Middleware for Next.js
  middleware(): (req: Request, res: Response, next: NextFunction) => void;
}

// ============= EXPORTS =============

export { App, createApp, startDev, start, NextJsAdapter };
export default App;
