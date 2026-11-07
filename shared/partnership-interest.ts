import { z } from "zod";

export const partnershipInterestTypes = [
  "Structured digital courses",
  "WAEC preparation",
  "JAMB preparation",
  "Quizzes & assessments",
  "Digital literacy",
  "Teacher development",
  "Student orientation",
  "Joint educational programmes",
  "Other",
] as const;

export const partnershipInterestInputSchema = z.object({
  schoolName: z.string().trim().min(2).max(200),
  schoolAddress: z.string().trim().min(5).max(2000),
  cityOrLga: z.string().trim().min(2).max(160),
  state: z.string().trim().min(2).max(100),
  schoolType: z.enum(["Public", "Private", "Faith-based", "Other"]),
  websiteOrSocialPage: z.string().trim().max(500).nullable(),
  contactName: z.string().trim().min(2).max(160),
  contactPosition: z.enum(["Proprietor / Proprietress", "Principal", "Vice-Principal", "Academic Coordinator", "ICT Coordinator", "Other"]),
  phoneNumber: z.string().trim().min(7).max(40),
  emailAddress: z.string().trim().email().max(254),
  preferredCommunication: z.enum(["Phone call", "WhatsApp", "Email"]),
  studentCount: z.enum(["Below 100", "100–300", "301–500", "501–1,000", "Above 1,000"]),
  classesAvailable: z.enum(["Junior Secondary School", "Senior Secondary School", "Both", "Other"]),
  usesDigitalLearning: z.enum(["Yes", "No", "Exploring options"]),
  digitalLearningDetails: z.string().trim().max(1000).nullable(),
  areasOfInterest: z.array(z.enum(partnershipInterestTypes)).min(1).max(partnershipInterestTypes.length),
  otherInterest: z.string().trim().max(500).nullable(),
  challengesAndNeeds: z.string().trim().min(5).max(5000),
  partnershipArrangement: z.enum(["Learning Access Partner", "Digital Learning Partner", "Strategic Education Partner", "Need further info"]),
  partnershipValue: z.string().trim().min(5).max(5000),
  orientationInterest: z.enum(["Yes", "No", "Discuss first"]),
  followUpPeriod: z.string().trim().max(200).nullable(),
  additionalComments: z.string().trim().max(5000).nullable(),
  acknowledged: z.boolean().refine((value) => value, "Please confirm the acknowledgement"),
});

export type PartnershipInterestInput = z.infer<typeof partnershipInterestInputSchema>;
