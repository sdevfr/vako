import { Express, Request, Response, NextFunction } from 'express'
import { Server } from 'http'

// CORE TYPES

export interface VakoOptions {
  port?: number
  wsPort?: number
  viewsDir?: string
  staticDir?: string
  routesDir?: string
  isDev?: boolean
  watchDirs?: string[]
  errorLog?: string
  showStack?: boolean
  autoInstall?: boolean
  security?: SecurityOptions
  layouts?: LayoutOptions
  plugins?: PluginOptions
  prefetch?: PrefetchOptions
  autoUpdater?: AutoUpdaterOptions
}

export interface SecurityOptions {
  helmet?: boolean
  rateLimit?: {
    windowMs: number
    max: number
    message?: string
  }
  cors?: {
    origin?: string[] | boolean
    credentials?: boolean
  }
}

export interface LayoutOptions {
  enabled?: boolean
  layoutsDir?: string
  defaultLayout?: string
  extension?: string
  sections?: string[]
  cache?: boolean
}

export interface PluginOptions {
  enabled?: boolean
  autoLoad?: boolean
  pluginsDir?: string
  whitelist?: string[]
  supportTypeScript?: boolean
}

export interface PrefetchOptions {
  enabled?: boolean
  maxConcurrent?: number
  notifyUser?: boolean
  cacheRoutes?: boolean
  prefetchDelay?: number
}

export interface AutoUpdaterOptions {
  enabled?: boolean
  checkOnStart?: boolean
  autoUpdate?: boolean
  updateChannel?: 'stable' | 'beta' | 'alpha'
  securityUpdates?: boolean
  showNotifications?: boolean
  backupCount?: number
  checkInterval?: number
}

// APP CLASS

export type RouteHandler = (
  req: Request,
  res: Response,
  next?: NextFunction
) => void | Promise<void>

export interface RouteHandlers {
  get?: RouteHandler | RouteHandler[]
  post?: RouteHandler | RouteHandler[]
  put?: RouteHandler | RouteHandler[]
  delete?: RouteHandler | RouteHandler[]
  patch?: RouteHandler | RouteHandler[]
  all?: RouteHandler | RouteHandler[]
}

export interface RouteInfo {
  type: 'file' | 'dynamic'
  path: string
  method?: string
  source?: string
  methods?: string[]
  createdAt?: string
}

export class App {
  express: Express
  app: Express
  logger: Logger
  layoutManager: LayoutManager
  routeManager: RouteManager
  pluginManager: PluginManager
  auth: AuthManager
  autoUpdater: any
  options: VakoOptions

  constructor(options?: VakoOptions)

  // Route management
  loadRoutes(routesDir?: string): this
  createRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteHandler[],
    options?: any
  ): this
  deleteRoute(method: string, path: string): this
  updateRoute(method: string, path: string, handler: RouteHandler): this
  listRoutes(): RouteInfo[]

  // Layout management
  createLayout(name: string, content: string): Promise<this>
  deleteLayout(name: string): Promise<this>
  listLayouts(): Promise<string[]>
  reloadLayouts(): this

  // Plugin management
  loadPlugin(plugin: string | Plugin, config?: any): Promise<this>
  unloadPlugin(pluginName: string): Promise<this>
  reloadPlugin(pluginName: string, config?: any): Promise<this>
  listPlugins(): PluginInfo[]

  // Authentication
  enableAuth(config?: any): Promise<this>
  isAuthEnabled(): boolean
  requireAuth(): RouteHandler
  requireRole(role: string): RouteHandler

  // Auto-updater
  checkForUpdates(silent?: boolean): Promise<any>
  performUpdate(updateInfo?: any): Promise<boolean>
  rollbackUpdate(backupPath?: string): Promise<boolean>

  // Logging
  log(type: LogType, message: string, details?: string): void

  // Server
  listen(port?: number, callback?: () => void): Server
  stop(): Promise<void>

  // Middleware
  use(middleware: any): this
}

// AUTH MANAGER

export class AuthManager {
  constructor(app: App)
  init(config?: any): Promise<void>
  destroy(): Promise<void>
  isAuthenticated(req: Request): boolean
  getCurrentUser(req: Request): any | null
}

// LOGGER

export class Logger {
  constructor(options?: any)
  log(type: LogType, message: string, details?: string): void
}

// LAYOUT AND ROUTE MANAGERS

export class LayoutManager {
  constructor(app: App, options?: LayoutOptions)
  middleware(): any
  reloadLayouts(): void
}

export class RouteManager {
  constructor(app: App, options?: VakoOptions)
  loadRoutes(routesDir?: string): void
  listRoutes(): RouteInfo[]
}

// PLUGIN SYSTEM

export interface Plugin {
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
  defaultConfig?: any

  load?(app: App, config: any, context: PluginContext): Promise<void> | void
  unload?(app: App, config: any): Promise<void> | void
  activate?(app: App, config: any): Promise<void> | void
  deactivate?(app: App, config: any): Promise<void> | void
}

export interface PluginContext {
  // Hooks
  hook(hookName: string, callback: Function, priority?: number): void
  removeHook(hookName: string, callback: Function): void

  // Routes and middleware
  addRoute(method: string, path: string, ...handlers: RouteHandler[]): void
  addMiddleware(middleware: RouteHandler): void
  addCommand(name: string, handler: Function, description?: string): void

  // Logging
  log(type: LogType, message: string, details?: string): void

  // Plugin access
  getPlugin(name: string): PluginInfo | null
  listPlugins(): PluginInfo[]

  // Configuration
  getConfig(): any
  updateConfig(config: any): boolean

  // Storage
  storage: {
    set(key: string | object, value?: any): Promise<boolean>
    get(key?: string, defaultValue?: any): Promise<any>
    delete(key: string): Promise<boolean>
    clear(): Promise<boolean>
  }
}

export interface PluginInfo {
  name: string
  version: string
  loaded: boolean
  active: boolean
  config?: any
}

export class PluginManager {
  constructor(app: App, options?: PluginOptions)
  loadPlugin(plugin: string | Plugin, config?: any): Promise<this>
  loadAllPlugins(): Promise<this>
  unloadPlugin(pluginName: string): Promise<this>
  getStats(): any
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
  | 'install'

// UTILITY FUNCTIONS

export function createApp(options?: VakoOptions): App
export function startDev(options?: VakoOptions): App
export function start(options?: VakoOptions): App

// NEXT.JS ADAPTER

export interface NextJsAdapterOptions {
  nextApp: any // Next.js App instance
  enableVakoRoutes?: boolean
  enableVakoPlugins?: boolean
  routePrefix?: string
}

export class NextJsAdapter {
  constructor(options: NextJsAdapterOptions)

  integrateRoutes(vakoApp: App): void
  usePlugins(vakoApp: App): void
  createApiHandler(
    vakoHandler: RouteHandler
  ): (req: Request, res: Response) => Promise<void>
  middleware(): (req: Request, res: Response, next: NextFunction) => void
}

// EXPORTS

export {
  App,
  AuthManager,
  Logger,
  LayoutManager,
  RouteManager,
  PluginManager,
  createApp,
  startDev,
  start,
  NextJsAdapter,
}
export default App
