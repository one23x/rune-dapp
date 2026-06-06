// Re-export shim — the real (single) toast store lives in @app/hooks/use-toast.
// This file used to be a byte-identical COPY of it, which created two
// independent module-level stores: feature code dispatched into the @app one
// while <Toaster/> read this one, so no toast ever appeared. Keep this a
// re-export so the store stays singular.
export * from "@app/hooks/use-toast";
