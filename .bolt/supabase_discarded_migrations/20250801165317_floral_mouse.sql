@@ .. @@
 INSERT INTO gamification_events (event_type, title, description, coins_reward, is_active, metadata)
 VALUES
-  ('daily_login', 'Daily Login', 'Login to the app daily to maintain your streak', 20, true, '{"multiplier": "streak"}'),
+  ('daily_visit', 'Daily Visit', 'Visit the app daily to maintain your streak', 20, true, '{"multiplier": "streak"}'),
   ('watch_episode', 'Watch Episode', 'Watch a complete episode', 10, true, '{}'),