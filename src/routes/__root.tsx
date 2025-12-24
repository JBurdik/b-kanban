import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar } from "@/components/Avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationToast } from "@/components/NotificationToast";
import { Logo } from "@/components/ui/Logo";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { data: session, isPending } = useSession();

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <Logo size="sm" />
          </Link>

          <nav className="flex items-center gap-4">
            {isPending ? (
              <div className="w-20 h-8 bg-dark-surface animate-pulse rounded" />
            ) : session ? (
              <>
                <Link
                  to="/boards"
                  className="text-dark-muted hover:text-dark-text transition-colors"
                >
                  Boards
                </Link>
                <NotificationBell userEmail={session.user.email} />
                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Avatar name={session.user.name} id={session.user.id} size="sm" />
                  <span className="text-dark-muted text-sm">{session.user.name}</span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="btn-ghost text-sm"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {session && <NotificationToast userEmail={session.user.email} />}
    </div>
  );
}
