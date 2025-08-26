/*
  # Create user viewing progress view with episode and series details

  1. New Views
    - `user_viewing_progress_with_details`
      - Joins user_viewing_progress with contents_series_episodes and contents_series
      - Handles polymorphic relationship based on content_type
      - Provides all necessary episode and series information

  2. Security
    - View inherits RLS policies from underlying tables
    - No additional policies needed as view uses existing table permissions
*/

CREATE OR REPLACE VIEW user_viewing_progress_with_details AS
SELECT
  uvp.id,
  uvp.smartuser_id,
  uvp.content_id,
  uvp.content_type,
  uvp.is_completed,
  uvp.completion_percentage,
  uvp.completed_at,
  uvp.created_at,
  uvp.updated_at,
  -- Episode details (when content_type = 'episode')
  cse.title AS episode_title,
  cse.description AS episode_description,
  cse.episode_position,
  cse.season_id,
  cse.series_id AS episode_series_id,
  cse.url_streaming_no_drm AS episode_video_url,
  cse.duration AS episode_duration,
  cse.product_year AS episode_product_year,
  -- Series details (from episode's series or direct series)
  COALESCE(cs_from_episode.title, cs_direct.title) AS series_title,
  COALESCE(cs_from_episode.description, cs_direct.description) AS series_description,
  COALESCE(cs_from_episode.url_covers, cs_direct.url_covers) AS series_thumbnail
FROM user_viewing_progress uvp
LEFT JOIN contents_series_episodes cse ON uvp.content_id = cse.episode_id AND uvp.content_type = 'episode'
LEFT JOIN contents_series cs_from_episode ON cse.series_id = cs_from_episode.serie_id
LEFT JOIN contents_series cs_direct ON uvp.content_id = cs_direct.serie_id AND uvp.content_type = 'series';