import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const emailPattern = /^\S+@\S+\.\S+$/
const allowedOrigin = Deno.env.get("APP_ORIGIN") || "http://127.0.0.1:5173"

export default {
  fetch: withSupabase({
    auth: "user",
    cors: {
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    },
  }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Método no permitido." }, { status: 405 })
    }

    const userId = ctx.userClaims?.id
    if (!userId) {
      return Response.json({ error: "Sesión requerida." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug || "").trim()
    const name = String(body.name || "").trim().slice(0, 160)
    const email = String(body.email || "").trim().toLowerCase().slice(0, 320)
    const consent = body.consent === true
    const website = String(body.website || "").trim()

    if (website) return new Response(null, { status: 204 })
    if (!slug || !emailPattern.test(email)) {
      return Response.json({ error: "Ingresa un correo válido." }, { status: 400 })
    }
    if (!consent) {
      return Response.json({ error: "Debes aceptar el envío del material." }, { status: 400 })
    }

    const { data: allowed, error: attemptError } = await ctx.supabaseAdmin.rpc("check_and_record_access_attempt", {
      p_user_id: userId,
    })
    if (attemptError) throw attemptError
    if (!allowed) {
      return Response.json({ error: "Demasiados intentos. Prueba nuevamente más tarde." }, { status: 429 })
    }

    const { data: tutorial, error: tutorialError } = await ctx.supabaseAdmin
      .from("tutorials")
      .select("id, slug, status, access_mode")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()

    if (tutorialError) throw tutorialError
    if (!tutorial) {
      return Response.json({ error: "Tutorial no encontrado." }, { status: 404 })
    }
    if (tutorial.access_mode === "public") {
      return Response.json({ ok: true, redirect: `/hub/${tutorial.slug}` })
    }

    const { error: accessError } = await ctx.supabaseAdmin.rpc("grant_tutorial_access", {
      p_user_id: userId,
      p_tutorial_id: tutorial.id,
      p_name: name,
      p_email: email,
      p_consent_at: new Date().toISOString(),
    })

    if (accessError) throw accessError

    return Response.json({
      ok: true,
      redirect: `/hub/${tutorial.slug}`,
    })
  }),
}
