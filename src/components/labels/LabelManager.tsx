import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LABEL_COLORS } from "@/lib/constants";
import type { Label } from "@/lib/types";
import { useConvexUser } from "@/hooks/useConvexUser";

interface Props {
  boardId: Id<"boards">;
  onClose: () => void;
}

export function LabelManager({ boardId, onClose }: Props) {
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [applyToCardBg, setApplyToCardBg] = useState(false);

  const { session } = useConvexUser();
  const labels = useQuery(api.labels.list, session ? { boardId } : "skip");
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);
  const deleteLabel = useMutation(api.labels.remove);

  const resetForm = () => {
    setName("");
    setSelectedColorIndex(0);
    setApplyToCardBg(false);
    setEditingLabel(null);
    setIsCreating(false);
  };

  const startEditing = (label: Label) => {
    setEditingLabel(label);
    setName(label.name);
    setApplyToCardBg(label.applyToCardBg);
    const colorIndex = LABEL_COLORS.findIndex(
      (c) => c.bg === label.color && c.text === label.textColor
    );
    setSelectedColorIndex(colorIndex >= 0 ? colorIndex : 0);
    setIsCreating(false);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleSave = async () => {
    const selectedColor = LABEL_COLORS[selectedColorIndex];

    if (editingLabel) {
      await updateLabel({
        labelId: editingLabel._id,
        name,
        color: selectedColor.bg,
        textColor: selectedColor.text,
        applyToCardBg,
      });
    } else {
      await createLabel({
        boardId,
        name,
        color: selectedColor.bg,
        textColor: selectedColor.text,
        applyToCardBg,
      });
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (labelToDelete) {
      await deleteLabel({ labelId: labelToDelete._id });
      setLabelToDelete(null);
      resetForm();
    }
  };

  const isFormOpen = isCreating || editingLabel !== null;

  return (
    <>
      <Modal open={true} onClose={onClose} title="Manage Labels" size="md">
        <div className="space-y-4">
          {/* Labels list */}
          {!isFormOpen && (
            <>
              <div className="space-y-2">
                {!labels || labels.length === 0 ? (
                  <p className="text-sm text-dark-muted text-center py-8">
                    No labels created yet. Create your first label to get started.
                  </p>
                ) : (
                  labels.map((label) => (
                    <div
                      key={label._id}
                      className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg"
                    >
                      <span
                        className={`flex-1 px-3 py-1.5 rounded font-medium text-sm ${label.color} ${label.textColor}`}
                      >
                        {label.name}
                      </span>
                      {label.applyToCardBg && (
                        <span className="text-xs text-dark-muted" title="Applied as card background">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </span>
                      )}
                      <button
                        onClick={() => startEditing(label)}
                        className="p-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setLabelToDelete(label)}
                        className="p-1.5 text-dark-muted hover:text-red-400 hover:bg-dark-hover rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <Button onClick={startCreating} className="w-full">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new label
              </Button>
            </>
          )}

          {/* Create/Edit form */}
          {isFormOpen && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">
                  Label name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bug, Feature, Urgent"
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_COLORS.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColorIndex(index)}
                      className={`w-10 h-8 rounded ${color.bg} ${
                        selectedColorIndex === index
                          ? "ring-2 ring-offset-2 ring-offset-dark-surface ring-accent"
                          : ""
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-2">
                  Preview
                </label>
                <span
                  className={`inline-block px-3 py-1.5 rounded font-medium text-sm ${LABEL_COLORS[selectedColorIndex].bg} ${LABEL_COLORS[selectedColorIndex].text}`}
                >
                  {name || "Label preview"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="applyToCardBg"
                  checked={applyToCardBg}
                  onChange={(e) => setApplyToCardBg(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent focus:ring-accent focus:ring-offset-dark-surface"
                />
                <label htmlFor="applyToCardBg" className="text-sm text-dark-text">
                  Apply color as card background
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={!name.trim()}>
                  {editingLabel ? "Save changes" : "Create label"}
                </Button>
                <Button variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={labelToDelete !== null}
        onClose={() => setLabelToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Label"
        message={`Are you sure you want to delete "${labelToDelete?.name}"? This will remove the label from all cards.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
