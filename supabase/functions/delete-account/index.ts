import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vojintesanovic0-dot.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const token = authorization.slice("Bearer ".length);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "Unauthorized" }, 401);

    // The caller may delete only their own account; the user ID is never accepted from the request body.
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error("Account deletion failed", { userId: data.user.id, message: deleteError.message });
      return json({ error: "Nalog nije obrisan. Pokušaj ponovo ili kontaktiraj podršku." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Account deletion request failed", error);
    return json({ error: "Zahtjev za brisanje naloga nije uspio." }, 500);
  }
});
