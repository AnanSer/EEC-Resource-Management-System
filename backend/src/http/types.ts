import { IncomingMessage, ServerResponse } from 'node:http';
import { SessionUser } from '../auth/session';

export interface CookieOptions {
  maxAge?: number; // in seconds
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
}

export interface AppRequest extends IncomingMessage {
  pathname: string;
  query: Record<string, string>;
  params: Record<string, string>;
  cookies: Record<string, string>;
  body: any;
  user?: SessionUser;
  sessionToken?: string;
}

export interface AppResponse extends ServerResponse {
  json: (data: any, statusCode?: number) => void;
  status: (code: number) => AppResponse;
  setCookie: (name: string, val: string, options?: CookieOptions) => void;
  clearCookie: (name: string, options?: Omit<CookieOptions, 'maxAge' | 'expires'>) => void;
}

export type RouteHandler = (req: AppRequest, res: AppResponse) => Promise<any> | any;
export type Middleware = (req: AppRequest, res: AppResponse, next: () => Promise<void>) => Promise<void> | void;
