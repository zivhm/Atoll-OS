import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

/* Simple brand SVG icons for the logo grid */
const LogoSlack = () => (
  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.527 2.527 0 0 1 0 8.834a2.527 2.527 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z"/>
  </svg>
);

const LogoStripe = () => (
  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.19l-.893 5.575C4.746 22.758 7.536 24 11.35 24c2.594 0 4.715-.64 6.238-1.825 1.637-1.27 2.477-3.168 2.477-5.548 0-4.1-2.508-5.793-6.089-7.477z"/>
  </svg>
);

const LogoNotion = () => (
  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.29 2.14c-.466-.373-.746-.653-2.428-.466l-12.47.56c-.466.046-.56.28-.373.466l1.44 1.508zm.793 3.172v13.869c0 .746.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.166V6.54c0-.606-.233-.933-.746-.886l-15.177.84c-.56.047-.747.327-.747.886zm14.337.42c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.233-1.494-.933l-4.573-7.186v6.952l1.447.327s0 .84-1.168.84l-3.219.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.037 9.76c-.093-.42.14-1.026.793-1.073l3.452-.233 4.76 7.279V9.201l-1.214-.14c-.093-.513.28-.886.746-.933l3.219-.186z"/>
  </svg>
);

const LogoShopify = () => (
  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
    <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.206-.192s-1.929-.136-1.929-.136-.946-.943-1.281-1.278c-.07.02-.148.04-.238.064l-.727 13.418L15.337 23.979zM11.065 7.478c-.455.135-.954.282-1.477.437.282-1.08.814-2.152.988-2.605.444.836.6 1.51.489 2.168zm1.668-3.024c.334.623.551 1.5.331 2.418l-.04.014V6.82c-.394-1.26-.06-2.108.709-2.366zM13.476 3.39c.105 0 .21.016.313.05-1.09.513-2.262 1.805-2.754 4.389-1.029.305-2.035.603-2.985.885C8.68 6.293 9.945 3.39 13.476 3.39zM14.96 6.563c-.003.016-.007.03-.01.046l-.157.047c-.004-.14-.014-.29-.03-.446.07.1.135.218.197.353zm.596 1.357l-.603.178c-.074-.573-.273-1.253-.6-1.81.65.087.974.9 1.203 1.632zm2.185-1.395c-.074 0-.134.037-.197.037s-2.019.462-2.019.462a4.592 4.592 0 0 0-1.627-2.426c1.595.044 2.647.487 3.135 1.26.248.393.533.667.708.667z"/>
  </svg>
);

export function TestimonialsSection() {
  return (
    <section className="px-6 py-24 bg-card">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-12">
            <motion.h2
              className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              Endorsed by the world's most innovative minds.
            </motion.h2>

            <div className="space-y-6">
              <motion.div
                className="p-8 bg-secondary rounded-[2rem] border border-border hover:border-primary/30 transition-colors duration-300 flex flex-col gap-6"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={1}
              >
                <Quote className="h-8 w-8 text-border" />
                <p className="text-lg leading-relaxed italic">
                  "Atoll isn't just a tool; it's a cognitive force multiplier. It has completely redefined how our design studio operates daily."
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-14 h-14 rounded-full bg-primary/20 border border-border flex items-center justify-center text-sm font-bold text-primary">
                    XS
                  </div>
                  <div>
                    <p className="font-bold">Xavier Sterling</p>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">CDO, Obsidian Creative</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="p-8 bg-secondary rounded-[2rem] border border-border hover:border-primary/30 transition-colors duration-300 flex flex-col gap-6 md:ml-12"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={2}
              >
                <Quote className="h-8 w-8 text-border" />
                <p className="text-lg leading-relaxed italic">
                  "The localization features alone saved us countless hours. Atoll writes in 5 languages perfectly matching our brand voice."
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-14 h-14 rounded-full bg-primary/20 border border-border flex items-center justify-center text-sm font-bold text-primary">
                    ER
                  </div>
                  <div>
                    <p className="font-bold">Elena Rostova</p>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">VP Operations, GlobalNet</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Logo grid with real SVGs */}
          <div className="grid grid-cols-2 gap-6 md:pl-10">
            <div className="space-y-6 pt-12">
              {[
                { name: "Stripe", Logo: LogoStripe },
                { name: "Notion", Logo: LogoNotion },
              ].map(({ name, Logo }) => (
                <div key={name} className="aspect-square bg-secondary rounded-[2rem] border border-border flex flex-col items-center justify-center gap-3 p-10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 text-muted-foreground/50">
                  <Logo />
                  <span className="text-sm font-bold">{name}</span>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              {[
                { name: "Slack", Logo: LogoSlack },
                { name: "Shopify", Logo: LogoShopify },
              ].map(({ name, Logo }) => (
                <div key={name} className="aspect-square bg-secondary rounded-[2rem] border border-border flex flex-col items-center justify-center gap-3 p-10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 text-muted-foreground/50">
                  <Logo />
                  <span className="text-sm font-bold">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
