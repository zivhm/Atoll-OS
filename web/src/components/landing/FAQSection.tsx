import { useState } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Sovereignty of Private Data?",
    answer: "Your data remains entirely your own. We utilize local-first processing and zero-knowledge encryption to ensure your business intelligence stays private and never trains global models.",
  },
  {
    question: "Multi-Lingual Capabilities?",
    answer: "Atoll is currently proficient in 94 global languages, offering native-level nuance and localized cultural context for seamless international operations.",
  },
  {
    question: "Scalability for Teams?",
    answer: "Our architecture allows for seamless deployment across entire organizations with role-based cognitive permissions, custom context sharing, and admin oversight.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 py-24 scroll-mt-24">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">Common Questions</h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="p-8 rounded-[2.5rem] border border-border bg-card hover:border-primary/30 transition-colors duration-300 group"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between text-left font-bold text-xl transition-colors"
              >
                <span>{faq.question}</span>
                <Plus
                  className={`h-6 w-6 text-muted-foreground group-hover:text-primary transition-all duration-300 flex-shrink-0 ${
                    openIndex === i ? "rotate-45" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="pt-6 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
