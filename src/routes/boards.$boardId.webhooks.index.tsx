import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useSession } from "@/lib/auth-client";
import { NotificationBell } from "@/components/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";
import { useState } from "react";

export const Route = createFileRoute("/boards/$boardId/webhooks/")({
  component: WebhooksPage,
});

const AVAILABLE_EVENTS = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.archived",
  "comment.created",
  "member.joined",
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  generic: { bg: "bg-gray-500/20", text: "text-gray-300" },
  slack: { bg: "bg-green-500/20", text: "text-green-400" },
  discord: { bg: "bg-indigo-500/20", text: "text-indigo-400" },
};

function WebhooksPage() {
  const { boardId } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const { data: authSession } = useSession();

  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  const currentUser = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip"
  );

  const webhooks = useQuery(api.webhooks.list, {
    boardId: boardId as Id<"boards">,
  });

  const createWebhook = useMutation(api.webhooks.create);
  const updateWebhook = useMutation(api.webhooks.update);
  const removeWebhook = useMutation(api.webhooks.remove);
  const testWebhook = useAction(api.webhooks.test);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"webhooks"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "generic" as "generic" | "slack" | "discord",
    events: [] as string[],
    secret: "",
  });
  const [testingId, setTestingId] = useState<Id<"webhooks"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"webhooks"> | null>(null);

  const userName = currentUser?.name ?? authSession?.user?.name;
  const userImage = currentUser?.image ?? authSession?.user?.image;
  const userId = currentUser?.id ?? authSession?.user?.id;

  const isLoading = board === undefined || userLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-dark-muted mb-4">Board not found</p>
        <Link to="/boards" className="btn-primary">
          Back to boards
        </Link>
      </div>
    );
  }

  const canManage = board.userRole === "admin" || board.userRole === "owner";

  const resetForm = () => {
    setFormData({ name: "", url: "", type: "generic", events: [], secret: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (webhook: NonNullable<typeof webhooks>[number]) => {
    setFormData({
      name: webhook.name,
      url: webhook.url,
      type: webhook.type,
      events: [...webhook.events],
      secret: "",
    });
    setEditingId(webhook._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url || formData.events.length === 0) return;

    if (editingId) {
      await updateWebhook({
        webhookId: editingId,
        name: formData.name,
        url: formData.url,
        type: formData.type,
        events: formData.events,
        ...(formData.secret ? { secret: formData.secret } : {}),
      });
    } else {
      await createWebhook({
        boardId: boardId as Id<"boards">,
        name: formData.name,
        url: formData.url,
        type: formData.type,
        events: formData.events,
        ...(formData.secret ? { secret: formData.secret } : {}),
      });
    }

    resetForm();
  };

  const handleToggle = async (webhookId: Id<"webhooks">, isActive: boolean) => {
    await updateWebhook({ webhookId, isActive: !isActive });
  };

  const handleTest = async (webhookId: Id<"webhooks">) => {
    setTestingId(webhookId);
    try {
      await testWebhook({ webhookId });
    } catch {
      // Error handled by status update
    }
    setTestingId(null);
  };

  const handleDelete = async (webhookId: Id<"webhooks">) => {
    setDeletingId(webhookId);
    await removeWebhook({ webhookId });
    setDeletingId(null);
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "Never";
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  };

  const getStatusBadge = (status?: number) => {
    if (status === undefined || status === null) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Never</span>;
    }
    if (status >= 200 && status < 300) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{status}</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{status || "Error"}</span>;
  };

  return (
    <div className="h-screen flex flex-col -mt-14">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-dark-border bg-dark-bg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/boards/$boardId"
            params={{ boardId }}
            className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{board.name}</h1>
            <span className="text-dark-muted">/</span>
            <span className="text-lg text-dark-muted">Webhooks</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell userEmail={userEmail} />
          <UserDropdown
            userName={userName}
            userEmail={userEmail}
            userImage={userImage ?? undefined}
            userId={userId}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <p className="text-sm text-dark-muted mt-1">
                Send real-time notifications to external services when events happen on this board.
              </p>
            </div>
            {canManage && !showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Webhook
              </button>
            )}
          </div>

          {/* Create/Edit Form */}
          {showForm && canManage && (
            <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">
                {editingId ? "Edit Webhook" : "New Webhook"}
              </h3>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="My Webhook"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">Type</label>
                  <div className="flex gap-2">
                    {(["generic", "slack", "discord"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFormData((p) => ({ ...p, type: t }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          formData.type === t
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-dark-border text-dark-muted hover:border-dark-text hover:text-dark-text"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Events */}
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-2">Events</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <button
                        key={event}
                        onClick={() => toggleEvent(event)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          formData.events.includes(event)
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-dark-border text-dark-muted hover:border-dark-text hover:text-dark-text"
                        }`}
                      >
                        {event}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secret (only for generic) */}
                {formData.type === "generic" && (
                  <div>
                    <label className="block text-sm font-medium text-dark-muted mb-1">
                      Secret {editingId && <span className="text-dark-muted/50">(leave empty to keep current)</span>}
                    </label>
                    <input
                      type="password"
                      value={formData.secret}
                      onChange={(e) => setFormData((p) => ({ ...p, secret: e.target.value }))}
                      placeholder="Optional signing secret"
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted/50 focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!formData.name || !formData.url || formData.events.length === 0}
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingId ? "Save Changes" : "Create Webhook"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-dark-border text-dark-muted rounded-lg hover:bg-dark-hover hover:text-dark-text transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Webhook List */}
          {webhooks === undefined ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-lg font-medium mb-1">No webhooks configured</p>
              <p className="text-sm">Add a webhook to get notified about board events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook: any) => (
                <div
                  key={webhook._id}
                  className="bg-dark-surface border border-dark-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="font-medium text-dark-text truncate">{webhook.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[webhook.type].bg} ${TYPE_COLORS[webhook.type].text}`}>
                          {webhook.type.charAt(0).toUpperCase() + webhook.type.slice(1)}
                        </span>
                        {!webhook.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-dark-muted truncate mb-2">{webhook.url}</p>

                      {/* Events */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {webhook.events.map((event: string) => (
                          <span
                            key={event}
                            className="text-xs px-2 py-0.5 rounded-full bg-dark-hover text-dark-muted"
                          >
                            {event}
                          </span>
                        ))}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-3 text-xs text-dark-muted">
                        <span>Last triggered: {formatTime(webhook.lastTriggeredAt)}</span>
                        {getStatusBadge(webhook.lastStatus)}
                      </div>
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(webhook._id, webhook.isActive)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            webhook.isActive ? "bg-accent" : "bg-dark-border"
                          }`}
                          title={webhook.isActive ? "Disable" : "Enable"}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              webhook.isActive ? "left-5" : "left-0.5"
                            }`}
                          />
                        </button>

                        {/* Test */}
                        <button
                          onClick={() => handleTest(webhook._id)}
                          disabled={testingId === webhook._id}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors disabled:opacity-50"
                          title="Send test event"
                        >
                          {testingId === webhook._id ? (
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleEdit(webhook)}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(webhook._id)}
                          disabled={deletingId === webhook._id}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-dark-hover transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
