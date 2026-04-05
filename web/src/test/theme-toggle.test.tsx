import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider } from "@/hooks/use-theme";

describe("theme toggle", () => {
  it("does not inject a session accent override when switching themes", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(document.getElementById("atoll-session-accent")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(document.getElementById("atoll-session-accent")).not.toBeInTheDocument();
  });
});
