import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dfphthobzdrvhirnxbgp.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcGh0aG9iemRydmhpcm54YmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTMxOTQsImV4cCI6MjA2ODIyOTE5NH0.t91lV3oA7BtFZyT71ByxyJVIzBexwZdmCVt0DgpBKjc';

// Only create Supabase client if environment variables are properly configured
export const supabase = createClient(supabaseUrl, supabaseAnonKey);