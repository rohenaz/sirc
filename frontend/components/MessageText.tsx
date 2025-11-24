/**
 * MessageText component - Renders IRC messages with clickable links, mentions, and inline images
 */

import { useState } from "react";
import {
  type MessagePart,
  parseMessage,
  parseMessageWithMentions,
} from "@/lib/message-parser";

interface MessageTextProps {
  text: string;
  className?: string;
  currentNick?: string;
  keywords?: string[];
  inlineImages?: boolean;
}

/**
 * Renders a single part of a parsed message
 */
function MessagePartComponent({ part }: { part: MessagePart }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (part.type === "link") {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline decoration-primary/40 hover:decoration-primary/80 transition-colors cursor-pointer break-all"
        onClick={() => {
          // Optional: Add analytics or custom handling here
          console.log("[MessageText] Opening URL:", part.url);
        }}
      >
        {part.content}
      </a>
    );
  }

  if (part.type === "mention") {
    return (
      <span className="bg-primary/20 text-primary px-1 rounded font-medium">
        {part.content}
      </span>
    );
  }

  if (part.type === "image") {
    if (imageError) {
      // If image failed to load, show as a regular link
      return (
        <a
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline decoration-primary/40 hover:decoration-primary/80 transition-colors cursor-pointer break-all"
        >
          {part.content}
        </a>
      );
    }

    return (
      <span className="block my-2">
        <a
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline decoration-primary/40 hover:decoration-primary/80 transition-colors cursor-pointer break-all block mb-1"
        >
          {part.content}
        </a>
        <div className="relative inline-block max-w-md rounded-lg overflow-hidden border border-border bg-card">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-muted-foreground text-sm">Loading...</div>
            </div>
          )}
          <img
            src={part.url}
            alt={part.content}
            className="max-w-full h-auto max-h-96 object-contain"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            loading="lazy"
          />
        </div>
      </span>
    );
  }

  return <span>{part.content}</span>;
}

/**
 * Renders IRC message text with clickable URLs, mention highlights, and inline images
 */
export function MessageText({
  text,
  className = "",
  currentNick,
  keywords = [],
  inlineImages = false,
}: MessageTextProps) {
  // Use mention parser if nickname is provided, otherwise basic parser
  const parts =
    currentNick && currentNick.trim()
      ? parseMessageWithMentions(text, currentNick, keywords, inlineImages)
      : parseMessage(text, inlineImages);

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <MessagePartComponent
          key={`${index}-${part.content.slice(0, 20)}`}
          part={part}
        />
      ))}
    </span>
  );
}
