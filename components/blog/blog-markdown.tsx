import { Fragment } from "react";

type BlogMarkdownProps = {
  content: string;
  className?: string;
};

function renderInlineContent(text: string) {
  const segments = text.split(/(\*\*.*?\*\*)/g);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={`${segment}-${index}`} className="font-semibold text-foreground">{segment.slice(2, -2)}</strong>;
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

export function BlogMarkdown({ content, className }: BlogMarkdownProps) {
  const blocks = content
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="mt-10 font-display text-2xl font-semibold tracking-tight first:mt-0 md:text-[2rem]">
              {block.replace(/^##\s+/, "")}
            </h2>
          );
        }

        if (block.startsWith("### ")) {
          return (
            <h3 key={index} className="mt-8 font-display text-xl font-semibold tracking-tight md:text-2xl">
              {block.replace(/^###\s+/, "")}
            </h3>
          );
        }

        const listItems = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        if (listItems.every((line) => line.startsWith("- "))) {
          return (
            <ul key={index} className="mt-6 space-y-3 pl-6 text-base leading-8 text-muted-foreground marker:text-primary">
              {listItems.map((item) => (
                <li key={item}>{renderInlineContent(item.replace(/^- /, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="mt-6 text-base leading-8 text-muted-foreground first:mt-0 md:text-[1.06rem]">
            {renderInlineContent(block.replace(/\n/g, " "))}
          </p>
        );
      })}
    </div>
  );
}
