import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/contexts/language-context";
import { Toaster } from "@/components/ui/toaster";
// MUST be the shared singleton — module-level `queryClient.invalidateQueries`
// calls across the dashboard import this instance; providing a different
// client here silently turns them all into no-ops.
import { queryClient } from "@app/lib/queryClient";

import AppRouter from "./app-router";
import "@app/lib/i18n"; // initializes i18next (used by format.ts and dashboard)
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AppRouter />
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </ThirdwebProvider>
  </StrictMode>,
);
