import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface Props {
  cardId: Id<"cards">;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

type Event = {
  _id: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: number;
  user: { name: string | null; email: string | null; image: string | null } | null;
};

// Human-readable phrase for an activity row (verb + detail).
function describe(e: Event): React.ReactNode {
  const q = (s?: string) => (s ? <span className="font-medium text-dark-text">{s}</span> : null);

  switch (e.action) {
    case "created":
      return <>created this card</>;
    case "archived":
      return <>archived this card</>;
    case "restored":
      return <>restored this card</>;
    case "moved":
      return (
        <>
          moved from {q(e.oldValue) ?? "?"} to {q(e.newValue) ?? "?"}
        </>
      );
    case "label_added":
      return <>added label {q(e.newValue)}</>;
    case "label_removed":
      return <>removed label {q(e.oldValue)}</>;
    case "field": {
      const f = e.field;
      if (f === "description") return <>edited the description</>;
      if (f === "title")
        return (
          <>
            renamed to {q(e.newValue)}
          </>
        );
      const label =
        f === "dueDate" ? "due date" : f === "assignee" ? "assignee" : f ?? "field";
      return (
        <>
          changed {label} from {q(e.oldValue) ?? "none"} to {q(e.newValue) ?? "none"}
        </>
      );
    }
    default:
      return <>{e.action}</>;
  }
}

export function HistoryList({ cardId }: Props) {
  const events = useQuery(api.cardActivity.list, { cardId }) as Event[] | undefined;

  if (events === undefined) {
    return <p className="text-dark-muted text-sm">Loading history…</p>;
  }

  if (events.length === 0) {
    return <p className="text-dark-muted text-sm italic">No activity yet</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((e) => {
        const name = e.user?.name || e.user?.email || "Someone";
        return (
          <li key={e._id} className="flex items-start gap-3 text-sm">
            <Avatar
              name={name}
              imageUrl={e.user?.image ?? undefined}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-dark-muted">
                <span className="font-medium text-dark-text">{name}</span> {describe(e)}
              </p>
              <p className="text-xs text-dark-muted/70">{formatTimeAgo(e.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
