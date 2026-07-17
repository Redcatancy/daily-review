import { supabase } from './supabase.js'

let currentUser = null

export async function signInWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin
    }
  })
  if (error) console.error('登录失败:', error.message)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('退出失败:', error.message)
  currentUser = null
}

export function getCurrentUser() {
  return currentUser
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null
    callback(currentUser)
  })
}

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  currentUser = session?.user ?? null
  return currentUser
}
