-- Fix RLS leak: the "advisor_conv_shared_read" policy on advisor_conversations
-- allowed SELECT on ANY non-archived row where share_token IS NOT NULL, which
-- let anyone with the anon key enumerate every shared conversation. The
-- companion policy on advisor_messages inherited the same leak via the
-- share_token branch.
--
-- This migration:
--   1. Drops the public share policy on advisor_conversations.
--   2. Drops and recreates advisor_msg_owner_select without the share_token
--      branch (owner-only).
--   3. Adds SECURITY DEFINER RPC get_shared_conversation(p_token text) that
--      returns the conversation + its non-superseded messages only when the
--      caller supplies a valid, non-archived share token.

DROP POLICY IF EXISTS "advisor_conv_shared_read" ON public.advisor_conversations;
DROP POLICY IF EXISTS "advisor_msg_owner_select" ON public.advisor_messages;

CREATE POLICY "advisor_msg_owner_select"
  ON public.advisor_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.advisor_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_shared_conversation(p_token text)
RETURNS TABLE(conversation jsonb, messages jsonb)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv jsonb;
  v_msgs jsonb;
  v_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  SELECT id, to_jsonb(c.*) INTO v_id, v_conv
    FROM public.advisor_conversations c
    WHERE c.share_token = p_token AND c.is_archived = false;
  IF v_id IS NULL THEN RETURN; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(m.*) ORDER BY m.created_at), '[]'::jsonb)
    INTO v_msgs
    FROM public.advisor_messages m
    WHERE m.conversation_id = v_id AND m.is_superseded = false;
  RETURN QUERY SELECT v_conv, v_msgs;
END $$;

REVOKE ALL ON FUNCTION public.get_shared_conversation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_conversation(text) TO anon, authenticated, service_role;
