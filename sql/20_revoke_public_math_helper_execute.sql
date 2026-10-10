-- Probability/odds math helpers are internal implementation details.
-- fan_poisson_prob accepts an iteration count and must not be exposed as an
-- unauthenticated RPC surface. The SECURITY DEFINER Fan Game repricer continues
-- to call these functions as their owner; no odds formula is changed.
begin;

revoke execute on function public.fan_odds_from_prob(numeric, numeric)
  from public, anon, authenticated;
revoke execute on function public.fan_poisson_prob(numeric, integer)
  from public, anon, authenticated;

commit;
