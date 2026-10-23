"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useSetGoal, useUpsertMetric } from "@/hooks/use-progress";
import type { Measurements } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Today's date in the browser's timezone, as YYYY-MM-DD. */
export const localToday = () => new Date().toLocaleDateString("en-CA");

const MEASUREMENTS: { key: keyof Measurements; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "arm", label: "Arm" },
  { key: "thigh", label: "Thigh" },
];

const toNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));

export function LogMetricDialog({ open, onClose, lastWeight }: { open: boolean; onClose: () => void; lastWeight: number | null }) {
  const [day, setDay] = useState(localToday);
  const [weight, setWeight] = useState(lastWeight != null ? String(lastWeight) : "");
  const [bodyFat, setBodyFat] = useState("");
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const upsert = useUpsertMetric();
  const toast = useToast();

  function close() {
    setError(undefined);
    upsert.reset();
    onClose();
  }

  function save() {
    const parsed = Object.fromEntries(
      Object.entries(measurements)
        .map(([k, v]) => [k, toNumber(v)])
        .filter(([, v]) => v !== undefined),
    ) as Partial<Measurements>;
    const body = {
      day,
      ...(toNumber(weight) !== undefined && { weight: toNumber(weight) }),
      ...(toNumber(bodyFat) !== undefined && { bodyFat: toNumber(bodyFat) }),
      ...(Object.keys(parsed).length > 0 && { measurements: parsed }),
    };
    if (Object.keys(body).length === 1) {
      setError("Enter at least a weight, body fat or one measurement.");
      return;
    }
    if (Object.values(body).some((v) => typeof v === "number" && Number.isNaN(v))) {
      setError("Use numbers only, like 62.4.");
      return;
    }
    setError(undefined);
    upsert.mutate(body, {
      onSuccess: (metric) => {
        toast({ title: "Weigh-in saved", description: metric.weight != null ? `${metric.weight} kg on ${metric.day}` : metric.day });
        close();
      },
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Log a weigh-in" description="Logging again on the same day updates that entry.">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="m-day">
            <Input id="m-day" type="date" value={day} max={localToday()} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Weight (kg)" htmlFor="m-weight">
            <Input id="m-weight" inputMode="decimal" autoFocus value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62.4" />
          </Field>
          <Field label="Body fat (%)" htmlFor="m-fat">
            <Input id="m-fat" inputMode="decimal" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowMeasurements((v) => !v)}
            aria-expanded={showMeasurements}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", showMeasurements && "rotate-180")} aria-hidden />
            Body measurements (cm)
          </button>
          {showMeasurements && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {MEASUREMENTS.map(({ key, label }) => (
                <Field key={key} label={label} htmlFor={`m-${key}`}>
                  <Input
                    id={`m-${key}`}
                    inputMode="decimal"
                    value={measurements[key] ?? ""}
                    onChange={(e) => setMeasurements((m) => ({ ...m, [key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>

        <FormError message={error ?? upsert.error?.message} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={upsert.isPending} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function GoalDialog({ open, onClose, current }: { open: boolean; onClose: () => void; current: number | null }) {
  const [value, setValue] = useState(current != null ? String(current) : "");
  const setGoal = useSetGoal();
  const toast = useToast();

  function close() {
    setGoal.reset();
    onClose();
  }

  function save(target: number | null) {
    setGoal.mutate(target, {
      onSuccess: () => {
        toast({ title: target == null ? "Goal cleared" : `Goal set to ${target} kg` });
        close();
      },
    });
  }

  const parsed = Number(value);
  const valid = value.trim() !== "" && parsed >= 20 && parsed <= 400;

  return (
    <Dialog open={open} onClose={close} title="Weight goal" description="Your progress towards it shows on the Progress page.">
      <div className="space-y-5">
        <Field label="Target weight (kg)" htmlFor="goal-weight" hint="Between 20 and 400 kg.">
          <Input id="goal-weight" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="60" />
        </Field>
        <FormError message={setGoal.error?.message} />
        <div className="flex flex-wrap justify-end gap-2">
          {current != null && (
            <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={() => save(null)}>
              Clear goal
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={setGoal.isPending} disabled={!valid} onClick={() => save(parsed)}>
            Save goal
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
