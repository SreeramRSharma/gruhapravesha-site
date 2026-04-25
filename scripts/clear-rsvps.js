const fs = require('fs');
const path = require('path');
const readline = require('readline');

const USE_DB = !!process.env.DATABASE_URL;
const RSVP_FILE = path.join(__dirname, '..', 'rsvps.json');

async function clearRSVPs() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise(resolve => {
    rl.question('⚠️  This will DELETE all RSVP data. Are you sure? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled — no data was deleted.');
    return;
  }

  if (USE_DB) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const countResult = await pool.query('SELECT COUNT(*) AS count FROM rsvps');
    const count = parseInt(countResult.rows[0].count, 10);

    await pool.query('DELETE FROM rsvps');
    await pool.end();

    console.log(`✅ Cleared ${count} RSVP(s) from PostgreSQL database.`);
  } else {
    if (!fs.existsSync(RSVP_FILE)) {
      console.log('No RSVP file found — nothing to clear.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
    const count = data.length;

    fs.writeFileSync(RSVP_FILE, JSON.stringify([], null, 2));

    console.log(`✅ Cleared ${count} RSVP(s) from rsvps.json.`);
  }
}

clearRSVPs().catch(err => {
  console.error('Clear failed:', err);
  process.exit(1);
});
