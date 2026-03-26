import { createClient } from "@supabase/supabase-js";

// This client is used ONLY for Supabase Auth (admin sign-in / sign-out).
// All other DB operations go through edge functions with service_role.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
