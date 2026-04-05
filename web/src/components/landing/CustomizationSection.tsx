import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import elizaHelper from "@/assets/eliza-helper.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IDENTITY_PRESETS = {
  operator: {
    name: "Operator Companion",
    category: "Control Plane",
    summary: "A calm helper for runtime operations, runbooks, and incident follow-through.",
    description:
      "Keeps the control plane legible, turns health signals into action, and writes back the context operators need to trust the next step.",
    roleTitle: "Operator-first control plane copilot",
    skills: ["Runbook drafting", "Runtime health triage", "Change summaries"],
    seedFiles: {
      identity: "Ground the helper in Atoll's operator-first voice and execution style.",
      soul: "Bias toward calm diagnosis, explicit next steps, and traceable reasoning.",
      tools: "Prefer observable actions: logs, runtime status, events, diagnostics, and repo context.",
    },
  },
  strategist: {
    name: "Strategic Advisor",
    category: "Planning",
    summary: "Synthesizes context into decisions, follow-ups, and concise executive notes.",
    description:
      "Reads the room, tracks commitments, and turns scattered context into a plan you can actually move on.",
    roleTitle: "Decision-support and planning partner",
    skills: ["Decision briefs", "Meeting prep", "Stakeholder follow-through"],
    seedFiles: {
      identity: "Position the helper as a measured planner with strong context retention.",
      soul: "Optimize for clarity, tradeoffs, and realistic sequencing instead of hype.",
      tools: "Use notes, issues, timelines, and current repo state as first-class inputs.",
    },
  },
  builder: {
    name: "Engineering Copilot",
    category: "Delivery",
    summary: "Targets implementation details, codebase constraints, and shipping discipline.",
    description:
      "Keeps specs grounded in the repo, narrows changesets, and leaves behind code that is explainable and maintainable.",
    roleTitle: "Repo-grounded implementation copilot",
    skills: ["Spec to code", "Regression hunts", "Release hygiene"],
    seedFiles: {
      identity: "Frame the helper as a pragmatic engineer with a bias toward clean, minimal changes.",
      soul: "Stay explicit about risks, tests, and constraints before changing behavior.",
      tools: "Treat the repo, tests, and runtime output as the source of truth.",
    },
  },
} as const;

type IdentityPresetKey = keyof typeof IDENTITY_PRESETS;

export function CustomizationSection() {
  const [selectedPreset, setSelectedPreset] = useState<IdentityPresetKey>("operator");
  const [helperName, setHelperName] = useState("Eliza");

  const currentPreset = useMemo(() => IDENTITY_PRESETS[selectedPreset], [selectedPreset]);

  return (
    <section id="customization" className="px-6 py-24">
      <div className="max-w-7xl mx-auto space-y-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Shape the helper around your workflow.</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Atoll&apos;s setup is closer to choosing a teammate than filling out a marketing wizard. Pick an identity, inspect what it seeds, and keep the control plane grounded in the way you work.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 shadow-2xl backdrop-blur lg:grid-cols-12 lg:rounded-[3rem]"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="border-b border-border/70 bg-background/90 p-6 sm:p-8 lg:col-span-4 lg:border-b-0 lg:border-r lg:p-10">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">Identity Settings</p>

            <div className="mb-8 flex items-center gap-4 rounded-[1.75rem] border border-border/70 bg-background/80 p-4">
              <img
                src={elizaHelper}
                alt=""
                aria-label="Helper avatar preview"
                className="h-16 w-16 rounded-2xl border border-border/70 bg-sky-100 object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{helperName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{currentPreset.roleTitle}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="helper-name" className="text-sm font-medium">Helper name</Label>
                <Input
                  id="helper-name"
                  value={helperName}
                  onChange={(event) => setHelperName(event.target.value)}
                  placeholder="Alex, Maya, Jordan..."
                  className="h-12 rounded-2xl border-border/70 bg-background/70"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="helper-identity" className="text-sm font-medium">Identity</Label>
                <Select value={selectedPreset} onValueChange={(value) => setSelectedPreset(value as IdentityPresetKey)}>
                  <SelectTrigger id="helper-identity" aria-label="Identity" className="h-12 rounded-2xl border-border/70 bg-background/70">
                    <SelectValue placeholder="Select an identity" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDENTITY_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose the helper&apos;s role here. The landing page mirrors Atoll&apos;s real setup flow instead of a generic personality picker.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Identity preview</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{currentPreset.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{currentPreset.category}</p>
                <p className="mt-3 text-sm text-muted-foreground">{currentPreset.summary}</p>
                <p className="mt-3 text-sm text-muted-foreground">{currentPreset.description}</p>
              </div>

              <div className="rounded-[1.75rem] border border-border/70 bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">What this changes</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Atoll uses this identity to seed the helper&apos;s initial <code>IDENTITY.md</code>, <code>SOUL.md</code>, and <code>TOOLS.md</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-background via-secondary/35 to-background p-6 sm:p-8 lg:col-span-8 lg:p-12">
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-[2rem] border border-border/70 bg-background/85 p-6 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
                  <div className="flex items-center gap-4">
                    <img
                      src={elizaHelper}
                      alt={`${helperName} avatar`}
                      className="h-20 w-20 rounded-[1.5rem] border border-border/70 bg-sky-100 object-cover"
                    />
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Helper preview</p>
                      <h3 className="mt-2 text-2xl font-semibold text-foreground">{helperName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{currentPreset.roleTitle}</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Ready to seed
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <PreviewFileCard
                    title="IDENTITY.md"
                    body={currentPreset.seedFiles.identity}
                  />
                  <PreviewFileCard
                    title="SOUL.md"
                    body={currentPreset.seedFiles.soul}
                  />
                  <PreviewFileCard
                    title="TOOLS.md"
                    body={currentPreset.seedFiles.tools}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[2rem] border border-border/70 bg-background/85 p-6 shadow-lg">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Identity skills</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentPreset.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-border/70 bg-background/85 p-6 shadow-lg">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Setup note</p>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    The best helpers feel specific. Start with a clear identity, keep the role title honest, and let Atoll carry those instructions into the runtime instead of hiding them behind marketing copy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PreviewFileCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-secondary/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
