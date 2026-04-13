"use client";

interface RedirectInfoProps {
  redirectUri: string;
}

export function RedirectInfo({ redirectUri }: RedirectInfoProps) {
  let hostname = redirectUri;
  try {
    hostname = new URL(redirectUri).hostname;
  } catch {
    /* keep raw */
  }

  return (
    <p className="text-xs text-center text-muted-foreground">
      After authorizing, you&apos;ll be redirected to{" "}
      <span className="font-mono">{hostname}</span>
    </p>
  );
}
