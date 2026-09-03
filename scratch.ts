import db from './server/db.js';
async function main() {
    const rows = await db.all('SELECT feature_key, section, feature_name, SUM(tokens_used) as total_tokens FROM ai_usage_logs GROUP BY feature_key, section, feature_name;');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}
main().catch(console.error);
