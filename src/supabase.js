import { createClient } from '@supabase/supabase-js'

// ============================================
// 在 Supabase 控制台 → Settings → API 中获取：
// - Project URL
// - anon / public key
// ============================================
const SUPABASE_URL = 'https://zaehdlhuoyeiuwxxipdl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Tv5l6dfFMaxH1tjLNXDi4w_t29wz9DS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
