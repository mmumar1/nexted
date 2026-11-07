import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { partnershipInterestTypes, type PartnershipInterestInput } from "@shared/partnership-interest";

type PartnershipInterestForm = Omit<PartnershipInterestInput, "partnershipArrangement" | "orientationInterest"> & {
  partnershipArrangement: PartnershipInterestInput["partnershipArrangement"] | "";
  orientationInterest: PartnershipInterestInput["orientationInterest"] | "";
};

const initialForm: PartnershipInterestForm = {
  schoolName: "",
  schoolAddress: "",
  cityOrLga: "",
  state: "",
  schoolType: "Private",
  websiteOrSocialPage: null,
  contactName: "",
  contactPosition: "Principal",
  phoneNumber: "",
  emailAddress: "",
  preferredCommunication: "Phone call",
  studentCount: "Below 100",
  classesAvailable: "Both",
  usesDigitalLearning: "No",
  digitalLearningDetails: null,
  areasOfInterest: [],
  otherInterest: null,
  challengesAndNeeds: "",
  partnershipArrangement: "",
  partnershipValue: "",
  orientationInterest: "",
  followUpPeriod: null,
  additionalComments: null,
  acknowledged: false,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t pt-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} <span aria-hidden="true">*</span></Label>
      <select
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

export default function PartnershipInterestPage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partnership-interests", form),
    onSuccess: () => setSubmitted(true),
    onError: (error: Error) => toast({
      title: "We could not submit your form",
      description: error.message,
      variant: "destructive",
    }),
  });

  const setField = <K extends keyof PartnershipInterestForm>(key: K, value: PartnershipInterestForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const toggleInterest = (interest: typeof partnershipInterestTypes[number], checked: boolean) => {
    setForm((current) => ({
      ...current,
      areasOfInterest: checked
        ? [...current.areasOfInterest, interest]
        : current.areasOfInterest.filter((item) => item !== interest),
    }));
  };

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Learnpedia home
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">Learnpedia — School Partnership Interest Form</CardTitle>
            <CardDescription className="text-sm leading-6">
              Thank you for your interest in Learnpedia. This form helps us understand your institution’s needs and identify suitable areas for collaboration. Completing it indicates interest in further discussion and does not constitute a binding partnership agreement or financial commitment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                <h1 className="mt-4 text-2xl font-bold">Thank you for your interest</h1>
                <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
                  Your school’s details have been sent to the Learnpedia team. A representative can follow up using your preferred contact method.
                </p>
                <Button asChild className="mt-6"><Link href="/">Return to Learnpedia</Link></Button>
              </div>
            ) : (
              <form className="space-y-8" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>
                <Section title="1. School Information">
                  <TextField id="schoolName" label="Official name of school" value={form.schoolName} onChange={(value) => setField("schoolName", value)} required autoComplete="organization" />
                  <div className="space-y-2">
                    <Label htmlFor="schoolAddress">School address <span aria-hidden="true">*</span></Label>
                    <Textarea id="schoolAddress" value={form.schoolAddress} onChange={(event) => setField("schoolAddress", event.target.value)} required rows={3} autoComplete="street-address" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField id="cityOrLga" label="City / Local Government Area" value={form.cityOrLga} onChange={(value) => setField("cityOrLga", value)} required />
                    <TextField id="state" label="State" value={form.state} onChange={(value) => setField("state", value)} required autoComplete="address-level1" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField id="schoolType" label="School type" value={form.schoolType} options={["Public", "Private", "Faith-based", "Other"]} onChange={(value) => setField("schoolType", value as PartnershipInterestInput["schoolType"])} />
                    <TextField id="websiteOrSocialPage" label="School website or social media page (optional)" value={form.websiteOrSocialPage || ""} onChange={(value) => setField("websiteOrSocialPage", value || null)} />
                  </div>
                </Section>

                <Section title="2. Administrative Contact">
                  <TextField id="contactName" label="Name of contact person" value={form.contactName} onChange={(value) => setField("contactName", value)} required autoComplete="name" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField id="contactPosition" label="Official position" value={form.contactPosition} options={["Proprietor / Proprietress", "Principal", "Vice-Principal", "Academic Coordinator", "ICT Coordinator", "Other"]} onChange={(value) => setField("contactPosition", value as PartnershipInterestInput["contactPosition"])} />
                    <TextField id="phoneNumber" label="Phone number" value={form.phoneNumber} onChange={(value) => setField("phoneNumber", value)} required type="tel" autoComplete="tel" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField id="emailAddress" label="Email address" value={form.emailAddress} onChange={(value) => setField("emailAddress", value)} required type="email" autoComplete="email" />
                    <SelectField id="preferredCommunication" label="Preferred method of communication" value={form.preferredCommunication} options={["Phone call", "WhatsApp", "Email"]} onChange={(value) => setField("preferredCommunication", value as PartnershipInterestInput["preferredCommunication"])} />
                  </div>
                </Section>

                <Section title="3. School Profile">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField id="studentCount" label="Approximate number of students" value={form.studentCount} options={["Below 100", "100–300", "301–500", "501–1,000", "Above 1,000"]} onChange={(value) => setField("studentCount", value as PartnershipInterestInput["studentCount"])} />
                    <SelectField id="classesAvailable" label="Classes / levels available" value={form.classesAvailable} options={["Junior Secondary School", "Senior Secondary School", "Both", "Other"]} onChange={(value) => setField("classesAvailable", value as PartnershipInterestInput["classesAvailable"])} />
                  </div>
                  <SelectField id="usesDigitalLearning" label="Does the school currently use digital learning platforms or resources?" value={form.usesDigitalLearning} options={["Yes", "No", "Exploring options"]} onChange={(value) => setField("usesDigitalLearning", value as PartnershipInterestInput["usesDigitalLearning"])} />
                  {form.usesDigitalLearning === "Yes" && (
                    <TextField id="digitalLearningDetails" label="If yes, please specify (optional)" value={form.digitalLearningDetails || ""} onChange={(value) => setField("digitalLearningDetails", value || null)} />
                  )}
                </Section>

                <Section title="4. Areas of Interest & Partnership Preference">
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">Which Learnpedia opportunities interest your school? <span aria-hidden="true">*</span></legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {partnershipInterestTypes.map((interest) => (
                        <label key={interest} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={form.areasOfInterest.includes(interest)}
                            onChange={(event) => toggleInterest(interest, event.target.checked)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          {interest}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {form.areasOfInterest.includes("Other") && (
                    <TextField id="otherInterest" label="Please specify other area (optional)" value={form.otherInterest || ""} onChange={(value) => setField("otherInterest", value || null)} />
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="challengesAndNeeds">What challenges or learning needs would you like Learnpedia to help address? <span aria-hidden="true">*</span></Label>
                    <Textarea id="challengesAndNeeds" value={form.challengesAndNeeds} onChange={(event) => setField("challengesAndNeeds", event.target.value)} required rows={4} />
                  </div>
                  <SelectField id="partnershipArrangement" label="Which partnership arrangement would your school like to explore?" value={form.partnershipArrangement} options={["Learning Access Partner", "Digital Learning Partner", "Strategic Education Partner", "Need further info"]} placeholder="Please select an arrangement" onChange={(value) => setField("partnershipArrangement", value as PartnershipInterestForm["partnershipArrangement"])} />
                  <div className="space-y-2">
                    <Label htmlFor="partnershipValue">What would make a Learnpedia partnership most valuable to your school? <span aria-hidden="true">*</span></Label>
                    <Textarea id="partnershipValue" value={form.partnershipValue} onChange={(event) => setField("partnershipValue", event.target.value)} required rows={4} />
                  </div>
                </Section>

                <Section title="5. Next Steps & Acknowledgement">
                  <SelectField id="orientationInterest" label="Would your school be interested in a student orientation or platform demonstration?" value={form.orientationInterest} options={["Yes", "No", "Discuss first"]} placeholder="Please select an option" onChange={(value) => setField("orientationInterest", value as PartnershipInterestForm["orientationInterest"])} />
                  <TextField id="followUpPeriod" label="Preferred date or period for a follow-up meeting (optional)" value={form.followUpPeriod || ""} onChange={(value) => setField("followUpPeriod", value || null)} />
                  <div className="space-y-2">
                    <Label htmlFor="additionalComments">Additional comments or recommendations (optional)</Label>
                    <Textarea id="additionalComments" value={form.additionalComments || ""} onChange={(event) => setField("additionalComments", event.target.value || null)} rows={3} />
                  </div>
                  <label className="flex items-start gap-3 rounded-md border p-4 text-sm leading-6">
                    <input
                      type="checkbox"
                      required
                      checked={form.acknowledged}
                      onChange={(event) => setField("acknowledged", event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-primary"
                    />
                    <span>I confirm that the information provided is accurate and understand this form records interest without creating a binding financial commitment.</span>
                  </label>
                </Section>

                <Button type="submit" className="w-full sm:w-auto" disabled={submit.isPending || !form.areasOfInterest.length}>
                  {submit.isPending ? "Submitting…" : "Submit partnership interest"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
