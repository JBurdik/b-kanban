import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useConvexUser } from "@/hooks/useConvexUser";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { userEmail, isLoading: authLoading } = useConvexUser();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const invite = useQuery(api.invites.getByToken, { token });
  const acceptInvite = useMutation(api.invites.accept);

  // Redirect to login if not authenticated
  if (!authLoading && !userEmail) {
    navigate({ to: "/login" });
    return null;
  }

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      const result = await acceptInvite({ token });
      navigate({ to: "/boards/$boardId", params: { boardId: result.boardId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    navigate({ to: "/boards" });
  };

  // Loading states
  if (authLoading || invite === undefined) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  // Invalid invite
  if (invite === null) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-dark-text mb-2">Invalid Invite</h1>
          <p className="text-dark-muted mb-6">
            This invite link is invalid, expired, or has reached its maximum number of uses.
          </p>
          <button
            onClick={() => navigate({ to: "/boards" })}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go to Boards
          </button>
        </div>
      </div>
    );
  }

  // Valid invite - show details
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-dark-text mb-2">You've been invited!</h1>
        <p className="text-dark-muted mb-1">
          <span className="text-dark-text font-medium">{invite.creatorName}</span> invited you to join
        </p>
        <p className="text-2xl font-bold text-dark-text mb-2">{invite.boardName}</p>
        <p className="text-dark-muted mb-6">
          as a <span className="capitalize text-accent font-medium">{invite.role}</span>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 px-4 py-2.5 border border-dark-border text-dark-muted rounded-lg hover:bg-dark-hover transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {accepting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Joining...
              </>
            ) : (
              "Join Board"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
