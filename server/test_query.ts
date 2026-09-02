import db from './db.js';
async function run() {
  const accounts = await db.all("SELECT id, platform, username, project_id, user_id FROM social_accounts WHERE platform = 'facebook' OR platform = 'instagram'");
  console.log(accounts);
  process.exit(0);
}
run();
