# Keyboard Shortcuts

## Overview

SIRC provides comprehensive keyboard shortcuts to help you navigate and control the application efficiently without reaching for the mouse. All shortcuts work consistently across Windows, Linux, and macOS, with automatic platform detection for modifier keys.

## Features

- **Platform-Aware**: Automatically uses Cmd on Mac, Ctrl on Windows/Linux
- **Context-Sensitive**: Shortcuts respect input focus (e.g., don't trigger while typing)
- **Visual Help**: Built-in help dialog showing all available shortcuts
- **Extensible**: Easy to add new shortcuts via the hook system
- **Category Organization**: Shortcuts grouped by Navigation, Actions, View, and Help

## Available Shortcuts

### Navigation

| Shortcut | Description |
|----------|-------------|
| **Ctrl+↑** / **⌘↑** | Switch to previous channel |
| **Ctrl+↓** / **⌘↓** | Switch to next channel |

### Actions

| Shortcut | Description |
|----------|-------------|
| **Ctrl+T** / **⌘T** | Add new server |
| **Ctrl+J** / **⌘J** | Join channel (opens join dialog) |
| **Ctrl+B** / **⌘B** | Browse channels (opens channel browser) |
| **Ctrl+W** / **⌘W** | Part current channel |

### View

| Shortcut | Description |
|----------|-------------|
| **Ctrl+L** / **⌘L** | Toggle IRC protocol log |

### Help

| Shortcut | Description |
|----------|-------------|
| **Ctrl+/** / **⌘/** | Show keyboard shortcuts help dialog |

## Usage

### Basic Usage

Simply press the keyboard combination to execute the action. For example, press `Ctrl+T` (or `⌘T` on Mac) to open the "Add Server" dialog.

### Context Awareness

Keyboard shortcuts are smart about when they trigger:

- **In Text Fields**: Most shortcuts are disabled when typing in input fields or textareas
  - Exception: `Escape` always works to blur/unfocus inputs

- **In Dialogs**: Shortcuts work normally unless typing in a dialog input field

### Platform Detection

The system automatically detects your platform:

- **macOS**: Uses `⌘` (Command) for Ctrl shortcuts, shows Mac-style symbols (⌘, ⇧, ⌥)
- **Windows/Linux**: Uses `Ctrl` for shortcuts, shows standard modifier names

## Help Dialog

Press `Ctrl+/` (or `⌘/` on Mac) to open the keyboard shortcuts help dialog. This shows:

- All available shortcuts organized by category
- Platform-appropriate keyboard symbols
- Short description of each action
- Visual key representations

The help dialog can be closed by:
- Pressing `Escape`
- Clicking outside the dialog
- Pressing `Ctrl+/` again to toggle

## Implementation Details

### Architecture

**Keyboard Shortcuts Library** (`/frontend/lib/keyboard-shortcuts.ts`):
- `useKeyboardShortcuts()` - React hook to register shortcuts
- `matchesShortcut()` - Check if event matches shortcut definition
- `formatShortcut()` - Format shortcut for display (e.g., "⌘T" or "Ctrl+T")
- `groupShortcutsByCategory()` - Group shortcuts by category for UI
- `getModifierKey()` - Get platform-specific modifier ("Cmd" or "Ctrl")
- `isMacOS()` - Platform detection helper

**Shortcuts Dialog** (`/frontend/components/KeyboardShortcutsDialog.tsx`):
- Displays all shortcuts in organized categories
- Platform-aware formatting
- Responsive design
- Keyboard-accessible (Escape to close)

**Main Integration** (`/frontend/app/page.tsx`):
- Defines all application shortcuts
- Registers shortcuts via `useKeyboardShortcuts()` hook
- Manages dialog state
- Provides handlers for each shortcut action

### Shortcut Definition

Shortcuts are defined as objects with this structure:

```typescript
interface KeyboardShortcut {
  key: string;              // Key to press (e.g., "t", "ArrowUp")
  ctrl?: boolean;           // Require Ctrl (Cmd on Mac)
  meta?: boolean;           // Require Meta key
  shift?: boolean;          // Require Shift
  alt?: boolean;            // Require Alt (Option on Mac)
  description: string;      // Human-readable description
  category: string;         // Category for organization
  handler: () => void;      // Function to execute
}
```

### Example Shortcut

```typescript
{
  key: "j",
  ctrl: true,
  description: "Join channel",
  category: "Actions",
  handler: () => {
    if (activeServerId) {
      setShowJoinChannel(true);
    }
  },
}
```

## Adding New Shortcuts

To add a new keyboard shortcut:

1. **Define the shortcut** in the `shortcuts` array in `page.tsx`:

```typescript
const shortcuts: KeyboardShortcut[] = [
  // ... existing shortcuts ...
  {
    key: "n",
    ctrl: true,
    shift: true,
    description: "Open notifications panel",
    category: "View",
    handler: () => setShowNotifications(true),
  },
];
```

2. **The shortcut is automatically**:
   - Registered via the `useKeyboardShortcuts()` hook
   - Displayed in the help dialog
   - Formatted for the user's platform

3. **No additional configuration needed!**

## Best Practices

### Choosing Keyboard Shortcuts

1. **Follow Conventions**: Use standard shortcuts where possible (Ctrl+T for new tab/server, Ctrl+W for close)
2. **Avoid Conflicts**: Don't override browser shortcuts (Ctrl+R, Ctrl+N, etc.)
3. **Mnemonic**: Choose keys that relate to the action (J for Join, B for Browse)
4. **Accessibility**: Provide alternatives to mouse-only actions

### Shortcut Combinations

Common patterns:
- `Ctrl+Key` - Primary actions
- `Ctrl+Shift+Key` - Secondary/related actions
- `Alt+Key` - Alternative actions (use sparingly)
- Arrow keys - Navigation

Avoid:
- `Ctrl+Alt+Key` - Reserved by system on some platforms
- Function keys (F1-F12) - Often used by browser/system
- Single letter keys without modifiers - Conflicts with typing

## Browser Compatibility

### Supported Browsers

- ✅ Chrome/Edge 20+
- ✅ Firefox 22+
- ✅ Safari 7+
- ✅ Opera 25+

### Platform Detection

The system reliably detects macOS, Windows, and Linux:

```typescript
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
```

## API Reference

### `useKeyboardShortcuts(shortcuts)`

React hook to register keyboard shortcuts.

```typescript
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/lib/keyboard-shortcuts";

const shortcuts: KeyboardShortcut[] = [
  {
    key: "k",
    ctrl: true,
    description: "Quick switcher",
    category: "Navigation",
    handler: () => openQuickSwitcher(),
  },
];

useKeyboardShortcuts(shortcuts);
```

**Parameters:**
- `shortcuts: KeyboardShortcut[]` - Array of shortcut definitions

**Behavior:**
- Listens to `keydown` events on document
- Checks if event matches any registered shortcut
- Prevents default browser behavior when match found
- Calls handler function
- Respects input context (doesn't trigger in text fields except Escape)

**Cleanup:**
- Automatically removes event listener on unmount

---

### `formatShortcut(shortcut)`

Format a shortcut for display.

```typescript
import { formatShortcut } from "@/lib/keyboard-shortcuts";

const shortcut = {
  key: "t",
  ctrl: true,
  shift: true,
  description: "New tab",
  category: "Actions",
  handler: () => {},
};

const formatted = formatShortcut(shortcut);
// macOS: "⌘⇧T"
// Windows/Linux: "Ctrl+Shift+T"
```

**Parameters:**
- `shortcut: KeyboardShortcut` - Shortcut to format

**Returns:** `string` - Formatted shortcut string

**Platform-Specific:**
- macOS: Uses symbols (⌘, ⇧, ⌥)
- Windows/Linux: Uses names (Ctrl, Shift, Alt) with "+" separator

---

### `groupShortcutsByCategory(shortcuts)`

Group shortcuts by category for organized display.

```typescript
import { groupShortcutsByCategory } from "@/lib/keyboard-shortcuts";

const categories = groupShortcutsByCategory(shortcuts);
// [
//   { name: "Navigation", shortcuts: [...] },
//   { name: "Actions", shortcuts: [...] },
//   { name: "View", shortcuts: [...] },
// ]
```

**Parameters:**
- `shortcuts: KeyboardShortcut[]` - Array of shortcuts

**Returns:** `ShortcutCategory[]` - Array of categories with shortcuts

**Interface:**
```typescript
interface ShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}
```

---

### `getModifierKey()`

Get platform-specific modifier key name.

```typescript
import { getModifierKey } from "@/lib/keyboard-shortcuts";

const mod = getModifierKey();
// macOS: "Cmd"
// Windows/Linux: "Ctrl"
```

**Returns:** `"Cmd" | "Ctrl"`

**Usage:**
```typescript
const instructions = `Press ${getModifierKey()}+T to add a server`;
// macOS: "Press Cmd+T to add a server"
// Windows: "Press Ctrl+T to add a server"
```

---

### `isMacOS()`

Check if running on macOS.

```typescript
import { isMacOS } from "@/lib/keyboard-shortcuts";

if (isMacOS()) {
  console.log("Running on Mac");
}
```

**Returns:** `boolean` - true if macOS, false otherwise

## Troubleshooting

### Shortcuts Not Working

1. **Check browser console** for errors
2. **Verify shortcut definition** in code
3. **Check for conflicts** with browser/system shortcuts
4. **Test in different input contexts** (outside text fields)

### Platform Detection Issues

If platform detection fails:
- Check `navigator.platform` in browser console
- File an issue with platform details

### Shortcut Conflicts

If a shortcut conflicts with browser/system:
- Choose a different key combination
- Add Shift modifier to differentiate
- Avoid common browser shortcuts (Ctrl+N, Ctrl+T for tabs, etc.)

## Future Enhancements

Planned improvements:

1. **Customizable Shortcuts** - User-configurable key bindings
2. **Shortcut Profiles** - Different layouts (default, vim-like, emacs-like)
3. **Quick Switcher** - Ctrl+K style channel/server switcher
4. **Command Palette** - Searchable command list
5. **Chord Shortcuts** - Multi-key sequences (like vim)
6. **Shortcut Recording** - Visual UI for customization
7. **Import/Export** - Share shortcut configurations
8. **Conflict Detection** - Warn about conflicting shortcuts

## Related Features

- [Desktop Notifications](./desktop-notifications.md) - Can be triggered by shortcuts
- [Mention Highlighting](./mention-highlighting.md) - Navigate mentions with shortcuts
- Settings UI - Coming soon

## Examples

### Custom Shortcut Handler

```typescript
const shortcuts: KeyboardShortcut[] = [
  {
    key: "m",
    ctrl: true,
    shift: true,
    description: "Mute all notifications",
    category: "Actions",
    handler: () => {
      const prefs = getNotificationPreferences();
      saveNotificationPreferences({
        ...prefs,
        enabled: !prefs.enabled,
      });
      console.log(`Notifications ${prefs.enabled ? "disabled" : "enabled"}`);
    },
  },
];
```

### Conditional Shortcut

```typescript
{
  key: "w",
  ctrl: true,
  description: "Part current channel",
  category: "Actions",
  handler: () => {
    if (!activeChannel) {
      console.log("No active channel");
      return;
    }
    if (!activeChannel.startsWith("#")) {
      console.log("Cannot part private messages");
      return;
    }
    partCurrentChannel();
  },
}
```

### Async Shortcut Handler

```typescript
{
  key: "r",
  ctrl: true,
  description: "Reconnect to server",
  category: "Actions",
  handler: async () => {
    if (!activeServerId) return;

    try {
      await Disconnect(activeServerId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await Connect(activeServerId);
      console.log("Reconnected successfully");
    } catch (error) {
      console.error("Reconnect failed:", error);
    }
  },
}
```

## Changelog

### Version 1.0.0 (2025-11-24)

- Initial implementation of keyboard shortcuts system
- Platform-aware modifier key detection (Cmd/Ctrl)
- Context-sensitive shortcut handling (respects input fields)
- Visual help dialog with category organization
- 8 core shortcuts:
  - Ctrl+↑/↓ - Channel navigation
  - Ctrl+T - Add server
  - Ctrl+J - Join channel
  - Ctrl+B - Browse channels
  - Ctrl+W - Part channel
  - Ctrl+L - Toggle IRC log
  - Ctrl+/ - Show shortcuts help
- Auto-formatting for display (⌘ vs Ctrl+)
- Extensible hook-based architecture

## Performance

- **Minimal overhead**: Single event listener on document
- **Fast matching**: O(n) where n = number of registered shortcuts
- **No re-renders**: Shortcuts don't cause component re-renders
- **Memory efficient**: Cleanup on unmount prevents leaks

## Accessibility

- **Keyboard-first**: All features accessible via keyboard
- **Visual indicators**: Shortcuts shown in help dialog
- **Screen reader friendly**: Semantic HTML in dialog
- **Focus management**: Proper focus handling in dialogs
- **Escape hatch**: Escape key always works

## Security

- **No eval()**: No dynamic code execution
- **Sandboxed**: Event handlers are user-defined functions
- **No XSS risk**: Shortcut keys are validated strings
- **No injection**: Key matching uses strict comparison

## Testing

### Manual Testing

1. Open SIRC
2. Press `Ctrl+/` (or `⌘/`) to open help
3. Verify all shortcuts listed
4. Test each shortcut:
   - `Ctrl+T` - Opens add server dialog
   - `Ctrl+J` - Opens join channel dialog (if server active)
   - `Ctrl+B` - Opens browse channels (if server active)
   - `Ctrl+W` - Parts channel (if channel active)
   - `Ctrl+L` - Toggles IRC log
5. Test in text field - shortcuts should not trigger (except Escape)
6. Test on different platforms (Mac/Windows/Linux)

### Automated Testing

```typescript
describe("Keyboard Shortcuts", () => {
  it("registers shortcuts on mount", () => {
    const { result } = renderHook(() => useKeyboardShortcuts([]));
    expect(document.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("matches shortcut correctly", () => {
    const handler = jest.fn();
    const shortcuts = [{ key: "t", ctrl: true, handler, description: "Test", category: "Test" }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", { key: "t", ctrlKey: true });
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });
});
```

## Support

For issues or questions about keyboard shortcuts:
- Press `Ctrl+/` to see all available shortcuts
- Check browser console for errors
- Verify platform detection: `console.log(navigator.platform)`
- File an issue on GitHub with details

**Known Issues**: None currently reported
**Browser Compatibility**: All modern browsers supported
**Feature Requests**: File an issue on GitHub
