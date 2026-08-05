import {
  filterAndDeduplicate,
  fetchFeed,
  parseFeed,
  publishValidatedSelection,
  shortlistCandidates,
  validateModelSelection,
  withAbortTimeout,
  type FeedSource,
  type NewsCandidate,
} from "./news.ts"

const source: FeedSource = { id: "test", name: "Fuente", url: "https://example.com/feed", kind: "official" }

Deno.test("parseFeed reads RSS and Atom without article bodies", () => {
  const rss = `<rss><channel><item><title><![CDATA[Nueva herramienta para agentes]]></title><link>https://example.com/a?utm_source=x</link><pubDate>Wed, 05 Aug 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Resumen breve.</p>]]></description></item></channel></rss>`
  const atom = `<feed><entry><title>Modelo abierto actualizado</title><link rel="alternate" href="https://example.com/b"/><updated>2026-08-05T09:00:00Z</updated><summary>Otra síntesis.</summary></entry></feed>`
  const parsed = [...parseFeed(rss, source), ...parseFeed(atom, source)]
  if (parsed.length !== 2) throw new Error("Expected two entries")
  if (parsed[0].url.includes("utm_source")) throw new Error("Tracking parameter was not removed")
  if (parsed[0].summary !== "Resumen breve.") throw new Error("Markup was not stripped")
})

Deno.test("filterAndDeduplicate removes repeated URLs, titles and prior editions", () => {
  const now = new Date("2026-08-05T12:00:00Z")
  const base = {
    sourceId: "test", sourceName: "Fuente", sourceKind: "official" as const,
    summary: "Resumen", publishedAt: "2026-08-05T10:00:00Z",
  }
  const result = filterAndDeduplicate([
    { ...base, title: "Noticia uno", url: "https://example.com/one" },
    { ...base, title: "Noticia uno", url: "https://example.com/other" },
    { ...base, title: "Noticia dos", url: "https://example.com/two" },
  ], new Date("2026-08-04T00:00:00Z"), now, [{ headline: "Anterior", primary_source_url: "https://example.com/two" }])
  if (result.length !== 1 || result[0].url !== "https://example.com/one") throw new Error("Deduplication failed")
})

function candidate(index: number, sourceName = "Fuente"): NewsCandidate {
  return {
    id: `news_${index}`,
    sourceId: `source_${index}`,
    sourceName,
    sourceKind: index % 2 ? "official" : "media",
    title: `Candidate title ${index}`,
    summary: "A useful source summary that is not copied in full.",
    url: `https://example.com/${index}`,
    publishedAt: `2026-08-05T0${index}:00:00Z`,
  }
}

Deno.test("validateModelSelection accepts four real candidates", () => {
  const candidates = [candidate(1), candidate(2), candidate(3), candidate(4)]
  const value = { items: candidates.map((item, index) => ({
    candidateId: item.id,
    supportingCandidateIds: [],
    category: index < 2 ? "herramientas" : "agentes",
    headline: `Titular práctico número ${index + 1}`,
    summary: "Este es un resumen en español suficientemente largo para pasar la validación del contrato.",
    whyItMatters: "Importa porque permite tomar una decisión práctica con mejor contexto.",
  })) }
  const output = validateModelSelection(value, candidates)
  if (output.length !== 4 || output[0].sources.length !== 1) throw new Error("Valid selection failed")
})

Deno.test("validateModelSelection rejects invented candidate identifiers", () => {
  const candidates = [candidate(1), candidate(2), candidate(3), candidate(4)]
  const value = { items: candidates.map((item, index) => ({
    candidateId: index === 0 ? "invented" : item.id,
    category: index < 2 ? "herramientas" : "agentes",
    headline: `Titular práctico número ${index + 1}`,
    summary: "Este es un resumen en español suficientemente largo para pasar la validación del contrato.",
    whyItMatters: "Importa porque permite tomar una decisión práctica con mejor contexto.",
  })) }
  let rejected = false
  try { validateModelSelection(value, candidates) } catch { rejected = true }
  if (!rejected) throw new Error("Invented identifiers must be rejected")
})

Deno.test("fetchFeed rejects responses larger than the configured limit", async () => {
  let rejected = false
  try {
    await fetchFeed(source, (() => Promise.resolve(new Response("oversized", {
      status: 200,
      headers: { "content-length": "1001" },
    }))) as typeof fetch, 100, 1_000)
  } catch (error) {
    rejected = error instanceof Error && error.message === "feed_too_large"
  }
  if (!rejected) throw new Error("Oversized feed must be rejected")
})

Deno.test("fetchFeed aborts a source that exceeds its timeout", async () => {
  const stalled = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
  })) as typeof fetch
  let rejected = false
  try { await fetchFeed(source, stalled, 5) } catch { rejected = true }
  if (!rejected) throw new Error("Timed-out feed must be rejected")
})

Deno.test("invalid model output never calls the publication callback", async () => {
  const candidates = [candidate(1), candidate(2), candidate(3), candidate(4)]
  let publications = 0
  let rejected = false
  try {
    await publishValidatedSelection({ items: [] }, candidates, async () => {
      publications += 1
      return true
    })
  } catch { rejected = true }
  if (!rejected || publications !== 0) throw new Error("Previous edition would not be preserved")
})

Deno.test("withAbortTimeout returns a stable error code", async () => {
  let message = ""
  try {
    await withAbortTimeout(signal => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    }), 5, "deepseek_timeout")
  } catch (error) {
    message = error instanceof Error ? error.message : ""
  }
  if (message !== "deepseek_timeout") throw new Error("Timeout was not normalized")
})

Deno.test("shortlistCandidates represents different sources before filling", () => {
  const base = {
    sourceName: "Fuente", sourceKind: "official" as const, summary: "Resumen",
    publishedAt: "2026-08-05T10:00:00Z",
  }
  const candidates = [
    ...Array.from({ length: 8 }, (_, index) => ({
      ...base, sourceId: "repeated", title: `Repeated ${index}`, url: `https://example.com/repeated-${index}`,
    })),
    { ...base, sourceId: "second", title: "Second source", url: "https://example.com/second" },
    { ...base, sourceId: "third", title: "Third source", url: "https://example.com/third" },
  ]
  const result = shortlistCandidates(candidates, 4)
  if (result.length !== 4) throw new Error("Shortlist limit failed")
  if (result.slice(0, 3).map(item => item.sourceId).join(",") !== "repeated,second,third") {
    throw new Error("Source diversity failed")
  }
})
