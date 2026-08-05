import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import {
  ACTIVE_FEEDS,
  SOURCE_REGISTRY_VERSION,
  assignCandidateIds,
  fetchFeed,
  filterAndDeduplicate,
  publishValidatedSelection,
  validateModelSelection,
  type NewsCandidate,
} from "./news.ts"

const DEEPSEEK_MODEL = "deepseek-v4-pro"
const MIN_ACTIVE_SOURCES = 8
const MIN_OFFICIAL_SOURCES = 5
const MIN_MEDIA_SOURCES = 2

function secretKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (current) {
    const keys = JSON.parse(current)
    if (keys.default) return keys.default as string
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
}

async function equalSecrets(left: string, right: string) {
  if (!left || !right) return false
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ])
  const a = new Uint8Array(leftHash)
  const b = new Uint8Array(rightHash)
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

function deepSeekPrompt(candidates: NewsCandidate[]) {
  return `Eres el editor de Pulso IA para una audiencia hispanohablante de creadores, builders y personas que automatizan con IA.
Selecciona exactamente cuatro noticias útiles y actuales. Prioriza aplicación práctica, actualidad, confiabilidad, corroboración y diversidad. No selecciones más de dos noticias de una misma categoría.
Categorías permitidas: modelos, agentes, herramientas, automatizacion, negocio, investigacion, seguridad, regulacion.
No inventes identificadores, enlaces, hechos ni fuentes. Usa supportingCandidateIds sólo cuando otra candidata corrobore realmente la misma noticia. Escribe en español y no copies el texto fuente.
Devuelve únicamente un objeto JSON con esta forma:
{"items":[{"candidateId":"news_...","supportingCandidateIds":[],"category":"herramientas","headline":"Titular en español","summary":"Resumen de 2 o 3 frases","whyItMatters":"Por qué importa de forma concreta"}]}

CANDIDATAS JSON:
${JSON.stringify(candidates.map(candidate => ({
    id: candidate.id,
    source: candidate.sourceName,
    sourceKind: candidate.sourceKind,
    title: candidate.title,
    summary: candidate.summary,
    url: candidate.url,
    publishedAt: candidate.publishedAt,
  })))}`
}

async function selectWithDeepSeek(candidates: NewsCandidate[], apiKey: string) {
  const prompt = deepSeekPrompt(candidates)
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: "Responde en español y produce exclusivamente JSON válido conforme al esquema solicitado." },
            { role: "user", content: attempt ? `${prompt}\nSegundo intento: revisa cuidadosamente el esquema y entrega contenido no vacío.` : prompt },
          ],
          thinking: { type: "enabled" },
          reasoning_effort: "high",
          response_format: { type: "json_object" },
          max_tokens: 2_800,
        }),
      })
      if (!response.ok) throw new Error(`deepseek_http_${response.status}`)
      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      if (typeof content !== "string" || !content.trim()) throw new Error("deepseek_empty_content")
      const parsed = JSON.parse(content)
      validateModelSelection(parsed, candidates)
      return parsed
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("deepseek_invalid_response")
}

async function recentItems(supabase: ReturnType<typeof createClient>, today: string) {
  const cutoff = new Date(`${today}T00:00:00.000Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 7)
  const { data: editions, error: editionError } = await supabase
    .from("ai_news_editions")
    .select("id")
    .gte("edition_date", cutoff.toISOString().slice(0, 10))
    .lt("edition_date", today)
  if (editionError) throw editionError
  if (!editions?.length) return []
  const { data, error } = await supabase
    .from("ai_news_items")
    .select("headline,primary_source_url")
    .in("edition_id", editions.map(item => item.id))
  if (error) throw error
  return data || []
}

Deno.serve(async request => {
  if (request.method !== "POST") return Response.json({ error: "Método no permitido." }, { status: 405 })

  const configuredSecret = Deno.env.get("AI_NEWS_CRON_SECRET") || ""
  if (!await equalSecrets(request.headers.get("x-cron-secret") || "", configuredSecret)) {
    return Response.json({ error: "No autorizado." }, { status: 401 })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const adminKey = secretKey()
    const deepSeekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || ""
    if (!supabaseUrl || !adminKey || !deepSeekApiKey) throw new Error("missing_server_secret")
    const supabase = createClient(supabaseUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    const results = await Promise.allSettled(ACTIVE_FEEDS.map(async feed => ({ feed, entries: await fetchFeed(feed) })))
    const active = results.flatMap(result => result.status === "fulfilled" ? [result.value] : [])
    const officialCount = active.filter(result => result.feed.kind === "official").length
    const mediaCount = active.filter(result => result.feed.kind === "media").length
    if (active.length < MIN_ACTIVE_SOURCES || officialCount < MIN_OFFICIAL_SOURCES || mediaCount < MIN_MEDIA_SOURCES) {
      throw new Error(`insufficient_active_sources:${active.length}/${officialCount}/${mediaCount}`)
    }

    const priorItems = await recentItems(supabase, today)
    const allEntries = active.flatMap(result => result.entries)
    let candidates = filterAndDeduplicate(allEntries, new Date(now.getTime() - 36 * 60 * 60 * 1_000), now, priorItems)
    let windowHours = 36
    if (candidates.length < 8) {
      windowHours = 72
      candidates = filterAndDeduplicate(allEntries, new Date(now.getTime() - 72 * 60 * 60 * 1_000), now, priorItems)
    }
    if (candidates.length < 8) throw new Error(`insufficient_candidates:${candidates.length}`)

    const candidateCount = candidates.length
    const identifiedCandidates = await assignCandidateIds(candidates.slice(0, 30))
    const selection = await selectWithDeepSeek(identifiedCandidates, deepSeekApiKey)
    const { editionId, itemCount } = await publishValidatedSelection(selection, identifiedCandidates, async selectedItems => {
      const { data, error: publishError } = await supabase.rpc("publish_ai_news_edition", {
        p_date: today,
        p_items: selectedItems,
        p_model: DEEPSEEK_MODEL,
        p_candidate_count: candidateCount,
      })
      if (publishError) throw publishError
      return { editionId: data, itemCount: selectedItems.length }
    })

    return Response.json({
      ok: true,
      editionId,
      editionDate: today,
      itemCount,
      candidateCount,
      activeSources: active.length,
      windowHours,
      sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
    })
  } catch (error) {
    console.error("refresh-ai-news failed", error)
    return Response.json({
      error: "La edición no se actualizó; se conserva la última edición válida.",
      code: error instanceof Error ? error.message : "unknown_error",
    }, { status: 503 })
  }
})
