import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 客户端客户端（受 RLS 保护）
export const supabaseClient = createClient(supabaseUrl, anonKey);
