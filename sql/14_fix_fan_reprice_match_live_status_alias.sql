-- Fix live Fan Game repricing after an end-to-end database test found an invalid alias.
-- The expression must refer to the current match record (mt), not a nonexistent alias p.
-- Idempotent and data-preserving: only replaces the broken CASE expression in the existing function.
begin;

do $fix$
declare
  v_definition text;
  v_fixed_definition text;
  v_broken text := 'when p.status = ''live'' then';
  v_correct text := 'when mt.status = ''live'' then';
begin
  if to_regprocedure('private.fan_reprice_match(text)') is null then
    raise exception 'private.fan_reprice_match(text) is missing; apply sql/01_fan_game.sql and sql/02_security_hardening.sql first.';
  end if;

  select pg_get_functiondef(to_regprocedure('private.fan_reprice_match(text)'))
    into v_definition;

  if position(v_broken in lower(v_definition)) > 0 then
    v_fixed_definition := replace(v_definition, v_broken, v_correct);
    if v_fixed_definition = v_definition then
      raise exception 'Live repricer alias replacement did not change the function definition.';
    end if;
    execute v_fixed_definition;
  elsif position(v_correct in lower(v_definition)) > 0
        and position('p.status' in lower(v_definition)) = 0 then
    -- Already corrected; repeated runs remain safe.
    return;
  else
    raise exception 'Expected live-status expression was not found; inspect private.fan_reprice_match(text) before proceeding.';
  end if;
end;
$fix$;

commit;
