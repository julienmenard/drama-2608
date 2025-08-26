/*
  # Add fake user favorites data using real content IDs

  1. Data Insertion
    - Add favorite series and episodes for users 38286633 and 38286717
    - Use actual content IDs from contents_series and contents_series_episodes tables
    - Include realistic timestamps for testing

  2. Content Selection
    - User 38286633: Gets favorites from various series and episodes
    - User 38286717: Gets different set of favorites for testing variety
    - Uses existing campaign_countries_languages_id values

  3. Data Integrity
    - Only inserts data if the referenced content exists
    - Uses conditional inserts to avoid conflicts
*/

-- First, let's get some real content IDs and insert favorites for user 38286633
DO $$
DECLARE
    campaign_id uuid;
    serie_ids integer[];
    episode_ids integer[];
BEGIN
    -- Get a campaign_countries_languages_id to use
    SELECT id INTO campaign_id 
    FROM campaign_countries_languages 
    LIMIT 1;
    
    IF campaign_id IS NULL THEN
        RAISE NOTICE 'No campaign_countries_languages_id found, skipping fake data insertion';
        RETURN;
    END IF;
    
    -- Get some series IDs
    SELECT ARRAY(
        SELECT serie_id 
        FROM contents_series 
        WHERE campaign_countries_languages_id = campaign_id 
        LIMIT 3
    ) INTO serie_ids;
    
    -- Get some episode IDs
    SELECT ARRAY(
        SELECT episode_id 
        FROM contents_series_episodes 
        WHERE campaign_countries_languages_id = campaign_id 
        LIMIT 5
    ) INTO episode_ids;
    
    -- Insert favorite series for user 38286633
    IF array_length(serie_ids, 1) > 0 THEN
        INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at)
        SELECT 
            '38286633',
            unnest(serie_ids[1:LEAST(3, array_length(serie_ids, 1))]),
            'serie',
            NOW() - INTERVAL '1 day' * (ROW_NUMBER() OVER()),
            NOW() - INTERVAL '1 day' * (ROW_NUMBER() OVER())
        ON CONFLICT (smartuser_id, content_id, content_type) DO NOTHING;
    END IF;
    
    -- Insert favorite episodes for user 38286633
    IF array_length(episode_ids, 1) > 0 THEN
        INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at)
        SELECT 
            '38286633',
            unnest(episode_ids[1:LEAST(4, array_length(episode_ids, 1))]),
            'episode',
            NOW() - INTERVAL '2 hours' * (ROW_NUMBER() OVER()),
            NOW() - INTERVAL '2 hours' * (ROW_NUMBER() OVER())
        ON CONFLICT (smartuser_id, content_id, content_type) DO NOTHING;
    END IF;
    
    -- Get different series IDs for user 38286717
    SELECT ARRAY(
        SELECT serie_id 
        FROM contents_series 
        WHERE campaign_countries_languages_id = campaign_id 
        AND serie_id != ALL(serie_ids)
        LIMIT 2
    ) INTO serie_ids;
    
    -- Get different episode IDs for user 38286717
    SELECT ARRAY(
        SELECT episode_id 
        FROM contents_series_episodes 
        WHERE campaign_countries_languages_id = campaign_id 
        AND episode_id != ALL(episode_ids)
        LIMIT 3
    ) INTO episode_ids;
    
    -- Insert favorite series for user 38286717
    IF array_length(serie_ids, 1) > 0 THEN
        INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at)
        SELECT 
            '38286717',
            unnest(serie_ids),
            'serie',
            NOW() - INTERVAL '3 days' * (ROW_NUMBER() OVER()),
            NOW() - INTERVAL '3 days' * (ROW_NUMBER() OVER())
        ON CONFLICT (smartuser_id, content_id, content_type) DO NOTHING;
    END IF;
    
    -- Insert favorite episodes for user 38286717
    IF array_length(episode_ids, 1) > 0 THEN
        INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at)
        SELECT 
            '38286717',
            unnest(episode_ids),
            'episode',
            NOW() - INTERVAL '6 hours' * (ROW_NUMBER() OVER()),
            NOW() - INTERVAL '6 hours' * (ROW_NUMBER() OVER())
        ON CONFLICT (smartuser_id, content_id, content_type) DO NOTHING;
    END IF;
    
    RAISE NOTICE 'Fake user favorites data inserted successfully for users 38286633 and 38286717';
END $$;