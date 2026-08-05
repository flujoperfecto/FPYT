import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import {
  ACTIVE_FEEDS,
  MODEL_CANDIDATE_LIMIT,
  SOURCE_REGISTRY_VERSION,
  assignCandidateIds,
  fetchFeed,
  filterAndDeduplicate,
  publishValidatedSelection,
  shortlistCandidates,
  validateModelSelection,
  withAbortTimeout,
  type NewsCandidate,
} from "./news.ts"

const DEEPSEEK_MODEL = "deepseek-v4-pro"
const MIN_ACTIVE_SOURCES = 8
const MIN_OFFICIAL_SOURCES = 5
const MIN_MEDIA_SOURCES = 2
const DEEPSEEK_TOTAL_TIMEOUT_MS = 110_000
const DEEPSEEK_ATTEMPT_TIMEOUT_MS = 105_000

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

function deepSeekPrompt(candidates: NewsCandidate[], isRetry = false) {
  return `Actúa como editor jefe de Pulso IA para creadores, builders y especialistas en automatización.

TAREA
Elige exactamente 4 noticias distintas de CANDIDATAS_JSON. Ordénalas por utilidad práctica e impacto. Evalúa internamente actualidad, fiabilidad de la fuente, posibilidad de aplicación, diversidad y corroboración.

CONTRATO JSON OBLIGATORIO
Devuelve sólo este objeto JSON, sin Markdown, comentarios ni claves adicionales:
{"items":[{"candidateId":"c01","supportingCandidateIds":[],"category":"herramientas","headline":"Titular claro en español","summary":"Dos frases factuales en español.","whyItMatters":"Una consecuencia práctica y concreta para la audiencia."}]}

REGLAS
- items debe contener exactamente 4 objetos y 4 candidateId diferentes que existan literalmente en CANDIDATAS_JSON.
- Categorías permitidas: modelos, agentes, herramientas, automatizacion, negocio, investigacion, seguridad, regulacion.
- Máximo 2 noticias de la misma categoría.
- supportingCandidateIds sólo puede incluir IDs reales que describan el mismo acontecimiento; si no hay corroboración, usa [].
- headline: 12-180 caracteres. summary: 40-700 caracteres. whyItMatters: 30-500 caracteres.
- No inventes hechos, productos, fechas, enlaces, fuentes o identificadores. No copies frases largas de la fuente.
- El campo content final nunca puede quedar vacío. Comprueba silenciosamente el contrato antes de responder.
${isRetry ? "- REPARACIÓN: la respuesta anterior fue vacía o inválida. Genera ahora el objeto JSON completo desde cero y verifica que tenga cuatro items." : ""}

CANDIDATAS_JSON:
${JSON.stringify(candidates.map(candidate => ({
    id: candidate.id,
    source: candidate.sourceName,
    sourceKind: candidate.sourceKind,
    title: candidate.title,
    summary: candidate.summary.slice(0, 360),
    url: candidate.url,
    publishedAt: candidate.publishedAt,
  })))}`
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || "unknown_error"
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const withMessage = error as { message?: unknown; code?: unknown }
    if (typeof withMessage.message === "string" && withMessage.message) return withMessage.message
    try {
      return JSON.stringify(error)
    } catch {
      return "unknown_error"
    }
  }
  return "unknown_error"
}

const RETRYABLE_MODEL_ERRORS = new Set([
  "deepseek_empty_content",
  "deepseek_invalid_json",
  "invalid_model_payload",
  "model_must_select_four",
  "unknown_or_duplicate_candidate",
  "invalid_category",
  "category_limit_exceeded",
  "invalid_headline",
  "invalid_summary",
  "invalid_why_it_matters",
  "unknown_supporting_candidate",
])

async function selectWithDeepSeek(candidates: NewsCandidate[], apiKey: string) {
  const startedAt = Date.now()
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const prompt = deepSeekPrompt(candidates, attempt === 1)
      const remainingMs = DEEPSEEK_TOTAL_TIMEOUT_MS - (Date.now() - startedAt)
      if (remainingMs <= 0) throw new Error("deepseek_timeout")
      const payload = await withAbortTimeout(async signal => {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "authorization": `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          signal,
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: "system", content: "Eres un editor de noticias preciso. Responde en español y emite exclusivamente JSON válido en el content final." },
              { role: "user", content: prompt },
            ],
            thinking: { type: "disabled" },
            response_format: { type: "json_object" },
            max_tokens: 4_096,
          }),
        })
        if (!response.ok) throw new Error(`deepseek_http_${response.status}`)
        return response.json()
      }, Math.min(DEEPSEEK_ATTEMPT_TIMEOUT_MS, remainingMs), "deepseek_timeout")
      const choice = payload?.choices?.[0]
      const content = choice?.message?.content
      if (typeof content !== "string" || !content.trim()) {
        const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : "unknown"
        const reasoningTokens = Number(payload?.usage?.completion_tokens_details?.reasoning_tokens || 0)
        throw new Error(`deepseek_empty_content:${finishReason}:${reasoningTokens}`)
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        throw new Error("deepseek_invalid_json")
      }
      validateModelSelection(parsed, candidates)
      return parsed
    } catch (error) {
      const errorCode = describeError(error).split(":", 1)[0]
      if (!RETRYABLE_MODEL_ERRORS.has(errorCode)) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(describeError(lastError) || "deepseek_invalid_response")
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
    const identifiedCandidates = await assignCandidateIds(shortlistCandidates(candidates, MODEL_CANDIDATE_LIMIT))
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
      code: describeError(error),
    }, { status: 503 })
  }
})
