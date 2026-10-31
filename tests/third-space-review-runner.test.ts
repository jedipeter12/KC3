import {
  runThirdSpaceReview,
  startThirdSpaceReview,
  type ReviewIo,
} from "../src/operator/thirdSpaceReviewRunner";
import type {
  ThirdSpaceReviewRecord,
  ThirdSpaceReviewWrite,
} from "../src/operator/thirdSpaceReview";
import type { ThirdSpaceReviewRepository } from "../src/operator/thirdSpaceReviewRepository";

const record: ThirdSpaceReviewRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  source: "reddit",
  discoveredAt: "2026-10-20",
  leadName: null,
  leadCity: null,
  updatedAt: "2026-10-20 12:00:00+00",
  place: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Evening Games",
    city: "Lenexa",
    address: "1 Main St",
    placeType: "board_game_cafe",
    status: "active",
    published: false,
    updatedAt: "2026-10-20 12:00:00+00",
  },
  review: {
    verificationState: "in_review",
    businessExists: true,
    currentlyOperating: true,
    publiclyAccessible: true,
    hoursReviewed: true,
    amenitiesReviewed: true,
    suitabilityReviewed: true,
    isThirdSpace: true,
    mvpEligible: false,
    lastVerifiedAt: "2026-10-20",
    verificationNotes: "Site visit",
  },
  detailUpdatedAt: null,
  classification: {
    casualHangoutSuitable: null,
    socialCommunitySuitable: null,
    quietIndependentActivity: null,
    casualConversation: null,
    groupGatherings: null,
    meetNewPeople: null,
    supportedActivities: null,
    organizedActivities: null,
    freePublicAccess: null,
    purchaseExpected: null,
    paidAdmission: null,
    activityFees: null,
  },
  hoursRevision: 2,
  effectiveOverrideId: null,
  hoursReviewPending: true,
  effectiveHours: [
    {
      day: 5,
      open: "12:00:00",
      close: "21:00:00",
      closed: false,
      nextDay: false,
      source: "kc3",
      observedAt: "2026-10-20T12:00:00Z",
    },
  ],
  hours: [
    {
      day: 5,
      open: "12:00:00",
      close: "21:00:00",
      closed: false,
      nextDay: false,
      source: "kc3",
      observedAt: "2026-10-20T12:00:00Z",
    },
  ],
};

function harness(answers: Record<string, string>, current = record) {
  const output: string[] = [];
  const writes: ThirdSpaceReviewWrite[] = [];
  const io: ReviewIo = {
    async ask(prompt) {
      output.push(prompt);
      if (prompt.startsWith("Select")) return answers.select ?? "1";
      if (prompt.startsWith('Type "yes"')) return answers.confirm ?? "yes";
      for (const [prefix, answer] of Object.entries(answers))
        if (prompt.startsWith(prefix)) return answer;
      return "";
    },
    write(message) {
      output.push(message);
    },
  };
  const repository: ThirdSpaceReviewRepository = {
    async unreviewedPlace() {
      return null;
    },
    async start() {
      return current;
    },
    async search() {
      return [current];
    },
    async save(_id, write) {
      writes.push(write);
      return current;
    },
  };
  return { io, repository, output, writes };
}

test("reviews a Reddit discovery, distinguishes false from unknown and none, and shows provenance before confirmation", async () => {
  const h = harness({
    "Verification state": "verified",
    mvpEligible: "yes",
    casualHangoutSuitable: "no",
    "Supported activities": "none",
    "MVP published": "yes",
    "Complete eligibility review": "yes",
    "Did you actually verify": "yes",
  });
  await expect(
    runThirdSpaceReview(h.repository, h.io, {
      name: "Games",
      city: "Lenexa",
      source: "reddit",
    }),
  ).resolves.toBe("saved");
  expect(h.writes).toHaveLength(1);
  expect(h.writes[0].classification?.casualHangoutSuitable).toBe(false);
  expect(h.writes[0].classification?.socialCommunitySuitable).toBeNull();
  expect(h.writes[0].classification?.supportedActivities).toEqual([]);
  expect(h.writes[0].classification?.organizedActivities).toBeNull();
  expect(h.writes[0]).toMatchObject({
    expectedHoursRevision: 2,
    expectedEffectiveOverrideId: null,
    reviewHours: true,
    published: true,
  });
  const displayed = h.output.join("\n");
  expect(displayed).toContain("Provenance: reddit, discovered 2026-10-20");
  expect(displayed).toContain("Current hours (source and observation)");
  expect(displayed.indexOf("Current discovery review")).toBeLessThan(
    displayed.indexOf('Type "yes"'),
  );
  expect(displayed).toContain("unknown -> no");
  expect(displayed).toContain("unknown -> confirmed none");
});

test("does not allow a pending hours review to retain publication without evening hours", async () => {
  const h = harness(
    {
      "Verification state": "verified",
      mvpEligible: "yes",
      "MVP published": "yes",
      "Complete eligibility review": "yes",
    },
    {
      ...record,
      effectiveHours: [{ ...record.effectiveHours[0], close: "19:00:00" }],
    },
  );
  await expect(
    runThirdSpaceReview(h.repository, h.io, {
      name: "",
      city: "",
      source: "reddit",
    }),
  ).resolves.toBe("cancelled");
  expect(h.writes).toHaveLength(0);
});

test("cancellation and unchanged review never write", async () => {
  const cancelled = harness({ confirm: "no", isThirdSpace: "no" });
  await expect(
    runThirdSpaceReview(cancelled.repository, cancelled.io, {
      name: "",
      city: "",
      source: "reddit",
    }),
  ).resolves.toBe("cancelled");
  expect(cancelled.writes).toHaveLength(0);
  const same = harness({});
  await expect(
    runThirdSpaceReview(same.repository, same.io, {
      name: "",
      city: "",
      source: "reddit",
    }),
  ).resolves.toBe("no_changes");
  expect(same.writes).toHaveLength(0);
});

test("unlinked leads can be reviewed without writing canonical classifications", async () => {
  const h = harness(
    { isThirdSpace: "no" },
    {
      ...record,
      place: null,
      classification: null,
      hours: [],
      effectiveHours: [],
      hoursRevision: 0,
      hoursReviewPending: false,
    },
  );
  await expect(
    runThirdSpaceReview(h.repository, h.io, {
      name: "",
      city: "",
      source: "reddit",
    }),
  ).resolves.toBe("saved");
  expect(h.writes[0]).toMatchObject({
    classification: null,
    published: null,
    reviewHours: false,
  });
});

test("starting a review requires explicit provenance and shows canonical values first", async () => {
  const h = harness({
    "Discovery source": "overture",
    "Actual discovery date": "2026-10-19",
    confirm: "no",
  });
  let starts = 0;
  const repo: ThirdSpaceReviewRepository = {
    ...h.repository,
    async unreviewedPlace() {
      return {
        ...record.place!,
        classification: record.classification!,
        hours: record.hours,
        effectiveHours: record.effectiveHours,
      };
    },
    async start() {
      starts += 1;
      return record;
    },
  };
  await expect(
    startThirdSpaceReview(repo, h.io, record.place!.id),
  ).resolves.toBe("cancelled");
  expect(starts).toBe(0);
  expect(h.output.join("\n")).toContain("Current KC3 classification");
  expect(h.output.join("\n")).toContain(
    "Current hours (source and observation)",
  );
  expect(h.output.join("\n")).toContain(
    "provenance overture, discovered 2026-10-19",
  );
});
