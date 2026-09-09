import { createClient } from '@supabase/supabase-js'

// Reemplaza estos dos valores con los que copiaste en el paso 5:
// Project Settings > API, en tu proyecto "pendientes-app" de Supabase
// (Project URL y anon/public key)
const supabaseUrl = 'https://aerpdleabrbsxqivxksr.supabase.co'
const supabaseKey = 'sb_publishable_SWB27RnGeIr9LMtyqsx1kg_b9BjsvH4'

export const supabase = createClient(supabaseUrl, supabaseKey)