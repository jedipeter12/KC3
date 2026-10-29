import type {
  ActivityType,
  DiscoverySource,
  DiscoveryVerificationState,
  PlaceType,
} from "../types/database";

export const activityTypes: readonly ActivityType[] = [
  "board_games",
  "community_gathering",
  "workshop",
  "hobby_meetup",
  "organized_social",
];
export const discoverySources: readonly DiscoverySource[] = [
  "google_places",
  "overture",
  "reddit",
  "community_suggestion",
  "manual_research",
];
export const verificationStates: readonly DiscoveryVerificationState[] = [
  "discovered",
  "in_review",
  "verified",
];

export type DiscoveryReview = {
  verificationState: DiscoveryVerificationState;
  businessExists: boolean | null;
  currentlyOperating: boolean | null;
  publiclyAccessible: boolean | null;
  hoursReviewed: boolean | null;
  amenitiesReviewed: boolean | null;
  suitabilityReviewed: boolean | null;
  isThirdSpace: boolean | null;
  mvpEligible: boolean | null;
  lastVerifiedAt: string | null;
  verificationNotes: string | null;
};
export type ThirdSpaceClassification = {
  casualHangoutSuitable: boolean | null;
  socialCommunitySuitable: boolean | null;
  quietIndependentActivity: boolean | null;
  casualConversation: boolean | null;
  groupGatherings: boolean | null;
  meetNewPeople: boolean | null;
  supportedActivities: ActivityType[] | null;
  organizedActivities: ActivityType[] | null;
  freePublicAccess: boolean | null;
  purchaseExpected: boolean | null;
  paidAdmission: boolean | null;
  activityFees: boolean | null;
};
export type ReviewPlace = {
  id: string;
  name: string;
  city: string;
  address: string;
  placeType: PlaceType;
  status: string;
  published: boolean;
  updatedAt: string;
};
export type ReviewHours = {
  day: number;
  open: string | null;
  close: string | null;
  closed: boolean;
  nextDay: boolean;
  source: string;
  observedAt: string | null;
};
export type UnreviewedPlace = ReviewPlace & {
  classification: ThirdSpaceClassification;
  hours: ReviewHours[];
  effectiveHours: ReviewHours[];
};
export type ThirdSpaceReviewRecord = {
  id: string;
  source: DiscoverySource;
  discoveredAt: string;
  leadName: string | null;
  leadCity: string | null;
  updatedAt: string;
  place: ReviewPlace | null;
  review: DiscoveryReview;
  detailUpdatedAt: string | null;
  classification: ThirdSpaceClassification | null;
  hoursRevision: number;
  effectiveOverrideId: string | null;
  hoursReviewPending: boolean;
  hours: ReviewHours[];
  effectiveHours: ReviewHours[];
};
export type ThirdSpaceReviewWrite = {
  expectedUpdatedAt: string;
  expectedPlaceUpdatedAt: string | null;
  expectedDetailUpdatedAt: string | null;
  expectedHoursRevision: number;
  expectedEffectiveOverrideId: string | null;
  review: DiscoveryReview;
  classification: ThirdSpaceClassification | null;
  published: boolean | null;
  reviewHours: boolean;
};

export const reviewBooleanFields: readonly (keyof DiscoveryReview)[] = [
  "businessExists",
  "currentlyOperating",
  "publiclyAccessible",
  "hoursReviewed",
  "amenitiesReviewed",
  "suitabilityReviewed",
  "isThirdSpace",
  "mvpEligible",
];
export const classificationBooleanFields: readonly (keyof ThirdSpaceClassification)[] =
  [
    "casualHangoutSuitable",
    "socialCommunitySuitable",
    "quietIndependentActivity",
    "casualConversation",
    "groupGatherings",
    "meetNewPeople",
    "freePublicAccess",
    "purchaseExpected",
    "paidAdmission",
    "activityFees",
  ];

export function isThirdSpaceReviewRecord(
  value: unknown,
): value is ThirdSpaceReviewRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ThirdSpaceReviewRecord>;
  return (
    typeof row.id === "string" &&
    discoverySources.includes(row.source!) &&
    typeof row.updatedAt === "string" &&
    !!row.review &&
    (row.place === null || typeof row.place?.id === "string") &&
    Array.isArray(row.hours) &&
    Array.isArray(row.effectiveHours) &&
    Number.isInteger(row.hoursRevision)
  );
}

export function displayValue(value: unknown): string {
  if (value === null) return "unknown";
  if (value === true) return "yes";
  if (value === false) return "no";
  if (Array.isArray(value))
    return value.length ? value.join(", ") : "confirmed none";
  return String(value);
}
