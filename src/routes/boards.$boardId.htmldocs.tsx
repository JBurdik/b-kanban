import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/boards/$boardId/htmldocs")({
  component: HtmlDocsLayout,
});

function HtmlDocsLayout() {
  return <Outlet />;
}
