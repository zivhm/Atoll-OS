import { motion } from "framer-motion";
import { TrendingUp, Code2, Megaphone, BarChart3, LucideIcon, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AGENT_PRESETS = {
  sales: {
    name: "Revenue Accelerator",
    defaultAgentName: "Atlas",
    tone: "Energetic",
    color: "bg-primary",
    icon: TrendingUp,
    greeting: "Good morning! I've analyzed this quarter's pipeline and identified 3 high-value opportunities. Ready to dive in?",
    response: "Perfect. I'll prioritize the enterprise deal and draft personalized outreach for the C-suite contacts. Keeping it energetic and value-focused.",
    knowledgeFocus: ["Sales Methodology", "Pipeline Analysis", "CRM Optimization"],
  },
  developer: {
    name: "Engineering Copilot",
    defaultAgentName: "Axiom",
    tone: "Minimalist",
    color: "bg-indigo-500",
    icon: Code2,
    greeting: "Morning. Found a performance bottleneck in the API layer. I've prepared optimization suggestions with benchmarks.",
    response: "Got it. I'll refactor the query batching logic and run tests. Documentation will be technical and concise.",
    knowledgeFocus: ["Code Architecture", "System Design", "DevOps"],
  },
  social: {
    name: "Brand Catalyst",
    defaultAgentName: "Echo",
    tone: "Approachable",
    color: "bg-rose-500",
    icon: Megaphone,
    greeting: "Hey! Your latest post is trending—engagement is up 40%. I've drafted follow-up content to keep the momentum going.",
    response: "Love it! I'll schedule those posts and add some engaging visuals. Tone will be friendly and conversational throughout.",
    knowledgeFocus: ["Content Strategy", "Audience Growth", "Brand Voice"],
  },
  analyst: {
    name: "Strategic Advisor",
    defaultAgentName: "Cipher",
    tone: "Professional",
    color: "bg-emerald-500",
    icon: BarChart3,
    greeting: "Good morning. I've prepared a high-level briefing of today's market shifts. I also noticed a meeting conflict for 2 PM — should I resolve it?",
    response: "That would be excellent. Please prioritize the stakeholder call and reschedule the internal sync. Keep the tone formal for the outreach.",
    knowledgeFocus: ["Financial Modeling", "Market Intelligence", "Risk Analysis"],
  },
};

type ToneOption = "Approachable" | "Professional" | "Minimalist" | "Energetic";

export function CustomizationSection() {
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof AGENT_PRESETS>("analyst");
  const [tone, setTone] = useState<ToneOption>("Professional");
  const [avatarColor, setAvatarColor] = useState("bg-emerald-500");
  const [agentName, setAgentName] = useState("Cipher");
  const [knowledgeFocus, setKnowledgeFocus] = useState<string[]>([
    "Financial Modeling",
    "Market Intelligence",
    "Risk Analysis",
  ]);

  const handlePresetChange = (preset: keyof typeof AGENT_PRESETS) => {
    setSelectedPreset(preset);
    const presetData = AGENT_PRESETS[preset];
    setTone(presetData.tone as ToneOption);
    setAvatarColor(presetData.color);
    setAgentName(presetData.defaultAgentName);
    setKnowledgeFocus(presetData.knowledgeFocus);
  };

  const currentPreset = AGENT_PRESETS[selectedPreset];
  const AgentIcon = currentPreset.icon;

  return (
    <section id="customization" className="px-6 py-24">
      <div className="max-w-7xl mx-auto space-y-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Designed by you. For you.</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Customizing Atoll is as simple as describing a friend. Tailor the tone, appearance, and knowledge base instantly.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 rounded-[2rem] lg:rounded-[3rem] overflow-hidden border border-border shadow-2xl"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {/* Left Panel: Controls */}
          <div className="lg:col-span-4 bg-secondary p-6 sm:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 lg:mb-10">Identity Settings</h4>
            <div className="space-y-6 lg:space-y-10">
              <div className="space-y-3 lg:space-y-4">
                <Label htmlFor="agent-preset" className="text-sm font-bold uppercase tracking-wider">Agent Preset</Label>
                <Select value={selectedPreset} onValueChange={(value) => handlePresetChange(value as keyof typeof AGENT_PRESETS)}>
                  <SelectTrigger id="agent-preset" className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">{AGENT_PRESETS.sales.name}</SelectItem>
                    <SelectItem value="developer">{AGENT_PRESETS.developer.name}</SelectItem>
                    <SelectItem value="social">{AGENT_PRESETS.social.name}</SelectItem>
                    <SelectItem value="analyst">{AGENT_PRESETS.analyst.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 lg:space-y-4">
                <Label htmlFor="agent-name" className="text-sm font-bold uppercase tracking-wider">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter agent name"
                  className="w-full"
                />
              </div>

              <div className="space-y-3 lg:space-y-4">
                <label className="block text-sm font-bold uppercase tracking-wider">Tone of Voice</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {(["Approachable", "Professional", "Minimalist", "Energetic"] as ToneOption[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl text-[12px] lg:text-[13px] font-bold transition-all ${
                        tone === t
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "bg-card border border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 lg:space-y-4">
                <label className="block text-sm font-bold uppercase tracking-wider">Avatar Style</label>
                <div className="flex gap-3 lg:gap-4">
                  {[
                    { color: "bg-primary", label: "Primary" },
                    { color: "bg-indigo-500", label: "Indigo" },
                    { color: "bg-rose-500", label: "Rose" },
                    { color: "bg-emerald-500", label: "Emerald" },
                  ].map((avatar) => (
                    <button
                      key={avatar.color}
                      onClick={() => setAvatarColor(avatar.color)}
                      className={`w-10 h-10 lg:w-12 lg:h-12 ${avatar.color} rounded-full border hover:scale-110 transition-transform cursor-pointer ${
                        avatarColor === avatar.color
                          ? "border-4 border-card ring-2 ring-primary shadow-lg"
                          : "border-border opacity-50"
                      }`}
                      aria-label={`Select ${avatar.label} color`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3 lg:space-y-4">
                <Label className="text-sm font-bold uppercase tracking-wider">Knowledge Focus</Label>
                <div className="space-y-2">
                  {knowledgeFocus.map((focus, index) => (
                    <div
                      key={focus}
                      className="p-3 lg:p-4 bg-card rounded-xl lg:rounded-2xl border border-primary/50 flex items-center justify-between"
                    >
                      <span className="text-xs lg:text-sm font-medium">{focus}</span>
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Chat Demo */}
          <div className="lg:col-span-8 bg-card p-6 sm:p-10 lg:p-20 relative overflow-hidden flex items-center justify-center">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
            <div className="w-full max-w-lg space-y-6 lg:space-y-8 relative z-10">
              <div className="flex items-center gap-4 lg:gap-5 mb-6 lg:mb-10">
                <div className="relative">
                  <div className={`w-14 h-14 lg:w-20 lg:h-20 ${avatarColor} rounded-xl lg:rounded-[1.5rem] flex items-center justify-center shadow-xl transition-all duration-300`}>
                    <AgentIcon className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 lg:-bottom-2 lg:-right-2 w-5 h-5 lg:w-6 lg:h-6 bg-green-500 rounded-full border-[3px] lg:border-4 border-card" />
                </div>
                <div>
                  <h3 className="text-2xl lg:text-3xl font-bold mb-1">{agentName}</h3>
                  <p className="text-primary font-bold text-[10px] lg:text-xs uppercase tracking-widest">Active • {tone}</p>
                </div>
              </div>

              <div className="space-y-4 lg:space-y-6">
                <div className="p-4 lg:p-6 bg-secondary rounded-2xl lg:rounded-3xl rounded-tl-none mr-8 lg:mr-16 border border-border shadow-md">
                  <p className="text-[13px] lg:text-[15px] leading-relaxed italic text-foreground/80">
                    "{currentPreset.greeting}"
                  </p>
                </div>
                <div 
                  className={`p-4 lg:p-6 ${avatarColor} text-white rounded-2xl lg:rounded-3xl rounded-tr-none ml-8 lg:ml-16 shadow-lg font-medium transition-all duration-300`}
                >
                  <p className="text-[13px] lg:text-[15px] leading-relaxed">
                    "{currentPreset.response}"
                  </p>
                </div>
                <div className="p-4 lg:p-6 bg-secondary rounded-2xl lg:rounded-3xl rounded-tl-none mr-8 lg:mr-16 border border-border shadow-md w-max">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${avatarColor} rounded-full animate-bounce`} />
                    <div className={`w-2 h-2 ${avatarColor} rounded-full animate-bounce`} style={{ animationDelay: "0.2s" }} />
                    <div className={`w-2 h-2 ${avatarColor} rounded-full animate-bounce`} style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
