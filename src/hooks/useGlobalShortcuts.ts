import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest(".ProseMirror")) return true;
  return false;
}

export function useGlobalShortcuts() {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case "b":
        case "B": {
          e.preventDefault();
          navigate({ to: "/boards" });
          break;
        }
        case "?": {
          e.preventDefault();
          setShowShortcutsModal((prev) => !prev);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return { showShortcutsModal, setShowShortcutsModal };
}
