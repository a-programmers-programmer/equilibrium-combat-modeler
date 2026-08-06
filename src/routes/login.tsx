import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center p-6">
      <div className="panel w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="display text-2xl font-semibold text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Optional — the modeler works without an account.</p>
        </div>
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              className="w-full rounded-[var(--radius)] border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-fg transition hover:border-border-strong hover:bg-surface"
            >
              Continue with {p.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-center text-sm text-primary hover:underline">
          Back to modeler
        </Link>
      </div>
    </main>
  );
}
