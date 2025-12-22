import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards")({
  component: BoardsLayout,
});

function BoardsLayout() {
  return <Outlet />;
}
