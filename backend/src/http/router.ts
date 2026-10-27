import { AppRequest, AppResponse, RouteHandler, Middleware } from './types';

interface RouteEntry {
  method: string;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handlers: (RouteHandler | Middleware)[];
}

export class Router {
  private routes: RouteEntry[] = [];
  private middlewares: Middleware[] = [];

  /**
   * Registers global middleware to run before route handlers
   */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public get(path: string, ...handlers: (RouteHandler | Middleware)[]): this {
    return this.addRoute('GET', path, handlers);
  }

  public post(path: string, ...handlers: (RouteHandler | Middleware)[]): this {
    return this.addRoute('POST', path, handlers);
  }

  public put(path: string, ...handlers: (RouteHandler | Middleware)[]): this {
    return this.addRoute('PUT', path, handlers);
  }

  public patch(path: string, ...handlers: (RouteHandler | Middleware)[]): this {
    return this.addRoute('PATCH', path, handlers);
  }

  public delete(path: string, ...handlers: (RouteHandler | Middleware)[]): this {
    return this.addRoute('DELETE', path, handlers);
  }

  /**
   * Mounts a sub-router with a common prefix
   */
  public mount(prefix: string, subRouter: Router): this {
    for (const route of subRouter.routes) {
      const fullPath = (prefix + (route.path === '/' ? '' : route.path)).replace(/\/+/g, '/');
      const { pattern, paramNames } = this.compilePattern(fullPath);
      this.routes.push({
        method: route.method,
        path: fullPath,
        pattern,
        paramNames,
        handlers: [...subRouter.middlewares, ...route.handlers],
      });
    }
    return this;
  }

  private addRoute(method: string, path: string, handlers: (RouteHandler | Middleware)[]): this {
    const { pattern, paramNames } = this.compilePattern(path);
    this.routes.push({
      method: method.toUpperCase(),
      path,
      pattern,
      paramNames,
      handlers,
    });
    return this;
  }

  private compilePattern(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const normalized = path.replace(/\/+/g, '/');

    // Escape regex characters except for :param
    const regexStr = normalized
      .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });

    return {
      pattern: new RegExp(`^${regexStr}\\/?$`),
      paramNames,
    };
  }

  /**
   * Handles an incoming request by executing matched middlewares and route handlers.
   * Returns true if a route was matched and handled, false otherwise.
   */
  public async handle(req: AppRequest, res: AppResponse): Promise<boolean> {
    const method = req.method?.toUpperCase() || 'GET';
    const pathname = req.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = pathname.match(route.pattern);
      if (match) {
        req.params = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          req.params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
        }

        // Execute global middlewares then route handlers in sequence
        const pipeline = [...this.middlewares, ...route.handlers];
        await this.runPipeline(req, res, pipeline);
        return true;
      }
    }

    return false;
  }

  private async runPipeline(
    req: AppRequest,
    res: AppResponse,
    handlers: (Middleware | RouteHandler)[]
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < handlers.length) {
        const handler = handlers[index++];
        if (res.writableEnded) return;

        // Handler can either be a middleware with next() or a route handler
        if (handler.length >= 3) {
          await (handler as Middleware)(req, res, next);
        } else {
          await (handler as RouteHandler)(req, res);
          // If response not ended, automatically continue
          if (!res.writableEnded && index < handlers.length) {
            await next();
          }
        }
      }
    };

    await next();
  }
}
