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

        <motion.blockquote
          className="hero-quote mx-auto max-w-4xl px-4 text-center text-[1.02rem] leading-[1.44] text-foreground/72 md:text-[1.26rem] lg:text-[1.48rem]"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          <span className="hero-quote-mark" aria-hidden="true">
            “
          </span>
          This circular type of coral reef, called an atoll, is created as a ring of coral surrounds an undersea volcano that has risen above the water&apos;s surface. Long after the volcano has receded into the ocean, the atoll remains. The habitat inside the atoll, protected from the open sea by the sturdy reef, is called a lagoon. - Luis Marden
          <span className="hero-quote-mark" aria-hidden="true">
            ”
          </span>
        </motion.blockquote>

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
