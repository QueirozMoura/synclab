import React from "react";

type NodeType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "codeBlock"
  | "strong"
  | "emphasis"
  | "code"
  | "link"
  | "text";

interface ASTNode {
  type: NodeType;
  content?: string;
  children?: ASTNode[];
  url?: string;
  language?: string;
}

function parseMarkdown(markdown: string): ASTNode[] {
  const lines = markdown.split("\n");
  const blocks: ASTNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: "codeBlock",
        content: codeLines.join("\n"),
        language,
      });
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading3",
        content: line.slice(4),
      });
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading2",
        content: line.slice(3),
      });
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({
        type: "heading1",
        content: line.slice(2),
      });
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !lines[i].startsWith("#")) {
      paragraphLines.push(lines[i]);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paragraphLines.join(" "),
      });
    }
  }

  return blocks;
}

function parseInline(text: string): ASTNode[] {
  const nodes: ASTNode[] = [];
  let lastIndex = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, type: "strong" as const },
    { regex: /\*(.+?)\*/g, type: "emphasis" as const },
    { regex: /`(.+?)`/g, type: "code" as const },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: "link" as const },
  ];

  const matches: Array<{ index: number; length: number; type: NodeType; content: string; url?: string }> = [];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        type,
        content: match[1],
        url: type === "link" ? match[2] : undefined,
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  const nonOverlapping: typeof matches = [];
  for (const match of matches) {
    const overlaps = nonOverlapping.some(
      (m) => match.index < m.index + m.length && match.index + match.length > m.index
    );
    if (!overlaps) {
      nonOverlapping.push(match);
    }
  }

  for (const match of nonOverlapping) {
    if (match.index > lastIndex) {
      nodes.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    nodes.push({
      type: match.type,
      content: match.content,
      url: match.url,
    });
    lastIndex = match.index + match.length;
  }

  if (lastIndex < text.length) {
    nodes.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  if (nodes.length === 0) {
    nodes.push({ type: "text", content: text });
  }

  return nodes;
}

function renderInline(nodes: ASTNode[]): React.ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "strong":
        return <strong key={index}>{node.content}</strong>;
      case "emphasis":
        return <em key={index}>{node.content}</em>;
      case "code":
        return (
          <code
            key={index}
            className="bg-[#1f1f27] px-1.5 py-0.5 rounded text-[#c0c1ff] text-sm font-mono"
          >
            {node.content}
          </code>
        );
      case "link":
        return (
          <a
            key={index}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#c0c1ff] underline hover:opacity-80 transition-opacity"
          >
            {node.content}
          </a>
        );
      case "text":
      default:
        return <span key={index}>{node.content}</span>;
    }
  });
}

interface MarkdownPreviewProps {
  content: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const blocks = parseMarkdown(content);

  return (
    <div className="w-full min-h-[500px] editor-preview max-w-none">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading1":
            return (
              <h1 key={index} className="text-4xl font-bold text-[#e4e1ed] mb-4 mt-8 first:mt-0">
                {block.content}
              </h1>
            );
          case "heading2":
            return (
              <h2 key={index} className="text-2xl font-semibold text-[#e4e1ed] mb-3 mt-6 first:mt-0">
                {block.content}
              </h2>
            );
          case "heading3":
            return (
              <h3 key={index} className="text-xl font-semibold text-[#e4e1ed] mb-2 mt-4 first:mt-0">
                {block.content}
              </h3>
            );
          case "paragraph":
            return (
              <p key={index} className="text-[#c7c4d7] leading-relaxed mb-4">
                {renderInline(parseInline(block.content || ""))}
              </p>
            );
          case "codeBlock":
            return (
              <div
                key={index}
                className="bg-[#1f1f27] border border-[#464554] rounded-lg overflow-x-auto my-4"
              >
                <pre className="overflow-x-auto p-4 text-sm font-mono leading-relaxed text-[#c7c4d7]">
                  <code>{block.content}</code>
                </pre>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
};