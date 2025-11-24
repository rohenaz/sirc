/**
 * Message parsing utilities for IRC chat messages
 * Handles URL detection, link formatting, and text processing
 */

export interface MessagePart {
  type: "text" | "link" | "mention" | "image";
  content: string;
  url?: string;
}

export interface HighlightResult {
  isMention: boolean;
  isKeyword: boolean;
  matchedKeyword?: string;
}

/**
 * Comprehensive URL regex pattern that matches:
 * - http:// and https:// URLs
 * - ftp:// and ftps:// URLs
 * - www. URLs (will be prefixed with https://)
 * - Common TLDs without protocol
 * - URLs with ports, paths, query strings, and fragments
 */
const URL_REGEX =
  /(?:(?:https?|ftp):\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/**
 * More strict URL validation to avoid false positives
 */
function isValidUrl(text: string): boolean {
  // Must contain at least one dot
  if (!text.includes(".")) return false;

  // Must have a valid TLD (at least 2 characters after last dot)
  const parts = text.split(".");
  const tld = parts[parts.length - 1].split(/[/?#]/)[0];
  if (tld.length < 2) return false;

  // Avoid matching things like "1.2" or "foo.bar" without more context
  const hasProtocol = /^(?:https?|ftp):\/\//i.test(text);
  const hasWww = /^www\./i.test(text);
  const hasCommonTld =
    /\.(com|org|net|edu|gov|io|dev|app|co|uk|de|fr|jp|cn|au|ca|in|ru|br|mx|es|it|nl|se|no|fi|dk|pl|be|ch|at|cz|gr|pt|nz|kr|za|sg|hk|tw|th|my|id|ph|vn|ae|sa|eg|tr|ar|cl|pe|ve|ua|ro|hu|sk|hr|si|bg|lt|lv|ee|is|ie|lu|mt|cy|by|md|al|mk|ba|rs|me|xk|ir|iq|il|jo|lb|sy|ye|kw|om|qa|bh|af|pk|bd|np|lk|mm|la|kh|bn|mv|bt|mn|uz|tm|tj|kg|kz|az|ge|am)\b/i.test(
      text,
    );

  return hasProtocol || hasWww || (hasCommonTld && text.length > 6);
}

/**
 * Ensures URL has a protocol for proper linking
 */
function normalizeUrl(text: string): string {
  // Already has protocol
  if (/^(?:https?|ftp):\/\//i.test(text)) {
    return text;
  }

  // Starts with www.
  if (/^www\./i.test(text)) {
    return `https://${text}`;
  }

  // Default to https for naked domains
  return `https://${text}`;
}

/**
 * Parses a message text and returns an array of text and link parts
 */
export function parseMessage(text: string, inlineImages = false): MessagePart[] {
  if (!text) return [];

  const parts: MessagePart[] = [];
  let lastIndex = 0;

  // Find all URL matches
  const matches = Array.from(text.matchAll(URL_REGEX));

  for (const match of matches) {
    const urlText = match[0];
    const index = match.index;

    // Skip if index is undefined (should not happen with matchAll)
    if (index === undefined) continue;

    // Validate the URL
    if (!isValidUrl(urlText)) continue;

    // Add text before the URL
    if (index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, index),
      });
    }

    const normalizedUrl = normalizeUrl(urlText);

    // Check if it's an image URL and inline images are enabled
    if (inlineImages && isImageUrl(normalizedUrl)) {
      parts.push({
        type: "image",
        content: urlText,
        url: normalizedUrl,
      });
    } else {
      // Add the URL as a link
      parts.push({
        type: "link",
        content: urlText,
        url: normalizedUrl,
      });
    }

    lastIndex = index + urlText.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  // If no URLs were found, return the whole text as one part
  if (parts.length === 0) {
    parts.push({
      type: "text",
      content: text,
    });
  }

  return parts;
}

/**
 * Extracts all URLs from a message
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];

  const matches = Array.from(text.matchAll(URL_REGEX));
  return matches
    .map((match) => match[0])
    .filter(isValidUrl)
    .map(normalizeUrl);
}

/**
 * Checks if a URL is an image based on file extension
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(?:\?|#|$)/i;
  return imageExtensions.test(url);
}

/**
 * Checks if a URL is a video based on file extension
 */
export function isVideoUrl(url: string): boolean {
  const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv|flv)(?:\?|#|$)/i;
  return videoExtensions.test(url);
}

/**
 * Checks if a message contains a mention of the specified nickname
 */
export function containsMention(message: string, nickname: string): boolean {
  if (!message || !nickname) return false;

  const messageLower = message.toLowerCase();
  const nickLower = nickname.toLowerCase();

  // Check for exact word match (with word boundaries)
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(nickLower)}\\b`, "i");
  return wordBoundaryRegex.test(message);
}

/**
 * Checks if a message contains any of the specified keywords
 */
export function containsKeyword(
  message: string,
  keywords: string[],
): string | null {
  if (!message || !keywords || keywords.length === 0) return null;

  const messageLower = message.toLowerCase();

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, "i");
    if (regex.test(message)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Checks if a message should trigger a highlight (mention or keyword)
 */
export function checkHighlight(
  message: string,
  nickname: string,
  keywords: string[] = [],
): HighlightResult {
  const isMention = containsMention(message, nickname);
  const matchedKeyword = containsKeyword(message, keywords);

  return {
    isMention,
    isKeyword: matchedKeyword !== null,
    matchedKeyword: matchedKeyword || undefined,
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a message with mention highlighting
 * Returns parts with mentions marked separately from regular text
 */
export function parseMessageWithMentions(
  text: string,
  nickname: string,
  keywords: string[] = [],
  inlineImages = false,
): MessagePart[] {
  if (!text) return [];

  const parts: MessagePart[] = [];
  const allHighlights = [nickname, ...keywords];

  // First parse URLs (with inline image support)
  const urlParts = parseMessage(text, inlineImages);

  // Then check each text part for mentions
  for (const part of urlParts) {
    if (part.type === "link" || part.type === "image") {
      parts.push(part);
      continue;
    }

    // Check if this text part contains any highlights
    let remainingText = part.content;
    let lastIndex = 0;
    const matches: Array<{ start: number; end: number; word: string }> = [];

    // Find all highlight matches
    for (const highlight of allHighlights) {
      const regex = new RegExp(`\\b${escapeRegex(highlight)}\\b`, "gi");
      let match;
      while ((match = regex.exec(part.content)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          word: match[0],
        });
      }
    }

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build parts from matches
    for (const match of matches) {
      // Add text before match
      if (match.start > lastIndex) {
        parts.push({
          type: "text",
          content: part.content.substring(lastIndex, match.start),
        });
      }

      // Add mention
      parts.push({
        type: "mention",
        content: match.word,
      });

      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < part.content.length) {
      parts.push({
        type: "text",
        content: part.content.substring(lastIndex),
      });
    }

    // If no matches found, add the whole text
    if (matches.length === 0) {
      parts.push(part);
    }
  }

  return parts;
}
