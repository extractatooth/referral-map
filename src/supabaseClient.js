import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mdlhlbnxveimagcmuqaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_paeaKrkSeuWMuiunrMQFww_u_PGUmAk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
