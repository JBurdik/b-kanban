import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/canvas")({
  component: CanvasLayout,
});

function CanvasLayout() {
  return <Outlet />;
}
