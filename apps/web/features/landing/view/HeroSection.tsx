"use client";

import Link from "next/link";
import { ArrowRight, Bot, Box, Layers, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParallax } from "@/hooks/useScrollAnimation";

export function HeroSection() {
  const scrollY = useParallax();

  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl"
          style={{ transform: `translate(-50%, calc(-50% + ${scrollY * 0.3}px))` }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl"
          style={{ transform: `translate(0, ${scrollY * 0.2}px)` }}
        />
      </div>

      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium animate-fade-in"
              style={{ animationDelay: "100ms", animationFillMode: "both" }}
            >
              <span>Built on Stellar</span>
              <span className="text-muted-foreground">•</span>
              <span>Soroban</span>
              <span className="text-muted-foreground">•</span>
              <span>MCP-compatible</span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-in"
              style={{ animationDelay: "200ms", animationFillMode: "both" }}
            >
              Agents with limits.
            </h1>

            <p
              className="text-xl sm:text-2xl text-primary font-medium animate-fade-in"
              style={{ animationDelay: "350ms", animationFillMode: "both" }}
            >
              Programmable permissions for AI agents on Stellar.
            </p>

            <p
              className="text-lg text-muted-foreground max-w-xl animate-fade-in"
              style={{ animationDelay: "500ms", animationFillMode: "both" }}
            >
              Agent Loom is a Stellar-native execution layer for paid APIs, MCP tools, and
              workflows — with OAuth consent, scoped access, and server-side signing so agents
              never hold your secret keys.
            </p>

            <div
              className="flex flex-col sm:flex-row items-start gap-4 animate-fade-in"
              style={{ animationDelay: "650ms", animationFillMode: "both" }}
            >
              <a href="#how-it-works">
                <Button size="lg" className="gap-2 text-base px-8">
                  How it works
                  <ArrowRight className="size-5" />
                </Button>
              </a>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  Open dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="relative hidden lg:block animate-fade-in"
            style={{
              animationDelay: "400ms",
              animationFillMode: "both",
              transform: `translateY(${scrollY * -0.1}px)`
            }}
          >
            <div className="relative">
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-xl bg-card border border-border shadow-lg">
                    <Bot className="size-8 text-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">AI agent</span>
                </div>

                <div className="w-px h-8 bg-gradient-to-b from-border to-primary/50" />

                <div className="relative p-8 rounded-2xl border-2 border-primary/30 bg-primary/5">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background border border-primary/30 text-xs text-primary font-medium">
                    Permission boundary
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <Layers className="size-8 text-primary" />
                    </div>
                    <div>
                      <span className="text-lg font-semibold text-foreground block">Agent Loom</span>
                      <span className="text-sm text-muted-foreground">Scoped execution layer</span>
                    </div>
                  </div>
                </div>

                <div className="relative w-48 h-8">
                  <div className="absolute left-1/2 top-0 w-px h-4 bg-gradient-to-b from-primary/50 to-border -translate-x-1/2" />
                  <div className="absolute left-1/2 top-4 w-40 h-px bg-border -translate-x-1/2" />
                  <div className="absolute left-[calc(50%-80px)] top-4 w-px h-4 bg-border" />
                  <div className="absolute left-[calc(50%+80px)] top-4 w-px h-4 bg-border" />
                </div>

                <div className="flex items-center gap-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-xl bg-card border border-border shadow-md">
                      <Server className="size-6 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Paid APIs</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-xl bg-card border border-border shadow-md">
                      <Box className="size-6 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Stellar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
