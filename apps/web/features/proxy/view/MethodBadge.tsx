import { getMethodColor, type HttpMethod } from "@/features/proxy/model/variables";
import { cn } from "@/lib/utils";

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 text-xs font-semibold",
        getMethodColor(method)
      )}
    >
      {method}
    </span>
  );
}
