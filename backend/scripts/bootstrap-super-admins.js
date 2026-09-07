const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD_ONE = process.env.BOOTSTRAP_SUPER_ADMIN_1_PASSWORD;
const PASSWORD_TWO = process.env.BOOTSTRAP_SUPER_ADMIN_2_PASSWORD;

const ACCOUNTS = [
  { email: 'adeyemiadeifeayoayanfe@gmail.com', password: PASSWORD_ONE },
  { email: 'cemkebbistate@gmail.com', password: PASSWORD_TWO },
];

function assertEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function listAuthUsers(supabase) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new Error(`Failed to list auth users: ${error.message}`);
  }

  return data.users || [];
}

async function ensureProfile(supabase, userId, email) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to check profile for ${email}: ${profileError.message}`);
  }

  if (profile) {
    return;
  }

  const localPart = email.split('@')[0];
  const firstName = localPart.slice(0, 1).toUpperCase() + localPart.slice(1).replace(/[._-]/g, ' ');

  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    first_name: firstName || 'Super',
    last_name: 'Admin',
  });

  if (error) {
    throw new Error(`Failed to create profile for ${email}: ${error.message}`);
  }
}

async function ensureAppUser(supabase, authUser, email) {
  const { data: existingUser, error: userLookupError } = await supabase
    .from('users')
    .select('id, auth_id, role')
    .eq('email', email)
    .maybeSingle();

  if (userLookupError) {
    throw new Error(`Failed to check app user for ${email}: ${userLookupError.message}`);
  }

  if (existingUser) {
    const updatePayload = {
      auth_id: authUser.id,
      role: 'super_admin',
      status: 'active',
      email_verified: true,
    };

    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', existingUser.id);

    if (updateError) {
      throw new Error(`Failed to update app user for ${email}: ${updateError.message}`);
    }

    await ensureProfile(supabase, existingUser.id, email);
    return { userId: existingUser.id, created: false };
  }

  const { data: createdUser, error: createUserError } = await supabase
    .from('users')
    .insert({
      auth_id: authUser.id,
      email,
      role: 'super_admin',
      status: 'active',
      email_verified: true,
    })
    .select('id')
    .single();

  if (createUserError || !createdUser) {
    throw new Error(`Failed to create app user for ${email}: ${createUserError?.message || 'unknown error'}`);
  }

  await ensureProfile(supabase, createdUser.id, email);
  return { userId: createdUser.id, created: true };
}

async function bootstrap() {
  assertEnv('SUPABASE_URL', SUPABASE_URL);
  assertEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
  assertEnv('BOOTSTRAP_SUPER_ADMIN_1_PASSWORD', PASSWORD_ONE);
  assertEnv('BOOTSTRAP_SUPER_ADMIN_2_PASSWORD', PASSWORD_TWO);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authUsers = await listAuthUsers(supabase);
  const results = [];

  for (const account of ACCOUNTS) {
    let authUser = authUsers.find((user) => user.email === account.email) || null;
    let createdAuth = false;

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new Error(`Failed to create auth user for ${account.email}: ${error?.message || 'unknown error'}`);
      }

      authUser = data.user;
      createdAuth = true;
    } else {
      const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: account.password,
        email_confirm: true,
      });

      if (error) {
        throw new Error(`Failed to update auth user for ${account.email}: ${error.message}`);
      }
    }

    const appUserResult = await ensureAppUser(supabase, authUser, account.email);

    results.push({
      email: account.email,
      auth_user: createdAuth ? 'created' : 'reused',
      app_user: appUserResult.created ? 'created' : 'reused',
      user_id: appUserResult.userId,
    });
  }

  console.log(JSON.stringify({ success: true, results }, null, 2));
}

bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
