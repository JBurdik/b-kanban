import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/secrets")({
  component: SecretsLayout,
});

function SecretsLayout() {
  return <Outlet />;
}
