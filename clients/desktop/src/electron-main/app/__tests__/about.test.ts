import { describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  setAboutPanelOptions: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getVersion: (): string => "1.2.3",
    setAboutPanelOptions: electronMock.setAboutPanelOptions,
  },
}));

import { configureNativeAboutPanel } from "../about";

describe("configureNativeAboutPanel", () => {
  it("includes the native macOS metadata available to this slice", () => {
    configureNativeAboutPanel("Planwise", "/tmp/traycer-icon.png");

    expect(electronMock.setAboutPanelOptions).toHaveBeenCalledWith({
      applicationName: "Planwise",
      applicationVersion: "1.2.3",
      version: "1.2.3",
      copyright: `Copyright ${new Date().getFullYear()} Planwise. Based on Traycer, copyright 2026 Traycer AI (MIT License).`,
      credits: "Planwise",
      website: "https://traycer.ai",
      iconPath: "/tmp/traycer-icon.png",
    });
  });
});
