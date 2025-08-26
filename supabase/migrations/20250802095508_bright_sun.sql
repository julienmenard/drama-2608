/*
  # Insert fake viewing progress data

  1. Purpose
    - Insert sample viewing progress data for testing users
    - Uses existing episode IDs from contents_series_episodes table
    - Creates realistic viewing patterns with various completion states

  2. Users
    - User ID: 38286633 (6 episodes with mixed progress)
    - User ID: 38286717 (6 episodes with different viewing patterns)

  3. Data Pattern
    - Mix of completed (100%) and in-progress episodes
    - Recent viewing activity over past few days
    - Various completion percentages (12%, 23%, 45%, etc.)
*/

-- Insert fake viewing progress data for specified users
WITH episode_data AS (
  SELECT 
    unnest(ARRAY[1, 2, 3, 4, 5, 6]) as episode_num,
    unnest(ARRAY[100, 23, 45, 78, 100, 12]) as completion_percentage,
    unnest(ARRAY[
      now() - interval '1 day',
      now() - interval '2 days', 
      now() - interval '3 days',
      now() - interval '1 day',
      now() - interval '4 days',
      now() - interval '5 days'
    ]) as completed_at,
    unnest(ARRAY[true, false, false, false, true, false]) as is_completed
),
users_to_insert AS (
  SELECT unnest(ARRAY['38286633', '38286717']) as smartuser_id
)
INSERT INTO user_viewing_progress (
  smartuser_id,
  content_id,
  content_type,
  completion_percentage,
  is_completed,
  completed_at,
  created_at,
  updated_at
)
SELECT 
  u.smartuser_id,
  e.episode_id,
  'episode' as content_type,
  ed.completion_percentage,
  ed.is_completed,
  CASE WHEN ed.is_completed THEN ed.completed_at ELSE NULL END,
  ed.completed_at,
  ed.completed_at
FROM users_to_insert u
CROSS JOIN episode_data ed
CROSS JOIN (
  SELECT episode_id, ROW_NUMBER() OVER (ORDER BY episode_id) as rn
  FROM contents_series_episodes 
  LIMIT 6
) e
WHERE e.rn = ed.episode_num
ON CONFLICT (smartuser_id, content_id, content_type) 
DO UPDATE SET
  completion_percentage = EXCLUDED.completion_percentage,
  is_completed = EXCLUDED.is_completed,
  completed_at = EXCLUDED.completed_at,
  updated_at = EXCLUDED.updated_at;