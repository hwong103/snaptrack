import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

const AUTH_BASE_URL = window.location.origin;

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  basePath: '/api/auth',
  plugins: [magicLinkClient()],
});
