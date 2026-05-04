export const ONBOARDING_STORAGE_KEY = "sitepulse_onboarding_v1";
export const ONBOARDING_DISMISSED_KEY = "sitepulse_onboarding_v1_dismissed";
export const ONBOARDING_CONGRATS_KEY = "sitepulse_onboarding_v1_congrats_shown";
export const ONBOARDING_STEP_COUNT = 5;

export type OnboardingStepState = [boolean, boolean, boolean, boolean, boolean];

function normalizeSteps(value: unknown): OnboardingStepState {
  const source = Array.isArray(value) ? value : [];

  return Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => Boolean(source[index])) as OnboardingStepState;
}

export function readOnboardingSteps(): OnboardingStepState {
  if (typeof window === "undefined") {
    return [false, false, false, false, false];
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return normalizeSteps(raw ? JSON.parse(raw) : null);
  } catch {
    return [false, false, false, false, false];
  }
}

export function writeOnboardingSteps(steps: boolean[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSteps(steps);
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("sitepulse:onboarding-updated", { detail: normalized }));
}

export function mergeOnboardingSteps(...stepSets: Array<boolean[] | null | undefined>): OnboardingStepState {
  const next = [false, false, false, false, false];

  for (const stepSet of stepSets) {
    const normalized = normalizeSteps(stepSet);
    for (let index = 0; index < ONBOARDING_STEP_COUNT; index += 1) {
      next[index] = next[index] || normalized[index];
    }
  }

  return next as OnboardingStepState;
}

export function markOnboardingStepComplete(stepIndex: number) {
  if (stepIndex < 0 || stepIndex >= ONBOARDING_STEP_COUNT) {
    return;
  }

  const current = readOnboardingSteps();
  current[stepIndex] = true;
  writeOnboardingSteps(current);
}
