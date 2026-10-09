-- Allow a user to switch their own reaction on a post.
-- The existing unique(post_id,user_id) constraint still limits each user to one reaction.

begin;

drop policy if exists community_reactions_owner_update on public.community_reactions;
create policy community_reactions_owner_update
on public.community_reactions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
