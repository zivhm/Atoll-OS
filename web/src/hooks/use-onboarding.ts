import { useEffect, useState } from "react";

import {
  dismissOnboarding,
  markOnboardingFirstChatCompleted,
  markOnboardingHelperCreated,
  ONBOARDING_CHANGE_EVENT,
  readOnboardingProgress,
  requestOnboardingReplay,
  type OnboardingProgress,
} from "@/lib/onboarding";

export function useOnboarding() {
  const [progress, setProgress] = useState<OnboardingProgress>(() =>
    readOnboardingProgress(),
  );

  useEffect(() => {
    const sync = () => setProgress(readOnboardingProgress());

    window.addEventListener("storage", sync);
    window.addEventListener(ONBOARDING_CHANGE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(
        ONBOARDING_CHANGE_EVENT,
        sync as EventListener,
      );
    };
  }, []);

  return {
    progress,
    dismiss: () => setProgress(dismissOnboarding()),
    requestReplay: () => setProgress(requestOnboardingReplay()),
    markHelperCreated: () => setProgress(markOnboardingHelperCreated()),
    markFirstChatCompleted: () =>
      setProgress(markOnboardingFirstChatCompleted()),
  };
}
