/*
  # Add gamification event translations

  1. New Tables
    - `gamification_event_translations`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to gamification_events)
      - `language_code` (text, e.g., 'en', 'fr')
      - `title` (text, translated title)
      - `description` (text, translated description)
      - `message` (text, translated notification message)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Update gamification_events metadata to mark events as one_time
    - Add indexes for performance
    - Add RLS policies

  3. Security
    - Enable RLS on gamification_event_translations table
    - Add policies for public read access and service role management
*/

-- Update existing gamification_events to mark them as one_time
UPDATE gamification_events 
SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{one_time}', 'true')
WHERE event_type IN ('email_provided', 'birth_date_provided', 'complete_profile');

-- Create gamification_event_translations table
CREATE TABLE IF NOT EXISTS gamification_event_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  language_code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, language_code)
);

-- Add foreign key constraint
ALTER TABLE gamification_event_translations 
ADD CONSTRAINT fk_gamification_event_translations_event_id 
FOREIGN KEY (event_id) REFERENCES gamification_events(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gamification_event_translations_event_id 
ON gamification_event_translations(event_id);

CREATE INDEX IF NOT EXISTS idx_gamification_event_translations_language 
ON gamification_event_translations(language_code);

CREATE INDEX IF NOT EXISTS idx_gamification_event_translations_event_lang 
ON gamification_event_translations(event_id, language_code);

-- Enable RLS
ALTER TABLE gamification_event_translations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Public can read gamification event translations"
ON gamification_event_translations
FOR SELECT
TO public
USING (true);

CREATE POLICY "Service role can manage gamification event translations"
ON gamification_event_translations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_gamification_event_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_gamification_event_translations_updated_at
  BEFORE UPDATE ON gamification_event_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_gamification_event_translations_updated_at();

-- Insert default translations for existing events
DO $$
DECLARE
  event_record RECORD;
BEGIN
  -- Loop through existing gamification events
  FOR event_record IN 
    SELECT id, event_type, title, description 
    FROM gamification_events 
    WHERE is_active = true
  LOOP
    -- Insert English translations
    INSERT INTO gamification_event_translations (event_id, language_code, title, description, message)
    VALUES (
      event_record.id,
      'en',
      event_record.title,
      event_record.description,
      CASE event_record.event_type
        WHEN 'daily_visit' THEN 'You earned coins for your daily visit!'
        WHEN 'email_provided' THEN 'You earned coins for providing your email!'
        WHEN 'birth_date_provided' THEN 'You earned coins for providing your date of birth!'
        WHEN 'complete_profile' THEN 'You earned coins for completing your profile!'
        WHEN 'watch_episode' THEN 'You earned coins for watching an episode!'
        WHEN 'watch_ads' THEN 'You earned coins for watching ads!'
        WHEN 'enable_notifications' THEN 'You earned coins for enabling notifications!'
        WHEN 'follow_social' THEN 'You earned coins for following us on social media!'
        ELSE 'You earned coins!'
      END
    )
    ON CONFLICT (event_id, language_code) DO NOTHING;

    -- Insert French translations
    INSERT INTO gamification_event_translations (event_id, language_code, title, description, message)
    VALUES (
      event_record.id,
      'fr',
      CASE event_record.event_type
        WHEN 'daily_visit' THEN 'Visite quotidienne'
        WHEN 'email_provided' THEN 'Email fourni'
        WHEN 'birth_date_provided' THEN 'Date de naissance fournie'
        WHEN 'complete_profile' THEN 'Profil complet'
        WHEN 'watch_episode' THEN 'Regarder un épisode'
        WHEN 'watch_ads' THEN 'Regarder des publicités'
        WHEN 'enable_notifications' THEN 'Activer les notifications'
        WHEN 'follow_social' THEN 'Suivre sur les réseaux sociaux'
        ELSE event_record.title
      END,
      CASE event_record.event_type
        WHEN 'daily_visit' THEN 'Gagnez des pièces en visitant l''application quotidiennement'
        WHEN 'email_provided' THEN 'Gagnez des pièces en fournissant votre adresse email'
        WHEN 'birth_date_provided' THEN 'Gagnez des pièces en fournissant votre date de naissance'
        WHEN 'complete_profile' THEN 'Gagnez des pièces en complétant votre profil'
        WHEN 'watch_episode' THEN 'Gagnez des pièces en regardant des épisodes'
        WHEN 'watch_ads' THEN 'Gagnez des pièces en regardant des publicités'
        WHEN 'enable_notifications' THEN 'Gagnez des pièces en activant les notifications'
        WHEN 'follow_social' THEN 'Gagnez des pièces en nous suivant sur les réseaux sociaux'
        ELSE event_record.description
      END,
      CASE event_record.event_type
        WHEN 'daily_visit' THEN 'Vous avez gagné des pièces pour votre visite quotidienne !'
        WHEN 'email_provided' THEN 'Vous avez gagné des pièces pour avoir fourni votre email !'
        WHEN 'birth_date_provided' THEN 'Vous avez gagné des pièces pour avoir fourni votre date de naissance !'
        WHEN 'complete_profile' THEN 'Vous avez gagné des pièces pour avoir complété votre profil !'
        WHEN 'watch_episode' THEN 'Vous avez gagné des pièces pour avoir regardé un épisode !'
        WHEN 'watch_ads' THEN 'Vous avez gagné des pièces pour avoir regardé des publicités !'
        WHEN 'enable_notifications' THEN 'Vous avez gagné des pièces pour avoir activé les notifications !'
        WHEN 'follow_social' THEN 'Vous avez gagné des pièces pour nous avoir suivi sur les réseaux sociaux !'
        ELSE 'Vous avez gagné des pièces !'
      END
    )
    ON CONFLICT (event_id, language_code) DO NOTHING;
  END LOOP;
END $$;