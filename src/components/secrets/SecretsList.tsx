import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { SecretItem } from "./SecretItem";
import { PassphraseModal } from "./PassphraseModal";
import { SecretFormModal, SecretFormData, parseEnvVars } from "./SecretFormModal";
import { BulkImportModal, BulkSecretData } from "./BulkImportModal";
import { useBoardPassphrase } from "@/hooks/useBoardPassphrase";
import { encryptSecret, decryptSecret, verifyPassphrase } from "@/lib/crypto";
import clsx from "clsx";

type SecretGroup = {
  _id: Id<"secretGroups">;
  name: string;
  color: string | undefined;
};

type Secret = {
  _id: Id<"secrets">;
  name: string;
  encryptedValue: string;
  iv: string;
  salt: string;
  visibility: "public" | "hidden";
  description: string | undefined;
  groupId: Id<"secretGroups"> | undefined;
  group: SecretGroup | null;
  createdAt: number;
  updatedAt: number;
  createdBy: { name: string; email: string } | null;
};

interface SecretsListProps {
  boardId: Id<"boards">;
  canManage: boolean;
  userEmail?: string;
}

export function SecretsList({ boardId, canManage, userEmail }: SecretsListProps) {
  const secrets = useQuery(api.secrets.list, { boardId, userEmail });
  const groups = useQuery(api.secretGroups.list, { boardId, userEmail });
  const createSecret = useMutation(api.secrets.create);
  const updateSecret = useMutation(api.secrets.update);
  const deleteSecret = useMutation(api.secrets.remove);
  const createGroup = useMutation(api.secretGroups.create);
  const deleteGroup = useMutation(api.secretGroups.remove);

  const { passphrase, isUnlocked, setPassphrase, clearPassphrase } =
    useBoardPassphrase(boardId);

  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseMode, setPassphraseMode] = useState<"unlock" | "create">("unlock");
  const [passphraseError, setPassphraseError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);

  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretModalMode, setSecretModalMode] = useState<"create" | "edit">("create");
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingFormData, setPendingFormData] = useState<SecretFormData | null>(null);

  // Bulk import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPasteContent, setBulkPasteContent] = useState("");
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [pendingBulkData, setPendingBulkData] = useState<BulkSecretData[] | null>(null);

  // Group management state
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("grouped");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["ungrouped"]));

  // Global paste capture (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only capture if not focused on an input/textarea
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const pastedText = e.clipboardData?.getData("text");
      if (!pastedText) return;

      // Check if it looks like env vars
      const parsed = parseEnvVars(pastedText);
      if (parsed.length > 0 && canManage) {
        e.preventDefault();
        setBulkPasteContent(pastedText);
        setShowBulkModal(true);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [canManage]);

  // Handle unlock
  const handleUnlock = () => {
    setPassphraseMode("unlock");
    setPassphraseError(undefined);
    setShowPassphraseModal(true);
  };

  // Handle passphrase submission
  const handlePassphraseSubmit = async (pass: string) => {
    setIsValidating(true);
    setPassphraseError(undefined);

    try {
      if (passphraseMode === "unlock" && secrets && secrets.length > 0) {
        // Verify passphrase against first secret
        const firstSecret = secrets[0];
        const isValid = await verifyPassphrase(
          {
            encryptedValue: firstSecret.encryptedValue,
            iv: firstSecret.iv,
            salt: firstSecret.salt,
          },
          pass
        );

        if (!isValid) {
          setPassphraseError("Incorrect passphrase");
          setIsValidating(false);
          return;
        }
      }

      setPassphrase(pass);
      setShowPassphraseModal(false);

      // If we have pending form data, complete the creation
      if (pendingFormData) {
        await handleCreateSecret(pendingFormData, pass);
        setPendingFormData(null);
      }

      // If we have pending bulk data, complete the bulk import
      if (pendingBulkData) {
        await handleBulkImport(pendingBulkData, pass);
        setPendingBulkData(null);
      }
    } catch {
      setPassphraseError("Failed to verify passphrase");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle create secret
  const handleCreateSecret = async (data: SecretFormData, pass?: string) => {
    if (!userEmail) return;

    const passphraseToUse = pass || passphrase;

    if (!passphraseToUse) {
      // Need to set passphrase first
      setPendingFormData(data);
      setPassphraseMode("create");
      setShowPassphraseModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const encrypted = await encryptSecret(data.value, passphraseToUse);
      await createSecret({
        boardId,
        name: data.name,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        salt: encrypted.salt,
        visibility: data.visibility,
        description: data.description || undefined,
        groupId: data.groupId as Id<"secretGroups"> | undefined,
        userEmail,
      });
      setShowSecretModal(false);
    } catch (error) {
      console.error("Failed to create secret:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle bulk import
  const handleBulkImport = async (secretsData: BulkSecretData[], pass?: string) => {
    if (!userEmail) return;

    const passphraseToUse = pass || passphrase;

    if (!passphraseToUse) {
      // Need to set passphrase first
      setPendingBulkData(secretsData);
      setPassphraseMode("create");
      setShowPassphraseModal(true);
      return;
    }

    setIsBulkImporting(true);
    try {
      // Create all secrets sequentially to avoid race conditions
      for (const secret of secretsData) {
        const encrypted = await encryptSecret(secret.value, passphraseToUse);
        await createSecret({
          boardId,
          name: secret.name,
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
          salt: encrypted.salt,
          visibility: secret.visibility,
          groupId: secret.groupId as Id<"secretGroups"> | undefined,
          userEmail,
        });
      }
      setShowBulkModal(false);
      setBulkPasteContent("");
    } catch (error) {
      console.error("Failed to bulk import secrets:", error);
    } finally {
      setIsBulkImporting(false);
    }
  };

  // Handle edit secret
  const handleEditSecret = async (data: SecretFormData) => {
    if (!editingSecret || !passphrase || !userEmail) return;

    setIsSubmitting(true);
    try {
      const updates: {
        secretId: Id<"secrets">;
        name?: string;
        encryptedValue?: string;
        iv?: string;
        salt?: string;
        visibility?: "public" | "hidden";
        description?: string;
        groupId?: Id<"secretGroups"> | null;
        userEmail: string;
      } = {
        secretId: editingSecret._id,
        name: data.name,
        visibility: data.visibility,
        description: data.description || undefined,
        groupId: data.groupId as Id<"secretGroups"> | null,
        userEmail,
      };

      // Only re-encrypt if value was changed
      if (data.value) {
        const encrypted = await encryptSecret(data.value, passphrase);
        updates.encryptedValue = encrypted.encryptedValue;
        updates.iv = encrypted.iv;
        updates.salt = encrypted.salt;
      }

      await updateSecret(updates);
      setShowSecretModal(false);
      setEditingSecret(null);
    } catch (error) {
      console.error("Failed to update secret:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete secret
  const handleDeleteSecret = async (secretId: Id<"secrets">) => {
    if (!userEmail) return;

    if (!confirm("Are you sure you want to delete this secret? This cannot be undone.")) {
      return;
    }

    try {
      await deleteSecret({ secretId, userEmail });
    } catch (error) {
      console.error("Failed to delete secret:", error);
    }
  };

  // Reveal secret value
  const revealSecret = useCallback(
    async (secret: Secret): Promise<string> => {
      if (!passphrase) throw new Error("Not unlocked");
      return decryptSecret(
        {
          encryptedValue: secret.encryptedValue,
          iv: secret.iv,
          salt: secret.salt,
        },
        passphrase
      );
    },
    [passphrase]
  );

  // Copy to clipboard
  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Group management
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !userEmail) return;
    try {
      await createGroup({
        boardId,
        name: newGroupName.trim(),
        userEmail,
      });
      setNewGroupName("");
      setShowNewGroupInput(false);
      // Auto-expand the new group
      setExpandedGroups((prev) => new Set([...prev, newGroupName.trim()]));
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleDeleteGroup = async (groupId: Id<"secretGroups">) => {
    if (!userEmail) return;
    if (!confirm("Delete this group? Secrets will be moved to 'Ungrouped'.")) return;
    try {
      await deleteGroup({ groupId, userEmail });
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const toggleGroupExpanded = (groupName: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Group secrets by their group
  const groupedSecrets = secrets
    ? secrets.reduce(
        (acc, secret) => {
          const groupName = secret.group?.name || "Ungrouped";
          if (!acc[groupName]) {
            acc[groupName] = {
              group: secret.group,
              secrets: [],
            };
          }
          acc[groupName].secrets.push(secret);
          return acc;
        },
        {} as Record<string, { group: SecretGroup | null; secrets: Secret[] }>
      )
    : {};

  // Open create modal
  const openCreateModal = () => {
    setSecretModalMode("create");
    setEditingSecret(null);
    setShowSecretModal(true);
  };

  // Open edit modal
  const openEditModal = async (secret: Secret) => {
    if (!passphrase) {
      handleUnlock();
      return;
    }

    setEditingSecret(secret);
    setSecretModalMode("edit");
    setShowSecretModal(true);
  };

  if (!secrets) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const hasSecrets = secrets.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-dark-text">Secrets</h2>
          {hasSecrets && (
            <>
              <button
                onClick={isUnlocked ? clearPassphrase : handleUnlock}
                className={clsx(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                  isUnlocked
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                )}
              >
                {isUnlocked ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                      />
                    </svg>
                    Unlocked
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Locked
                  </>
                )}
              </button>
              {/* View toggle */}
              <div className="flex items-center bg-dark-bg rounded-lg p-0.5 border border-dark-border">
                <button
                  onClick={() => setViewMode("grouped")}
                  className={clsx(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    viewMode === "grouped"
                      ? "bg-dark-surface text-dark-text"
                      : "text-dark-muted hover:text-dark-text"
                  )}
                >
                  Grouped
                </button>
                <button
                  onClick={() => setViewMode("flat")}
                  className={clsx(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    viewMode === "flat"
                      ? "bg-dark-surface text-dark-text"
                      : "text-dark-muted hover:text-dark-text"
                  )}
                >
                  Flat
                </button>
              </div>
            </>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setBulkPasteContent("");
                setShowBulkModal(true);
              }}
              size="sm"
              variant="secondary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Bulk Import
            </Button>
            <Button onClick={openCreateModal} size="sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Secret
            </Button>
          </div>
        )}
      </div>

      {/* Group management bar */}
      {hasSecrets && canManage && viewMode === "grouped" && (
        <div className="flex items-center gap-2">
          {showNewGroupInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateGroup();
                  if (e.key === "Escape") {
                    setShowNewGroupInput(false);
                    setNewGroupName("");
                  }
                }}
                placeholder="Group name..."
                className="px-2 py-1 text-sm bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <button
                onClick={handleCreateGroup}
                className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowNewGroupInput(false);
                  setNewGroupName("");
                }}
                className="p-1 text-dark-muted hover:bg-dark-hover rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Group
            </button>
          )}
        </div>
      )}

      {/* Secrets display */}
      {hasSecrets ? (
        viewMode === "grouped" ? (
          // Grouped view
          <div className="space-y-3">
            {Object.entries(groupedSecrets)
              .sort(([a], [b]) => (a === "Ungrouped" ? 1 : b === "Ungrouped" ? -1 : a.localeCompare(b)))
              .map(([groupName, { group, secrets: groupSecrets }]) => {
                const isExpanded = expandedGroups.has(groupName);
                return (
                  <div
                    key={groupName}
                    className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden"
                  >
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroupExpanded(groupName)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-dark-bg/50 hover:bg-dark-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={clsx(
                            "w-4 h-4 text-dark-muted transition-transform",
                            isExpanded && "rotate-90"
                          )}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: group?.color || "#6b7280" }}
                        />
                        <span className="font-medium text-dark-text">{groupName}</span>
                        <span className="text-xs text-dark-muted">
                          {groupSecrets.length} secret{groupSecrets.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {canManage && group && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group._id);
                          }}
                          className="p-1 text-dark-muted hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </button>

                    {/* Group secrets */}
                    {isExpanded && (
                      <table className="w-full">
                        <thead>
                          <tr className="border-t border-dark-border bg-dark-bg/30">
                            <th className="px-4 py-2 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                              Value
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                              Created By
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-dark-muted uppercase tracking-wider w-24">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                          {groupSecrets.map((secret) => (
                            <SecretItem
                              key={secret._id}
                              name={secret.name}
                              value={null}
                              visibility={secret.visibility}
                              description={secret.description}
                              createdBy={secret.createdBy}
                              createdAt={secret.createdAt}
                              isLocked={!isUnlocked}
                              canManage={canManage}
                              onReveal={() => revealSecret(secret)}
                              onCopy={copyToClipboard}
                              onEdit={() => openEditModal(secret)}
                              onDelete={() => handleDeleteSecret(secret._id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          // Flat view
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border bg-dark-bg/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                    Group
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {secrets.map((secret) => (
                  <SecretItem
                    key={secret._id}
                    name={secret.name}
                    value={null}
                    visibility={secret.visibility}
                    description={secret.description}
                    group={secret.group}
                    createdBy={secret.createdBy}
                    createdAt={secret.createdAt}
                    isLocked={!isUnlocked}
                    canManage={canManage}
                    onReveal={() => revealSecret(secret)}
                    onCopy={copyToClipboard}
                    onEdit={() => openEditModal(secret)}
                    onDelete={() => handleDeleteSecret(secret._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-dark-surface border border-dark-border rounded-lg p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-dark-bg flex items-center justify-center">
            <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h3 className="text-dark-text font-medium mb-1">No secrets yet</h3>
          <p className="text-dark-muted text-sm mb-4">
            Store encrypted API keys, credentials, and other sensitive data
          </p>
          {canManage && (
            <Button onClick={openCreateModal} size="sm">
              Add First Secret
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <PassphraseModal
        open={showPassphraseModal}
        onClose={() => {
          setShowPassphraseModal(false);
          setPendingFormData(null);
        }}
        onSubmit={handlePassphraseSubmit}
        mode={passphraseMode}
        isValidating={isValidating}
        error={passphraseError}
      />

      <SecretFormModal
        open={showSecretModal}
        onClose={() => {
          setShowSecretModal(false);
          setEditingSecret(null);
        }}
        onSubmit={secretModalMode === "create" ? handleCreateSecret : handleEditSecret}
        isSubmitting={isSubmitting}
        mode={secretModalMode}
        groups={groups || []}
        initialData={
          editingSecret
            ? {
                name: editingSecret.name,
                visibility: editingSecret.visibility,
                description: editingSecret.description || "",
                groupId: editingSecret.groupId,
              }
            : undefined
        }
      />

      <BulkImportModal
        open={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setBulkPasteContent("");
        }}
        onImport={handleBulkImport}
        isImporting={isBulkImporting}
        initialPasteContent={bulkPasteContent}
        existingSecretNames={secrets?.map((s) => s.name) || []}
        groups={groups || []}
      />
    </div>
  );
}
