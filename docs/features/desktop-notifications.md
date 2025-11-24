# Desktop Notifications Feature

## Overview

SIRC provides desktop notifications for important IRC events like mentions and private messages, ensuring you never miss a message even when the application is in the background. The system uses the Web Notifications API for browser environments and will integrate with Wails3 native notifications when running as a desktop application.

## Features

### Notification Types

1. **Mention Notifications** - When someone mentions your nickname in a channel
2. **Private Message Notifications** - When you receive a direct message
3. **Keyword Notifications** - When custom keywords are detected (configurable)

### Smart Notification Behavior

- **Auto-dismissal**: Notifications automatically close after 5 seconds (except PMs)
- **Focus Detection**: No notifications when window is focused (configurable)
- **Mentions-Only Mode**: Only show notifications for mentions/PMs, not all messages (default)
- **Message Truncation**: Long messages are truncated to 100 characters
- **Own Message Filtering**: Never notifies for your own messages
- **New Message Detection**: Only new messages trigger notifications, not history

## How It Works

### Permission Flow

1. When the chat interface loads, the app requests notification permission
2. User grants or denies permission via browser prompt
3. Permission state is cached and checked before showing notifications

### Notification Trigger Flow

1. Messages are polled every 1 second from the backend
2. New messages are detected by comparing message count
3. Each new message is checked for:
   - Is it from yourself? (skip)
   - Is it a private message?
   - Does it mention your nickname?
   - Does it contain custom keywords?
4. If notification criteria are met, a browser notification is shown
5. User preferences are respected (window focus, mentions-only, etc.)

## Implementation Details

### Frontend Components

**Notification Utilities** (`/frontend/lib/notifications.ts`):
- `requestNotificationPermission()` - Request browser permission
- `showNotification()` - Generic notification function
- `showMentionNotification()` - Mention-specific notifications
- `showPrivateMessageNotification()` - PM notifications
- `showKeywordNotification()` - Keyword highlight notifications
- `getNotificationPreferences()` - Load preferences from localStorage
- `saveNotificationPreferences()` - Save preferences
- `shouldNotify()` - Check if notification should be shown

**Chat Integration** (`/frontend/app/page.tsx`):
- ChatMessages component requests permission on mount
- Tracks previous message count to detect new messages
- Uses `checkHighlight()` to detect mentions/keywords
- Calls notification functions based on message type

### Backend Support

**Go Notification Service** (`/pkg/services/notification_service.go`):
- Foundation for Wails3 native notification integration
- Will handle OS-level notifications for desktop app
- Currently browser-based, will upgrade when Wails3 runs desktop

## Usage

### User Experience

Notifications work automatically once permission is granted:

```
Browser Prompt:
"sirc.app wants to show notifications"
[Block] [Allow]

↓ User clicks "Allow"

When a mention occurs:
┌─────────────────────────────────┐
│ Alice mentioned you in #dev     │
│ Hey @YourNick, can you help?    │
└─────────────────────────────────┘
Auto-closes after 5 seconds
```

### Private Messages

```
┌─────────────────────────────────┐
│ Private message from Bob        │
│ Hey, got a minute?              │
└─────────────────────────────────┘
Requires interaction to dismiss
```

## Preferences

Notification preferences are stored in `localStorage`:

```typescript
interface NotificationPreferences {
  enabled: boolean;              // Master toggle (default: true)
  mentionsOnly: boolean;         // Only notify for mentions/PMs (default: true)
  keywords: string[];            // Custom highlight keywords (default: [])
  sound: boolean;                // Play notification sound (default: false)
  notifyWhenFocused: boolean;    // Show notifications when focused (default: false)
}
```

### Default Behavior

- ✅ Notifications enabled
- ✅ Mentions-only mode (no noise for every message)
- ✅ No notifications when window is focused
- ❌ No sound alerts
- ❌ No custom keywords configured

## API Reference

### `requestNotificationPermission()`

Request browser notification permission.

```typescript
const granted = await requestNotificationPermission();
if (granted) {
  console.log("User granted notification permission");
}
```

**Returns**: `Promise<boolean>` - true if granted, false otherwise

---

### `showMentionNotification(from, channel, message)`

Show a notification for a mention.

```typescript
showMentionNotification(
  "Alice",
  "#development",
  "Hey @Bob, can you review this PR?"
);
```

**Parameters**:
- `from: string` - Nickname of sender
- `channel: string` - Channel name
- `message: string` - Message text (truncated to 100 chars)
- `server?: string` - Optional server name

**Returns**: `Notification | null` - Browser Notification object or null

---

### `showPrivateMessageNotification(from, message)`

Show a notification for a private message.

```typescript
showPrivateMessageNotification(
  "Alice",
  "Hey, can we discuss the project?"
);
```

**Parameters**:
- `from: string` - Nickname of sender
- `message: string` - Message text (truncated to 100 chars)

**Returns**: `Notification | null` - Browser Notification object or null

**Note**: PMs require user interaction to dismiss (`requireInteraction: true`)

---

### `shouldNotify(isMention, isKeyword)`

Check if notification should be shown based on preferences and window state.

```typescript
const highlight = checkHighlight(message, currentNick, keywords);
if (shouldNotify(highlight.isMention, highlight.isKeyword)) {
  showMentionNotification(from, channel, message);
}
```

**Parameters**:
- `isMention: boolean` - Is this a mention?
- `isKeyword: boolean` - Does it contain a keyword?

**Returns**: `boolean` - true if should notify, false otherwise

**Checks**:
1. Are notifications enabled?
2. Is window focused and notifyWhenFocused is false?
3. If mentions-only mode, is this a mention or keyword?

---

### `getNotificationPreferences()`

Load notification preferences from localStorage.

```typescript
const prefs = getNotificationPreferences();
console.log(prefs.enabled); // true
console.log(prefs.mentionsOnly); // true
```

**Returns**: `NotificationPreferences` - Current preferences

---

### `saveNotificationPreferences(prefs)`

Save notification preferences to localStorage.

```typescript
saveNotificationPreferences({
  enabled: true,
  mentionsOnly: false,  // Notify for all messages
  keywords: ["urgent", "help"],
  sound: true,
  notifyWhenFocused: true
});
```

**Parameters**:
- `prefs: Partial<NotificationPreferences>` - Preferences to update (partial)

**Side Effects**: Updates localStorage and logs to console

## Browser Compatibility

### Supported Browsers

- ✅ Chrome/Edge 20+
- ✅ Firefox 22+
- ✅ Safari 7+
- ✅ Opera 25+

### Unsupported

- ❌ Internet Explorer (all versions)
- ❌ Older mobile browsers

### Detection

The system automatically detects browser support:

```typescript
if (!("Notification" in window)) {
  console.warn("Browser does not support notifications");
}
```

## Wails3 Integration

### Current State (Web)

- Uses browser Web Notifications API
- Works in Wails3 webview
- Limited to browser-level notifications

### Future Enhancement (Native)

When Wails3 desktop app is fully implemented:
- OS-level native notifications
- Better integration with system notification center
- Support for notification actions (reply, dismiss, etc.)
- Proper app icon and branding

### Migration Path

The current browser-based implementation will automatically upgrade to Wails3 native notifications when running in desktop mode:

```typescript
// Future implementation:
import { Notify } from "@wailsio/runtime/notifications";

if (isWailsDesktop()) {
  Notify({
    title: "Mention",
    body: message,
    icon: "/icon.png"
  });
} else {
  // Fallback to browser API
  showMentionNotification(...);
}
```

## Security Considerations

### Privacy

- No sensitive data is logged
- Notifications only shown to active user
- No external services used
- All data stays on device

### Permissions

- User must explicitly grant notification permission
- Permission state is respected
- No persistent nagging for permission
- Clear indication when notifications are disabled

## Troubleshooting

### Notifications Not Showing

1. **Check permission**: Ensure notification permission is granted
   - Browser: Look for 🔔 icon in address bar
   - Settings: Check browser notification settings

2. **Check preferences**: Verify notifications are enabled
   - Open browser console
   - Run: `localStorage.getItem('irc-notification-prefs')`

3. **Check window focus**: If `notifyWhenFocused: false`, notifications won't show
   - This is default behavior
   - Minimize or switch to another window to test

4. **Check browser support**: Verify browser supports notifications
   - Run: `console.log("Notification" in window)`
   - Should return `true`

### Notifications Show for Own Messages

This is a bug if it happens. Report with:
- Current nickname
- Message sent
- Browser console logs

### Notifications Don't Auto-Close

- PM notifications require manual dismiss (by design)
- Other notifications should close after 5 seconds
- Check browser notification settings for overrides

## Performance Considerations

### Polling Impact

- Messages are polled every 1 second
- Only new messages are checked for notifications
- Minimal CPU/memory overhead
- Network traffic: ~1 KB per poll

### Optimization

- Message count comparison is O(1)
- Mention detection uses compiled regex (cached)
- Notification API is async (non-blocking)
- No DOM manipulation for notifications

## Future Enhancements

Planned improvements:

1. **Notification Settings UI** - Visual preferences dialog
2. **Sound Support** - Audio alerts for notifications
3. **Custom Sounds** - User-selectable notification sounds
4. **Rich Notifications** - Reply directly from notification
5. **Do Not Disturb** - Scheduled quiet hours
6. **Per-Channel Settings** - Different rules per channel
7. **Notification History** - Log of all notifications
8. **Notification Grouping** - Combine multiple mentions

## Related Features

- [Mention Highlighting](./mention-highlighting.md) - Visual highlighting in chat
- [Clickable URLs](./clickable-urls.md) - Link detection in messages
- Notification Settings UI - Coming soon

## Changelog

### Version 1.0.0 (2025-11-24)

- Initial implementation of desktop notifications
- Web Notifications API integration
- Auto-permission request on mount
- Mention and PM detection
- Preferences system with localStorage
- Focus detection (don't notify when active)
- Message truncation (100 char limit)
- Auto-close after 5 seconds
- Smart new message detection
- Own message filtering

## Code Examples

### Basic Integration

```typescript
import {
  requestNotificationPermission,
  showMentionNotification,
  shouldNotify,
} from "@/lib/notifications";

// Request permission on app load
useEffect(() => {
  requestNotificationPermission();
}, []);

// Check new messages for mentions
useEffect(() => {
  if (newMessage.text.includes(currentNick)) {
    if (shouldNotify(true, false)) {
      showMentionNotification(
        newMessage.from,
        channel,
        newMessage.text
      );
    }
  }
}, [messages]);
```

### Custom Keyword Highlighting

```typescript
import { checkHighlight } from "@/lib/message-parser";
import {
  showKeywordNotification,
  getNotificationPreferences,
} from "@/lib/notifications";

const prefs = getNotificationPreferences();
const highlight = checkHighlight(message.text, currentNick, prefs.keywords);

if (highlight.isKeyword && shouldNotify(false, true)) {
  showKeywordNotification(
    message.from,
    channel,
    message.text,
    highlight.matchedKeyword
  );
}
```

### Managing Preferences

```typescript
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications";

// Load current preferences
const prefs = getNotificationPreferences();

// Update a specific setting
saveNotificationPreferences({
  mentionsOnly: false  // Notify for all messages
});

// Enable custom keywords
saveNotificationPreferences({
  keywords: ["urgent", "help", "question"]
});
```

## Testing

### Manual Testing

1. **Grant permission**: Open app, allow notifications
2. **Send mention**: Have someone mention your nick in channel
3. **Verify notification**: Should see desktop notification
4. **Test PM**: Send yourself a private message
5. **Test focus**: Verify no notifications when window is focused
6. **Test auto-close**: Mention notification should close after 5 seconds

### Automated Testing

```typescript
describe("Desktop Notifications", () => {
  it("requests permission on mount", () => {
    render(<ChatMessages serverId="test" channel="#test" />);
    expect(Notification.requestPermission).toHaveBeenCalled();
  });

  it("shows notification for mentions", () => {
    const { result } = renderHook(() => useNotifications());
    result.current.showMentionNotification("Alice", "#dev", "Hey @Bob");
    expect(new Notification).toHaveBeenCalled();
  });
});
```

## Support

For issues or questions about notifications:
- Check browser console for errors
- Verify notification permission is granted
- Check `localStorage` for preference corruption
- Review documentation above

**Known Issues**: None currently reported
**Browser Compatibility**: See section above
**Feature Requests**: File an issue on GitHub
