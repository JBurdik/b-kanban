import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { checkPassphraseStrength } from "@/lib/crypto";
import clsx from "clsx";

interface PassphraseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (passphrase: string) => void;
  mode: "unlock" | "create";
  isValidating?: boolean;
  error?: string;
}

export function PassphraseModal({
  open,
  onClose,
  onSubmit,
  mode,
  isValidating = false,
  error,
}: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);

  const strength = mode === "create" ? checkPassphraseStrength(passphrase) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.trim()) {
      onSubmit(passphrase);
    }
  };

  const handleClose = () => {
    setPassphrase("");
    setShowPassphrase(false);
    onClose();
  };

  const strengthColors = [
    "bg-rose-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-emerald-500",
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === "unlock" ? "Unlock Secrets" : "Set Passphrase"}
      description={
        mode === "unlock"
          ? "Enter the passphrase to decrypt and view secrets"
          : "Create a strong passphrase to encrypt your secrets. Share it securely with team members."
      }
      size="sm"
      zIndex={60}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="relative">
            <Input
              label="Passphrase"
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={
                mode === "unlock" ? "Enter passphrase" : "Create a strong passphrase"
              }
              error={error}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassphrase(!showPassphrase)}
              className="absolute right-3 top-[30px] text-dark-muted hover:text-dark-text"
            >
              {showPassphrase ? (
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

          {/* Strength indicator for create mode */}
          {mode === "create" && passphrase.length > 0 && strength && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={clsx(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= strength.score ? strengthColors[strength.score] : "bg-dark-border"
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-dark-muted">{strength.feedback}</p>
            </div>
          )}

          {mode === "create" && (
            <p className="text-xs text-amber-400 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>
                This passphrase cannot be recovered. If lost, encrypted secrets will be
                inaccessible. Store it safely!
              </span>
            </p>
          )}
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!passphrase.trim() || (mode === "create" && (strength?.score ?? 0) < 2)}
            loading={isValidating}
          >
            {mode === "unlock" ? "Unlock" : "Set Passphrase"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
