import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { ATOLL_GITHUB_URL } from "@/components/landing/constants";

export function HeroSection() {
  return (
    <section className="relative px-6 py-24 md:py-40 flex flex-col items-center text-center overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/15 via-border/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-primary/10 via-border/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Background glows */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-40 pointer-events-none">
        <div className="w-[500px] h-[500px] bg-primary rounded-full mix-blend-screen filter blur-[100px] opacity-40 absolute -translate-x-1/4" />
        <div className="w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 absolute translate-x-1/4 translate-y-1/4" />
      </div>

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        <motion.span
          className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-bold tracking-widest uppercase border border-primary/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Intelligent. Friendly. Yours.
        </motion.span>

        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Meet your next favorite{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-400">
            employee.
          </span>
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Atoll is a digital assistant that adapts to your workflow, learns your preferences, and manages the chaos so you can focus on what truly matters.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a href={ATOLL_GITHUB_URL} target="_blank" rel="noreferrer">
            <Button size="lg" className="w-full sm:w-auto px-10 py-6 rounded-full text-lg font-bold shadow-xl">
              View on GitHub
              <ArrowUpRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
