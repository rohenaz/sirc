"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  groupShortcutsByCategory,
  formatShortcut,
  type KeyboardShortcut,
} from "@/lib/keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  const categories = groupShortcutsByCategory(shortcuts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and control SIRC more efficiently
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold mb-3 text-primary">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-2 hover:bg-accent rounded"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
          <p>
            Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Ctrl+/</kbd> or{" "}
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">⌘/</kbd>{" "}
            to toggle this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
