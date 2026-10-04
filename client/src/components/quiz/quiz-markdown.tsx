import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { Bold, Eye, Italic, List, ListOrdered, Pencil, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { normalizeMathDelimiters } from "@/lib/quiz-markdown";

export function QuizMarkdownContent({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none break-words text-foreground ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]} rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}>
        {normalizeMathDelimiters(source)}
      </ReactMarkdown>
    </div>
  );
}

interface QuizMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function QuizMarkdownEditor({ value, onChange, placeholder, minHeight = "min-h-40" }: QuizMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const insertFormatting = (kind: "bold" | "italic" | "bullet" | "numbered" | "inlineMath" | "displayMath") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    let inserted: string;
    if (kind === "bold") inserted = `**${selected || "bold text"}**`;
    else if (kind === "italic") inserted = `_${selected || "italic text"}_`;
    else if (kind === "inlineMath") inserted = `$${selected || "x = 1"}$`;
    else if (kind === "displayMath") inserted = `$$\n${selected || "x = 1"}\n$$`;
    else {
      const prefix = kind === "bullet" ? "- " : "1. ";
      inserted = selected
        ? selected.split("\n").map((line, index) => `${kind === "numbered" ? `${index + 1}. ` : prefix}${line.replace(/^(?:- |\d+\. )/, "")}`).join("\n")
        : prefix;
    }

    const nextValue = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  };

  const toolbar = [
    { label: "Bold", icon: Bold, action: "bold" as const },
    { label: "Italic", icon: Italic, action: "italic" as const },
    { label: "Bulleted list", icon: List, action: "bullet" as const },
    { label: "Numbered list", icon: ListOrdered, action: "numbered" as const },
    { label: "Inline equation", icon: Sigma, action: "inlineMath" as const },
    { label: "Display equation", icon: Sigma, action: "displayMath" as const },
  ];

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b p-1">
        {toolbar.map(({ label, icon: Icon, action }) => (
          <Button key={label} type="button" variant="ghost" size="icon" className="h-8 w-8" title={label} aria-label={label} onClick={() => insertFormatting(action)}>
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 gap-2" aria-pressed={preview} onClick={() => setPreview((current) => !current)}>
          {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      {preview ? (
        <div className={`${minHeight} p-3`}>
          {value.trim() ? <QuizMarkdownContent source={value} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${minHeight} resize-y rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0`}
        />
      )}
    </div>
  );
}