import type { Request } from 'express';
import type { AuthContext } from './index';

export type AuthedRequest = Request & {
  auth?: AuthContext;
  rawBody?: Buffer;
};
