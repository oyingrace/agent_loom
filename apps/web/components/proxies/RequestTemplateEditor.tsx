"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  detectVariablesInTemplate,
  findMissingVariables
} from "@/lib/utils/detectVariablesInTemplate";

interface RequestTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  existingVariables?: string[];
  onAddVariables?: (names: string[]) => void;
}

export function RequestTemplateEditor({
  value,
  onChange,
  placeholder = '{\n  "query": "{{graphqlQuery}}"\n}',
  rows = 8,
  existingVariables = [],
  onAddVariables
}: RequestTemplateEditorProps) {
  const detectedVariables = useMemo(() => detectVariablesInTemplate(value), [value]);
  const missingVariables = useMemo(
    () => findMissingVariables(value, existingVariables),
    [value, existingVariables]
  );

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="font-mono text-sm"
      />
      {detectedVariables.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-xs">
            <span className="font-medium">Detected: </span>
            {detectedVariables.map((v, i) => (
              <span key={v}>
                <code
                  className={`rounded px-1 py-0.5 ${
                    existingVariables.includes(v) ? "bg-green-500/10 text-green-600" : "bg-muted"
                  }`}
                >
                  {`{{${v}}}`}
                </code>
                {i < detectedVariables.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
          {missingVariables.length > 0 && onAddVariables ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onAddVariables(missingVariables)}
            >
              <Plus className="size-3" />
              Add {missingVariables.length} variable{missingVariables.length > 1 ? "s" : ""}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface QueryParamsEditorProps {
  value: string;
  onChange: (value: string) => void;
  existingVariables?: string[];
  onAddVariables?: (names: string[]) => void;
}

export function QueryParamsEditor({
  value,
  onChange,
  existingVariables = [],
  onAddVariables
}: QueryParamsEditorProps) {
  const detectedVariables = useMemo(() => detectVariablesInTemplate(value), [value]);
  const missingVariables = useMemo(
    () => findMissingVariables(value, existingVariables),
    [value, existingVariables]
  );

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="param1={{variable1}}&param2={{variable2}}"
        rows={2}
        className="font-mono text-sm"
      />
      {detectedVariables.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-xs">
            <span className="font-medium">Detected: </span>
            {detectedVariables.map((v, i) => (
              <span key={v}>
                <code
                  className={`rounded px-1 py-0.5 ${
                    existingVariables.includes(v) ? "bg-green-500/10 text-green-600" : "bg-muted"
                  }`}
                >
                  {`{{${v}}}`}
                </code>
                {i < detectedVariables.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
          {missingVariables.length > 0 && onAddVariables ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onAddVariables(missingVariables)}
            >
              <Plus className="size-3" />
              Add {missingVariables.length} variable{missingVariables.length > 1 ? "s" : ""}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
