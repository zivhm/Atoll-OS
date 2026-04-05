import { motion } from "framer-motion";
import { Zap, MessageSquareText, BarChart3, Globe, ShieldCheck, ArrowRight } from "lucide-react";
import { ATOLL_GITHUB_URL } from "@/components/landing/constants";

const features = [
  {
    icon: Zap,
    title: "The Quick Deployer",
    description: "Spin up fully configured AI agents in minutes. Define goals, connect tools, and let Atoll handle the orchestration end-to-end.",
    link: "See how it works",
    href: "#customization",
  },
  {
    icon: MessageSquareText,
    title: "Conversational Intelligence",
    description: "Atoll understands context, remembers past interactions, and adapts its responses to match your communication style and business needs.",
    link: "",
    wide: true,
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Track agent accuracy, task completion rates, lifecycle health, and operator-visible logs so you can see exactly what the control plane is doing.",
    link: "Browse the repo",
    href: ATOLL_GITHUB_URL,
  },
  {
    icon: Globe,
    title: "Multi-Channel Reach",
    description: "Deploy agents across Slack, email, web chat, and APIs. One agent, every channel — with consistent quality and brand voice.",
  },
  {
    icon: ShieldCheck,
    title: "Operator-Visible Security",
    description: "Atoll emphasizes explicit access controls, runtime diagnostics, and self-hosted configuration ownership so operators can verify real behavior.",
    link: "",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export function FeaturesSection() {
  const heroImageUrl = `${import.meta.env.BASE_URL}images/atoll-hero.png`;

  return (
    <section
      id="features"
      className="px-6 py-24 relative overflow-hidden"
    >
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="absolute inset-0 bg-background/20" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className={`group h-[400px] p-10 rounded-[3rem] flex flex-col justify-between relative overflow-hidden ${
                feature.wide ? "lg:col-span-2" : ""
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
              whileHover={{ 
                y: -8,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
            >
              {/* Glass backdrop */}
              <div 
                className="absolute inset-0 rounded-[3rem] backdrop-blur-2xl bg-background/10 border border-border/20"
                style={{
                  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 60px rgba(0, 0, 0, 0.3)"
                }}
              />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl backdrop-blur-md bg-background/30 border border-border/20">
                    <feature.icon className="h-7 w-7 text-primary drop-shadow-lg" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground drop-shadow-lg">{feature.title}</h3>
                  <p className="text-foreground/90 leading-relaxed drop-shadow-md">{feature.description}</p>
                </div>
                {feature.link && (
                  <FeatureLink href={feature.href}>
                    {feature.link} <ArrowRight className="h-4 w-4" />
                  </FeatureLink>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureLink({ href, children }: { href?: string; children: React.ReactNode }) {
  const className =
    "mt-6 inline-flex w-fit items-center gap-2 text-sm font-bold text-primary transition-transform drop-shadow-lg group-hover:translate-x-1";

  if (!href) {
    return null;
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

