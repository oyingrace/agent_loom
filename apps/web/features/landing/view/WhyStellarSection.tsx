"use client";

import { Box, CreditCard } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollAnimation } from "@/components/ui/scroll-animation";

const badges = ["Stellar", "Soroban", "x402", "MCP", "OAuth"];

export function WhyStellarSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container">
        <ScrollAnimation animation="fade-up">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Why Stellar and Soroban</h2>
          </div>
        </ScrollAnimation>

        <div className="max-w-4xl mx-auto">
          <ScrollAnimation animation="stagger" className="grid gap-8 md:grid-cols-2">
            <Card className="group hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-card/50">
              <CardHeader className="space-y-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit group-hover:bg-primary/20 transition-colors">
                  <Box className="size-7" />
                </div>
                <CardTitle className="text-xl">Built for Stellar</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Fast settlement, native assets, and Soroban smart contracts for agent-driven swaps,
                  attestations, and workflows on one network.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-card/50">
              <CardHeader className="space-y-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit group-hover:bg-primary/20 transition-colors">
                  <CreditCard className="size-7" />
                </div>
                <CardTitle className="text-xl">Paid HTTP by default</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Proxies and workflow steps can require Stellar-native payments (x402-stellar), turning
                  APIs into usage-based primitives agents can consume safely.
                </CardDescription>
              </CardHeader>
            </Card>
          </ScrollAnimation>

          <ScrollAnimation animation="fade-up" delay={300}>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary"
                >
                  {badge}
                </span>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}
