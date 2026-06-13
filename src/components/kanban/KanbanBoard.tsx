import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import clsx from "clsx";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useKanbanDnd } from "@/hooks/useKanbanDnd";
import { canEdit, canManageColumns } from "@/lib/permissions";
import type { Card, Column, BoardMember, BoardRole } from "@/lib/types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { AddColumnModal } from "./AddColumnModal";
import { AddColumnButton } from "./AddColumnButton";
import { CursorOverlay } from "./CursorOverlay";
import type { FilterOption } from "./FilterBar";
import type { CursorPosition } from "@/hooks/useBoardCursors";

interface KanbanColumnWithCards extends Column {
  cards: Card[];
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns: KanbanColumnWithCards[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface OnlineUser {
  userId: Id<"users">;
  userName: string;
  userImage?: string;
  activeCardId?: Id<"cards">;
}

interface Props {
  board: Board;
  filter?: FilterOption;
  searchQuery?: string;
  currentUserId?: string;
  versionFilter?: Id<"versions"> | null;
  onCardClick?: (card: Card) => void;
  onCardDoubleClick?: (card: Card) => void;
  focusedCardId?: Id<"cards"> | null;
  isSelected?: (cardId: Id<"cards">) => boolean;
  onSelectionToggle?: (cardId: Id<"cards">) => void;
  // Presence / cursors
  cursors?: CursorPosition[];
  onCursorMove?: (x: number, y: number) => void;
  onlineUsers?: OnlineUser[];
}

// Helper to strip HTML tags from TipTap content
function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function KanbanBoard({
  board,
  filter = "all",
  searchQuery = "",
  currentUserId,
  versionFilter,
  onCardClick,
  onCardDoubleClick,
  focusedCardId,
  isSelected,
  onSelectionToggle,
  cursors = [],
  onCursorMove,
  onlineUsers = [],
}: Props) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  // Mobile: track which full-width column is in view for the page dots.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCol, setActiveCol] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  const updateActiveCol = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    let nearest = 0;
    let min = Infinity;
    children.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - el.scrollLeft);
      if (d < min) {
        min = d;
        nearest = i;
      }
    });
    setActiveCol(nearest);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveCol();
      const el = scrollRef.current;
      if (el) {
        setScrollLeft(el.scrollLeft);
        setScrollTop(el.scrollTop);
      }
    });
  }, [updateActiveCol]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onCursorMove) return;
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left + el.scrollLeft;
      const y = e.clientY - rect.top + el.scrollTop;
      onCursorMove(x, y);
    },
    [onCursorMove]
  );

  const scrollToCol = useCallback((index: number) => {
    const el = scrollRef.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - 12, behavior: "smooth" });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const handleScrollTo = useCallback((contentX: number, contentY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: contentX - el.clientWidth / 2,
      top: contentY - el.clientHeight / 2,
      behavior: "smooth",
    });
  }, []);

  // Build userId → info map for cursor labels (cheap, no query)
  const userLookup = useMemo(() => {
    const map = new Map<string, OnlineUser>();
    for (const u of onlineUsers) map.set(u.userId, u);
    return map;
  }, [onlineUsers]);

  // Build cardId → viewers[] map for the open-card badges
  const viewersByCard = useMemo(() => {
    const map = new Map<string, OnlineUser[]>();
    for (const u of onlineUsers) {
      if (!u.activeCardId || u.userId === (currentUserId as unknown as Id<"users">)) continue;
      const existing = map.get(u.activeCardId) ?? [];
      map.set(u.activeCardId, [...existing, u]);
    }
    return map;
  }, [onlineUsers, currentUserId]);

  const userRole = board.userRole;
  const canDrag = canEdit(userRole);
  const canAddColumn = canManageColumns(userRole);

  const createColumn = useMutation(api.columns.create);

  // Apply filter and search to cards while keeping column structure
  const filteredColumns = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return (board.columns || []).map((column) => ({
      ...column,
      cards: column.cards.filter((card) => {
        // Apply assignee filter
        if (filter === "my-tasks" && card.assignee?.id !== currentUserId) {
          return false;
        }
        if (filter === "unassigned" && card.assignee) {
          return false;
        }

        // Apply version filter
        if (versionFilter && card.versionId !== versionFilter) {
          return false;
        }

        // Apply search filter
        if (searchLower) {
          const titleMatch = card.title.toLowerCase().includes(searchLower);
          const slugMatch = card.slug.toLowerCase().includes(searchLower);
          const contentMatch = stripHtml(card.content).toLowerCase().includes(searchLower);
          if (!titleMatch && !slugMatch && !contentMatch) {
            return false;
          }
        }

        return true;
      }),
    }));
  }, [board.columns, filter, searchQuery, currentUserId, versionFilter]);

  const {
    columns,
    activeCard,
    activeColumn,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useKanbanDnd({
    initialColumns: filteredColumns,
    canDrag,
    canReorderColumns: canAddColumn,
  });

  const handleCreateColumn = async (name: string) => {
    setIsCreatingColumn(true);
    try {
      await createColumn({
        boardId: board._id,
        name,
        position: columns.length,
      });
      setShowAddColumn(false);
    } finally {
      setIsCreatingColumn(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerMove={handlePointerMove}
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 pb-safe h-full overflow-x-auto snap-x snap-mandatory sm:snap-none scroll-pl-3"
      >
        <SortableContext
          items={columns.map((c) => c._id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column._id}
              column={column}
              boardId={board._id}
              canEdit={canDrag}
              canManageColumns={canAddColumn}
              isDraggingColumn={!!activeColumn}
              onCardClick={onCardClick}
              onCardDoubleClick={onCardDoubleClick}
              focusedCardId={focusedCardId}
              isSelected={isSelected}
              onSelectionToggle={onSelectionToggle}
              viewersByCard={viewersByCard}
            />
          ))}
        </SortableContext>

        {canAddColumn && (
          <AddColumnButton onClick={() => setShowAddColumn(true)} />
        )}
      </div>

      {/* Live cursor overlay — other users' pointers */}
      <CursorOverlay
        cursors={cursors}
        userLookup={userLookup}
        currentUserId={currentUserId as unknown as Id<"users"> | undefined}
        scrollLeft={scrollLeft}
        scrollTop={scrollTop}
        containerWidth={containerSize.w}
        containerHeight={containerSize.h}
        onScrollTo={handleScrollTo}
      />

      {/* Mobile page dots — one per column */}
      {columns.length > 1 && (
        <div className="sm:hidden absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 max-w-[80vw] overflow-x-auto no-scrollbar px-3 py-1.5 rounded-full bg-dark-surface/80 backdrop-blur border border-dark-border pointer-events-auto">
            {columns.map((column, i) => (
              <button
                key={column._id}
                onClick={() => scrollToCol(i)}
                aria-label={`Go to ${column.name}`}
                className={clsx(
                  "h-2 rounded-full transition-all flex-shrink-0",
                  i === activeCol ? "w-5 bg-accent" : "w-2 bg-dark-border"
                )}
              />
            ))}
          </div>
        </div>
      )}
      </div>

      {showAddColumn && (
        <AddColumnModal
          onSubmit={handleCreateColumn}
          onClose={() => setShowAddColumn(false)}
          isPending={isCreatingColumn}
        />
      )}

      <DragOverlay>
        {activeCard && <KanbanCard card={activeCard} isOverlay />}
        {activeColumn && (
          <div className="flex-shrink-0 w-72 sm:w-80 lg:w-72 xl:w-80 bg-dark-surface rounded-lg shadow-2xl opacity-90 max-h-[400px] overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-dark-border">
              <div className="flex items-center gap-1">
                <div className="p-1 text-dark-muted">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm">
                  {activeColumn.name}
                  <span className="ml-2 text-dark-muted">({activeColumn.cards?.length || 0})</span>
                </h3>
              </div>
            </div>
            <div className="p-2 space-y-2">
              {activeColumn.cards?.slice(0, 3).map((card) => (
                <div key={card._id} className="p-2 bg-dark-bg rounded-lg text-sm text-dark-text truncate">
                  {card.title}
                </div>
              ))}
              {(activeColumn.cards?.length || 0) > 3 && (
                <div className="text-xs text-dark-muted text-center py-1">
                  +{activeColumn.cards!.length - 3} more cards
                </div>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
