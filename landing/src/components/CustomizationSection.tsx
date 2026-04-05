import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { identityPresets, type IdentityPresetKey } from "@/content";

export function CustomizationSection() {
  const [selectedPreset, setSelectedPreset] = useState<IdentityPresetKey>("operator");
  const [helperName, setHelperName] = useState("Eliza");
  const currentPreset = useMemo(() => identityPresets[selectedPreset], [selectedPreset]);
  const elizaHelper = `${import.meta.env.BASE_URL}images/eliza-helper.png`;

  return (
    <section id="customization" className="px-6 py-24">
      <div className="mx-auto max-w-7xl space-y-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-6 text-4xl font-bold md:text-5xl">Shape your helper to match your workflow.</h2>
          <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
            Give your helper a clear role and feel as if it was part of your team stack from the first reply.
          </p>
        </motion.div>

        <motion.div
          className="grid overflow-hidden rounded-[2rem] border border-border/70 bg-card/72 backdrop-blur lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)] lg:rounded-[3rem]"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="border-b border-border/70 bg-background/88 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">Identity Settings</p>

            <div className="mb-8 flex items-center gap-4 rounded-[1.75rem] border border-border/70 bg-background/82 p-4">
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
                <label htmlFor="helper-name" className="text-sm font-medium text-foreground">
                  Helper name
                </label>
                <input
                  id="helper-name"
                  value={helperName}
                  onChange={(event) => setHelperName(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border/80 bg-background/75 px-4 text-foreground outline-none transition-colors focus:border-primary/50"
                />
              </div>

              <div className="space-y-3">
                <label htmlFor="helper-identity" className="text-sm font-medium text-foreground">
                  Identity
                </label>
                <select
                  id="helper-identity"
                  value={selectedPreset}
                  onChange={(event) => setSelectedPreset(event.target.value as IdentityPresetKey)}
                  className="h-12 w-full rounded-2xl border border-border/80 bg-background/75 px-4 text-foreground outline-none transition-colors focus:border-primary/50"
                >
                  {Object.entries(identityPresets).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Keep the setup tight: pick a role, keep the name honest, and let Atoll adapt the helper from there.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Current identity</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{currentPreset.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{currentPreset.category}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{currentPreset.summary}</p>
              </div>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-background via-secondary/20 to-background p-6 sm:p-8 lg:p-10">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative z-10 flex h-full items-center">
              <div className="w-full rounded-[2rem] border border-border/70 bg-background/90 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-5">
                  <img
                    src={elizaHelper}
                    alt={`${helperName} avatar`}
                    className="h-20 w-20 rounded-[1.5rem] border border-border/70 bg-sky-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Helper preview</p>
                    <h3 className="mt-2 text-3xl font-semibold text-foreground">{helperName}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{currentPreset.roleTitle}</p>
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
                </div>

                <div className="mt-6 rounded-[1.75rem] border border-border/70 bg-secondary/45 p-5 sm:p-6">
                  <p className="text-sm leading-7 text-muted-foreground">{currentPreset.summary}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
