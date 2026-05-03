"use server";

import { revalidatePath } from "next/cache";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import {
  isChecklistStepKey,
  type ChecklistStepKey,
} from "@/lib/onboarding/derive-checklist";
import {
  dismissChecklist,
  dismissTipGroup,
  resetOnboarding,
  skipChecklistStep,
  type TipGroupKey,
  TIP_GROUP_KEYS,
} from "@/lib/onboarding/state";

export type OnboardingActionResult = {
  success?: boolean;
  error?: string;
};

export async function dismissChecklistAction(): Promise<OnboardingActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  try {
    await dismissChecklist(dbUser.id);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to dismiss onboarding checklist:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function skipChecklistStepAction(
  stepKey: ChecklistStepKey
): Promise<OnboardingActionResult> {
  if (!isChecklistStepKey(stepKey)) {
    return { error: "Unknown step." };
  }

  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  try {
    await skipChecklistStep(dbUser.id, stepKey);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to skip onboarding step:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function dismissTipGroupAction(
  group: TipGroupKey
): Promise<OnboardingActionResult> {
  if (!TIP_GROUP_KEYS.includes(group)) {
    return { error: "Unknown tip group." };
  }

  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  try {
    await dismissTipGroup(dbUser.id, group);
    return { success: true };
  } catch (error) {
    console.error("Failed to dismiss onboarding tip group:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function restartOnboardingAction(): Promise<OnboardingActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  try {
    await resetOnboarding(dbUser.id);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to restart onboarding:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
