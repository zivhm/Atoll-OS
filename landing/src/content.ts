import {
  Globe,
  type LucideIcon,
  MessageSquareText,
  Zap,
} from "lucide-react";

export interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  wide?: boolean;
}

export const featureCards: FeatureCard[] = [
  {
    icon: Zap,
    title: "Quick Agent Setup",
    description:
      "Spin up fully configured AI agents in minutes. Define goals, connect tools, and let Atoll handle the orchestration end-to-end.",
    linkLabel: "See how it works",
    href: "#customization",
  },
  {
    icon: MessageSquareText,
    title: "Conversational Intelligence",
    description:
      "Your helpers understands context, remembers past interactions, and adapts its responses to match your communication style and business needs. ",
  },
  {
    icon: Globe,
    title: "Multi-Channel Reach",
    description:
      "Deploy agents across Telegram, email, web chat, and APIs.",
  },
] as const;

export const identityPresets = {
  operator: {
    name: "Operation Manager",
    category: "Operations",
    summary:
      "A dedicated assistant for managing operational tasks and workflows.",
    roleTitle: "Operations-first copilot",
    skills: ["Runbook drafting", "Fleet runtime monitoring", "Scheduling tasks"],
  },
  strategist: {
    name: "Strategic Advisor",
    category: "Planning",
    summary:
      "Synthesizes context into decisions, follow-ups, and concise executive notes.",
    roleTitle: "Decision-support and planning partner",
    skills: ["Decision briefs", "Meeting prep", "Stakeholder follow-through"],
  },
  builder: {
    name: "Engineering Copilot",
    category: "Delivery",
    summary:
      "Targets implementation details, codebase constraints, and shipping discipline.",
    roleTitle: "Repo-grounded implementation copilot",
    skills: ["Spec to code", "Regression hunts", "Release hygiene"],
  },
} as const;

export const faqs = [
  {
    question: "Is Atoll a paid service?",
    answer:
      "No. The repo is built to be easy to self host and manage, No costs, No strings attached.",
  },
  {
    question: "How does Atoll stay observable?",
    answer:
      "It keeps runtime behavior close to the operator: health signals, tool activity, and helper state are meant to stay inspectable instead of disappearing behind a black box.",
  },
  {
    question: "Can the helper work across channels?",
    answer:
      "Yes. Atoll is designed so one helper can carry the same identity and operational posture across chat surfaces, APIs, and internal workflows.",
  },
  {
    question: "Do I need any technical knowledge to use Atoll?",
    answer:
      "No. The landing keeps setup minimal on purpose: name the helper, pick the operating posture, and start from a clear identity.",
  },
  {
    question: "What is the main use case right now?",
    answer:
      "Running helpers with real operational context, predictable tools, and observable runtime behavior instead of generic chat personas.",
  },
] as const;

export type IdentityPresetKey = keyof typeof identityPresets;
