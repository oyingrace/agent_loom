"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProxyUrlDisplayProps {
  proxyUrl: string;
}

export function ProxyUrlDisplay({ proxyUrl }: ProxyUrlDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(proxyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-muted flex items-center gap-2 rounded-lg p-3">
      <code className="flex-1 truncate font-mono text-sm">{proxyUrl}</code>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleCopyUrl}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
