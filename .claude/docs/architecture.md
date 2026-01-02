# Architecture Documentation

## Sidebar Layout System

The application uses a fixed sidebar layout for authenticated users, replacing the previous header-based navigation.

### Component Hierarchy

```
__root.tsx
└── AppLayout
    ├── Sidebar (desktop - fixed left)
    ├── MobileSidebar (mobile - overlay)
    └── main (content area)
        └── Page Components
```

### Key Files

- `src/components/layout/Sidebar.tsx` - Fixed left sidebar (256px/64px collapsed)
- `src/components/layout/AppLayout.tsx` - Wrapper with sidebar + main content
- `src/hooks/useSidebarState.ts` - Persists collapsed state in localStorage

### Sidebar Features

- **Collapsible**: 256px expanded, 64px collapsed (icons only)
- **Persistent State**: Collapsed state saved to localStorage
- **Auto-collapse**: Collapses on screens < 1024px
- **Mobile Overlay**: Slide-in overlay on mobile with backdrop

### Navigation Items

1. **Boards Section**: Lists all user's boards with active state highlighting
2. **Settings Section**: Link to profile settings
3. **User Section**: User avatar, name, notifications, and sign out

### Styling

- Background: `bg-dark-surface`
- Border: `border-r border-dark-border`
- Active state: `bg-accent/20 text-accent`
- Transition: 300ms for collapse/expand

## State Management

The sidebar state is managed via the `useSidebarState` hook:

```typescript
const { isCollapsed, isMobileOpen, toggle, toggleMobile, closeMobile } = useSidebarState();
```

## Responsive Behavior

- **Desktop (lg+)**: Fixed sidebar, collapsible
- **Mobile (<lg)**: Hidden sidebar, hamburger menu triggers overlay
