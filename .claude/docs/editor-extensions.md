# Editor Extensions Documentation

## TipTap Editor Setup

The RichTextEditor component uses TipTap with multiple extensions for a Notion-like editing experience.

### Installed Extensions

| Extension | Purpose |
|-----------|---------|
| StarterKit | Basic formatting (bold, italic, strike, headings, lists, code) |
| Placeholder | Hint text when editor is empty |
| TaskList + TaskItem | Checkbox task lists |
| Table + TableRow/Header/Cell | Table support |
| Highlight | Text highlighting |
| SlashCommands | `/` command palette |
| Callout | Custom callout blocks |
| Mention | `@` mentions |

### Slash Commands (`/`)

Type `/` to open the command palette. Available commands:

| Command | Description |
|---------|-------------|
| Heading 1-3 | Section headings |
| Bullet List | Unordered list |
| Numbered List | Ordered list |
| To-do List | Checkbox task list |
| Code Block | Code snippet |
| Quote | Blockquote |
| Divider | Horizontal rule |
| Table | 3x3 table |
| Callout | Info/warning/success/error callout |
| Highlight | Highlight selected text |

### Adding New Slash Commands

Edit `src/components/editor/SlashCommands.tsx`:

```typescript
const commands: CommandItem[] = [
  // ... existing commands
  {
    title: "Your Command",
    description: "Description here",
    icon: <YourIcon />,
    command: (editor) => editor.chain().focus().yourCommand().run(),
  },
];
```

### Custom Callout Extension

The Callout extension (`src/components/editor/CalloutExtension.tsx`) provides four types:

- **info** - Blue, information icon
- **warning** - Amber, warning icon
- **success** - Green, checkmark icon
- **error** - Red, X icon

Usage in slash commands:
```typescript
editor.chain().focus().setCallout({ type: "info" }).run()
```

### hideToolbar Prop

The RichTextEditor supports hiding the toolbar for a cleaner Notion-like experience:

```tsx
<RichTextEditor
  content={content}
  onChange={onChange}
  hideToolbar={true}  // Hides toolbar, relies on / commands
/>
```

### Styling

Editor styles are defined inline in RichTextEditor.tsx. Key selectors:

- `.ProseMirror h1/h2/h3` - Headings
- `.ProseMirror ul:not([data-type="taskList"])` - Bullet lists
- `.ProseMirror ul[data-type="taskList"]` - Task lists
- `.ProseMirror table` - Tables
- `.ProseMirror mark` - Highlights
- `.ProseMirror blockquote` - Quotes
