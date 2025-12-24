interface Props {
  onClick: () => void;
}

export function AddColumnButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-72 h-fit p-4 border-2 border-dashed border-dark-border rounded-lg text-dark-muted hover:border-accent hover:text-accent transition-colors"
    >
      + Add Column
    </button>
  );
}
