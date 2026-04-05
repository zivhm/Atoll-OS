import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { ATOLL_GITHUB_URL } from "@/constants";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center overflow-hidden px-6 py-24 text-center md:py-40">
      <div className="edge-fade-top" />
      <div className="edge-fade-bottom" />

      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-45">
        <div className="absolute h-[32rem] w-[32rem] -translate-x-1/4 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute h-[30rem] w-[30rem] translate-x-1/4 translate-y-1/4 rounded-full bg-amber-300/18 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-8">
        <motion.span
          className="inline-block rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-primary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          Intelligent. Friendly. Yours.
        </motion.span>

        <motion.h1
          className="text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          Meet your next favorite{" "}
          <span className="bg-gradient-to-r from-primary via-emerald-500 to-amber-400 bg-clip-text text-transparent">
            employee.
          </span>
        </motion.h1>

        <motion.p
          className="mx-auto max-w-2xl text-xl leading-relaxed text-muted-foreground md:text-2xl"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          An atoll is a ring-shaped island that creates a calm, a protected space in the middle of the ocean. <br /> Atoll creates that for your helpers, handling the setup and keeping everything running, so you can focus on your work.
        </motion.p>

        <motion.div
          className="flex items-center justify-center pt-8"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }}
        >
          <a
            href={ATOLL_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-10 py-5 text-lg font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            View on GitHub
            <ArrowUpRight className="h-5 w-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
