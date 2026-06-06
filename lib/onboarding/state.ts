import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const TIP_GROUP_KEYS = ["workspace", "myNotes", "dashboard"] as const;
export type TipGroupKey = (typeof TIP_GROUP_KEYS)[number];

export type OnboardingState = {
  checklistDismissedAt?: string;
  /**
   * Per-step skip timestamps keyed by ChecklistStepKey. The user explicitly
   * waved off the step rather than completing it; treated as "done" for
   * progress + completion math but rendered with a distinct "Skipped" visual.
   * Stored as `Record<string, string>` here so this module doesn't depend on
   * derive-checklist's key enum — the UI validates against the typed list.
   */
  checklistStepsSkipped?: Record<string, string>;
  tipsDismissed?: Partial<Record<TipGroupKey, string>>;
};

function asStringRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickStringEntries<K extends string>(
  source: Record<string, unknown>,
  keys: ReadonlyArray<K>
): Partial<Record<K, string>> | undefined {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function pickAllStringEntries(
  source: Record<string, unknown>
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parse the raw `onboardingState` JSON value into a typed shape, defensively.
 * Returns an empty object when the field is null, malformed, or has unexpected
 * shape — every consumer can then read `state.checklistDismissedAt` / etc.
 * without null-checking the wrapper.
 */
export function parseOnboardingState(raw: unknown): OnboardingState {
  const r = asStringRecord(raw);
  if (!r) return {};

  const result: OnboardingState = {};

  if (typeof r.checklistDismissedAt === "string") {
    result.checklistDismissedAt = r.checklistDismissedAt;
  }

  const skippedSource = asStringRecord(r.checklistStepsSkipped);
  if (skippedSource) {
    const skipped = pickAllStringEntries(skippedSource);
    if (skipped) result.checklistStepsSkipped = skipped;
  }

  const tipsSource = asStringRecord(r.tipsDismissed);
  if (tipsSource) {
    const tips = pickStringEntries(tipsSource, TIP_GROUP_KEYS);
    if (tips) result.tipsDismissed = tips;
  }

  return result;
}

export function isChecklistDismissed(state: OnboardingState): boolean {
  return Boolean(state.checklistDismissedAt);
}

export function isTipGroupDismissed(
  state: OnboardingState,
  group: TipGroupKey
): boolean {
  return Boolean(state.tipsDismissed?.[group]);
}

export async function skipChecklistStep(
  userId: string,
  stepKey: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { onboardingState: true },
  });
  const current = parseOnboardingState(user?.onboardingState);
  const next: OnboardingState = {
    ...current,
    checklistStepsSkipped: {
      ...(current.checklistStepsSkipped ?? {}),
      [stepKey]: new Date().toISOString(),
    },
  };
  await db.user.update({
    where: { id: userId },
    data: { onboardingState: next },
  });
}

export async function dismissChecklist(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { onboardingState: true },
  });
  const current = parseOnboardingState(user?.onboardingState);
  const next: OnboardingState = {
    ...current,
    checklistDismissedAt: new Date().toISOString(),
  };
  await db.user.update({
    where: { id: userId },
    data: { onboardingState: next },
  });
}

export async function dismissTipGroup(
  userId: string,
  group: TipGroupKey
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { onboardingState: true },
  });
  const current = parseOnboardingState(user?.onboardingState);
  const next: OnboardingState = {
    ...current,
    tipsDismissed: {
      ...(current.tipsDismissed ?? {}),
      [group]: new Date().toISOString(),
    },
  };
  await db.user.update({
    where: { id: userId },
    data: { onboardingState: next },
  });
}

export async function resetOnboarding(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    // Prisma requires the explicit `DbNull` sentinel (not literal `null`) to
    // clear a nullable JSON column.
    data: { onboardingState: Prisma.DbNull },
  });
}
