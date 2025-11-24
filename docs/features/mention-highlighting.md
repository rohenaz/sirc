# Mention Highlighting Feature

## Overview

SIRC automatically detects and highlights messages that mention your nickname, making it easy to spot when someone is talking to you in busy IRC channels.

## Features

### Visual Highlighting

- **Automatic Detection**: Your nickname is automatically highlighted in messages
- **Theme Integration**: Uses Schatzi NUI theme colors (`bg-primary/20 text-primary`)
- **Word Boundaries**: Only matches complete words to avoid false positives
- **Case Insensitive**: Works regardless of capitalization
- **Real-time**: Highlights appear instantly as messages arrive

### Technical Details

**Frontend Components:**
- `parseMessageWithMentions()` - Parses text and identifies mentions
- `containsMention()` - Checks if a message contains your nickname
- `MessageText` component - Renders highlighted messages

**Backend Support:**
- `GetCurrentNick()` - Returns your nickname for any server
- Automatic nickname fetching per server

## How It Works

1. When messages arrive, the system fetches your current nickname
2. Each message is parsed for mentions using word-boundary regex
3. Matching text is wrapped in a highlight span
4. The highlight uses the theme's primary color at 20% opacity

## Usage

Mention highlighting works automatically with no configuration needed:

```
[12:34] Alice: Hey everyone!
[12:35] Bob: @YourNick did you see the latest update?  ← Highlighted
[12:36] Carol: YourNick: what do you think?           ← Highlighted
[12:37] Dave: I think yourNICK would know             ← Highlighted (case insensitive)
```

## API Reference

### Frontend Functions

#### `parseMessageWithMentions(text, nickname, keywords)`

Parses a message and returns parts with mentions marked.

```typescript
const parts = parseMessageWithMentions(
  "Hey Alice, check this out!",
  "Alice",
  []
);
// Returns: [
//   { type: "text", content: "Hey " },
//   { type: "mention", content: "Alice" },
//   { type: "text", content: ", check this out!" }
// ]
```

#### `containsMention(message, nickname)`

Checks if a message contains a mention.

```typescript
containsMention("Hey Alice!", "Alice"); // true
containsMention("Hey Alice!", "Bob");   // false
containsMention("Alice123", "Alice");   // false (word boundary)
```

#### `checkHighlight(message, nickname, keywords)`

Comprehensive highlight check with result details.

```typescript
const result = checkHighlight("Hey Alice!", "Alice", ["urgent"]);
// Returns: {
//   isMention: true,
//   isKeyword: false,
//   matchedKeyword: undefined
// }
```

### Backend Methods

#### `GetCurrentNick(serverID)`

Returns the current nickname for a server.

```go
nick, err := ircService.GetCurrentNick("server-123")
if err != nil {
    // Handle error
}
// nick = "Alice"
```

## Styling

Mentions use the following Tailwind classes:

```css
bg-primary/20 text-primary px-1 rounded font-medium
```

This creates:
- Light purple background (20% opacity)
- Purple text (theme primary color)
- Small padding and rounded corners
- Medium font weight for emphasis

## Extensibility

### Custom Keywords

The system supports custom highlight keywords:

```typescript
<MessageText
  text={msg.text}
  currentNick="Alice"
  keywords={["urgent", "help", "Alice"]}
/>
```

All keywords will be highlighted the same way as mentions.

### Theme Customization

To change highlight colors, update the `--primary` variable in `globals.css`:

```css
:root {
  --primary: oklch(0.65 0.2 250); /* Current purple */
}
```

The highlights will automatically update to match.

## Implementation Notes

### Word Boundary Matching

The system uses regex word boundaries (`\b`) to ensure accurate matching:

```
"Alice"     in "Hey Alice!" → ✓ Match
"Alice"     in "Alice123"   → ✗ No match
"Alice"     in "Alicee"     → ✗ No match
```

### Regex Safety

All nicknames and keywords are escaped before being used in regex patterns to prevent regex injection:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

### Performance

- Parsing happens client-side for instant feedback
- Nickname is fetched once per server connection
- No server-side processing required
- Efficient regex matching with minimal overhead

## Future Enhancements

Planned improvements:
1. **Desktop Notifications** - Native OS notifications for mentions
2. **Notification Sounds** - Audio alerts for important messages
3. **Keyword Management UI** - Settings dialog for custom keywords
4. **Mention History** - Log of all messages that mentioned you
5. **Per-Channel Settings** - Different highlight rules per channel

## Troubleshooting

### Mentions Not Highlighting

1. **Check nickname**: Ensure you're connected to the server
2. **Word boundaries**: Nickname must be a complete word
3. **Case**: Matching is case-insensitive, both "Alice" and "alice" work

### Wrong Nickname

If the wrong nickname is being highlighted, check:
1. Server configuration in settings
2. Nickname field in server dialog
3. Current connection state

## Related Features

- [Clickable URLs](./clickable-urls.md) - Also uses `parseMessage()`
- Desktop Notifications - Coming soon
- Notification Settings - Coming soon

## Changelog

### Version 1.0.0 (2025-11-24)
- Initial implementation of mention highlighting
- Word-boundary matching for accuracy
- Theme-integrated styling
- Backend nickname fetching
- Real-time detection in chat

### Version 1.0.1 (2025-11-24)
- Added keyword support (not yet exposed in UI)
- Improved regex escaping
- Better TypeScript types
