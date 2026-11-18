export interface Classification {
  is_engineering_relevant: boolean;
  relevance: number;
  summary: string;
  what_it_does: string;
  primary_category: string;
  subcategories: string[];
  lifecycle_phases: string[];
  disciplines: string[];
  career_roles: string[];
  trl: number;
  trl_rationale: string;
  learning_curve: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  cost_model: string;
  platforms: string[];
  teaching_uses: string[];
  student_project_ideas: string[];
  relations: { alternatives_to: string[]; integrates_with: string[]; built_on: string[] };
  keywords: string[];
  confidence: "low" | "medium" | "high";
}

export interface Tool {
  id: string;
  name: string;
  url: string;
  desc: string;
  home: string | null;
  lang: string | null;
  lic: string | null;
  topics: string[];
  stars: number;
  forks: number;
  created: string;
  pushed: string;
  spd: number;
  d7: number | null;
  d30: number | null;
  domains: string[];
  cls: Classification | null;
}

export interface Meta {
  generated_at: string;
  count: number;
  classified: number;
  domains: Record<string, string>;
}

interface Labeled {
  id: string;
  label: string;
  description?: string;
}

export interface Taxonomy {
  version: string;
  categories: (Labeled & { subcategories: Labeled[] })[];
  lifecycle_phases: Labeled[];
  disciplines: Labeled[];
  career_roles: Labeled[];
  trl_scale: { level: number; label: string; evidence: string }[];
  teaching_uses: Labeled[];
}

export type SortKey = "rising" | "week" | "stars" | "new" | "updated";
export type AgeKey = "all" | "90" | "365";

export interface Filters {
  q: string;
  domain: string | null;
  category: string | null;
  phase: string | null;
  discipline: string | null;
  role: string | null;
  minTrl: number;
  age: AgeKey;
  /** include tools the AI marked as not engineering-relevant */
  showOther: boolean;
}
