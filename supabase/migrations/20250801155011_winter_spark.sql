/*
  # Ensure required gamification events exist

  1. New Records
    - Creates essential gamification events if they don't exist
    - `daily_login` - Daily visit rewards with streak multiplier
    - `watch_episode` - Rewards for watching content
    - `enable_notifications` - One-time reward for enabling notifications
    - `complete_profile` - Reward for completing user profile
    - `share_content` - Reward for sharing content

  2. Data Integrity
    - Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates
    - Ensures all events are active by default
    - Sets reasonable coin rewards for each event type
*/

-- Insert required gamification events if they don't exist
INSERT INTO gamification_events (event_type, title, description, coins_reward, is_active, metadata)
VALUES 
  ('daily_login', 'Daily Login', 'Earn coins for logging in daily (multiplied by streak)', 20, true, '{"streak_multiplier": true}'),
  ('watch_episode', 'Watch Episode', 'Earn coins for watching an episode', 10, true, '{}'),
  ('enable_notifications', 'Enable Notifications', 'One-time reward for enabling notifications', 50, true, '{"one_time": true}'),
  ('complete_profile', 'Complete Profile', 'Reward for completing your profile', 100, true, '{"one_time": true}'),
  ('share_content', 'Share Content', 'Earn coins for sharing content', 15, true, '{}')
ON CONFLICT (event_type) DO NOTHING;