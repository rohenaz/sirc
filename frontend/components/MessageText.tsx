/**
 * MessageText component - Renders IRC messages with clickable links
 */

import { type MessagePart, parseMessage } from "@/lib/message-parser";

interface MessageTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a single part of a parsed message
 */
function MessagePartComponent({ part }: { part: MessagePart }) {
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

  return <span>{part.content}</span>;
}

/**
 * Renders IRC message text with clickable URLs
 */
export function MessageText({ text, className = "" }: MessageTextProps) {
  const parts = parseMessage(text);

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
