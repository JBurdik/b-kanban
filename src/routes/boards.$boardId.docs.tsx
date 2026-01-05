import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  return <Outlet />;
}
