-- Add per-target customization fields to social_post_targets
ALTER TABLE social_post_targets
  ADD COLUMN IF NOT EXISTS custom_body TEXT,
  ADD COLUMN IF NOT EXISTS first_comment TEXT,
  ADD COLUMN IF NOT EXISTS platform_options JSONB DEFAULT '{}';
