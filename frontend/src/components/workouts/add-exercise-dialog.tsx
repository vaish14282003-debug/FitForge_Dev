"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useUploadExerciseImage } from "@/hooks/use-profile";
import { useCreateExercise } from "@/hooks/use-workouts";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/workout";
import type { Exercise } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Give it a name").max(80),
  muscleGroup: z.enum(MUSCLE_GROUPS.map((m) => m.value) as [Exercise["muscleGroup"], ...Exercise["muscleGroup"][]]),
  equipment: z.enum(EQUIPMENT.map((e) => e.value) as [Exercise["equipment"], ...Exercise["equipment"][]]),
  instructions: z.string().trim().max(1000),
});

type Values = z.infer<typeof schema>;

export function AddExerciseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createExercise = useCreateExercise();
  const uploadImage = useUploadExerciseImage();
  const toast = useToast();
  const [image, setImage] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", muscleGroup: "CHEST", equipment: "BARBELL", instructions: "" },
  });

  function close() {
    reset();
    setImage(null);
    createExercise.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title="Add an exercise" description="It's added to your gym's library for every trainer.">
      <form className="space-y-5" noValidate onSubmit={handleSubmit((values) =>
          createExercise.mutate(values, {
            onSuccess: async ({ exercise }) => {
              // The photo is optional and uploaded after the exercise exists; a failed upload keeps the exercise.
              if (image) {
                try {
                  await uploadImage.mutateAsync({ id: exercise.id, file: image });
                } catch (err) {
                  toast({ title: "Exercise added, but the photo didn't upload", description: (err as Error).message, tone: "error" });
                  return close();
                }
              }
              toast({ title: "Exercise added", description: `${values.name} is now in your gym's library.` });
              close();
            },
          }),
        )}>
        <Field label="Name" htmlFor="ex-name" error={errors.name?.message}>
          <Input id="ex-name" placeholder="e.g. Landmine Press" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Muscle group" htmlFor="ex-muscle">
            <Select id="ex-muscle" {...register("muscleGroup")}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment" htmlFor="ex-equipment">
            <Select id="ex-equipment" {...register("equipment")}>
              {EQUIPMENT.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="How to do it" htmlFor="ex-instructions" error={errors.instructions?.message} hint="Optional. A sentence or two.">
          <textarea
            id="ex-instructions"
            rows={3}
            className="w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
            {...register("instructions")}
          />
        </Field>
        <Field label="Photo" htmlFor="ex-image" hint="Optional. JPG, PNG or WebP up to 5 MB, e.g. the machine or the starting position.">
          <input
            id="ex-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-white/15"
          />
        </Field>
        <FormError message={createExercise.error?.message} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={createExercise.isPending || uploadImage.isPending}>
            Add exercise
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
