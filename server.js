const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USE_DB = !!process.env.DATABASE_URL;
const RSVP_FILE = path.join(__dirname, 'rsvps.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PostgreSQL Setup (production) ───────────────────────
let pool;
if (USE_DB) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

async function initDB() {
  if (USE_DB) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rsvps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        attendance VARCHAR(20) NOT NULL,
        guests INTEGER NOT NULL DEFAULT 2,
        message TEXT DEFAULT '',
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✅ PostgreSQL database ready');
  } else {
    if (!fs.existsSync(RSVP_FILE)) {
      fs.writeFileSync(RSVP_FILE, JSON.stringify([], null, 2));
    }
    console.log('  📁 Using local file storage (rsvps.json)');
  }
}

const sanitize = (str) => str.replace(/[<>&"'/]/g, '');

// ── POST - Save RSVP ───────────────────────────────────
app.post('/api/rsvp', async (req, res) => {
  const { name, attendance, guests, message } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!attendance || !['attending', 'not-attending'].includes(attendance)) {
    return res.status(400).json({ error: 'Valid attendance selection is required.' });
  }

  const guestCount = parseInt(guests, 10);
  if (isNaN(guestCount) || guestCount < 1 || guestCount > 20) {
    return res.status(400).json({ error: 'Number of guests must be between 1 and 20.' });
  }

  const cleanName = sanitize(name.trim().slice(0, 100));
  const cleanMsg = message ? sanitize(message.trim().slice(0, 500)) : '';

  try {
    if (USE_DB) {
      await pool.query(
        'INSERT INTO rsvps (name, attendance, guests, message) VALUES ($1, $2, $3, $4)',
        [cleanName, attendance, guestCount, cleanMsg]
      );
    } else {
      const data = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
      data.push({ name: cleanName, attendance, guests: guestCount, message: cleanMsg, submittedAt: new Date().toISOString() });
      fs.writeFileSync(RSVP_FILE, JSON.stringify(data, null, 2));
    }
    res.json({ success: true, message: 'RSVP saved successfully!' });
  } catch (err) {
    console.error('Error saving RSVP:', err);
    res.status(500).json({ error: 'Failed to save RSVP. Please try again.' });
  }
});

// ── GET - Retrieve RSVPs ────────────────────────────────
app.get('/api/rsvps', async (req, res) => {
  try {
    if (USE_DB) {
      const result = await pool.query(
        'SELECT name, attendance, guests, message, submitted_at AS "submittedAt" FROM rsvps ORDER BY submitted_at DESC'
      );
      res.json(result.rows);
    } else {
      const data = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
      res.json(data);
    }
  } catch (err) {
    console.error('Error reading RSVPs:', err);
    res.status(500).json({ error: 'Failed to read RSVPs.' });
  }
});

// ── Start ───────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏠 Housewarming site running at http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
