import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import type { BoardMember } from "@/lib/types";

interface Props {
  value: Id<"users"> | undefined;
  onChange: (value: Id<"users"> | undefined) => void;
  members: BoardMember[];
  disabled?: boolean;
  className?: string;
}

export function AssigneeSelect({
  value,
  onChange,
  members,
  disabled = false,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedMember = members.find((m) => m.userId === value);

  // Filter members by search
  const filteredMembers = members.filter(
    (m) =>
      m.user &&
      (m.user.name.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email.toLowerCase().includes(search.toLowerCase()))
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (member: BoardMember) => {
    onChange(member.userId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm",
          "flex items-center justify-between gap-2",
          "hover:border-dark-hover focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
          "transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        <span className="flex-1 text-left">
          {selectedMember?.user ? (
            <span className="flex items-center gap-2">
              <Avatar
                name={selectedMember.user.name}
                id={selectedMember.user.id}
                imageUrl={selectedMember.user.image}
                size="sm"
              />
              <span className="truncate">{selectedMember.user.name}</span>
            </span>
          ) : (
            <span className="text-dark-muted">Unassigned</span>
          )}
        </span>

        <div className="flex items-center gap-1">
          {selectedMember && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-dark-hover rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-dark-muted hover:text-dark-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={clsx("w-4 h-4 text-dark-muted transition-transform", isOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            "absolute z-50 w-full mt-1",
            "bg-dark-surface border border-dark-border rounded-lg shadow-xl",
            "overflow-hidden"
          )}
        >
          {/* Search input */}
          <div className="p-2 border-b border-dark-border">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {/* Unassigned option */}
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
                setSearch("");
              }}
              className={clsx(
                "w-full px-3 py-2 text-sm text-left",
                "flex items-center gap-3",
                "transition-colors",
                !value
                  ? "bg-accent/20 text-accent"
                  : "text-dark-text hover:bg-dark-hover"
              )}
            >
              <div className="w-6 h-6 rounded-full bg-dark-border flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="flex-1">Unassigned</span>
              {!value && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-dark-muted">No members found</div>
            ) : (
              filteredMembers.map((member) => {
                if (!member.user) return null;
                const isSelected = member.userId === value;

                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => handleSelect(member)}
                    className={clsx(
                      "w-full px-3 py-2 text-sm text-left",
                      "flex items-center gap-3",
                      "transition-colors",
                      isSelected
                        ? "bg-accent/20 text-accent"
                        : "text-dark-text hover:bg-dark-hover"
                    )}
                  >
                    <Avatar
                      name={member.user.name}
                      id={member.user.id}
                      imageUrl={member.user.image}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{member.user.name}</div>
                      <div className="truncate text-xs text-dark-muted">{member.user.email}</div>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
