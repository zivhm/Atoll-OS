import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative px-6 py-24 md:py-40 flex flex-col items-center text-center overflow-hidden">
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
          <Link to="/dashboard">
            <Button size="lg" className="w-full sm:w-auto px-10 py-6 rounded-full text-lg font-bold shadow-xl">
              Open Dashboard
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-10 py-6 rounded-full text-lg font-bold gap-3 group">
              Watch the Film
              <Play className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
