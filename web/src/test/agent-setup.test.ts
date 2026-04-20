import { describe, expect, it, vi } from "vitest";

import { refreshPostLaunchQueries } from "@/lib/agent-setup";

describe("refreshPostLaunchQueries", () => {
  it("does not wait for query invalidation promises to settle", async () => {
    let resolveFirst: (() => void) | undefined;
    const invalidateQueries = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);

    refreshPostLaunchQueries({ invalidateQueries });

    await Promise.resolve();

    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    expect(resolveFirst).toBeTypeOf("function");
  });
});
