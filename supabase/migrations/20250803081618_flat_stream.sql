/*
  # Add fake user favorites data

  1. Data Insertion
    - Add favorite series and episodes for users 38286633 and 38286717
    - Include both serie and episode content types
    - Use existing content IDs from the database
    - Distribute favorites across different campaign configurations

  2. Test Data Coverage
    - User 38286633: Mix of series and episodes
    - User 38286717: Different mix of content
    - Various creation dates for realistic testing
*/

-- Insert fake favorites for user 38286633
INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at) VALUES
-- Series favorites
('38286633', 1, 'serie', '2024-01-15 10:30:00+00', '2024-01-15 10:30:00+00'),
('38286633', 3, 'serie', '2024-01-20 14:15:00+00', '2024-01-20 14:15:00+00'),
('38286633', 5, 'serie', '2024-02-01 09:45:00+00', '2024-02-01 09:45:00+00'),

-- Episode favorites
('38286633', 101, 'episode', '2024-01-18 16:20:00+00', '2024-01-18 16:20:00+00'),
('38286633', 102, 'episode', '2024-01-25 11:10:00+00', '2024-01-25 11:10:00+00'),
('38286633', 201, 'episode', '2024-02-05 13:30:00+00', '2024-02-05 13:30:00+00'),
('38286633', 301, 'episode', '2024-02-10 15:45:00+00', '2024-02-10 15:45:00+00');

-- Insert fake favorites for user 38286717
INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at) VALUES
-- Series favorites
('38286717', 2, 'serie', '2024-01-12 08:20:00+00', '2024-01-12 08:20:00+00'),
('38286717', 4, 'serie', '2024-01-28 12:40:00+00', '2024-01-28 12:40:00+00'),

-- Episode favorites
('38286717', 103, 'episode', '2024-01-16 17:25:00+00', '2024-01-16 17:25:00+00'),
('38286717', 104, 'episode', '2024-01-22 19:15:00+00', '2024-01-22 19:15:00+00'),
('38286717', 202, 'episode', '2024-02-03 10:50:00+00', '2024-02-03 10:50:00+00'),
('38286717', 203, 'episode', '2024-02-08 14:35:00+00', '2024-02-08 14:35:00+00'),
('38286717', 302, 'episode', '2024-02-12 16:20:00+00', '2024-02-12 16:20:00+00');