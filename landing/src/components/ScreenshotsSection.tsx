import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const screenshots = [
  {
    src: "images/chat.png",
    alt: "Chat view",
    title: "Chat view",
  },
  {
    src: "images/setup-1.png",
    alt: "Helper setup",
    title: "Guided setup flow",
  },
  {
    src: "images/set-d.png",
    alt: "Helper settings",
    title: "Settings",
  },
  {
    src: "images/ids-d.png",
    alt: "Identity catalog",
    title: "Identity catalog",
  },
] as const;

export function ScreenshotsSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    const updateSelectedIndex = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    updateSelectedIndex();
    emblaApi.on("select", updateSelectedIndex);
    emblaApi.on("reInit", updateSelectedIndex);

    return () => {
      emblaApi.off("select", updateSelectedIndex);
      emblaApi.off("reInit", updateSelectedIndex);
    };
  }, [emblaApi]);

  return (
    <section id="preview" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-primary/80">
            App Preview
          </p>
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            See the it before you run it.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Swipe through the setup flow, identity catalog, settings surface, and chat from the same interface.
          </p>
        </motion.div>

        <motion.div
          role="region"
          aria-label="App screenshots"
          className="mt-14 rounded-[2.5rem] border border-border/80 bg-card/80 p-4 backdrop-blur"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="overflow-hidden rounded-[2rem]" ref={emblaRef}>
            <div className="flex">
              {screenshots.map((shot) => (
                <div key={shot.alt} className="min-w-0 flex-[0_0_100%]">
                  <img
                    src={`${import.meta.env.BASE_URL}${shot.src}`}
                    alt={shot.alt}
                    className="h-auto w-full rounded-[2rem] border border-border/70 object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {screenshots[selectedIndex]?.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Screenshot {selectedIndex + 1} of {screenshots.length}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 md:justify-end">
              <div className="flex items-center gap-2">
                {screenshots.map((shot, index) => (
                  <button
                    key={shot.alt}
                    type="button"
                    aria-label={`Go to screenshot ${index + 1}`}
                    aria-pressed={selectedIndex === index}
                    onClick={() => scrollTo(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      selectedIndex === index
                        ? "w-8 bg-primary"
                        : "w-2.5 bg-border hover:bg-primary/40"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous screenshot"
                  onClick={scrollPrev}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/75 text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next screenshot"
                  onClick={scrollNext}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/75 text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
