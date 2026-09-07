const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TARGET_EMAIL = 'adeyemiadeifeayoayanfe@gmail.com';

function assertEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function main() {
  assertEnv('SUPABASE_URL', process.env.SUPABASE_URL);
  assertEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const authUser = (usersPage.users || []).find((user) => user.email === TARGET_EMAIL);
  if (!authUser) {
    throw new Error(
      `Auth account not found for ${TARGET_EMAIL}. Create it first with bootstrap-super-admins after setting BOOTSTRAP_SUPER_ADMIN_1_PASSWORD.`
    );
  }

  const { data: existingUser, error: userLookupError } = await supabase
    .from('users')
    .select('id,email,role,status,auth_id,email_verified')
    .eq('auth_id', authUser.id)
    .maybeSingle();

  if (userLookupError) {
    throw new Error(`Failed to inspect users row: ${userLookupError.message}`);
  }

  let userRow = existingUser;
  if (!userRow) {
    const { data: createdUser, error: createUserError } = await supabase
      .from('users')
      .insert({
        auth_id: authUser.id,
        email: TARGET_EMAIL,
        role: 'super_admin',
        status: 'active',
        email_verified: true,
      })
      .select('id,email,role,status,auth_id,email_verified')
      .single();

    if (createUserError || !createdUser) {
      throw new Error(`Failed to create users row: ${createUserError?.message || 'unknown error'}`);
    }

    userRow = createdUser;
    console.log('Created users row');
  } else {
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        role: 'super_admin',
        status: 'active',
        email_verified: true,
        email: TARGET_EMAIL,
      })
      .eq('id', userRow.id);

    if (updateUserError) {
      throw new Error(`Failed to repair users row: ${updateUserError.message}`);
    }

    console.log('Repaired existing users row');
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id,user_id,first_name,last_name,phone,address,date_of_birth,gender')
    .eq('user_id', userRow.id)
    .maybeSingle();

  if (profileLookupError) {
    throw new Error(`Failed to inspect profiles row: ${profileLookupError.message}`);
  }

  if (!existingProfile) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from('profiles')
      .insert({
        user_id: userRow.id,
        first_name: 'Adeyemi',
        last_name: 'Ayanfe',
        phone: null,
        address: null,
        date_of_birth: null,
        gender: null,
      })
      .select('id,user_id,first_name,last_name')
      .single();

    if (createProfileError || !createdProfile) {
      throw new Error(
        `Failed to create profile row: ${createProfileError?.message || 'unknown error'}`
      );
    }

    console.log('Created profile row');
  } else {
    console.log('Profile row already present');
  }

  console.log(
    JSON.stringify(
      {
        email: TARGET_EMAIL,
        auth_user_id: authUser.id,
        users_row_id: userRow.id,
        has_profile: true,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
