/*
  # Add title column to gamification_events table

  1. Changes
    - Add `title` column to `gamification_events` table for event titles
    - Update existing records with appropriate titles based on event_type
    - Add index for better performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add title column to gamification_events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gamification_events' AND column_name = 'title'
  ) THEN
    ALTER TABLE gamification_events ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Update existing records with titles based on event_type
UPDATE gamification_events 
SET title = CASE 
  WHEN event_type = 'daily_login' THEN 'Daily Login'
  WHEN event_type = 'watch_episode' THEN 'Watch Episode'
  WHEN event_type = 'complete_series' THEN 'Complete Series'
  WHEN event_type = 'share_content' THEN 'Share Content'
  WHEN event_type = 'rate_content' THEN 'Rate Content'
  WHEN event_type = 'invite_friend' THEN 'Invite Friend'
  WHEN event_type = 'watch_ads' THEN 'Watch Ads'
  WHEN event_type = 'enable_notifications' THEN 'Enable Notifications'
  WHEN event_type = 'follow_social' THEN 'Follow on Social Media'
  ELSE INITCAP(REPLACE(event_type, '_', ' '))
END
WHERE title = '' OR title IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_gamification_events_title ON gamification_events(title);