import type { ProviderAdapter } from "./types";
import type { ProviderSlug } from "./catalog";
import { jiraAdapter } from "./providers/jira";
import { githubAdapter } from "./providers/github";
import { slackAdapter } from "./providers/slack";
import { linearAdapter } from "./providers/linear";
import { gitlabAdapter } from "./providers/gitlab";
import { airtableAdapter } from "./providers/airtable";
import { bitbucketAdapter } from "./providers/bitbucket";
import { azureDevopsAdapter } from "./providers/azuredevops";
import { clickupAdapter } from "./providers/clickup";
import { notionAdapter } from "./providers/notion";
import { teamsAdapter } from "./providers/teams";
import { discordAdapter } from "./providers/discord";
import {
  anthropicAdapter,
  openaiAdapter,
  geminiAdapter,
  copilotAdapter,
} from "./providers/ai";

// Only implemented adapters live here. Catalog entries with enabled:false have
// no adapter yet (they render as "próximamente" in the UI).
const ADAPTERS: Partial<Record<ProviderSlug, ProviderAdapter>> = {
  jira: jiraAdapter,
  github: githubAdapter,
  slack: slackAdapter,
  linear: linearAdapter,
  gitlab: gitlabAdapter,
  airtable: airtableAdapter,
  bitbucket: bitbucketAdapter,
  "azure-devops": azureDevopsAdapter,
  clickup: clickupAdapter,
  notion: notionAdapter,
  teams: teamsAdapter,
  discord: discordAdapter,
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  copilot: copilotAdapter,
};

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return ADAPTERS[slug as ProviderSlug];
}
