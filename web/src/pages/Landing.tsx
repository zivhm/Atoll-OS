import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CustomizationSection } from "@/components/landing/CustomizationSection";
import { IntegrationsSection } from "@/components/landing/IntegrationsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FooterSection } from "@/components/landing/FooterSection";

export default function Landing() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <LandingNav />
      <main className="pt-16">
        <HeroSection />
        <FeaturesSection />
        <CustomizationSection />
        <IntegrationsSection />
        <PricingSection />
        <FAQSection />
      </main>
      <FooterSection />
    </div>
  );
}
