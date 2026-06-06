import { useState } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import type { FilterOption } from "./FilterBar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";

interface Version {
  _id: Id<"versions">;
  name: string;
  color: string;
}

interface ColumnLite {
  _id: Id<"columns">;
  name: string;
}

interface Props {
  boardId: string;
  viewMode: "board" | "table";
  onViewModeChange: (mode: "board" | "table") => void;
  filter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  taskCounts: { all: number; myTasks: number; unassigned: number };
  versions: Version[];
  selectedVersionId: Id<"versions"> | null;
  onVersionChange: (versionId: Id<"versions"> | null) => void;
  columns: ColumnLite[];
  onCreateCard: (columnId: Id<"columns">, title: string) => Promise<void> | void;
  onSearch: () => void;
  canEdit: boolean;
  canManage: boolean;
  memberCount: number;
  onOpenLabels: () => void;
  onOpenVersions: () => void;
  onOpenMembers: () => void;
}

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All Tasks" },
  { value: "my-tasks", label: "My Tasks" },
  { value: "unassigned", label: "Unassigned" },
];

export function MobileBoardBar({
  boardId,
  viewMode,
  onViewModeChange,
  filter,
  onFilterChange,
  taskCounts,
  versions,
  selectedVersionId,
  onVersionChange,
  columns,
  onCreateCard,
  onSearch,
  canEdit,
  canManage,
  memberCount,
  onOpenLabels,
  onOpenVersions,
  onOpenMembers,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [targetColumn, setTargetColumn] = useState<Id<"columns"> | null>(null);
  const [creating, setCreating] = useState(false);

  const activeFilters =
    (filter !== "all" ? 1 : 0) + (selectedVersionId ? 1 : 0);

  const handleAdd = async () => {
    const columnId = targetColumn ?? columns[0]?._id;
    if (!columnId || !newTitle.trim()) return;
    setCreating(true);
    try {
      await onCreateCard(columnId, newTitle.trim());
      setNewTitle("");
      setAddOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const openAdd = () => {
    setTargetColumn(columns[0]?._id ?? null);
    setNewTitle("");
    setAddOpen(true);
  };

  return (
    <>
      {/* Bottom tab bar — mobile only */}
      <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-dark-bg border-t border-dark-border pb-safe">
        <div className="h-14 flex items-stretch justify-around">
          {/* View toggle */}
          <TabButton
            label={viewMode === "board" ? "Board" : "Table"}
            onClick={() =>
              onViewModeChange(viewMode === "board" ? "table" : "board")
            }
            icon={
              viewMode === "board" ? (
                <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              ) : (
                <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )
            }
          />

          {/* Filter */}
          <TabButton
            label="Filter"
            onClick={() => setFilterOpen(true)}
            badge={activeFilters || undefined}
            icon={
              <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            }
          />

          {/* Add card (center, primary) */}
          {canEdit && (
            <button
              onClick={openAdd}
              aria-label="Add card"
              className="flex-1 flex items-center justify-center"
            >
              <span className="-mt-5 w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-transform">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </span>
            </button>
          )}

          {/* Search */}
          <TabButton
            label="Find"
            onClick={onSearch}
            icon={
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            }
          />

          {/* More */}
          <TabButton
            label="More"
            onClick={() => setMoreOpen(true)}
            icon={
              <path d="M4 6h16M4 12h16M4 18h16" />
            }
          />
        </div>
      </nav>

      {/* Filter sheet */}
      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter tasks"
      >
        <div className="space-y-1">
          {filterOptions.map((opt) => {
            const count =
              opt.value === "all"
                ? taskCounts.all
                : opt.value === "my-tasks"
                  ? taskCounts.myTasks
                  : taskCounts.unassigned;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onFilterChange(opt.value);
                  setFilterOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-3 rounded-lg text-left",
                  filter === opt.value
                    ? "bg-accent text-white"
                    : "text-dark-text hover:bg-dark-hover"
                )}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span
                  className={clsx(
                    "text-xs px-2 py-0.5 rounded-full",
                    filter === opt.value ? "bg-white/20" : "bg-dark-border"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {versions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-border">
            <p className="px-3 pb-1 text-xs font-semibold text-dark-muted">
              Version
            </p>
            <div className="flex flex-wrap gap-2 px-1">
              <button
                onClick={() => onVersionChange(null)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs border",
                  !selectedVersionId
                    ? "border-accent text-accent"
                    : "border-dark-border text-dark-muted"
                )}
              >
                All
              </button>
              {versions.map((v) => (
                <button
                  key={v._id}
                  onClick={() =>
                    onVersionChange(
                      v._id === selectedVersionId ? null : v._id
                    )
                  }
                  className={clsx(
                    "px-3 py-1.5 rounded-full text-xs border",
                    v._id === selectedVersionId
                      ? "border-accent text-accent"
                      : "border-dark-border text-dark-muted"
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add card sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New card"
      >
        <div className="space-y-3 px-1">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Card title"
            autoFocus
            className="w-full px-3 py-3 bg-dark-bg border border-dark-border rounded-lg text-base text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {columns.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setTargetColumn(c._id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-full text-xs border",
                    (targetColumn ?? columns[0]?._id) === c._id
                      ? "border-accent text-accent"
                      : "border-dark-border text-dark-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={handleAdd}
            loading={creating}
            disabled={!newTitle.trim()}
            className="w-full"
          >
            Add card
          </Button>
        </div>
      </BottomSheet>

      {/* More sheet */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Board tools"
      >
        <div className="space-y-1">
          {canManage && (
            <SheetRow
              label="Labels"
              onClick={() => {
                setMoreOpen(false);
                onOpenLabels();
              }}
              icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
            />
          )}
          {canManage && (
            <SheetRow
              label="Versions"
              onClick={() => {
                setMoreOpen(false);
                onOpenVersions();
              }}
              icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
            />
          )}
          <Link
            to="/boards/$boardId/secrets"
            params={{ boardId }}
            onClick={() => setMoreOpen(false)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-dark-text hover:bg-dark-hover"
          >
            <svg
              className="w-5 h-5 text-dark-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <span className="text-sm font-medium">Secrets</span>
          </Link>
          <SheetRow
            label={`${memberCount} members`}
            onClick={() => {
              setMoreOpen(false);
              onOpenMembers();
            }}
            icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </div>
      </BottomSheet>
    </>
  );
}

function TabButton({
  label,
  onClick,
  icon,
  badge,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 text-dark-muted active:text-dark-text relative"
    >
      <span className="relative">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {icon}
        </svg>
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-medium bg-accent text-white rounded-full">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function SheetRow({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-dark-text hover:bg-dark-hover"
    >
      <svg
        className="w-5 h-5 text-dark-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={icon}
        />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
