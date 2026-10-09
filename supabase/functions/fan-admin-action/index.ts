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

    const body=await req.json();
    const action=String(body.action||"");
    let data, error;
    if(action==="generate_markets"){
      ({data,error}=await actor.rpc("fan_generate_markets",{p_match:String(body.match_id)}));
    }else if(action==="settle_match"){
      ({data,error}=await actor.rpc("fan_settle_match",{p_match:String(body.match_id)}));
    }else if(action==="grant"){
      ({data,error}=await actor.rpc("fan_admin_grant",{p_user:String(body.user_id),p_amount:Number(body.amount),p_reason:String(body.reason||"Admin grant")}));
    }else if(action==="set_odds"){
      ({data,error}=await actor.rpc("fan_set_odds",{p_market:String(body.market_id),p_odds:Number(body.odds)}));
    }else{
      return Response.json({error:"Unknown action"},{status:400,headers:corsHeaders});
    }
    if(error) return Response.json({error:error.message},{status:400,headers:corsHeaders});
    return Response.json({ok:true,data},{headers:corsHeaders});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:"Admin action failed"},{status:500,headers:corsHeaders});
  }
});
