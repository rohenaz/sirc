/**
 * MessageText component - Renders IRC messages with clickable links and mentions
 */

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

  if (part.type === "mention") {
    return (
      <span className="bg-primary/20 text-primary px-1 rounded font-medium">
        {part.content}
      </span>
    );
  }

  return <span>{part.content}</span>;
}

/**
 * Renders IRC message text with clickable URLs and mention highlights
 */
export function MessageText({
  text,
  className = "",
  currentNick,
  keywords = [],
}: MessageTextProps) {
  // Use mention parser if nickname is provided, otherwise basic parser
  const parts =
    currentNick && currentNick.trim()
      ? parseMessageWithMentions(text, currentNick, keywords)
      : parseMessage(text);

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
