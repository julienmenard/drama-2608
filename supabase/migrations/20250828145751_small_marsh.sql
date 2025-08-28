/*
  # Update event_type_category to reference event_categories table

  1. Schema Changes
    - Alter `gamification_events` table to change `event_type_category` from text to uuid
    - Add foreign key constraint to reference `event_categories(id)`
    - Update existing data to use category IDs instead of names

  2. Data Migration
    - Map existing category names to their corresponding IDs in event_categories table
    - Update all existing records to use the new foreign key relationship

  3. Constraints
    - Add foreign key constraint for referential integrity
    - Add index for better query performance
*/

-- First, let's see what categories exist and create a mapping
DO $$
DECLARE
    category_record RECORD;
    event_record RECORD;
BEGIN
    -- Update existing gamification_events to use category IDs
    FOR category_record IN 
        SELECT id, name FROM event_categories
    LOOP
        -- Update events that have this category name to use the category ID
        UPDATE gamification_events 
        SET event_type_category = category_record.id::text
        WHERE event_type_category = category_record.name;
        
        RAISE NOTICE 'Updated events with category "%" to use ID "%"', category_record.name, category_record.id;
    END LOOP;
    
    -- Handle any events that don't have a matching category by creating a default category
    FOR event_record IN 
        SELECT DISTINCT event_type_category 
        FROM gamification_events 
        WHERE event_type_category IS NOT NULL 
        AND event_type_category NOT IN (SELECT id::text FROM event_categories)
        AND event_type_category NOT IN (SELECT name FROM event_categories)
    LOOP
        -- Create missing category
        INSERT INTO event_categories (name, description)
        VALUES (event_record.event_type_category, 'Auto-created category')
        ON CONFLICT (name) DO NOTHING;
        
        -- Update events to use the new category ID
        UPDATE gamification_events 
        SET event_type_category = (
            SELECT id::text FROM event_categories WHERE name = event_record.event_type_category
        )
        WHERE event_type_category = event_record.event_type_category;
        
        RAISE NOTICE 'Created new category "%" and updated events', event_record.event_type_category;
    END LOOP;
END $$;

-- Now alter the column type to uuid
ALTER TABLE gamification_events 
ALTER COLUMN event_type_category TYPE uuid 
USING event_type_category::uuid;

-- Add foreign key constraint
ALTER TABLE gamification_events 
ADD CONSTRAINT fk_gamification_events_category 
FOREIGN KEY (event_type_category) REFERENCES event_categories(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_gamification_events_category_id 
ON gamification_events(event_type_category);

-- Update the existing index name for consistency
DROP INDEX IF EXISTS idx_gamification_events_type;
CREATE INDEX idx_gamification_events_event_type 
ON gamification_events(event_type);