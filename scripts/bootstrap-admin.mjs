import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!supabaseUrl || !secretKey || !email || !password) {
  throw new Error('Configura SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_EMAIL y ADMIN_PASSWORD.');
}
if (password.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
  throw new Error('ADMIN_PASSWORD debe incluir minúscula, mayúscula, número y símbolo.');
}

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
let user = users.users.find(item => item.email?.toLowerCase() === email);

if (user) {
  const { data, error } = await client.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { error: adminError } = await client.from('admin_users').upsert({
  user_id: user.id,
  display_name: email.split('@')[0],
}, { onConflict: 'user_id' });
if (adminError) throw adminError;

console.log(JSON.stringify({ ok: true, adminUserId: user.id, email: user.email }, null, 2));
