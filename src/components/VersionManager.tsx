import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useConvexUser } from "@/hooks/useConvexUser";
import clsx from "clsx";

const VERSION_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-teal-500",
];

interface Props {
  boardId: Id<"boards">;
  onClose: () => void;
}

export function VersionManager({ boardId, onClose }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(VERSION_COLORS[0]);
  const [editingId, setEditingId] = useState<Id<"versions"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { session } = useConvexUser();
  const versions = useQuery(api.versions.list, session ? { boardId } : "skip");
  const createVersion = useMutation(api.versions.create);
  const updateVersion = useMutation(api.versions.update);
  const removeVersion = useMutation(api.versions.remove);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createVersion({ boardId, name: name.trim(), color });
    setName("");
    setColor(VERSION_COLORS[(versions?.length ?? 0) % VERSION_COLORS.length]);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateVersion({ versionId: editingId, name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleDelete = async (versionId: Id<"versions">) => {
    if (!confirm("Delete this version? It will be removed from all cards.")) return;
    await removeVersion({ versionId });
  };

  const handleToggleActive = async (versionId: Id<"versions">, isActive: boolean) => {
    await updateVersion({ versionId, isActive: !isActive });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">Manage Versions</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create form */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Version name (e.g., v1.0)"
                className="input flex-1 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary text-sm px-3">
                Add
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {VERSION_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={clsx("w-6 h-6 rounded-full transition-all", c, color === c && "ring-2 ring-white ring-offset-2 ring-offset-dark-surface")}
                />
              ))}
            </div>
          </div>

          {/* Version list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {versions?.map((version) => (
              <div key={version._id} className="flex items-center gap-2 p-2 bg-dark-bg rounded-lg group">
                {editingId === version._id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input flex-1 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    />
                    <div className="flex gap-1">
                      {VERSION_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={clsx("w-4 h-4 rounded-full", c, editColor === c && "ring-2 ring-white ring-offset-1 ring-offset-dark-bg")}
                        />
                      ))}
                    </div>
                    <button onClick={handleUpdate} className="text-green-400 hover:text-green-300 p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-dark-muted hover:text-dark-text p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <span className={clsx("w-3 h-3 rounded-full flex-shrink-0", version.color)} />
                    <span className={clsx("flex-1 text-sm", !version.isActive && "text-dark-muted line-through")}>{version.name}</span>
                    <button
                      onClick={() => handleToggleActive(version._id, version.isActive)}
                      className={clsx("text-xs px-1.5 py-0.5 rounded", version.isActive ? "bg-green-500/20 text-green-400" : "bg-dark-border text-dark-muted")}
                    >
                      {version.isActive ? "Active" : "Archived"}
                    </button>
                    <button
                      onClick={() => { setEditingId(version._id); setEditName(version.name); setEditColor(version.color); }}
                      className="text-dark-muted hover:text-dark-text p-1 opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(version._id)}
                      className="text-dark-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
            {versions?.length === 0 && (
              <p className="text-sm text-dark-muted text-center py-4">No versions yet. Create one above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
