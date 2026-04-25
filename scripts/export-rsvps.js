const fs = require('fs');
const path = require('path');

const USE_DB = !!process.env.DATABASE_URL;
const RSVP_FILE = path.join(__dirname, '..', 'rsvps.json');

async function exportRSVPs() {
  let rows;

  if (USE_DB) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const result = await pool.query(
      'SELECT name, attendance, guests, message, submitted_at AS "submittedAt" FROM rsvps ORDER BY submitted_at DESC'
    );
    rows = result.rows;
    await pool.end();
  } else {
    if (!fs.existsSync(RSVP_FILE)) {
      console.log('No RSVPs found.');
      return;
    }
    rows = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
  }

  if (rows.length === 0) {
    console.log('No RSVPs found.');
    return;
  }

  // Print summary
  const attending = rows.filter(r => r.attendance === 'attending');
  const declined = rows.filter(r => r.attendance === 'not-attending');
  const totalGuests = attending.reduce((sum, r) => sum + (r.guests || 0), 0);

  console.log('═══════════════════════════════════════');
  console.log('  RSVP Export');
  console.log('═══════════════════════════════════════');
  console.log(`  Total responses : ${rows.length}`);
  console.log(`  Attending       : ${attending.length}`);
  console.log(`  Total guests    : ${totalGuests}`);
  console.log(`  Declined        : ${declined.length}`);
  console.log('═══════════════════════════════════════\n');

  // Print table
  console.log('Name'.padEnd(25) + 'Status'.padEnd(16) + 'Guests'.padEnd(8) + 'Message');
  console.log('─'.repeat(70));
  for (const r of rows) {
    const name = (r.name || '').slice(0, 24).padEnd(25);
    const status = (r.attendance || '').padEnd(16);
    const guests = String(r.guests || 0).padEnd(8);
    const msg = (r.message || '').slice(0, 40);
    console.log(`${name}${status}${guests}${msg}`);
  }

  // Export to CSV
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvFile = path.join(__dirname, '..', `rsvps-export-${timestamp}.csv`);
  const header = 'Name,Attendance,Guests,Message,Submitted At';
  const csvRows = rows.map(r => {
    const msg = (r.message || '').replace(/"/g, '""');
    return `"${r.name}","${r.attendance}",${r.guests},"${msg}","${r.submittedAt || ''}"`;
  });
  fs.writeFileSync(csvFile, [header, ...csvRows].join('\n'));
  console.log(`\n✅ Exported to ${csvFile}`);
}

exportRSVPs().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
