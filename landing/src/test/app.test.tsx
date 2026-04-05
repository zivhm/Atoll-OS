import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "@/App";

describe("landing app", () => {
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
  });
});
