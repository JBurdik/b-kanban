import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/webhooks")({
  component: WebhooksLayout,
});

function WebhooksLayout() {
  return <Outlet />;
}
