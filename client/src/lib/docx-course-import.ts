import mammoth from "mammoth";
import { getCourseImportImageUrls, type CourseImportPayload } from "@shared/course-import";
import { courseImportPayloadSchema } from "@shared/course-import";
import { youtubeVideoUrlSchema } from "@shared/schema";

export interface CourseImportParseResult {
  course: CourseImportPayload | null;
  errors: string[];
  warnings: string[];
}

const IMAGE_FILE_URL = /^https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]\S*)?$/i;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]<>])/g, "\\$1");
}

function markdownInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(
      /https?:\/\/[^\s<>]+/g,
      (url) => {
        const trailing = url.match(/[.,!?;:]+$/)?.[0] ?? "";
        const target = trailing ? url.slice(0, -trailing.length) : url;
        return IMAGE_FILE_URL.test(target) ? `![Image](${target})${trailing}` : escapeMarkdown(url);
      },
    );
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const content = Array.from(element.childNodes, markdownInline).join("");
  switch (element.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return `**${content}**`;
    case "em":
    case "i":
      return `*${content}*`;
    case "code":
      return `\`${content}\``;
    case "a": {
      const href = element.getAttribute("href")?.trim() ?? "";
      if (isHttpUrl(href) && IMAGE_FILE_URL.test(href)) return `![Image](${href})`;
      return isHttpUrl(href) ? `[${content}](${href})` : content;
    }
    case "br":
      return "  \n";
    default:
      return content;
  }
}

function markdownBlock(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const prefix = tag === "ol" ? `${index + 1}. ` : "- ";
        return `${prefix}${markdownInline(child)}`;
      });
    return items.join("\n");
  }
  if (/^h[4-6]$/.test(tag)) return `### ${markdownInline(element)}`;
  if (tag === "blockquote") return markdownInline(element).split("\n").map((line) => `> ${line}`).join("\n");
  return markdownInline(element).trim();
}

function elementText(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parseLabeledUrl(text: string, label: string) {
  const match = text.match(new RegExp(`^${label}\\s*:\\s*(https?:\\/\\/\\S+)\\s*$`, "i"));
  if (!match) return null;
  return match[1].replace(/[.,!?;:]+$/, "");
}

function validationMessages(error: ReturnType<typeof courseImportPayloadSchema.safeParse>) {
  if (error.success) return [];
  return error.error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

export async function parseCourseDocx(file: File): Promise<CourseImportParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { course: null, errors: ["Upload a Microsoft Word .docx file."], warnings };
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    return { course: null, errors: ["The Word file must be smaller than 5 MB and cannot be empty."], warnings };
  }

  let html: string;
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    html = result.value;
    warnings.push(...result.messages.map((message) => message.message));
  } catch {
    return { course: null, errors: ["The file could not be read as a valid .docx document."], warnings };
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;
  if (body.querySelector("img")) {
    errors.push("Embedded Word images are not supported yet. Add an Image: https://... URL at the required position instead.");
  }

  const titleHeading = body.querySelector("h1");
  const title = titleHeading ? elementText(titleHeading) : "";
  if (!title) errors.push("Add the course title as a Heading 1.");
  if (body.querySelectorAll("h1").length > 1) errors.push("Use only one Heading 1 for the course title.");

  const descriptionParagraph = Array.from(body.children).find((element) =>
    element.tagName.toLowerCase() === "p" && /^description\s*:/i.test(elementText(element)),
  );
  const description = descriptionParagraph
    ? elementText(descriptionParagraph).replace(/^description\s*:\s*/i, "").trim()
    : "";
  if (!description) errors.push("Add a paragraph directly under the course title: Description: Your course description.");

  const modules: CourseImportPayload["modules"] = [];
  let currentModuleIndex: number | null = null;
  let currentLessonIndex: number | null = null;
  const lessonOrders = new Map<number, number>();
  let moduleOrder = 0;
  let descriptionFound = false;

  for (const element of Array.from(body.children)) {
    if (element === titleHeading) continue;
    if (element === descriptionParagraph && !descriptionFound) {
      descriptionFound = true;
      continue;
    }

    const tag = element.tagName.toLowerCase();
    const text = elementText(element);
    if (/^h[1-3]$/.test(tag)) {
      if (tag === "h1") continue;
      if (tag === "h2") {
        const match = text.match(/^module\s+(\d+)\s*:\s*(.+)$/i);
        if (!match) {
          errors.push(`Invalid module heading "${text}". Use "Module 1: Module title" as a Heading 2.`);
          currentModuleIndex = null;
          currentLessonIndex = null;
          continue;
        }
        moduleOrder += 1;
        if (Number(match[1]) !== moduleOrder) {
          errors.push(`Expected "Module ${moduleOrder}" but found "Module ${match[1]}". Keep module numbering in sequence.`);
        }
        modules.push({
          title: match[2].trim(),
          order: moduleOrder,
          content: "",
          videoUrls: [],
          parentIndex: null,
        });
        currentModuleIndex = modules.length - 1;
        currentLessonIndex = null;
        lessonOrders.set(currentModuleIndex, 0);
        continue;
      }

      const match = text.match(/^lesson\s+(\d+)\s*:\s*(.+)$/i);
      if (!match) {
        errors.push(`Invalid lesson heading "${text}". Use "Lesson 1: Lesson title" as a Heading 3.`);
        currentLessonIndex = null;
        continue;
      }
      if (currentModuleIndex === null) {
        errors.push(`Lesson "${match[2].trim()}" must appear under a Module heading.`);
        currentLessonIndex = null;
        continue;
      }
      const order = (lessonOrders.get(currentModuleIndex) ?? 0) + 1;
      if (Number(match[1]) !== order) {
        errors.push(`Expected "Lesson ${order}" under "${modules[currentModuleIndex].title}" but found "Lesson ${match[1]}". Keep lesson numbering in sequence.`);
      }
      lessonOrders.set(currentModuleIndex, order);
      modules.push({
        title: match[2].trim(),
        order,
        content: "",
        videoUrls: [],
        parentIndex: currentModuleIndex,
      });
      currentLessonIndex = modules.length - 1;
      continue;
    }

    if (/^h[4-6]$/.test(tag) && /^quiz\b/i.test(text)) {
      errors.push("Quizzes are not part of this Word template. Add quizzes separately using the existing quiz importer.");
      continue;
    }

    if (!text && tag !== "ul" && tag !== "ol") continue;
    if (currentLessonIndex === null) {
      if (currentModuleIndex !== null) {
        errors.push(`Content "${text.slice(0, 60)}" is outside a lesson. Add it beneath a Lesson heading.`);
      }
      continue;
    }

    const imageUrl = parseLabeledUrl(text, "Image");
    if (imageUrl) {
      if (!isHttpUrl(imageUrl)) {
        errors.push(`Invalid image URL: ${imageUrl}`);
        continue;
      }
      modules[currentLessonIndex].content += `\n\n![Image](${imageUrl})`;
      continue;
    }

    if (/^image\s*:/i.test(text)) {
      errors.push(`Invalid image URL in "${text}". Use Image: https://...`);
      continue;
    }

    const videoUrl = parseLabeledUrl(text, "Video");
    if (videoUrl) {
      if (!youtubeVideoUrlSchema.safeParse(videoUrl).success) {
        errors.push(`Unsupported video URL: ${videoUrl}. Use a YouTube video link.`);
        continue;
      }
      modules[currentLessonIndex].videoUrls.push(videoUrl);
      continue;
    }

    if (/^audio\s*:/i.test(text)) {
      errors.push("Audio links are not supported in this importer because lessons do not currently have an audio player.");
      continue;
    }
    if (/^video\s*:/i.test(text)) {
      errors.push(`Invalid video URL in "${text}". Use Video: https://...`);
      continue;
    }

    const block = markdownBlock(element);
    if (block) modules[currentLessonIndex].content += `${modules[currentLessonIndex].content ? "\n\n" : ""}${block}`;
  }

  modules.forEach((module, index) => {
    if (module.parentIndex !== null && !module.content.trim()) {
      errors.push(`Lesson "${module.title}" is missing explanation content.`);
    }
    if (module.videoUrls.length > 5) errors.push(`Lesson "${module.title}" has more than five Video: links.`);
  });

  const candidate = { title, description, modules };
  const validation = courseImportPayloadSchema.safeParse(candidate);
  errors.push(...validationMessages(validation));
  if (errors.length || !validation.success) return { course: null, errors, warnings };

  const invalidImageUrls = getCourseImportImageUrls(
    validation.data.modules.map((module) => module.content).join("\n"),
  );
  if (invalidImageUrls.length) {
    errors.push("One or more image links are not valid HTTP or HTTPS URLs.");
    return { course: null, errors, warnings };
  }

  return { course: validation.data, errors, warnings };
}
