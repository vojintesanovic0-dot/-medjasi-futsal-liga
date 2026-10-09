import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vojintesanovic0-dot.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const BATCH_SIZE = 20;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const token = auth.slice(7);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    const role = profile?.role;
    const { type, title, body, match_id } = await req.json();
    const eventType = String(type || "");
    const allowedPushTypes = new Set(["goal", "card", "live", "finish", "match_finished", "news"]);

    // Only administrators and moderators may broadcast to every subscriber.
    // A valid JWT alone must never let a regular account send league-wide push.
    if (role !== "admin" && role !== "moderator") {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (!allowedPushTypes.has(eventType)) {
      return Response.json({ error: "Invalid push type" }, { status: 400, headers: corsHeaders });
    }

    const moderatorPushTypes = new Set(["goal", "card", "live", "finish", "match_finished"]);
    if (role === "moderator" && !moderatorPushTypes.has(eventType)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const { data: cfg, error: cfgError } = await admin
      .from("push_config")
      .select("vapid_public_key,vapid_private_key,subject")
      .eq("id", 1)
      .single();

    if (cfgError || !cfg) throw new Error("Push configuration is missing");

    webpush.setVapidDetails(cfg.subject, cfg.vapid_public_key, cfg.vapid_private_key);

    const { data: subs, error: subError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth");

    if (subError) throw subError;

    const payload = JSON.stringify({
      title: String(title || "Medjaši Futsal Liga").slice(0, 160),
      body: String(body || "").slice(0, 1000),
      type: String(type || "general").slice(0, 40),
      match_id: match_id || null,
      url: "./"
    });

    let sent = 0;
    let removed = 0;
    let failed = 0;

    for (let i = 0; i < (subs || []).length; i += BATCH_SIZE) {
      const batch = (subs || []).slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              payload
            );
            return { sent: 1, failed: 0, removed: 0 };
          } catch (err) {
            const status = (err as any)?.statusCode;

            if (status === 404 || status === 410) {
              const { error: deleteError } = await admin
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);

              return {
                sent: 0,
                failed: deleteError ? 1 : 0,
                removed: deleteError ? 0 : 1
              };
            }

            return { sent: 0, failed: 1, removed: 0 };
          }
        })
      );

      for (const result of results) {
        sent += result.sent;
        failed += result.failed;
        removed += result.removed;
      }
    }

    return Response.json(
      { ok: true, sent, failed, removed },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("send-push error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Push send failed" },
      { status: 500, headers: corsHeaders }
    );
  }
});
