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

async function removeUserUploads(userId: string) {
  const ownedFolders = [
    `avatars/${userId}`,
    `stories/${userId}`,
    `community/${userId}`,
    `chat/${userId}`,
    `comments/${userId}`
  ];
  const storage = admin.storage.from("liga-images");
  const paths: string[] = [];

  for (const folder of ownedFolders) {
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset });
      if (error) throw new Error(`Could not inspect account media folder ${folder}: ${error.message}`);
      const items = data ?? [];
      for (const item of items) {
        // Storage folders have no object ID; remove files only inside this user's exact folder.
        if (item.id && item.name && !item.name.includes("/")) paths.push(`${folder}/${item.name}`);
      }
      if (items.length < 1000) break;
      offset += items.length;
    }
  }

  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await storage.remove(paths.slice(offset, offset + 100));
    if (error) throw new Error(`Could not remove account media: ${error.message}`);
  }
}

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

    // Remove files uploaded into user-owned folders before deleting the Auth row.
    // Shared league assets (gallery/news/player media) are intentionally preserved.
    await removeUserUploads(data.user.id);

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
