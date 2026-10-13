import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vojintesanovic0-dot.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({error:"Method not allowed"},{status:405,headers:corsHeaders});
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return Response.json({error:"Unauthorized"},{status:401,headers:corsHeaders});
    const token = auth.slice(7);
    const {data:u,error:ue}=await admin.auth.getUser(token);
    if(ue || !u.user) return Response.json({error:"Unauthorized"},{status:401,headers:corsHeaders});

    const {data:p}=await admin.from("profiles").select("role").eq("id",u.user.id).maybeSingle();
    if(p?.role!=="admin") return Response.json({error:"Forbidden"},{status:403,headers:corsHeaders});

    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!publicKey) throw new Error("Missing Supabase public API key for authenticated RPC calls.");

    // Keep the caller's JWT on RPC requests so auth.uid() and the database's
    // own administrator checks see the real actor, not the service-role user.
    const actor = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: auth } }
    });

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return Response.json({ error: "Request body must be a JSON object" }, { status: 400, headers: corsHeaders });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const action = typeof body.action === "string" ? body.action.trim() : "";
    let data, error;
    if(action==="generate_markets" || action==="settle_match"){
      const matchId = (typeof body.match_id === "string" || typeof body.match_id === "number") ? String(body.match_id).trim() : "";
      if (!matchId || matchId.length > 100) {
        return Response.json({ error: "Invalid match_id" }, { status: 400, headers: corsHeaders });
      }
      const rpcName = action === "generate_markets" ? "fan_generate_markets" : "fan_settle_match";
      ({data,error}=await actor.rpc(rpcName,{p_match:matchId}));
    }else if(action==="grant"){
      const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
      const amount = Number(body.amount);
      const reason = (typeof body.reason === "string" ? body.reason.trim() : "") || "Admin grant";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return Response.json({ error: "Invalid user_id" }, { status: 400, headers: corsHeaders });
      }
      if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) {
        return Response.json({ error: "amount must be a non-zero integer between -1000 and 1000" }, { status: 400, headers: corsHeaders });
      }
      if (reason.length > 200) {
        return Response.json({ error: "reason must be at most 200 characters" }, { status: 400, headers: corsHeaders });
      }
      ({data,error}=await actor.rpc("fan_admin_grant",{p_user:userId,p_amount:amount,p_reason:reason}));
    }else if(action==="set_odds"){
      const marketId = typeof body.market_id === "string" ? body.market_id.trim() : "";
      const odds = Number(body.odds);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marketId)) {
        return Response.json({ error: "Invalid market_id" }, { status: 400, headers: corsHeaders });
      }
      if (!Number.isFinite(odds) || odds < 1.01 || odds > 100) {
        return Response.json({ error: "odds must be between 1.01 and 100" }, { status: 400, headers: corsHeaders });
      }
      ({data,error}=await actor.rpc("fan_set_odds",{p_market:marketId,p_odds:odds}));
    }else{
      return Response.json({error:"Unknown action"},{status:400,headers:corsHeaders});
    }
    if(error) return Response.json({error:error.message},{status:400,headers:corsHeaders});
    return Response.json({ok:true,data},{headers:corsHeaders});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:"Admin action failed"},{status:500,headers:corsHeaders});
  }
});
