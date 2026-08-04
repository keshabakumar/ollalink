import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "es"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

// Match both "/login" and locale-prefixed variants like "/en/login", "/fr/login".
// With urlMappingStrategy: "rewrite", the underlying path may be locale-prefixed,
// so a bare "/login" matcher would miss those and fail to redirect authenticated
// users away from the login page.
const isSignInPage = createRouteMatcher(["/login", "/:locale/login"]);
const isPublicApiRoute = createRouteMatcher(["/api/(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isApi = isPublicApiRoute(request);
  if (isApi || request.nextUrl.pathname === "/install.ps1") {
    return;
  }

  const isAuthenticated = await convexAuth.isAuthenticated();
  const isSignIn = isSignInPage(request);
  if (isSignIn && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/");
  }
  if (!isSignIn && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }

  return I18nMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next/static|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",

    // all routes except static assets
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
