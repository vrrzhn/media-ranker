import { createClient } from '@supabase/supabase-js'

// Grabs your private keys from the .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Creates the authenticated connection tool
export const supabase = createClient(supabaseUrl, supabaseAnonKey)