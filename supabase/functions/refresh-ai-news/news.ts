export const SOURCE_REGISTRY_VERSION = "2026-08-05"
export const MAX_FEED_BYTES = 1_000_000
export const FEED_TIMEOUT_MS = 7_000

export type FeedSource = {
  id: string
  name: string
  url: string
  kind: "official" | "media"
}

export type NewsCandidate = {
  id: string
  sourceId: string
  sourceName: string
  sourceKind: "official" | "media"
  title: string
  summary: string
  url: string
  publishedAt: string
}

export const ACTIVE_FEEDS: FeedSource[] = [
  { id: "openai", name: "OpenAI", url: "https://openai.com/news/rss.xml", kind: "official" },
  { id: "google-deepmind", name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", kind: "official" },
  { id: "google-ai", name: "Google AI", url: "https://blog.google/technology/ai/rss/", kind: "official" },
  { id: "microsoft-ai", name: "Microsoft AI", url: "https://news.microsoft.com/source/topics/ai/feed/", kind: "official" },
  { id: "nvidia-ai", name: "NVIDIA", url: "https://blogs.nvidia.com/blog/category/deep-learning/feed/", kind: "official" },
  { id: "github-changelog", name: "GitHub", url: "https://github.blog/changelog/feed/", kind: "official" },
  { id: "hugging-face", name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", kind: "official" },
  { id: "cloudflare", name: "Cloudflare", url: "https://blog.cloudflare.com/rss/", kind: "official" },
  { id: "techcrunch-ai", name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", kind: "media" },
  { id: "mit-technology-review", name: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", kind: "media" },
  { id: "ars-technica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", kind: "media" },
  { id: "the-verge-ai", name: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", kind: "media" },
]

// Estas publicaciones siguen en el registro editorial, pero no exponen un RSS/Atom
// oficial estable a la fecha de esta versión. No se sustituyen por feeds de terceros.
export const PENDING_OFFICIAL_FEEDS = ["Anthropic", "Meta AI"] as const

const TRACKING_PARAMETERS = ["gclid", "fbclid", "mc_cid", "mc_eid", "ref", "source"]
const ALLOWED_CATEGORIES = new Set([
  "modelos", "agentes", "herramientas", "automatizacion",
  "negocio", "investigacion", "seguridad", "regulacion",
])

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  }
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => {
      const radix = code[0].toLowerCase() === "x" ? 16 : 10
      const parsed = Number.parseInt(radix === 16 ? code.slice(1) : code, radix)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : ""
    })
    .replace(/&([a-z]+);/gi, (_, name: string) => named[name.toLowerCase()] ?? " ")
}

function plainText(value: string, maximum = 800) {
  return decodeEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
}

function tagValue(block: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:")
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"))
    if (match?.[1]) return match[1]
  }
  return ""
}

function entryLink(block: string) {
  const atomLinks = [...block.matchAll(/<link\b([^>]*)>/gi)]
  for (const match of atomLinks) {
    const attributes = match[1]
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1]
    const relation = attributes.match(/\brel=["']([^"']+)["']/i)?.[1]
    if (href && (!relation || relation === "alternate")) return decodeEntities(href.trim())
  }
  return plainText(tagValue(block, ["link"]), 2_000)
}

export function normalizeUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "https:") return ""
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.includes(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }
    url.hostname = url.hostname.toLowerCase()
    return url.toString()
  } catch {
    return ""
  }
}

function titleKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function parseFeed(xml: string, source: FeedSource): Omit<NewsCandidate, "id">[] {
  const rssItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => match[0])
  const atomEntries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(match => match[0])
  return [...rssItems, ...atomEntries].flatMap(block => {
    const title = plainText(tagValue(block, ["title"]), 240)
    const url = normalizeUrl(entryLink(block))
    const dateValue = plainText(tagValue(block, ["pubDate", "published", "updated", "dc:date"]), 120)
    const date = new Date(dateValue)
    if (title.length < 8 || !url || Number.isNaN(date.getTime())) return []
    const summary = plainText(tagValue(block, ["description", "summary", "content:encoded", "content"]), 700)
    return [{
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      title,
      summary,
      url,
      publishedAt: date.toISOString(),
    }]
  })
}

async function readResponseWithLimit(response: Response, maximumBytes: number) {
  const declaredSize = Number(response.headers.get("content-length") || 0)
  if (declaredSize > maximumBytes) throw new Error("feed_too_large")
  if (!response.body) return ""
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let result = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximumBytes) {
      await reader.cancel("feed_too_large")
      throw new Error("feed_too_large")
    }
    result += decoder.decode(value, { stream: true })
  }
  return result + decoder.decode()
}

export async function fetchFeed(
  source: FeedSource,
  fetcher: typeof fetch = fetch,
  timeoutMs = FEED_TIMEOUT_MS,
  maximumBytes = MAX_FEED_BYTES,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("feed_timeout"), timeoutMs)
  try {
    const response = await fetcher(source.url, {
      headers: { "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9" },
      redirect: "follow",
      signal: controller.signal,
    })
    if (!response.ok || !normalizeUrl(response.url || source.url)) throw new Error(`feed_http_${response.status}`)
    const xml = await readResponseWithLimit(response, maximumBytes)
    const entries = parseFeed(xml, source)
    if (!entries.length) throw new Error("feed_without_entries")
    return entries
  } finally {
    clearTimeout(timeout)
  }
}

export function filterAndDeduplicate(
  entries: Omit<NewsCandidate, "id">[],
  cutoff: Date,
  now = new Date(),
  previouslyPublished: { headline: string; primary_source_url: string }[] = [],
) {
  const oldUrls = new Set(previouslyPublished.map(item => normalizeUrl(item.primary_source_url)).filter(Boolean))
  const oldTitles = new Set(previouslyPublished.map(item => titleKey(item.headline)))
  const urls = new Set<string>()
  const titles = new Set<string>()
  return entries
    .filter(entry => {
      const published = new Date(entry.publishedAt)
      const url = normalizeUrl(entry.url)
      const title = titleKey(entry.title)
      if (!url || !title || published < cutoff || published > new Date(now.getTime() + 2 * 60 * 60 * 1000)) return false
      if (oldUrls.has(url) || oldTitles.has(title) || urls.has(url) || titles.has(title)) return false
      urls.add(url)
      titles.add(title)
      return true
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}

export async function assignCandidateIds(entries: Omit<NewsCandidate, "id">[]) {
  const encoder = new TextEncoder()
  return Promise.all(entries.map(async entry => {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(entry.url))
    const id = [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, "0")).join("")
    return { ...entry, id: `news_${id}` }
  }))
}

export type ModelSelection = {
  items: Array<{
    candidateId: string
    supportingCandidateIds?: string[]
    category: string
    headline: string
    summary: string
    whyItMatters: string
  }>
}

export function validateModelSelection(value: unknown, candidates: NewsCandidate[]) {
  if (!value || typeof value !== "object" || !Array.isArray((value as ModelSelection).items)) {
    throw new Error("invalid_model_payload")
  }
  const selection = value as ModelSelection
  if (selection.items.length !== 4) throw new Error("model_must_select_four")
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]))
  const usedCandidates = new Set<string>()
  const categoryCounts = new Map<string, number>()

  return selection.items.map((item, index) => {
    const candidate = byId.get(item.candidateId)
    if (!candidate || usedCandidates.has(item.candidateId)) throw new Error("unknown_or_duplicate_candidate")
    usedCandidates.add(item.candidateId)
    if (!ALLOWED_CATEGORIES.has(item.category)) throw new Error("invalid_category")
    categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1)
    if ((categoryCounts.get(item.category) || 0) > 2) throw new Error("category_limit_exceeded")
    if (typeof item.headline !== "string" || item.headline.trim().length < 12 || item.headline.trim().length > 180) throw new Error("invalid_headline")
    if (typeof item.summary !== "string" || item.summary.trim().length < 40 || item.summary.trim().length > 700) throw new Error("invalid_summary")
    if (typeof item.whyItMatters !== "string" || item.whyItMatters.trim().length < 30 || item.whyItMatters.trim().length > 500) throw new Error("invalid_why_it_matters")

    const supportingIds = [...new Set(item.supportingCandidateIds || [])]
    if (supportingIds.some(id => !byId.has(id))) throw new Error("unknown_supporting_candidate")
    const sourceCandidates = [candidate, ...supportingIds.filter(id => id !== candidate.id).map(id => byId.get(id)!)]
    const uniqueSources = [...new Map(sourceCandidates.map(source => [source.url, source])).values()]
    return {
      position: index + 1,
      category: item.category,
      headline: item.headline.trim(),
      summary: item.summary.trim(),
      why_it_matters: item.whyItMatters.trim(),
      primary_source_name: candidate.sourceName,
      primary_source_url: candidate.url,
      source_published_at: candidate.publishedAt,
      sources: uniqueSources.map(source => ({
        name: source.sourceName,
        url: source.url,
        title: source.title,
        published_at: source.publishedAt,
      })),
    }
  })
}

export async function publishValidatedSelection<T>(
  value: unknown,
  candidates: NewsCandidate[],
  publish: (items: ReturnType<typeof validateModelSelection>) => Promise<T>,
) {
  const items = validateModelSelection(value, candidates)
  return publish(items)
}
