// types/legacy.d.ts
// Ambient type declarations for legacy JavaScript modules during JS→TS migration

declare module 'express' {
  export interface Request {
    user?: any;
    body: any;
    params: any;
    query: any;
    file?: any;
  }
  export interface Response {
    status(code: number): Response;
    json(obj: any): Response;
    send(data: any): Response;
  }
  export interface NextFunction {
    (err?: any): void;
  }
  export interface Router {
    get(path: string, ...handlers: any[]): Router;
    post(path: string, ...handlers: any[]): Router;
    put(path: string, ...handlers: any[]): Router;
    delete(path: string, ...handlers: any[]): Router;
    patch(path: string, ...handlers: any[]): Router;
  }
  export function Router(): Router;
  export default function express(): any;
}

declare module 'cors' {
  export default function cors(options?: any): any;
}

declare module 'helmet' {
  export default function helmet(options?: any): any;
}

declare module 'morgan' {
  export default function morgan(format?: string): any;
}

declare module 'bcrypt' {
  export function hash(data: string, saltRounds: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string): any;
}

declare module 'multer' {
  export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }
  export interface Multer {
    single(fieldname: string): any;
    array(fieldname: string, maxCount?: number): any;
  }
  export type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;
  export default function multer(options?: any): Multer;
}

// Legacy route handlers (any fences during migration)
declare type LegacyRouteHandler = (req: any, res: any, next?: any) => void;
declare type LegacyMiddleware = (req: any, res: any, next: any) => void;

// Database types (minimal for now)
declare interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any>;
  close(): Promise<void>;
}

// User types (will be refined during migration)
declare interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

declare interface Track {
  id: string;
  user_id: string;
  title: string;
  audio_url: string;
  created_at: string;
}

declare interface Library {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
}

// Legacy lib modules (any fences during migration)
declare module '../lib/authentication' {
  export function authenticateToken(req: any, res: any, next: any): void;
  export function optionalAuth(req: any, res: any, next: any): void;
}

declare module '../lib/database' {
  export function getRow(sql: string, params?: any[]): Promise<any>;
  export function getRows(sql: string, params?: any[]): Promise<any[]>;
  export function update(sql: string, params?: any[]): Promise<any>;
  export function insert(sql: string, params?: any[]): Promise<any>;
}

declare module '../lib/redis' {
  export default {
    getClient(): Promise<any>;
  };
}

declare module '../lib/storage' {
  export function uploadAvatar(userId: string, buffer: Buffer, format: string): Promise<string>;
}

// Global declarations for Node.js
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    PORT: string;
    JWT_SECRET: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    API_BASE_URL?: string;
  }
}
