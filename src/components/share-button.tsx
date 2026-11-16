"use client";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
export function ShareButton({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <span className="relative inline-flex">
      <Tooltip label={state === "copied" ? "Link copied" : "Copy edition link"}>
        <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy edition link">
          {state === "copied" ? <Check className="text-signal" /> : <Link2 />}
        </Button>
      </Tooltip>
      <span
        role="status"
        className={
          state === "failed"
            ? "absolute right-0 top-10 z-10 w-48 rounded border border-border bg-card p-2 text-xs"
            : "sr-only"
        }
      >
        {state === "copied"
          ? "Edition link copied"
          : state === "failed"
            ? "Copy unavailable. You can copy this page's address from your browser."
            : ""}
      </span>
    </span>
  );
}
