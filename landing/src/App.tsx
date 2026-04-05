import { FooterSection } from "@/components/FooterSection";
import { HeroSection } from "@/components/HeroSection";
import { LandingNav } from "@/components/LandingNav";
import { FAQSection } from "@/components/FAQSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { CustomizationSection } from "@/components/CustomizationSection";
import { ThemeProvider } from "@/hooks/use-theme";

export default function App() {
  return (
    <ThemeProvider>
      <div id="top" className="min-h-screen bg-background text-foreground">
        <LandingNav />
        <main className="pt-16">
          <HeroSection />
          <FeaturesSection />
          <CustomizationSection />
          <FAQSection />
        </main>
        <FooterSection />
      </div>
    </ThemeProvider>
  );
}
