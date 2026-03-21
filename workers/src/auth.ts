import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import type { Env } from './index';

export function createAuth(env: Env) {
  const resend = new Resend(env.RESEND_API_KEY);
  const frontendHost = new URL(env.FRONTEND_URL).hostname;

  return betterAuth({
    baseURL: {
      allowedHosts: [
        frontendHost,
        '*.workers.dev',
        'localhost:*',
        '127.0.0.1:*',
      ],
      protocol: 'auto',
    },
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    database: env.DB,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        accessType: 'offline',
        prompt: 'select_account consent',
      },
    },
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) => {
          await resend.emails.send({
            from: 'SnapTrack <noreply@hwong103.work>',
            to: email,
            subject: 'Your SnapTrack sign-in link',
            html: `
              <p>Click the link below to sign in to SnapTrack. It expires in 10 minutes.</p>
              <p><a href="${url}">${url}</a></p>
              <p>If you did not request this, you can safely ignore this email.</p>
            `,
          });
        },
      }),
    ],
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    advanced: {
      defaultCookieAttributes: { sameSite: 'none', secure: true },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
