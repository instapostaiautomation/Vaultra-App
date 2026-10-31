/**
 * Single source of white-label configuration for this build.
 *
 * Base app: tenant.config.json has an empty tenantId → customers pick their jeweller.
 * Branded build: CI copies the App Kit's config.json over tenant.config.json → the app is
 * locked to that jeweller, uses its name/theme/layout and sends X-Tenant-ID on every request.
 * app.config.js reads the same file for app name, bundle ID, package, icon and splash.
 */
import raw from "../tenant.config.json";

export type HomeSection = "prices" | "karats" | "sip" | "banners" | "buy" | "categories" | "trending" | "promos";

export type TenantTheme = {
  preset?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  font: string;
  cardRadius?: number;
};

export type TenantConfig = {
  tenantId: string;
  appName: string;
  slug?: string;
  bundleId: string;
  packageName: string;
  version?: string;
  apiBaseUrl?: string;
  theme: TenantTheme | null;
  homeLayout: HomeSection[] | null;
  assets: { logoUrl: string; splashUrl: string };
  support?: { phone: string; email: string };
};

export const tenantConfig = raw as TenantConfig;

/** Jeweller this build is locked to ("" in the base app). */
export const LOCKED_TENANT_ID = tenantConfig.tenantId || "";

export const DEFAULT_HOME_LAYOUT: HomeSection[] = ["prices", "karats", "sip", "banners", "buy", "categories", "trending", "promos"];

export const homeLayout: HomeSection[] = tenantConfig.homeLayout?.length ? tenantConfig.homeLayout : DEFAULT_HOME_LAYOUT;
