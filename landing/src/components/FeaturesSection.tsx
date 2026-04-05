import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { featureCards } from "@/content";
import { useTheme } from "@/hooks/use-theme";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.45,
      ease: "easeOut" as const,
    },
  }),
};

export function FeaturesSection() {
  const { theme } = useTheme();
  const backgroundImageName = theme === "dark" ? "atoll-night.png" : "atoll-day.png";
  const heroImageUrl = `${import.meta.env.BASE_URL}images/${backgroundImageName}`;

  return (
    <section id="features" className="relative z-0 overflow-hidden px-6 py-24">
      <div
        data-testid="features-background"
        className="absolute inset-0 z-0 scale-[1.03] bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="absolute inset-0 z-0 bg-background/12" />
      <div className="edge-fade-top edge-fade-strong" />
      <div className="edge-fade-bottom edge-fade-strong" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.article
              key={feature.title}
              className={`relative flex h-[25rem] flex-col justify-between overflow-hidden rounded-[3rem] p-10 ${
                feature.wide ? "lg:col-span-2" : ""
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={index}
            >
              <div className="glass-panel absolute inset-0 rounded-[3rem]" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/20 bg-background/30">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-4 text-2xl font-bold text-foreground">{feature.title}</h3>
                  <p className="leading-relaxed text-foreground/90">{feature.description}</p>
                </div>
                {feature.href ? (
                  <FeatureLink href={feature.href}>
                    {feature.linkLabel} <ArrowRight className="h-4 w-4" />
                  </FeatureLink>
                ) : null}
              </div>
            </motion.article>
          ))}
          <div
            data-testid="features-spacer"
            aria-hidden="true"
            className="hidden h-[25rem] rounded-[3rem] opacity-0 pointer-events-none lg:block lg:col-span-2"
          />
        </div>
      </div>
    </section>
  );
}

function FeatureLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  return (
    <a
      href={href}
      className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-bold text-primary"
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}
