/**
 * Message parsing utilities for IRC chat messages
 * Handles URL detection, link formatting, and text processing
 */

export interface MessagePart {
  type: "text" | "link";
  content: string;
  url?: string;
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
export function parseMessage(text: string): MessagePart[] {
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

    // Add the URL as a link
    parts.push({
      type: "link",
      content: urlText,
      url: normalizeUrl(urlText),
    });

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
