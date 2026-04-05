import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "@/App";

describe("landing app", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the standalone GitHub Pages landing experience", () => {
    render(<App />);

    expect(screen.getAllByText("Atoll").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/zivhm/Atoll-OS"
    );
    expect(screen.queryByRole("link", { name: /open dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/works with your ecosystem/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pricing/i)).not.toBeInTheDocument();
    expect(screen.getByText("Identity Settings")).toBeInTheDocument();
    expect(screen.getByText("Helper preview")).toBeInTheDocument();
    expect(screen.queryByText("IDENTITY.md")).not.toBeInTheDocument();
    expect(screen.getByText("Is Atoll a paid service?")).toBeInTheDocument();
    expect(screen.getByText("How does Atoll stay observable?")).toBeInTheDocument();
    expect(screen.getByText("Can the helper work across channels?")).toBeInTheDocument();
    expect(screen.getByText("Do I need any technical knowledge to use Atoll?")).toBeInTheDocument();
    expect(screen.getByText("What is the main use case right now?")).toBeInTheDocument();
    expect(screen.queryByText("Operator-Visible Security")).not.toBeInTheDocument();
    expect(screen.getByTestId("features-spacer")).toBeInTheDocument();

    expect(screen.getByTestId("features-background")).toHaveStyle({
      backgroundImage: "url('/images/atoll-day.png')",
    });
  });

  it("switches the feature backdrop image in dark theme", () => {
    window.localStorage.setItem("atoll-landing-theme", "dark");

    render(<App />);

    expect(screen.getByTestId("features-background")).toHaveStyle({
      backgroundImage: "url('/images/atoll-night.png')",
    });
  });
});
