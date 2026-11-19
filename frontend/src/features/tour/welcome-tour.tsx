"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompleteTour } from "@/hooks/use-profile";
import type { Session } from "@/lib/types";
import { buildTourSteps, placeCard, type Placement } from "./steps";
import { tourStore } from "./tour-store";

const PAD = 6; // space between the highlighted element and the spotlight's edge
const CARD_WIDTH = 340;

type Rect = { top: number; left: number; width: number; height: number; radius: string };

/** The visible element for a target. Nav links exist twice (header and phone tab bar). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(name)}"]`)) {
    if (el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/**
 * A short guided tour for new users, shown once (the server remembers when it was finished or
 * skipped) and replayable from the profile page. Each step highlights a real part of the screen.
 */
export function WelcomeTour({ session, navHrefs }: { session: Session; navHrefs: string }) {
  const { user } = session;
  // navHrefs is a space-separated string so the steps only change when the navigation does.
  const steps = useMemo(
    () => buildTourSteps({ name: user.name, role: user.role, navHrefs: navHrefs.split(" ").filter(Boolean) }),
    [user.name, user.role, navHrefs],
  );
  const complete = useCompleteTour();
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index === steps.length - 1;

  // First visit: open once the page has settled. Replays come from the profile page.
  useEffect(() => {
    if (user.tourCompletedAt) return;
    const timer = setTimeout(() => {
      setIndex(0);
      setOpen(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [user.tourCompletedAt]);

  useEffect(
    () =>
      tourStore.subscribe(() => {
        setIndex(0);
        setOpen(true);
      }),
    [],
  );

  const measure = useCallback(() => {
    const el = step.target ? findTarget(step.target) : null;
    const box = el?.getBoundingClientRect();
    const rect = box
      ? {
          top: box.top - PAD,
          left: box.left - PAD,
          width: box.width + PAD * 2,
          height: box.height + PAD * 2,
          // Fully rounded elements (pills, avatars) get a round spotlight.
          radius: parseFloat(getComputedStyle(el!).borderRadius) >= box.height / 2 ? "9999px" : "16px",
        }
      : null;
    setSpot(rect);
    const card = cardRef.current?.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const width = Math.min(CARD_WIDTH, viewport.width - 32);
    setPlacement(placeCard(rect, { width, height: card?.height ?? 220 }, viewport));
  }, [step]);

  // Follow the highlighted element through scrolling, resizing and layout changes.
  useEffect(() => {
    if (!open) return;
    const el = step.target ? findTarget(step.target) : null;
    el?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    let frame = requestAnimationFrame(measure);
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // A second pass once the card has its real height.
    const settle = setTimeout(remeasure, 60);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [open, step, measure, reduceMotion]);

  const close = useCallback(() => {
    setOpen(false);
    complete.mutate();
    if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
  }, [complete]);

  const next = useCallback(() => (last ? close() : setIndex((i) => i + 1)), [last, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard: arrows move, Escape skips. Focus sits on the main button of each step.
  useEffect(() => {
    if (!open) return;
    returnFocus.current ??= document.activeElement;
    primaryRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Tab") {
        // Keep focus inside the card.
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusable?.length) return;
        const first = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, close, next, back]);

  useEffect(() => {
    if (!open) returnFocus.current = null;
  }, [open]);

  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 34 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          {/* Blocks clicks on the page while the tour is open. */}
          <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />

          {spot ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute"
              initial={false}
              animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
              transition={transition}
              // One shadow list draws the red outline, the dimmed page around it and a soft glow
              // (a Tailwind ring would be overwritten, since rings are box-shadows too).
              style={{
                borderRadius: spot.radius,
                boxShadow: "0 0 0 2px #ff2d1f, 0 0 0 9999px rgba(5,2,2,0.74), 0 0 32px 6px rgba(255,45,31,0.5)",
              }}
            />
          ) : (
            <div aria-hidden className="absolute inset-0 bg-[rgba(5,2,2,0.74)] backdrop-blur-[2px]" />
          )}

          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
            className="absolute rounded-3xl border border-white/10 bg-[#140c0b]/95 p-5 shadow-2xl backdrop-blur-xl"
            style={{ width: `min(${CARD_WIDTH}px, calc(100vw - 32px))` }}
            initial={false}
            animate={{ top: placement?.top ?? -9999, left: placement?.left ?? 16, opacity: placement ? 1 : 0 }}
            transition={transition}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
                <Sparkles className="size-3.5" aria-hidden />
                {index === 0 ? "Welcome tour" : `Step ${index} of ${steps.length - 1}`}
              </p>
              {!last && (
                <button
                  type="button"
                  onClick={close}
                  className="-m-1 rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Skip the tour"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>

            <h2 id="tour-title" className="font-display mt-2 text-xl font-semibold">
              {step.title}
            </h2>
            <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
                transition={transition}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              {index === 0 ? (
                <button type="button" onClick={close} className="text-sm text-muted-foreground transition hover:text-foreground">
                  Skip tour
                </button>
              ) : (
                <Button variant="ghost" size="sm" onClick={back}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
              )}
              <Button ref={primaryRef} size="sm" onClick={next}>
                {index === 0 ? "Show me around" : last ? "Let's go" : "Next"}
                {!last && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
