import { useState, useEffect } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseEnvVars } from "./SecretFormModal";
import clsx from "clsx";

export interface BulkSecretData {
  name: string;
  value: string;
  visibility: "public" | "hidden";
  groupId?: string | null;
}

interface SecretGroup {
  _id: string;
  name: string;
  color?: string;
}

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (secrets: BulkSecretData[]) => void;
  isImporting?: boolean;
  initialPasteContent?: string;
  existingSecretNames?: string[];
  groups?: SecretGroup[];
}

export function BulkImportModal({
  open,
  onClose,
  onImport,
  isImporting = false,
  initialPasteContent = "",
  existingSecretNames = [],
  groups = [],
}: BulkImportModalProps) {
  const [pasteInput, setPasteInput] = useState("");
  const [parsedEnvVars, setParsedEnvVars] = useState<Array<{ name: string; value: string }>>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [defaultVisibility, setDefaultVisibility] = useState<"public" | "hidden">("hidden");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Initialize with paste content if provided
  useEffect(() => {
    if (open && initialPasteContent) {
      setPasteInput(initialPasteContent);
    } else if (!open) {
      // Reset when closing
      setPasteInput("");
      setParsedEnvVars([]);
      setSelectedNames(new Set());
      setSelectedGroupId(null);
    }
  }, [open, initialPasteContent]);

  // Parse env vars when input changes
  useEffect(() => {
    if (pasteInput) {
      const parsed = parseEnvVars(pasteInput);
      setParsedEnvVars(parsed);
      // Auto-select all new secrets (not duplicates)
      const newNames = new Set(
        parsed
          .filter((env) => !existingSecretNames.includes(env.name))
          .map((env) => env.name)
      );
      setSelectedNames(newNames);
    } else {
      setParsedEnvVars([]);
      setSelectedNames(new Set());
    }
  }, [pasteInput, existingSecretNames]);

  const toggleSelect = (name: string) => {
    const newSelected = new Set(selectedNames);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedNames(newSelected);
  };

  const selectAll = () => {
    const allNames = parsedEnvVars
      .filter((env) => !existingSecretNames.includes(env.name))
      .map((env) => env.name);
    setSelectedNames(new Set(allNames));
  };

  const selectNone = () => {
    setSelectedNames(new Set());
  };

  const handleImport = () => {
    const secretsToImport = parsedEnvVars
      .filter((env) => selectedNames.has(env.name))
      .map((env) => ({
        name: env.name,
        value: env.value,
        visibility: defaultVisibility,
        groupId: selectedGroupId,
      }));
    onImport(secretsToImport);
  };

  const duplicateCount = parsedEnvVars.filter((env) =>
    existingSecretNames.includes(env.name)
  ).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Import Secrets"
      description="Paste your .env file content to import multiple secrets at once"
      size="lg"
    >
      <div className="space-y-4">
        {/* Paste area */}
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            Paste .env content
          </label>
          <textarea
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            placeholder="API_KEY=sk-xxxxx&#10;DATABASE_URL=postgres://...&#10;SECRET_TOKEN=abc123"
            className="w-full h-32 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono resize-none"
            autoFocus
          />
        </div>

        {/* Parsed results */}
        {parsedEnvVars.length > 0 && (
          <div className="space-y-3">
            {/* Summary and actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-dark-muted">
                Found <span className="text-dark-text font-medium">{parsedEnvVars.length}</span> secrets
                {duplicateCount > 0 && (
                  <span className="text-amber-400 ml-1">
                    ({duplicateCount} already exist)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-dark-muted hover:text-accent transition-colors"
                >
                  Select all
                </button>
                <span className="text-dark-border">|</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-dark-muted hover:text-accent transition-colors"
                >
                  Select none
                </button>
              </div>
            </div>

            {/* Secret list with checkboxes */}
            <div className="max-h-48 overflow-y-auto border border-dark-border rounded-lg divide-y divide-dark-border">
              {parsedEnvVars.map((env, idx) => {
                const isDuplicate = existingSecretNames.includes(env.name);
                const isSelected = selectedNames.has(env.name);

                return (
                  <label
                    key={idx}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                      isDuplicate
                        ? "opacity-50 cursor-not-allowed bg-dark-bg/50"
                        : isSelected
                          ? "bg-accent/10"
                          : "hover:bg-dark-hover"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isDuplicate && toggleSelect(env.name)}
                      disabled={isDuplicate}
                      className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent focus:ring-accent focus:ring-offset-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-dark-text truncate">
                          {env.name}
                        </span>
                        {isDuplicate && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                            exists
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-muted font-mono truncate block">
                        {env.value.length > 40
                          ? `${env.value.slice(0, 40)}...`
                          : env.value || "(empty)"}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Default visibility */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-dark-muted">Default visibility:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultVisibility("hidden")}
                  className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition-colors",
                    defaultVisibility === "hidden"
                      ? "bg-accent/20 border-accent text-accent"
                      : "border-dark-border text-dark-muted hover:bg-dark-hover"
                  )}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                  Hidden
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultVisibility("public")}
                  className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition-colors",
                    defaultVisibility === "public"
                      ? "bg-accent/20 border-accent text-accent"
                      : "border-dark-border text-dark-muted hover:bg-dark-hover"
                  )}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Public
                </button>
              </div>
            </div>

            {/* Group selector */}
            {groups.length > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-dark-muted">Import to group:</span>
                <select
                  value={selectedGroupId || ""}
                  onChange={(e) => setSelectedGroupId(e.target.value || null)}
                  className="px-2 py-1 text-sm bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {pasteInput && parsedEnvVars.length === 0 && (
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            No valid KEY=value pairs found. Keys must be UPPERCASE_WITH_UNDERSCORES.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={selectedNames.size === 0}
          loading={isImporting}
        >
          Import {selectedNames.size > 0 ? `${selectedNames.size} Secret${selectedNames.size !== 1 ? "s" : ""}` : "Secrets"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
