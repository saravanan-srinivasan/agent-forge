import { Compass, Telescope, BarChart3, Bot } from 'lucide-react';

// Frontend mirror of backend agent roster — for UI rendering before backend responds.
export const AGENTS = {
  planner: {
    role: 'planner',
    name: 'ATLAS',
    title: 'Strategic Planner',
    description: 'Decomposes complex problems into ordered sub-tasks. Routes work to the right specialist.',
    color: '#fbbf24',
    rgb: '251, 191, 36',
    icon: Compass,
    glyph: '⊕',
    tools: ['task_decomposition'],
    bg: 'rgba(251, 191, 36, 0.06)',
  },
  researcher: {
    role: 'researcher',
    name: 'ORION',
    title: 'Information Gatherer',
    description: 'Fetches real-time data from external sources. Verifies facts, gathers evidence.',
    color: '#4ade80',
    rgb: '74, 222, 128',
    icon: Telescope,
    glyph: '⟁',
    tools: ['web_search', 'fetch_url', 'knowledge_base'],
    bg: 'rgba(74, 222, 128, 0.06)',
  },
  analyst: {
    role: 'analyst',
    name: 'VEGA',
    title: 'Insight Synthesizer',
    description: 'Synthesizes findings, computes metrics, produces actionable recommendations.',
    color: '#60a5fa',
    rgb: '96, 165, 250',
    icon: BarChart3,
    glyph: '◊',
    tools: ['calculator', 'compare', 'summarize'],
    bg: 'rgba(96, 165, 250, 0.06)',
  },
};

export const AGENT_ORDER = ['planner', 'researcher', 'analyst'];

export const FALLBACK_AGENT = {
  name: 'AGENT',
  color: '#94a3b8',
  rgb: '148, 163, 184',
  icon: Bot,
  glyph: '○',
};

export function agentOf(role) {
  return AGENTS[role] || FALLBACK_AGENT;
}

// Tool icon mapping
import { Search, Globe, BookOpen, Calculator, GitCompare, FileText, Layers } from 'lucide-react';
export const TOOL_ICONS = {
  web_search:     Search,
  fetch_url:      Globe,
  knowledge_base: BookOpen,
  calculator:     Calculator,
  compare:        GitCompare,
  summarize:      FileText,
};

export function toolIcon(name) { return TOOL_ICONS[name] || Layers; }
