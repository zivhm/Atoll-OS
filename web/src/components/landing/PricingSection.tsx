import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const plans = [
  {
    name: "Personal",
    price: "$0",
    description: "Elevate your personal productivity with the standard Atoll suite.",
    features: ["Standard Neural Processing", "5 Core App Integrations", "Single Identity Profile"],
    cta: "Begin Now",
    highlight: false,
  },
  {
    name: "Professional",
    price: "$24",
    description: "For the high-performance professional and growing remote teams.",
    features: ["Advanced Persona Dynamics", "Unlimited Integrations", "Priority Cognitive Latency", "Dedicated Priority Support"],
    cta: "Experience Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Custom fine-tuned intelligence for global enterprise operations.",
    features: ["On-Premise Deployment", "Private LLM Nodes", "Custom Data Governance"],
    cta: "Contact Relations",
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Choose Your Tier.</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Unrivaled digital capability, scaled to your ambition and workflow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`p-10 rounded-[2rem] border flex flex-col transition-all duration-300 hover:-translate-y-2 ${
                plan.highlight
                  ? "border-2 border-primary bg-foreground/5 relative lg:scale-105 shadow-2xl shadow-primary/10 z-10"
                  : "bg-card border-border"
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i + 1}
            >
              {plan.highlight && (
                <Badge className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest shadow-lg rounded-full">
                  Most Popular
                </Badge>
              )}
              <div>
                <h3 className="text-2xl font-bold mb-3">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-10 leading-relaxed">{plan.description}</p>
                <div className="flex items-baseline gap-2 mb-10">
                  <span className="text-5xl font-bold tracking-tighter">{plan.price}</span>
                  {plan.price !== "Custom" && <span className="text-muted-foreground font-medium">/mo</span>}
                </div>
                <ul className="space-y-5 mb-12">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-4 text-sm font-medium">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/dashboard" className="mt-auto block">
                <Button
                  className={`w-full rounded-2xl py-6 font-bold ${plan.highlight ? "shadow-xl" : ""}`}
                  variant={plan.highlight ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
