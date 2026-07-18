import { describe, it, expect } from "vitest";
import { computeAssociationStats } from "./association-stats";
import { makeResolver } from "./identity";
import type { ProviderData } from "@/lib/integrations/types";

const resolve = makeResolver({ identities: [], aliases: [] });

function wi(partial: Partial<ProviderData["workItems"] extends (infer T)[] ? T : never>) {
  return {
    source: "jira",
    externalId: "1",
    title: "t",
    status: "s",
    bucket: "DONE",
    assignee: null,
    priority: null,
    isCritical: false,
    isStale: false,
    storyPoints: null,
    labels: [],
    type: null,
    project: null,
    sprint: null,
    url: "u",
    createdAt: null,
    updatedAt: null,
    resolvedAt: null,
    ...partial,
  } as NonNullable<ProviderData["workItems"]>[number];
}

describe("computeAssociationStats", () => {
  it("cuenta actividad SIN persona asociada", () => {
    const data: ProviderData = {
      workItems: [wi({ assignee: null }), wi({ assignee: "ana" })],
    };
    const s = computeAssociationStats(data, resolve);
    expect(s.unassociatedRecords).toBe(1);
    expect(s.participantsLinked).toBe(1);
  });

  it("cuenta participantes distintos (mismo handle no duplica)", () => {
    const data: ProviderData = {
      workItems: [wi({ assignee: "ana" }), wi({ assignee: "@Ana" })],
    };
    const s = computeAssociationStats(data, resolve);
    expect(s.participantsLinked).toBe(1);
    expect(s.unassociatedRecords).toBe(0);
  });

  it("usa assignees múltiples cuando están presentes", () => {
    const data: ProviderData = {
      workItems: [wi({ assignee: null, assignees: ["ana", "bruno"] })],
    };
    const s = computeAssociationStats(data, resolve);
    expect(s.participantsLinked).toBe(2);
    expect(s.unassociatedRecords).toBe(0);
  });

  it("code changes y activity sin autor cuentan como sin persona", () => {
    const data: ProviderData = {
      codeChanges: [
        {
          source: "github",
          externalId: "1",
          title: "t",
          author: null,
          state: "MERGED",
          reviewerCount: 0,
          hasReviewer: false,
          checksState: "success",
          draft: false,
          ageHours: 1,
          isOld: false,
          isRisk: false,
          url: "u",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          mergedAt: null,
          closedAt: null,
        },
      ],
      activity: [
        {
          source: "slack",
          externalId: "1",
          author: null,
          channel: "c",
          text: "x",
          isBlocker: false,
          url: null,
          createdAt: null,
        },
      ],
    };
    const s = computeAssociationStats(data, resolve);
    expect(s.unassociatedRecords).toBe(2);
    expect(s.participantsLinked).toBe(0);
  });
});
