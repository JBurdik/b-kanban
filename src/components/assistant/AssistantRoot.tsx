// Mounts the floating button + the panel. Kept separate from AssistantContext
// to avoid a circular import (context ⇄ button).

import { useAssistant } from "@/contexts/AssistantContext";
import { AssistantButton } from "./AssistantButton";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantRoot() {
  const { isOpen, close } = useAssistant();
  return (
    <>
      <AssistantButton />
      {isOpen && <AssistantPanel onClose={close} />}
    </>
  );
}
