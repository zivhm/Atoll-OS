import {
  BarChart3,
  Globe,
  MessageSquareText,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { ATOLL_GITHUB_URL } from "@/constants";

export const featureCards = [
  {
    icon: Zap,
    title: "The Quick Deployer",
    description:
      "Spin up fully configured AI agents in minutes. Define goals, connect tools, and let Atoll handle the orchestration end-to-end.",
    linkLabel: "See how it works",
    href: "#customization",
  },
  {
    icon: MessageSquareText,
    title: "Conversational Intelligence",
    description:
      "Atoll understands context, remembers past interactions, and adapts its responses to match your communication style and business needs.",
    wide: true,
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description:
      "Track agent accuracy, task completion rates, lifecycle health, and operator-visible logs so you can see exactly what the control plane is doing.",
    linkLabel: "Browse the repo",
    href: ATOLL_GITHUB_URL,
  },
  {
    icon: Globe,
    title: "Multi-Channel Reach",
    description:
      "Deploy agents across Slack, email, web chat, and APIs. One agent, every channel with consistent quality and operator-visible behavior.",
  },
  {
    icon: ShieldCheck,
    title: "Operator-Visible Security",
    description:
      "Atoll emphasizes explicit access controls, runtime diagnostics, and self-hosted configuration ownership so operators can verify real behavior.",
  },
] as const;

export const identityPresets = {
  operator: {
    name: "Operator Companion",
    category: "Control Plane",
    summary:
      "A calm helper for runtime operations, runbooks, and incident follow-through.",
    roleTitle: "Operator-first control plane copilot",
    skills: ["Runbook drafting", "Runtime health triage", "Change summaries"],
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
    question: "Is Atoll self-hostable?",
    answer:
      "Yes. The repo is built around operator-visible runtime ownership, explicit credentials, and local-first workflows.",
  },
  {
    question: "Does setup need a long workflow?",
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
