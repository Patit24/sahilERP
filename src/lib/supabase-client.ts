import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const remoteStorageFlag = import.meta.env.VITE_ENABLE_REMOTE_STORAGE as string | undefined
const supabaseAuthFlag = import.meta.env.VITE_ENABLE_SUPABASE_AUTH as string | undefined
const disableLocalCacheFlag = import.meta.env.VITE_DISABLE_LOCAL_CACHE as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)
export const isRemoteStorageEnabled = remoteStorageFlag === 'true'
export const isSupabaseAuthEnabled = supabaseAuthFlag === 'true'
export const isLocalCacheDisabled = disableLocalCacheFlag === 'true'

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: isSupabaseAuthEnabled,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 5
        }
      }
    })
  : null
