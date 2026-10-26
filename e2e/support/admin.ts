import { createClient } from "@supabase/supabase-js";

/** Secret-key client for test setup and clean-up against the local stack. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Removes a user created by a test (auth.users stores the phone without the plus). */
export async function deleteUserByPhone(e164: string) {
  const admin = adminClient();
  const phone = e164.replace(/^\+/, "");
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.phone === phone);
    if (user) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
      return;
    }
    if (data.users.length < 200) return;
  }
}

/** A verified account for a test, created without sending an SMS (no rate limit). */
export async function createConfirmedUser(e164: string, password: string, fullName: string) {
  const { error } = await adminClient().auth.admin.createUser({
    phone: e164.replace(/^\+/, ""),
    password,
    phone_confirm: true,
    user_metadata: { full_name: fullName, locale: "en" },
  });
  if (error) throw error;
}
