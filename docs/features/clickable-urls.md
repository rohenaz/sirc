# Clickable URLs Feature

## Overview

SIRC now automatically detects and converts URLs in chat messages into clickable links. This feature enhances user experience by making it easy to open web pages, file downloads, and other resources shared in IRC channels.

## Features

### URL Detection

The system automatically detects and highlights:

- **HTTP/HTTPS URLs**: `http://example.com`, `https://github.com/user/repo`
- **FTP URLs**: `ftp://files.example.com/file.zip`
- **WWW URLs**: `www.example.com` (automatically prefixed with `https://`)
- **Naked Domains**: `example.com` (automatically prefixed with `https://`)
- **URLs with Paths**: `https://example.com/path/to/page`
- **URLs with Query Strings**: `https://example.com/search?q=irc&lang=en`
- **URLs with Fragments**: `https://example.com/page#section`
- **URLs with Ports**: `http://localhost:8080/api`

### Smart URL Validation

The parser includes validation to avoid false positives:

- Requires valid TLD (at least 2 characters)
- Recognizes common TLDs (`.com`, `.org`, `.net`, `.io`, etc.)
- Filters out version numbers like "1.2"
- Validates URL structure before creating links

### Link Behavior

- **Target**: Links open in a new tab/window (`target="_blank"`)
- **Security**: Uses `rel="noopener noreferrer"` for security
- **Styling**: Links are underlined and use the primary theme color
- **Hover Effect**: Links have hover states with color transitions
- **Word Breaking**: Long URLs break properly to prevent layout issues

## Usage

The feature works automatically - no configuration needed. Any message containing a URL will have it automatically converted to a clickable link.

### Example Messages

```
[12:34] Alice: Check out https://github.com/user/sirc
[12:35] Bob: Download from ftp://files.example.com/archive.zip
[12:36] Carol: Visit www.example.com for more info
[12:37] Dave: The site example.com has the documentation
```

All URLs in the messages above will be clickable.

## Implementation Details

### Components

1. **Message Parser** (`lib/message-parser.ts`)
   - URL regex pattern matching
   - URL validation and normalization
   - Message parsing into text and link parts

2. **MessageText Component** (`components/MessageText.tsx`)
   - Renders parsed messages with clickable links
   - Handles styling and interaction
   - Logs click events for debugging

### API

#### `parseMessage(text: string): MessagePart[]`

Parses a message and returns an array of parts (text or links).

```typescript
const parts = parseMessage('Visit https://example.com today');
// Returns:
// [
//   { type: 'text', content: 'Visit ' },
//   { type: 'link', content: 'https://example.com', url: 'https://example.com' },
//   { type: 'text', content: ' today' }
// ]
```

#### `extractUrls(text: string): string[]`

Extracts all URLs from a message.

```typescript
const urls = extractUrls('Visit https://example.com and www.github.com');
// Returns: ['https://example.com', 'https://www.github.com']
```

#### `isImageUrl(url: string): boolean`

Checks if a URL points to an image (for future inline preview feature).

```typescript
isImageUrl('https://example.com/photo.jpg'); // true
isImageUrl('https://example.com/page.html'); // false
```

#### `isVideoUrl(url: string): boolean`

Checks if a URL points to a video (for future inline preview feature).

```typescript
isVideoUrl('https://example.com/video.mp4'); // true
isVideoUrl('https://example.com/page.html'); // false
```

## Future Enhancements

This feature lays the groundwork for:

1. **Inline Image Preview**: Automatically show images from image URLs
2. **Video Embeds**: Embed videos from supported platforms
3. **Link Preview Cards**: Show metadata for shared links
4. **URL Shortening**: Show shortened versions of very long URLs
5. **Link Security Scanning**: Warn about potentially malicious URLs

## Testing

Tests are located in `lib/__tests__/message-parser.test.ts`.

Run tests with:
```bash
cd frontend
bun test message-parser.test.ts
```

## Browser Compatibility

This feature uses standard web APIs and works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- URL detection is performed client-side using regex
- Parsing is fast and lightweight (~1ms for typical messages)
- No server-side processing required
- Links are rendered using React for optimal performance

## Security

- All external links open in new tabs with `rel="noopener noreferrer"`
- This prevents the new page from accessing `window.opener`
- Protects against reverse tabnapping attacks
- No automatic downloading or code execution from links

## Accessibility

- Links are keyboard accessible (tab navigation)
- Screen readers will announce links properly
- Links have visible hover states
- Color contrast meets WCAG guidelines

## Changelog

### Version 1.0.0 (2025-11-24)
- Initial implementation of clickable URLs
- Support for HTTP, HTTPS, FTP, WWW, and naked domains
- Smart URL validation to avoid false positives
- Styled links with hover effects
- Security measures for external links
