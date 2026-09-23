-- Open/click tracking used to overwrite status 'sent' with 'opened'/'clicked',
-- which removed engaged emails from every "sent" count (history, analytics and
-- the daily send limit). Engagement is kept in opened_at / clicked_at.
DO $$
BEGIN
  IF to_regclass('outreach_individual_emails') IS NOT NULL THEN
    UPDATE outreach_individual_emails
    SET status = 'sent'
    WHERE status IN ('opened', 'clicked')
      AND sent_at IS NOT NULL;
  END IF;
END $$;
