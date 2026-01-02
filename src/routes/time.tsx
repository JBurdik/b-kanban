import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { TimeTracker, MonthlyReport } from "@/components/timetracking";

export const Route = createFileRoute("/time")({
  component: TimeTrackingPage,
});

function TimeTrackingPage() {
  const { userEmail, isLoading, session } = useConvexUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Time Tracking</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Timer + Today's entries */}
        <div className="card">
          <TimeTracker userEmail={userEmail!} mode="full" />
        </div>

        {/* Right column: Monthly report */}
        <div className="card">
          <MonthlyReport userEmail={userEmail!} />
        </div>
      </div>
    </div>
  );
}
