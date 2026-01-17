import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/archive")({
  component: ArchiveLayout,
});

function ArchiveLayout() {
  return <Outlet />;
}
