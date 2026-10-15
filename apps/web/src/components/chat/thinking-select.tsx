"use client";

import { THINKING_LABELS, thinkingLevels, type ThinkingLevel } from "@moonc/core";
import { Brain } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isAuto } from "@/lib/auto-model";
import { findModel, update, useStore, type ModelRef } from "@/lib/store";

/** How hard the chosen model thinks. Only shown for models that have that setting; the levels follow the company. */
export function ThinkingSelect({ model }: { model?: ModelRef }) {
  const thinking = useStore((s) => s.thinking);
  useStore((s) => s.connections); // re-render when models change
  const found = isAuto(model) ? undefined : findModel(model);
  const levels = found ? thinkingLevels(found.conn.providerId, found.model.id) : [];
  if (!levels.length) return null;
  const value = thinking && levels.includes(thinking as ThinkingLevel) ? thinking : "default";
  return (
    <Select value={value} onValueChange={(v) => update((s) => ({ ...s, thinking: v === "default" ? undefined : v }))}>
      <SelectTrigger size="sm" aria-label="Thinking" className="h-8 w-auto gap-1 border-0 bg-transparent shadow-none dark:bg-transparent">
        <Brain className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default thinking</SelectItem>
        {levels.map((l) => (
          <SelectItem key={l} value={l}>
            {THINKING_LABELS[l]} thinking
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
