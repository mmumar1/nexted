import { useRef, useState, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { Bold, Eye, ImagePlus, Italic, List, ListOrdered, Pencil, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { normalizeMathDelimiters } from "@/lib/quiz-markdown";

function MarkdownImage({ src, alt = "", enableLightbox = false }: ComponentProps<"img"> & { enableLightbox?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;

  const image = (
    <img
      src={src}
      alt={alt}
      className="mx-auto block h-auto max-h-[min(75vh,48rem)] max-w-full rounded-md object-contain"
    />
  );

  return (
    <figure className="my-8 block w-full clear-both text-center">
      {enableLightbox ? (
        <>
          <button
            type="button"
            className="mx-auto block max-w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setOpen(true)}
            aria-label={alt ? `View larger image: ${alt}` : "View larger image"}
            title="Click to view larger"
          >
            {image}
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[95vh] max-w-[96vw] border-0 bg-transparent p-2 shadow-none sm:rounded-lg">
              <img
                src={src}
                alt={alt}
                className="mx-auto block max-h-[88vh] max-w-full rounded-md object-contain"
              />
            </DialogContent>
          </Dialog>
        </>
      ) : image}
    </figure>
  );
}

export function QuizMarkdownContent({
  source,
  className = "",
  enableImageLightbox = false,
}: {
  source: string;
  className?: string;
  enableImageLightbox?: boolean;
}) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
        components={{
          img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} enableLightbox={enableImageLightbox} />,
        }}
      >
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
  enableImageInsert?: boolean;
}

export function QuizMarkdownEditor({ value, onChange, placeholder, minHeight = "min-h-40", enableImageInsert = false }: QuizMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");

  const insertImage = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let imageUrlObject: URL;
    try {
      imageUrlObject = new URL(imageUrl.trim());
    } catch {
      return;
    }
    if (imageUrlObject.protocol !== "http:" && imageUrlObject.protocol !== "https:") return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const alt = imageAlt.trim() || "Image";
    const markdown = `![${alt.replace(/[\[\]\\]/g, "\\$&")}](${imageUrlObject.href})`;
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const suffix = end < value.length && value[end] !== "\n" ? "\n" : "";
    const inserted = `${prefix}${markdown}${suffix}`;
    const nextValue = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    onChange(nextValue);
    setImageUrl("");
    setImageAlt("");
    requestAnimationFrame(() => {
      const cursor = start + inserted.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

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
      {enableImageInsert && (
        <div className="grid gap-2 border-b p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium">
            Image URL
            <Input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/diagram.png"
              aria-label="Image URL to insert"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Image description
            <Input
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder="Describe the image"
              aria-label="Image description"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={insertImage}
            disabled={preview || !/^https?:\/\//i.test(imageUrl.trim())}
          >
            <ImagePlus className="h-4 w-4" />
            Insert image
          </Button>
        </div>
      )}
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