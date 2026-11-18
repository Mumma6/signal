import "server-only";
import type { Edition } from "../types";
import { editionSchema } from "../schemas";
import preview from "./snapshot.json";
const radarProjects = [
  {
    name: "ollama/ollama",
    reason:
      "A practical starting point for running models locally, with a straightforward developer API.",
  },
  {
    name: "ggml-org/llama.cpp",
    reason: "Follow the inference engine behind a broad ecosystem of local AI applications.",
  },
  {
    name: "huggingface/transformers",
    reason: "Track model support and the tooling that turns research releases into usable code.",
  },
  {
    name: "vllm-project/vllm",
    reason: "Worth following if you serve open models and care about inference efficiency.",
  },
];

// Hand-edited historical examples, never passed off as today's generated news.
export const historicalEdition: Edition = {
  id: "sample-2025-04-30",
  date: "2025-04-30",
  sample: true,
  partial: false,
  title: "Open models. New reasoning. More possibilities.",
  description: "A look back at the ideas and releases that shaped April 2025.",
  publishedAt: "2025-04-30T06:00:00.000Z",
  reports: [],
  outcomes: {
    collected: 5,
    duplicates: 0,
    invalid: 0,
    evaluated: 5,
    selected: 5,
    rejected: 0,
    summaries: 5,
    sourcesUnavailable: 0,
    repositories: 4,
    releaseFailures: 0,
    summaryFailures: 0,
  },
  stories: [
    {
      id: "qwen3",
      title: "Qwen3 brings hybrid reasoning to open-weight AI",
      url: "https://qwenlm.github.io/blog/qwen3/",
      sourceName: "Qwen",
      publishedAt: "2025-04-29T00:00:00.000Z",
      category: "Models",
      summary:
        "Qwen released a family of open-weight models that can switch between deliberate reasoning and faster responses. The lineup includes dense and mixture-of-experts architectures, with weights available under Apache 2.0.",
      whyItMatters:
        "Developers get more control over the trade-off between reasoning depth, latency, and compute, with models they can run on their own infrastructure.",
      evidence: ["We are open-weighting two MoE models"],
    },
    {
      id: "openai-reasoning",
      title: "OpenAI gives its reasoning models a full set of tools",
      url: "https://openai.com/index/introducing-o3-and-o4-mini/",
      sourceName: "OpenAI",
      publishedAt: "2025-04-16T00:00:00.000Z",
      category: "Models",
      summary:
        "At their April launch, o3 and o4-mini combined reasoning with tools in ChatGPT, including web search, Python, and image analysis. OpenAI positioned o4-mini as a smaller, more cost-efficient option.",
      whyItMatters:
        "Reasoning becomes more useful when a model can check information and perform calculations along the way. Tool selection is increasingly part of the model's job.",
      evidence: ["our reasoning models can agentically use and combine every tool within ChatGPT"],
    },
    {
      id: "a2a",
      title: "Google proposes a common language for AI agents",
      url: "https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/",
      sourceName: "Google Developers",
      publishedAt: "2025-04-09T00:00:00.000Z",
      category: "Developer tools",
      summary:
        "Google introduced Agent2Agent, an open protocol for agents built with different vendors and frameworks to collaborate. The announcement brought together technology partners and service providers around interoperability.",
      whyItMatters:
        "A shared protocol could make it easier to connect specialized agents without tightly coupling every system to a single framework or provider.",
      evidence: ["we’re launching a new, open protocol called Agent2Agent (A2A)"],
    },
    {
      id: "llama4",
      title: "Meta’s Llama 4 makes multimodality part of the architecture",
      url: "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
      sourceName: "Meta AI",
      publishedAt: "2025-04-05T00:00:00.000Z",
      category: "Open source",
      summary:
        "Meta introduced Llama 4 Scout and Maverick, open-weight models built with mixture-of-experts architectures and native multimodal capabilities. The models use Meta’s custom license, which developers should review before deployment.",
      whyItMatters:
        "More deployable multimodal models expand the options for applications that combine images and text. Open weights still come with distinct licensing and hardware considerations.",
      evidence: ["We’re sharing the first models in the Llama 4 herd"],
    },
    {
      id: "claude-research",
      title: "Claude connects research to your working context",
      url: "https://www.anthropic.com/news/research",
      sourceName: "Anthropic",
      publishedAt: "2025-04-15T00:00:00.000Z",
      category: "Industry",
      summary:
        "Anthropic announced Research and a Google Workspace integration for Claude. Research explores questions through multiple searches, while the integration brings email, calendar, and document context into its responses.",
      whyItMatters:
        "Connecting search to work context could reduce the effort of assembling information across tools. Reliable citations and permission boundaries remain essential.",
      evidence: ["we’re introducing two new capabilities"],
    },
  ],
  repositories: radarProjects.map((project, i) => ({
    name: project.name,
    reason: project.reason,
    url: `https://github.com/${project.name}`,
    description: [
      "Run language models locally.",
      "LLM inference in C/C++.",
      "Model definitions for state-of-the-art machine learning.",
      "High-throughput inference and serving for LLMs.",
    ][i],
    language: ["Go", "C++", "Python", "Python"][i],
    stars: null,
    pushedAt: null,
    release: null,
    releaseUrl: null,
    collectedAt: "2025-04-30T06:00:00.000Z",
  })),
};

// An explicit, dated local snapshot can be refreshed without a database or model account.
export const sampleEdition: Edition =
  preview === null ? historicalEdition : editionSchema.parse(preview);
