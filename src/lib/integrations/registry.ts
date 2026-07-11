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
// Project Planning & Portfolio
import { trelloAdapter } from "./providers/trello";
import { asanaAdapter } from "./providers/asana";
import { mondayAdapter } from "./providers/monday";
import { shortcutAdapter } from "./providers/shortcut";
import { wrikeAdapter } from "./providers/wrike";
import { teamworkAdapter } from "./providers/teamwork";
import { smartsheetAdapter } from "./providers/smartsheet";
import { zohoProjectsAdapter } from "./providers/zoho-projects";
import { basecampAdapter } from "./providers/basecamp";
import { azureBoardsAdapter } from "./providers/azureboards";
import { jiraAlignAdapter } from "./providers/jira-align";
import { jiraRoadmapsAdapter } from "./providers/jira-roadmaps";
import { msPlannerAdapter } from "./providers/ms-planner";
import { msProjectAdapter } from "./providers/ms-project";
import { primaveraAdapter } from "./providers/primavera";

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
  // Project Planning & Portfolio
  trello: trelloAdapter,
  asana: asanaAdapter,
  monday: mondayAdapter,
  shortcut: shortcutAdapter,
  wrike: wrikeAdapter,
  teamwork: teamworkAdapter,
  smartsheet: smartsheetAdapter,
  "zoho-projects": zohoProjectsAdapter,
  basecamp: basecampAdapter,
  "azure-boards": azureBoardsAdapter,
  "jira-align": jiraAlignAdapter,
  "jira-roadmaps": jiraRoadmapsAdapter,
  "ms-planner": msPlannerAdapter,
  "ms-project": msProjectAdapter,
  primavera: primaveraAdapter,
};

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return ADAPTERS[slug as ProviderSlug];
}
