export function detectVariablesInTemplate(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(2, -2))));
}

export function findMissingVariables(template: string, definedVariables: string[]): string[] {
  const detected = detectVariablesInTemplate(template);
  return detected.filter((v) => !definedVariables.includes(v));
}
