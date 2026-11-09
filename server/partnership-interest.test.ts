import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { partnershipInterestInputSchema } from "../shared/partnership-interest.js";
import { organizationPartnershipInterestInputSchema } from "../shared/organization-partnership-interest.js";
import { MemStorage } from "./storage.js";

const validSubmission = {
  schoolName: "  Bright Future School ",
  schoolAddress: "12 Learning Road, Ikeja",
  cityOrLga: "Ikeja",
  state: "Lagos",
  schoolType: "Private",
  websiteOrSocialPage: null,
  contactName: "Amina Bello",
  contactPosition: "Principal",
  phoneNumber: "+2348012345678",
  emailAddress: "amina@example.edu",
  preferredCommunication: "WhatsApp",
  studentCount: "301–500",
  classesAvailable: "Both",
  usesDigitalLearning: "Exploring options",
  digitalLearningDetails: null,
  areasOfInterest: ["WAEC preparation", "Teacher development"],
  otherInterest: null,
  challengesAndNeeds: "We would like to improve access to exam preparation resources.",
  partnershipArrangement: "Digital Learning Partner",
  partnershipValue: "Reliable learning resources for our students and teachers.",
  orientationInterest: "Yes",
  followUpPeriod: "Next school term",
  additionalComments: null,
  acknowledged: true,
} as const;

describe("school partnership interest", () => {
  it("validates and normalizes a complete submission", () => {
    const result = partnershipInterestInputSchema.parse(validSubmission);

    assert.equal(result.schoolName, "Bright Future School");
    assert.deepEqual(result.areasOfInterest, ["WAEC preparation", "Teacher development"]);
  });

  describe("organization partnership interest", () => {
    const validOrganizationSubmission = {
      organizationName: "Community Learning Initiative",
      organizationType: "NGO / Nonprofit",
      contactName: "Amina Bello",
      contactRole: "Programme Director",
      emailAddress: "amina@example.org",
      phoneNumber: "+2348012345678",
      websiteOrSocialPage: null,
      location: "Ikeja, Lagos, Nigeria",
      areasOfInterest: ["Digital literacy", "Teacher development"],
      otherInterest: null,
      partnershipProposal: "We would like to explore digital learning programmes for local communities.",
      partnershipArrangement: "Digital Learning Partner",
      additionalComments: null,
      acknowledged: true,
    } as const;

    it("validates and normalizes a complete organization submission", () => {
      const result = organizationPartnershipInterestInputSchema.parse({
        ...validOrganizationSubmission,
        organizationName: "  Community Learning Initiative  ",
      });

      assert.equal(result.organizationName, "Community Learning Initiative");
      assert.deepEqual(result.areasOfInterest, ["Digital literacy", "Teacher development"]);
    });

    it("requires contact details, areas of interest, a proposal, and acknowledgement", () => {
      assert.equal(organizationPartnershipInterestInputSchema.safeParse({
        ...validOrganizationSubmission,
        acknowledged: false,
      }).success, false);
      assert.equal(organizationPartnershipInterestInputSchema.safeParse({
        ...validOrganizationSubmission,
        areasOfInterest: [],
      }).success, false);
      assert.equal(organizationPartnershipInterestInputSchema.safeParse({
        ...validOrganizationSubmission,
        emailAddress: "invalid",
      }).success, false);
    });

    it("stores organization applications for administrator review", async () => {
      const storage = new MemStorage();
      const submission = organizationPartnershipInterestInputSchema.parse(validOrganizationSubmission);

      await storage.createOrganizationPartnershipInterest(submission);
      const saved = await storage.getOrganizationPartnershipInterests();

      assert.equal(saved.length, 1);
      assert.equal(saved[0].organizationName, "Community Learning Initiative");
      assert.equal(saved[0].contactRole, "Programme Director");
    });
  });

  it("requires the acknowledgement and at least one area of interest", () => {
    assert.equal(partnershipInterestInputSchema.safeParse({
      ...validSubmission,
      acknowledged: false,
    }).success, false);
    assert.equal(partnershipInterestInputSchema.safeParse({
      ...validSubmission,
      areasOfInterest: [],
    }).success, false);
  });

  it("requires explicit choices instead of accepting empty preference fields", () => {
    assert.equal(partnershipInterestInputSchema.safeParse({
      ...validSubmission,
      partnershipArrangement: "",
      orientationInterest: "",
    }).success, false);
  });

  it("stores submissions for administrator review in newest-first order", async () => {
    const storage = new MemStorage();
    const submission = partnershipInterestInputSchema.parse(validSubmission);

    await storage.createPartnershipInterest(submission);
    const saved = await storage.getPartnershipInterests();

    assert.equal(saved.length, 1);
    assert.equal(saved[0].schoolName, "Bright Future School");
    assert.equal(saved[0].contactName, "Amina Bello");
  });
});
