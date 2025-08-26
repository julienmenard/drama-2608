/*
  # Add Profile Completion Gamification Events

  1. New Events
    - `email_provided` - Reward for providing email address (50 coins)
    - `birth_date_provided` - Reward for providing birth date (30 coins)
    - `complete_profile` - Reward for completing full profile (100 coins)

  2. Security
    - Uses existing RLS policies on gamification_events table
    - Events are active by default
*/

-- Insert profile completion gamification events
INSERT INTO gamification_events (event_type, title, description, coins_reward, is_active, metadata)
VALUES 
  (
    'email_provided',
    'Email Added!',
    'Thank you for providing your email address',
    50,
    true,
    '{"category": "profile", "one_time": true}'::jsonb
  ),
  (
    'birth_date_provided',
    'Birthday Added!',
    'Thank you for providing your birth date',
    30,
    true,
    '{"category": "profile", "one_time": true}'::jsonb
  ),
  (
    'complete_profile',
    'Profile Complete!',
    'Congratulations! Your profile is now complete',
    100,
    true,
    '{"category": "profile", "one_time": true, "requires": ["email", "birth_date"]}'::jsonb
  )
ON CONFLICT (event_type) DO NOTHING;