import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  onSubmit: (name: string) => void;
  onClose: () => void;
  isPending?: boolean;
}

export function AddColumnModal({ onSubmit, onClose, isPending }: Props) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Add Column" size="sm">
      <form onSubmit={handleSubmit}>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Column name"
          autoFocus
        />
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()} loading={isPending}>
            Create
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
