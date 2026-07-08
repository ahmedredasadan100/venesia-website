import { createClient } from "@supabase/supabase-js";

import { createSupabaseFetch } from "./supabase-fetch";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: createSupabaseFetch(),
    },
  },
);