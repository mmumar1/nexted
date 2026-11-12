import { z } from "zod";
import { httpImageUrlSchema, youtubeVideoUrlSchema } from "./schema.js";

export const courseImportModuleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  order: z.number().int().min(1).max(1000),
  content: z.string().max(30_000),
  videoUrls: z.array(youtubeVideoUrlSchema).max(5),
  parentIndex: z.number().int().min(0).nullable(),
});

export const courseImportPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2_000),
  modules: z.array(courseImportModuleSchema).min(1).max(200),
}).superRefine(({ modules }, context) => {
  const contentLength = modules.reduce((total, module) => total + module.content.length, 0);
  if (contentLength > 300_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["modules"],
      message: "Course lesson content exceeds the 300,000-character limit.",
    });
  }

  const moduleOrders = new Map<number, Set<number>>();
  const lessonCounts = new Map<number, number>();
  modules.forEach((module, index) => {
    if (module.parentIndex === null) {
      if (module.content || module.videoUrls.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modules", index],
          message: "Course modules cannot contain lesson content or videos.",
        });
      }
      if (!moduleOrders.has(-1)) moduleOrders.set(-1, new Set());
      const orders = moduleOrders.get(-1)!;
      if (orders.has(module.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modules", index, "order"],
          message: "Module order values must be unique.",
        });
      }
      orders.add(module.order);
      return;
    }

    const parent = modules[module.parentIndex];
    if (!parent || module.parentIndex >= index || parent.parentIndex !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modules", index, "parentIndex"],
        message: "Each lesson must refer to a preceding course module.",
      });
      return;
    }

    const orders = moduleOrders.get(module.parentIndex) ?? new Set<number>();
    if (orders.has(module.order)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modules", index, "order"],
        message: "Lesson order values must be unique within its module.",
      });
    }
    orders.add(module.order);
    moduleOrders.set(module.parentIndex, orders);
    lessonCounts.set(module.parentIndex, (lessonCounts.get(module.parentIndex) ?? 0) + 1);
  });

  modules.forEach((module, index) => {
    if (module.parentIndex === null && !lessonCounts.has(index)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modules", index],
        message: "Every course module must contain at least one lesson.",
      });
    }
  });
});

export type CourseImportModule = z.infer<typeof courseImportModuleSchema>;
export type CourseImportPayload = z.infer<typeof courseImportPayloadSchema>;

const imageUrlPattern = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

export function getCourseImportImageUrls(content: string): string[] {
  return Array.from(content.matchAll(imageUrlPattern), ([, url]) => url)
    .filter((url): url is string => !!url)
    .filter((url) => httpImageUrlSchema.safeParse(url).success);
}
