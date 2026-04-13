"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  VARIABLE_TYPES,
  type VariableDefinition,
  type VariableType
} from "@/lib/proxy/variables";
import { cn } from "@/lib/utils";

function parseValue(value: string, type: VariableType): unknown {
  switch (type) {
    case "number":
      return parseFloat(value) || 0;
    case "boolean":
      return value.toLowerCase() === "true";
    case "array":
    case "object":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

export function VariablesBuilder({
  variables,
  onChange
}: {
  variables: VariableDefinition[];
  onChange: (next: VariableDefinition[]) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const updateAt = (index: number, patch: Partial<VariableDefinition>) => {
    const next = variables.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
    setExpandedIndex((prev) => (prev === index ? null : prev));
  };

  const add = () => {
    onChange([
      ...variables,
      {
        name: "",
        type: "string",
        description: "",
        required: false
      }
    ]);
    setExpandedIndex(variables.length);
  };

  return (
    <div className="space-y-3">
      {variables.map((variable, index) => {
        const isValid =
          variable.name.length > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name);
        const variableType = variable.type || "string";
        const expanded = expandedIndex === index;

        return (
          <div
            key={index}
            className={cn(
              "bg-card rounded-lg border",
              !isValid && variable.name.length > 0 && "border-destructive"
            )}
          >
            <div className="flex flex-wrap items-center gap-2 p-3">
              <Input
                placeholder="variableName"
                value={variable.name}
                onChange={(e) => updateAt(index, { name: e.target.value })}
                className={cn(
                  "min-w-[120px] flex-1 font-mono",
                  !isValid && variable.name.length > 0 && "border-destructive"
                )}
              />
              <select
                value={variableType}
                onChange={(e) =>
                  updateAt(index, { type: e.target.value as VariableType })
                }
                className={cn(
                  "border-input h-9 w-28 rounded-md border bg-transparent px-2 text-sm",
                  "dark:bg-input/30"
                )}
              >
                {VARIABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={variable.required}
                  onChange={(e) => updateAt(index, { required: e.target.checked })}
                  className="border-input size-4 rounded"
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExpandedIndex(expanded ? null : index)}
              >
                {expanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(index)}>
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>

            {expanded ? (
              <div className="space-y-3 border-t px-3 pt-3 pb-3">
                <div>
                  <Label className="text-sm">Description</Label>
                  <Textarea
                    value={variable.description}
                    onChange={(e) => updateAt(index, { description: e.target.value })}
                    placeholder="What this variable is for"
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Default</Label>
                    <Input
                      value={
                        variable.default !== undefined ? String(variable.default) : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        updateAt(index, {
                          default: v === "" ? undefined : parseValue(v, variableType)
                        });
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Example</Label>
                    <Input
                      value={
                        variable.example !== undefined ? String(variable.example) : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        updateAt(index, {
                          example: v === "" ? undefined : parseValue(v, variableType)
                        });
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={add}>
        <Plus className="size-4" />
        Add variable
      </Button>
    </div>
  );
}
