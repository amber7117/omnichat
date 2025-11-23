import { AuthContext } from './index';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    rawBody?: Buffer;
  }
}

export {};
