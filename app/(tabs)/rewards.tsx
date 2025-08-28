@@ .. @@
 export default function RewardsScreen() {
   const { t } = useTranslation();
   const { authState } = useAuth();
   const { userGamification: gamificationData, processEvent } = useGamification();
   const [activeTab, setActiveTab] = useState<'rewards' | 'ranking' | 'hall'>('rewards');
   const [events, setEvents] = useState<GamificationEvent[]>([]);
   const [achievements, setAchievements] = useState<UserAchievement[]>([]);
   const [loading, setLoading] = useState(true);
+  const [dailyVisitBaseReward, setDailyVisitBaseReward] = useState(0);
   const { language } = useTranslation();
   const { isAvailable, isLoading: campaignLoading } = useCampaignConfig();

@@ .. @@
   useEffect(() => {
     if (authState.user?.smartuserId) {
       loadGamificationData();
+      loadDailyVisitBaseReward();
     }
   }, [authState.user?.smartuserId]);

@@ .. @@
+  const loadDailyVisitBaseReward = async () => {
+    try {
+      // Fetch the daily_visit event to get the base coins reward
+      const { data: dailyVisitEvent, error } = await supabase
+        .from('gamification_events')
+        .select('coins_reward')
+        .eq('event_type', 'daily_visit')
+        .eq('is_active', true)
+        .single();
+
+      if (error) {
+        console.error('Error loading daily visit base reward:', error);
+        // Fallback to default value
+        setDailyVisitBaseReward(20);
+      } else if (dailyVisitEvent) {
+        setDailyVisitBaseReward(dailyVisitEvent.coins_reward);
+        console.log('Daily visit base reward loaded:', dailyVisitEvent.coins_reward);
+      } else {
+        // Fallback if no event found
+        setDailyVisitBaseReward(20);
+      }
+    } catch (error) {
+      console.error('Unexpected error loading daily visit base reward:', error);
+      setDailyVisitBaseReward(20);
+    }
+  };
+
   const loadGamificationData = async () => {
@@ .. @@
             {Array.from({ length: 7 }, (_, i) => {
               const day = i + 1;
               const isCompleted = day <= (gamificationData?.consecutive_days_streak || 0);
-              const coins = day === 1 ? 20 : day === 7 ? 80 : 20 + (day - 1) * 10;
+              const coins = dailyVisitBaseReward * day;
               
               return (