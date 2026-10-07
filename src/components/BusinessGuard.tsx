import { useQuery } from "convex/react";
import { Navigate, Outlet, useLocation } from "react-router";
import { api } from "@/convex/_generated/api";
import { RequireAuth } from "./RequireAuth";

/**
 * Wraps authenticated app routes:
 * 1. RequireAuth → must be signed in.
 * 2. Must have created a business → onboarding.
 */
export function BusinessGuard() {
  const business = useQuery(api.business.getMyBusinessQuery, {});
  const location = useLocation();

  if (business === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (business === null) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/onboarding?returnTo=${returnTo}`} replace />;
  }

  return <Outlet />;
}
