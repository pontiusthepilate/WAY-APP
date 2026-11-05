import { api } from "./client";

export const COMPANY_TYPES = [
  "BUSINESS_NAME",
  "COMPANY",
  "INCORPORATED_TRUSTEES",
  "LIMITED_PARTNERSHIP",
  "LIMITED_LIABILITY_PARTNERSHIP",
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export type VerificationStatus = "pending" | "verified" | "rejected";

export interface BusinessVerificationRequest {
  id: string;
  profileId: string;
  rcNumber: string;
  companyType: CompanyType;
  documentUrls: string[];
  status: VerificationStatus;
  isResubmission: boolean;
  lookupSource: "dojah" | "apify" | null;
  lookupResult: Record<string, unknown> | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  escalatedAt: string | null;
  daysElapsed: number;
  daysRemaining: number;
  slaDays: number;
  isOverdue: boolean;
}

export function submitBusinessVerification(input: {
  profileId: string;
  rcNumber: string;
  companyType: CompanyType;
  documentUrls: string[];
}) {
  return api.post<BusinessVerificationRequest>("/business-verification", input);
}

export function getMyBusinessVerification(profileId: string) {
  return api.get<BusinessVerificationRequest>(`/business-verification/mine?profileId=${encodeURIComponent(profileId)}`);
}
