-- Consolidate the public league's read-only bootstrap into one PostgREST request.
-- SECURITY INVOKER deliberately preserves the caller's table grants and RLS policies.
CREATE OR REPLACE FUNCTION public.get_league_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT jsonb_build_object(
    'teams', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name, t.id)
      FROM (SELECT * FROM public.teams ORDER BY name, id LIMIT 21001) AS t
    ), '[]'::jsonb),
    'players', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.jersey_number, p.id)
      FROM (SELECT * FROM public.players ORDER BY jersey_number, id LIMIT 21001) AS p
    ), '[]'::jsonb),
    'matches', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.match_date, m.id)
      FROM (SELECT * FROM public.matches ORDER BY match_date, id LIMIT 21001) AS m
    ), '[]'::jsonb),
    'goals', COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.minute, g.id)
      FROM (SELECT * FROM public.goals ORDER BY minute, id LIMIT 21001) AS g
    ), '[]'::jsonb),
    'cards', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.minute, c.id)
      FROM (SELECT * FROM public.cards ORDER BY minute, id LIMIT 21001) AS c
    ), '[]'::jsonb),
    'match_players', COALESCE((
      SELECT jsonb_agg(to_jsonb(mp) ORDER BY mp.match_id, mp.player_id)
      FROM (SELECT * FROM public.match_players ORDER BY match_id, player_id LIMIT 21001) AS mp
    ), '[]'::jsonb),
    'comments', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC, c.id DESC)
      FROM (SELECT * FROM public.comments ORDER BY created_at DESC, id DESC LIMIT 300) AS c
    ), '[]'::jsonb),
    'messages', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC, m.id DESC)
      FROM (SELECT * FROM public.messages ORDER BY created_at DESC, id DESC LIMIT 300) AS m
    ), '[]'::jsonb),
    'gallery', COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.created_at DESC, g.id DESC)
      FROM (SELECT * FROM public.gallery ORDER BY created_at DESC, id DESC LIMIT 200) AS g
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_league_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_league_snapshot() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
