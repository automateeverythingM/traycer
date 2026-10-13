import { app } from "electron";
import { TRAYCER_WEBSITE_URL } from "./support-links";

export function configureNativeAboutPanel(
  appName: string,
  iconPath: string | null,
): void {
  app.setAboutPanelOptions({
    applicationName: appName,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: `Copyright ${new Date().getFullYear()} Planwise. Based on Traycer, copyright 2026 Traycer AI (MIT License).`,
    credits: "Planwise",
    website: TRAYCER_WEBSITE_URL,
    ...(iconPath === null ? {} : { iconPath }),
  });
}
