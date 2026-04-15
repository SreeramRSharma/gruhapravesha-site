const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const RSVP_FILE = path.join(__dirname, 'rsvps.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize RSVP file if it doesn't exist
if (!fs.existsSync(RSVP_FILE)) {
  fs.writeFileSync(RSVP_FILE, JSON.stringify([], null, 2));
}

// POST - Save RSVP
app.post('/api/rsvp', (req, res) => {
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

  const sanitize = (str) => str.replace(/[<>&"'/]/g, '');

  const rsvpEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: sanitize(name.trim().slice(0, 100)),
    attendance,
    guests: guestCount,
    message: message ? sanitize(message.trim().slice(0, 500)) : '',
    submittedAt: new Date().toISOString()
  };

  try {
    const data = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
    data.push(rsvpEntry);
    fs.writeFileSync(RSVP_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, message: 'RSVP saved successfully!' });
  } catch (err) {
    console.error('Error saving RSVP:', err);
    res.status(500).json({ error: 'Failed to save RSVP. Please try again.' });
  }
});

// GET - Retrieve RSVPs (optional admin view)
app.get('/api/rsvps', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read RSVPs.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🏠 Housewarming site running at http://localhost:${PORT}\n`);
});
