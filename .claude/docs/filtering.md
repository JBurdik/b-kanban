# Filtering Documentation

## Task Filtering System

The Kanban board supports filtering cards by assignee status.

### Filter Options

| Option | Description |
|--------|-------------|
| All Tasks | Show all cards |
| My Tasks | Show only cards assigned to current user |
| Unassigned | Show cards with no assignee |

### Implementation

#### FilterBar Component

Located at `src/components/kanban/FilterBar.tsx`:

```typescript
interface FilterBarProps {
  currentFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  taskCounts?: {
    all: number;
    myTasks: number;
    unassigned: number;
  };
}
```

#### Board Page Integration

The filter state is managed in `src/routes/boards.$boardId.index.tsx`:

```typescript
const [filter, setFilter] = useState<FilterOption>("all");

// Calculate task counts
const taskCounts = useMemo(() => {
  // Count all, myTasks, unassigned
}, [board?.columns, currentUser?.id]);
```

#### KanbanBoard Filtering

The KanbanBoard component (`src/components/kanban/KanbanBoard.tsx`) applies filtering:

```typescript
const filteredColumns = useMemo(() => {
  if (filter === "all") return board.columns;

  return board.columns.map(column => ({
    ...column,
    cards: column.cards.filter(card => {
      if (filter === "my-tasks") return card.assignee?.id === currentUserId;
      if (filter === "unassigned") return !card.assignee;
      return true;
    }),
  }));
}, [board.columns, filter, currentUserId]);
```

### Adding New Filters

1. Add option to `FilterOption` type in `FilterBar.tsx`
2. Add button to `filters` array
3. Update filtering logic in `KanbanBoard.tsx`
4. Update count calculation in board page

### Backend Optimization

Currently filtering is client-side. For large boards, consider:

1. Create a Convex query with filter parameter
2. Use the `by_assignee` index in `convex/schema.ts`
3. Return filtered cards from the server

```typescript
// Example backend query
export const getFilteredCards = query({
  args: { boardId: v.id("boards"), filter: v.string(), userId: v.optional(v.id("users")) },
  handler: async (ctx, { boardId, filter, userId }) => {
    // Filter at database level
  },
});
```
