import { z } from "zod";

export const organizationPartnershipTypes = [
  "NGO / Nonprofit",
  "Education provider",
  "Company / Business",
  "Government agency",
  "Community organization",
  "Other",
] as const;

export const organizationPartnershipInterestTypes = [
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

export const organizationPartnershipInterestInputSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  organizationType: z.enum(organizationPartnershipTypes),
  contactName: z.string().trim().min(2).max(160),
  contactRole: z.string().trim().min(2).max(160),
  emailAddress: z.string().trim().email().max(254),
  phoneNumber: z.string().trim().min(7).max(40),
  websiteOrSocialPage: z.string().trim().max(500).nullable(),
  location: z.string().trim().min(2).max(500),
  areasOfInterest: z.array(z.enum(organizationPartnershipInterestTypes)).min(1).max(organizationPartnershipInterestTypes.length),
  otherInterest: z.string().trim().max(500).nullable(),
  partnershipProposal: z.string().trim().min(5).max(5000),
  partnershipArrangement: z.enum(["Learning Access Partner", "Digital Learning Partner", "Strategic Education Partner", "Need further info"]),
  additionalComments: z.string().trim().max(5000).nullable(),
  acknowledged: z.boolean().refine((value) => value, "Please confirm the acknowledgement"),
});

export type OrganizationPartnershipInterestInput = z.infer<typeof organizationPartnershipInterestInputSchema>;
