/**
 * Page registry. Explicit imports work identically in the Bun server
 * runtime and the Bun.build client bundle (Bun 1.3 removed
 * `import.meta.glob`). Keys use the `./pages/<Name>.svelte` convention
 * that `resolve()` builds from the Inertia component name.
 */
import type { Component } from "svelte";
import Analytics from "./pages/Analytics.svelte";
import ForgotPassword from "./pages/ForgotPassword.svelte";
import Home from "./pages/Home.svelte";
import Login from "./pages/Login.svelte";
import NotFound from "./pages/NotFound.svelte";
import Profile from "./pages/Profile.svelte";
import ResetPassword from "./pages/ResetPassword.svelte";
import Sites from "./pages/Sites.svelte";
import SiteSettings from "./pages/SiteSettings.svelte";
import ApiKeys from "./pages/ApiKeys.svelte";
import AdminUsers from "./pages/admin/Users.svelte";
import Conversions from "./pages/analytics/Conversions.svelte";
import Campaigns from "./pages/analytics/Campaigns.svelte";
import Devices from "./pages/analytics/Devices.svelte";
import Geography from "./pages/analytics/Geography.svelte";
import Pages from "./pages/analytics/Pages.svelte";
import Realtime from "./pages/analytics/Realtime.svelte";
import Sources from "./pages/analytics/Sources.svelte";
import Tracking from "./pages/analytics/Tracking.svelte";

type PageModule = { default: Component<any> };
export const pages: Record<string, PageModule> = {
	"./pages/Analytics.svelte": { default: Analytics },
	"./pages/ForgotPassword.svelte": { default: ForgotPassword },
	"./pages/Home.svelte": { default: Home },
	"./pages/Login.svelte": { default: Login },
	"./pages/NotFound.svelte": { default: NotFound },
	"./pages/Profile.svelte": { default: Profile },
	"./pages/ResetPassword.svelte": { default: ResetPassword },
	"./pages/Sites.svelte": { default: Sites },
	"./pages/SiteSettings.svelte": { default: SiteSettings },
	"./pages/admin/Users.svelte": { default: AdminUsers },
	"./pages/ApiKeys.svelte": { default: ApiKeys },
	"./pages/analytics/Realtime.svelte": { default: Realtime },
	"./pages/analytics/Pages.svelte": { default: Pages },
	"./pages/analytics/Sources.svelte": { default: Sources },
	"./pages/analytics/Devices.svelte": { default: Devices },
	"./pages/analytics/Geography.svelte": { default: Geography },
	"./pages/analytics/Campaigns.svelte": { default: Campaigns },
	"./pages/analytics/Conversions.svelte": { default: Conversions },
	"./pages/analytics/Tracking.svelte": { default: Tracking },
};

/** Fallback for unknown component names — never resolve to undefined. */
export const notFoundPage: PageModule = pages["./pages/NotFound.svelte"] ?? {
	default: NotFound,
};
