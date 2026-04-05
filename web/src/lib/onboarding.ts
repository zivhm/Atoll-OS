export interface OnboardingProgress {
  version: 1;
  dismissed: boolean;
  helperCreated: boolean;
  firstChatCompleted: boolean;
  replayRequested: boolean;
}

export type OnboardingStage =
  | "welcome"
  | "first-chat"
  | "next-steps"
  | "idle";

export const ONBOARDING_STORAGE_KEY = "atoll-onboarding-v1";
export const ONBOARDING_CHANGE_EVENT = "atoll:onboarding-change";

export const ONBOARDING_PROMPTS = [
  "What can you help me with?",
  "Summarize what this helper can do for my team.",
  "Draft a short plan for getting started in Atoll.",
] as const;

export const ONBOARDING_COPY = {
  welcome: {
    title: "Create your first helper",
    description:
      "Atoll walks you through naming one helper, keeping the recommended setup, and sending a first message so you can verify the whole flow quickly.",
    timeToComplete: "About 2 minutes",
  },
  runtimeSummary: {
    title: "Recommended setup",
    description:
      "We keep the engine and AI defaults on the safest path for a first launch. You can reveal advanced runtime controls whenever you need to tune the helper.",
  },
  firstChat: {
    title: "Send your first message",
    description:
      "Your helper is live. Send one simple prompt from the helper chat to confirm the runtime, model, and reply path are all working.",
  },
  nextSteps: {
    title: "Next steps",
    description:
      "Your first chat worked. Keep using the helper now, or open settings later to connect channels, adjust runtime options, and refine the prompt files.",
  },
} as const;

export function getInitialOnboardingProgress(): OnboardingProgress {
  return {
    version: 1,
    dismissed: false,
    helperCreated: false,
    firstChatCompleted: false,
    replayRequested: false,
  };
}

export function readOnboardingProgress(): OnboardingProgress {
  if (typeof window === "undefined") {
    return getInitialOnboardingProgress();
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return getInitialOnboardingProgress();
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingProgress> | null;
    if (!parsed || typeof parsed !== "object") {
      return getInitialOnboardingProgress();
    }

    return {
      ...getInitialOnboardingProgress(),
      ...parsed,
      version: 1,
    };
  } catch {
    return getInitialOnboardingProgress();
  }
}

export function writeOnboardingProgress(
  next: OnboardingProgress,
): OnboardingProgress {
  if (typeof window === "undefined") {
    return next;
  }

  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ONBOARDING_CHANGE_EVENT, { detail: next }));
  return next;
}

export function updateOnboardingProgress(
  updater: (current: OnboardingProgress) => OnboardingProgress,
): OnboardingProgress {
  return writeOnboardingProgress(updater(readOnboardingProgress()));
}

export function dismissOnboarding(): OnboardingProgress {
  return updateOnboardingProgress((current) => ({
    ...current,
    dismissed: true,
    replayRequested: false,
  }));
}

export function requestOnboardingReplay(): OnboardingProgress {
  return writeOnboardingProgress({
    ...getInitialOnboardingProgress(),
    replayRequested: true,
  });
}

export function markOnboardingHelperCreated(): OnboardingProgress {
  return updateOnboardingProgress((current) => ({
    ...current,
    dismissed: false,
    helperCreated: true,
    replayRequested: false,
  }));
}

export function markOnboardingFirstChatCompleted(): OnboardingProgress {
  return updateOnboardingProgress((current) => ({
    ...current,
    dismissed: false,
    helperCreated: true,
    firstChatCompleted: true,
    replayRequested: false,
  }));
}

export function getOnboardingStage(input: {
  progress: OnboardingProgress;
  hasHelpers: boolean;
  hasSelectedHelper: boolean;
}): OnboardingStage {
  const { progress, hasHelpers, hasSelectedHelper } = input;

  if (
    progress.replayRequested ||
    (!hasHelpers &&
      !progress.dismissed &&
      !progress.helperCreated &&
      !progress.firstChatCompleted)
  ) {
    return "welcome";
  }

  if (hasSelectedHelper && progress.helperCreated && !progress.firstChatCompleted) {
    return "first-chat";
  }

  if (hasSelectedHelper && progress.firstChatCompleted) {
    return "next-steps";
  }

  return "idle";
}
