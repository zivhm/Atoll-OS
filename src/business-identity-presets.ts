import { readFileSync } from "node:fs";

export type AgentPresetCategory = string;

type BusinessIdentityPresetManifestItem = {
  id: string;
  name: string;
  description: string;
  color: string;
  category: AgentPresetCategory;
  sourceRepoUrl: string;
  sourcePath: string;
  summary: string;
  suggestedRoleTitle: string;
  recommendedSkills: string[];
};

type BusinessIdentityPresetDefinition = BusinessIdentityPresetManifestItem & {
  identity: string;
  soul: string;
  tools: string;
};

const TRUSTED_SKILLS_REPO_URL = "https://skills.sh";

const BUSINESS_IDENTITY_MANIFEST: BusinessIdentityPresetManifestItem[] = [
  {
    id: "accountant",
    name: "Accountant",
    description: "Keeps spreadsheets, financial records, and document-heavy workflows accurate and audit-friendly.",
    color: "gold",
    category: "finance",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/accountant",
    summary: "Best for bookkeeping, spreadsheet-heavy reviews, reconciliations, and document-backed finance operations.",
    suggestedRoleTitle: "Accountant focused on clean records, reliable spreadsheets, and document accuracy",
    recommendedSkills: [
      "https://skills.sh/supercent-io/skills-template/data-analysis",
      "https://skills.sh/supercent-io/skills-template/workflow-automation",
      "https://skills.sh/anthropics/skills/xlsx",
      "https://skills.sh/anthropics/skills/pdf",
      "https://skills.sh/anthropics/skills/docx"
    ]
  },
  {
    id: "sales-manager",
    name: "Sales Manager",
    description: "Owns pipeline hygiene, outbound outreach, follow-ups, and practical revenue operations.",
    color: "emerald",
    category: "sales",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/sales-manager",
    summary: "Strong default for outreach, pipeline discipline, response handling, and sales-enable workflows.",
    suggestedRoleTitle: "Sales manager focused on outreach quality, follow-through, and pipeline health",
    recommendedSkills: [
      "https://skills.sh/coreyhaines31/marketingskills/copywriting",
      "https://skills.sh/coreyhaines31/marketingskills/cold-email",
      "https://skills.sh/coreyhaines31/marketingskills/sales-enablement",
      "https://skills.sh/coreyhaines31/marketingskills/revops",
      "https://skills.sh/googleworkspace/cli/gws-gmail",
      "https://skills.sh/browser-use/browser-use/browser-use"
    ]
  },
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Handles customer communication, issue triage, reply quality, and retention-sensitive follow-up.",
    color: "sky",
    category: "support",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/customer-support",
    summary: "Useful for inbox support, issue lookup, calm customer messaging, and churn-sensitive replies.",
    suggestedRoleTitle: "Customer support operator focused on clear replies, triage, and dependable follow-through",
    recommendedSkills: [
      "https://skills.sh/googleworkspace/cli/gws-gmail",
      "https://skills.sh/supercent-io/skills-template/technical-writing",
      "https://skills.sh/anthropics/skills/internal-comms",
      "https://skills.sh/coreyhaines31/marketingskills/copy-editing",
      "https://skills.sh/browser-use/browser-use/browser-use",
      "https://skills.sh/coreyhaines31/marketingskills/churn-prevention"
    ]
  },
  {
    id: "marketing-manager",
    name: "Marketing Manager",
    description: "Shapes messaging, campaign execution, reporting, and market-facing growth work.",
    color: "rose",
    category: "marketing",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/marketing-manager",
    summary: "Best for campaign planning, messaging, creative direction, analytics, and product marketing context.",
    suggestedRoleTitle: "Marketing manager focused on messaging, campaigns, analytics, and launch quality",
    recommendedSkills: [
      "https://skills.sh/coreyhaines31/marketingskills/content-strategy",
      "https://skills.sh/coreyhaines31/marketingskills/copywriting",
      "https://skills.sh/coreyhaines31/marketingskills/marketing-psychology",
      "https://skills.sh/coreyhaines31/marketingskills/analytics-tracking",
      "https://skills.sh/coreyhaines31/marketingskills/ad-creative",
      "https://skills.sh/coreyhaines31/marketingskills/product-marketing-context",
      "https://skills.sh/coreyhaines31/marketingskills/seo-audit"
    ]
  },
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    description: "Owns social content planning, channel output, creative packaging, and lightweight reporting.",
    color: "violet",
    category: "marketing",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/social-media-manager",
    summary: "Useful for content calendars, social copy, lightweight creative production, and channel reporting.",
    suggestedRoleTitle: "Social media manager focused on content flow, channel quality, and engagement reporting",
    recommendedSkills: [
      "https://skills.sh/coreyhaines31/marketingskills/social-content",
      "https://skills.sh/coreyhaines31/marketingskills/copywriting",
      "https://skills.sh/coreyhaines31/marketingskills/marketing-ideas",
      "https://skills.sh/coreyhaines31/marketingskills/analytics-tracking",
      "https://skills.sh/anthropics/skills/canvas-design",
      "https://skills.sh/browser-use/browser-use/browser-use"
    ]
  },
  {
    id: "office-manager",
    name: "Office Manager",
    description: "Keeps admin workflows, documents, email coordination, and internal process work organized.",
    color: "amber",
    category: "operations",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/office-manager",
    summary: "Strong fit for administrative process work, docs, scheduling support, and internal coordination.",
    suggestedRoleTitle: "Office manager focused on process hygiene, documents, and internal coordination",
    recommendedSkills: [
      "https://skills.sh/supercent-io/skills-template/task-planning",
      "https://skills.sh/googleworkspace/cli/gws-drive",
      "https://skills.sh/googleworkspace/cli/gws-gmail",
      "https://skills.sh/supercent-io/skills-template/technical-writing",
      "https://skills.sh/anthropics/skills/internal-comms",
      "https://skills.sh/anthropics/skills/doc-coauthoring",
      "https://skills.sh/anthropics/skills/pdf"
    ]
  },
  {
    id: "project-manager",
    name: "Project Manager",
    description: "Coordinates scope, sequencing, owners, timelines, and progress visibility across moving work.",
    color: "cyan",
    category: "project-management",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/project-manager",
    summary: "Best for milestone planning, dependency tracking, handoffs, and execution-focused coordination.",
    suggestedRoleTitle: "Project manager focused on scope, sequencing, and execution follow-through",
    recommendedSkills: [
      "https://skills.sh/othmanadi/planning-with-files/planning-with-files",
      "https://skills.sh/supercent-io/skills-template/task-planning",
      "https://skills.sh/googleworkspace/cli/gws-calendar",
      "https://skills.sh/supercent-io/skills-template/workflow-automation",
      "https://skills.sh/anthropics/skills/doc-coauthoring",
      "https://skills.sh/obra/superpowers/writing-plans",
      "https://skills.sh/obra/superpowers/executing-plans"
    ]
  },
  {
    id: "growth-strategy",
    name: "Growth & Strategy",
    description: "Runs research, framing, packaging, and decision support for growth bets and strategy work.",
    color: "indigo",
    category: "strategy",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/growth-strategy",
    summary: "Useful for market research, positioning choices, pricing questions, launch planning, and product framing.",
    suggestedRoleTitle: "Growth strategist focused on research, positioning, pricing, and launch decisions",
    recommendedSkills: [
      "https://skills.sh/obra/superpowers/brainstorming",
      "https://skills.sh/tavily-ai/skills/search",
      "https://skills.sh/coreyhaines31/marketingskills/competitor-alternatives",
      "https://skills.sh/coreyhaines31/marketingskills/pricing-strategy",
      "https://skills.sh/coreyhaines31/marketingskills/launch-strategy",
      "https://skills.sh/github/awesome-copilot/prd",
      "https://skills.sh/coreyhaines31/marketingskills/marketing-ideas"
    ]
  },
  {
    id: "tech-web-manager",
    name: "Tech & Web Manager",
    description: "Builds, tests, audits, and maintains modern web surfaces with practical technical judgment.",
    color: "teal",
    category: "engineering",
    sourceRepoUrl: TRUSTED_SKILLS_REPO_URL,
    sourcePath: "business-identities/tech-web-manager",
    summary: "Best for implementation-heavy website work, audits, frontend quality, and ongoing web operations.",
    suggestedRoleTitle: "Technical web operator focused on build quality, audits, and site performance",
    recommendedSkills: [
      "https://skills.sh/anthropics/skills/frontend-design",
      "https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices",
      "https://skills.sh/vercel-labs/agent-skills/web-design-guidelines",
      "https://skills.sh/browser-use/browser-use/browser-use",
      "https://skills.sh/squirrelscan/skills/audit-website",
      "https://skills.sh/anthropics/skills/webapp-testing",
      "https://skills.sh/shadcn/ui/shadcn",
      "https://skills.sh/coreyhaines31/marketingskills/analytics-tracking"
    ]
  }
];

export const BUSINESS_IDENTITY_PRESETS: BusinessIdentityPresetDefinition[] =
  BUSINESS_IDENTITY_MANIFEST.map((item) => ({
    ...item,
    identity: readPresetMarkdown(item.id, "IDENTITY.md"),
    soul: readPresetMarkdown(item.id, "SOUL.md"),
    tools: readPresetMarkdown(item.id, "TOOLS.md")
  }));

function readPresetMarkdown(
  presetId: string,
  fileName: "IDENTITY.md" | "SOUL.md" | "TOOLS.md"
): string {
  return readFileSync(new URL(`./business-identities/${presetId}/${fileName}`, import.meta.url), "utf8").trimEnd();
}
