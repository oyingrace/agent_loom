"use client";

import { Coins, Server, Shield } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollAnimation } from "@/components/ui/scroll-animation";

const solutions = [
  {
    icon: Shield,
    title: "Scoped by default",
    description:
      "OAuth-backed sessions and explicit scopes (MCP tools, payments, Soroswap when enabled). Workflows can use your wallet for Soroban (unsigned XDR, you sign); optional server hot wallet remains for demos."
  },
  {
    icon: Coins,
    title: "Economic primitives",
    description:
      "Turn proxies and workflows into paid, metered HTTP steps on Stellar (x402-stellar) so agents can consume APIs with clear budgets."
  },
  {
    icon: Server,
    title: "MCP-compatible",
    description:
      "Expose proxies and workflows as MCP servers so Claude, ChatGPT, and other clients discover tools with OAuth consent."
  }
];

export function SolutionSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container">
        <ScrollAnimation animation="fade-up">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">
              A safe execution layer for agentic finance
            </h2>
          </div>
        </ScrollAnimation>

        <ScrollAnimation animation="stagger" className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {solutions.map((solution) => {
            const Icon = solution.icon;
            return (
              <Card
                key={solution.title}
                className="group hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-card/50"
              >
                <CardHeader className="space-y-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit group-hover:bg-primary/20 transition-colors">
                    <Icon className="size-7" />
                  </div>
                  <CardTitle className="text-xl">{solution.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {solution.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </ScrollAnimation>
      </div>
    </section>
  );
}
