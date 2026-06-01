import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

import { AppLayout } from "@/components/layout";

// Marketing pages are lazy-loaded so each route ships its own chunk instead
// of bloating the single entry bundle (recharts-heavy pages especially).
const Home          = lazy(() => import("@/pages/home"));
const Projects      = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const Tools         = lazy(() => import("@/pages/tools"));
const Rune          = lazy(() => import("@/pages/rune"));
const B18           = lazy(() => import("@/pages/b18"));
const Hyperliquid   = lazy(() => import("@/pages/hyperliquid"));
const LegendAtm     = lazy(() => import("@/pages/legend-atm"));
const Resources     = lazy(() => import("@/pages/resources"));
const NotFound      = lazy(() => import("@/pages/not-found"));

// Lazy-load the dashboard shell — it wraps its inner routes in
// <WouterRouter base="/app">, which strips the /app prefix so the inner
// Switch can match routes like "/strategy" instead of "/app/strategy".
const AppContainer = lazy(() => import("@app/dashboard-shell"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-amber-500">
      <div>Loading…</div>
    </div>
  );
}

export default function AppRouter() {
  const [location] = useLocation();
  const inApp = location === "/app" || location.startsWith("/app/");
  return (
    <>
      {inApp ? (
        <Suspense fallback={<Loading />}>
          <AppContainer />
        </Suspense>
      ) : (
        <AppLayout>
          <Suspense fallback={<Loading />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
          <Switch>
        <Route path="/" component={Home} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/rune"            component={Rune} />
        <Route path="/projects/b18"             component={B18} />
        <Route path="/projects/hyperliquid"     component={Hyperliquid} />
        <Route path="/projects/hyperliquid/:address" component={Hyperliquid} />
        <Route path="/projects/legend-atm"      component={LegendAtm} />
        <Route path="/projects/:id"             component={ProjectDetail} />
        <Route path="/tools"      component={Tools} />
        <Route path="/resources"  component={Resources} />
            <Route component={NotFound} />
          </Switch>
            </motion.div>
          </AnimatePresence>
          </Suspense>
        </AppLayout>
      )}
    </>
  );
}
