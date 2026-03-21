import { useState } from 'react';
import { authClient } from '../services/authClient';

function getCallbackURL() {
  return `${window.location.origin}/`;
}

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      await authClient.signIn.magicLink({ email, callbackURL: getCallbackURL() });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-in link');
    } finally {
      setSending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await authClient.signIn.social({ provider: 'google', callbackURL: getCallbackURL() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <main className="min-h-dvh">
      <div className="app-shell flex min-h-dvh items-center py-10">
        <div className="w-full space-y-8">
          <section className="space-y-3 text-left">
            <p className="text-ui-label">Photo-first calorie logging</p>
            <h1 className="text-hero-title text-zinc-50">
              Snap<span className="text-accent-fresh">Track</span>
            </h1>
            <p className="max-w-[30ch] text-body-secondary text-zinc-400">
              Log meals quickly, keep your daily target in view, and make food tracking feel lighter.
            </p>
          </section>

          {sent ? (
            <section className="surface-panel rounded-[2rem] px-6 py-7 text-left">
              <div className="section-stack">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklch,var(--accent-fresh)_14%,transparent)]">
                  <svg className="w-6 h-6 text-accent-fresh" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="section-heading-copy">
                  <p className="text-ui-label">Email sent</p>
                  <p className="text-screen-title text-zinc-100">Check your inbox</p>
                  <p className="text-body-secondary text-zinc-400">
                    We sent a sign-in link to <span className="text-zinc-200">{email}</span>
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="surface-panel rounded-[2rem] px-6 py-6">
              <div className="section-stack">
                <div className="section-heading-copy">
                  <p className="text-ui-label">Sign in</p>
                  <p className="text-screen-title text-zinc-100">Pick the fastest way back in.</p>
                </div>

                <button
                  id="google-sign-in"
                  onClick={handleGoogle}
                  className="surface-button-secondary flex h-12 w-full items-center justify-center gap-3 rounded-xl active:scale-[0.98] transition-all text-zinc-100 font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-ui-label text-zinc-400">or</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>

                <form onSubmit={handleMagicLink} className="section-stack">
                  <label htmlFor="email-input" className="sr-only">Email address</label>
                  <input
                    id="email-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="surface-field h-12 w-full rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all"
                  />
                  <button
                    id="magic-link-submit"
                    type="submit"
                    disabled={sending || !email.trim()}
                    className="bg-accent-primary h-12 w-full rounded-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all text-slate-950 font-medium"
                  >
                    {sending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : (
                      'Send sign-in link'
                    )}
                  </button>
                </form>
              </div>
            </section>
          )}

          {error && (
            <p className="rounded-[1.25rem] bg-[color:color-mix(in_oklch,var(--accent-danger)_16%,transparent)] px-4 py-3 text-body-secondary text-[color:color-mix(in_oklch,var(--accent-danger)_75%,white_25%)]" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
