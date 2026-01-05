import { useState, useEffect } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import clsx from "clsx";

export interface SecretFormData {
  name: string;
  value: string;
  visibility: "public" | "hidden";
  description: string;
  groupId?: string | null;
}

interface SecretGroup {
  _id: string;
  name: string;
  color?: string;
}

interface SecretFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SecretFormData) => void;
  isSubmitting?: boolean;
  initialData?: Partial<SecretFormData>;
  mode: "create" | "edit";
  groups?: SecretGroup[];
}

// Parse env vars format (KEY=value or KEY="value" or KEY='value')
export function parseEnvVars(input: string): Array<{ name: string; value: string }> {
  const results: Array<{ name: string; value: string }> = [];
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match KEY=value pattern (handles quoted and unquoted values)
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      let [, key, val] = match;
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      results.push({ name: key, value: val });
    }
  }

  return results;
}

export function SecretFormModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData,
  mode,
  groups = [],
}: SecretFormModalProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [visibility, setVisibility] = useState<"public" | "hidden">("hidden");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [parsedEnvVars, setParsedEnvVars] = useState<Array<{ name: string; value: string }>>([]);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "");
      setValue(initialData.value || "");
      setVisibility(initialData.visibility || "hidden");
      setDescription(initialData.description || "");
      setGroupId(initialData.groupId || null);
    } else if (!open) {
      // Reset form when closing
      setName("");
      setValue("");
      setVisibility("hidden");
      setDescription("");
      setGroupId(null);
      setShowValue(false);
      setErrors({});
      setShowPasteMode(false);
      setPasteInput("");
      setParsedEnvVars([]);
    }
  }, [open, initialData]);

  // Parse env vars when input changes
  useEffect(() => {
    if (pasteInput) {
      setParsedEnvVars(parseEnvVars(pasteInput));
    } else {
      setParsedEnvVars([]);
    }
  }, [pasteInput]);

  const handleSelectEnvVar = (envVar: { name: string; value: string }) => {
    setName(envVar.name);
    setValue(envVar.value);
    setShowPasteMode(false);
    setPasteInput("");
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation: uppercase letters, numbers, underscores
    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      newErrors.name = "Use UPPERCASE_WITH_UNDERSCORES format";
    }

    if (!value.trim() && mode === "create") {
      newErrors.value = "Value is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        name: name.trim(),
        value: value,
        visibility,
        description: description.trim(),
        groupId,
      });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-convert to uppercase and replace spaces/dashes with underscores
    const formatted = e.target.value
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");
    setName(formatted);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add Secret" : "Edit Secret"}
      description={
        mode === "create"
          ? "Create a new encrypted secret for this board"
          : "Update the secret details"
      }
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Paste from .env toggle (only in create mode) */}
          {mode === "create" && (
            <div>
              <button
                type="button"
                onClick={() => setShowPasteMode(!showPasteMode)}
                className={clsx(
                  "flex items-center gap-2 text-sm transition-colors",
                  showPasteMode
                    ? "text-accent"
                    : "text-dark-muted hover:text-dark-text"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                {showPasteMode ? "Hide paste area" : "Paste from .env file"}
              </button>

              {showPasteMode && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder="Paste your .env content here...&#10;&#10;Example:&#10;API_KEY=sk-xxxxx&#10;DATABASE_URL=postgres://..."
                    className="w-full h-28 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono resize-none"
                  />

                  {parsedEnvVars.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-dark-muted">
                        Found {parsedEnvVars.length} secret{parsedEnvVars.length !== 1 ? "s" : ""}. Click to select:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {parsedEnvVars.map((env, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectEnvVar(env)}
                            className="px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded hover:bg-dark-hover hover:border-accent transition-colors font-mono"
                          >
                            {env.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {pasteInput && parsedEnvVars.length === 0 && (
                    <p className="text-xs text-amber-400">
                      No valid KEY=value pairs found. Make sure keys are UPPERCASE_WITH_UNDERSCORES.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Name */}
          <Input
            label="Name"
            value={name}
            onChange={handleNameChange}
            placeholder="API_KEY"
            error={errors.name}
            helperText="Use UPPERCASE_WITH_UNDERSCORES format"
          />

          {/* Value */}
          <div className="relative">
            <Input
              label="Value"
              type={showValue ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "edit" ? "Leave empty to keep current value" : "Enter secret value"}
              error={errors.value}
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-3 top-[30px] text-dark-muted hover:text-dark-text"
            >
              {showValue ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              )}
            </button>
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark-text">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("hidden")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  visibility === "hidden"
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-dark-surface border-dark-border text-dark-muted hover:bg-dark-hover"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                onClick={() => setVisibility("public")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  visibility === "public"
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-dark-surface border-dark-border text-dark-muted hover:bg-dark-hover"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p className="text-xs text-dark-muted">
              {visibility === "hidden"
                ? "Value is masked by default, click to reveal"
                : "Value is shown by default when unlocked"}
            </p>
          </div>

          {/* Group selector */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-dark-text">Group (optional)</label>
              <select
                value={groupId || ""}
                onChange={(e) => setGroupId(e.target.value || null)}
                className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-muted">
                Organize secrets by app or service
              </p>
            </div>
          )}

          {/* Description */}
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this secret used for?"
            rows={2}
          />
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {mode === "create" ? "Create Secret" : "Save Changes"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
