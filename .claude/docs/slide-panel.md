# Slide Panel Documentation

## Card Detail Slide Panel

The slide panel provides a smooth way to view and edit cards without leaving the board.

### Component

Located at `src/components/kanban/CardSlidePanel.tsx`

### Features

- **Slide-in Animation**: Panel slides from right with 0.3s ease-out
- **Backdrop**: Semi-transparent backdrop (40% black)
- **View/Edit Modes**: Single-click for view, double-click for edit
- **Keyboard Support**: Escape to close
- **Auto-save**: Changes auto-save via `useAutoSave` hook

### Props

```typescript
interface Props {
  card: CardWithColumn;
  board: Board;
  userEmail?: string;
  editMode?: boolean;  // Start in edit mode
  onClose: () => void;
}
```

### Integration

In `src/routes/boards.$boardId.index.tsx`:

```typescript
const [selectedCard, setSelectedCard] = useState<Card | null>(null);
const [editMode, setEditMode] = useState(false);

// Card click handlers
const handleCardClick = (card: Card) => {
  setSelectedCard(card);
  setEditMode(false);  // View mode
};

const handleCardDoubleClick = (card: Card) => {
  setSelectedCard(card);
  setEditMode(true);   // Edit mode
};

// Render panel
{selectedCardWithColumn && (
  <CardSlidePanel
    card={selectedCardWithColumn}
    board={board}
    editMode={editMode}
    onClose={() => setSelectedCard(null)}
  />
)}
```

### Animation Configuration

Animations defined in `tailwind.config.js`:

```javascript
animation: {
  "slide-in-right": "slide-in-right 0.3s ease-out",
  "slide-out-right": "slide-out-right 0.2s ease-in",
  "fade-in": "fade-in 0.2s ease-out",
},
keyframes: {
  "slide-in-right": {
    from: { transform: "translateX(100%)", opacity: "0" },
    to: { transform: "translateX(0)", opacity: "1" },
  },
}
```

### Styling

- **Width**: `max-w-2xl` (672px)
- **Background**: `bg-dark-surface`
- **Border**: `border-l border-dark-border`
- **Shadow**: `shadow-2xl`
- **Z-index**: 50 (panel), 40 (backdrop)

### View Mode Features

- Read-only display of card data
- Status bar with column, assignee, effort
- Description rendered as HTML
- "Double-click to edit" hint

### Edit Mode Features

- Full CardContent component with editor
- CardSidebar for status, priority, assignee
- All fields editable with auto-save
