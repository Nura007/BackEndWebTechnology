const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const { Pool } = require('pg');
const path = require('path');

require('dotenv').config();

console.log('Environment loaded. PORT:', process.env.PORT);
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');

// ================= Express =================
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => res.render('index'));
app.get('/constructorsPage', (req, res) => res.render('constructorsPage'));
app.get('/driversPage', (req, res) => res.render('driversPage'));
app.get('/contact', (req, res) => res.render('contact'));
app.get('/add', (req, res) => res.render('add'));
app.get('/mongo', (req, res) => res.render('filters'));

app.get('/drivers/ver', (req, res) => res.render('ver'));
app.get('/drivers/nor', (req, res) => res.render('lando'));
app.get('/drivers/pia', (req, res) => res.render('piastri'));
app.get('/sqll', (req, res) => res.render('sqll'));

// ================= MongoDB (Contact + Constructors) =================
if (!process.env.MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI env var. Set it in .env (local) or Render Environment.');
} else {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));
}

const SchemaContact = new mongoose.Schema({
  name: String,
  email: String,
  number: String,
  message: String,
  date: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', SchemaContact);

app.post('/send-data', async (req, res) => {
  try {
    const contact = new Contact({
      name: req.body.name,
      email: req.body.email,
      number: req.body.number,
      message: req.body.msg
    });

    await contact.save();
    res.json({ status: "success", saved: contact });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const SchemaConstructor = new mongoose.Schema({
  position: Number,
  team: String,
  color: String,
  drivers: String,
  points: Number,
  wins: Number,
  podiums: Number,
  season: Number
});
const Constructor = mongoose.model('Constructor', SchemaConstructor);

app.get('/api/constructors', async (req, res) => {
  try {
    const { season, team, minPoints, maxPoints, fields } = req.query;

    const filter = {};
    if (season) filter.season = Number(season);
    if (team) filter.team = team;

    if (minPoints || maxPoints) {
      filter.points = {};
      if (minPoints) filter.points.$gte = Number(minPoints);
      if (maxPoints) filter.points.$lte = Number(maxPoints);
    }

    let projection = null;
    if (fields) projection = fields.split(',').join(' ');

    const constructors = await Constructor.find(filter, projection).sort({ position: 1 });

    res.json({ count: constructors.length, data: constructors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD constructors (по id)
app.get('/api/constructors/:id', async (req, res) => {
  try {
    const constructor = await Constructor.findById(req.params.id);
    if (!constructor) return res.status(404).json({ error: 'Constructor not found' });
    res.json(constructor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/constructors', async (req, res) => {
  try {
    const { position, team, color, drivers, points, wins, podiums, season } = req.body;
    if (!team || !drivers || !position) {
      return res.status(400).json({ error: 'Position, team, and drivers are required' });
    }

    const constructor = new Constructor({
      position,
      team,
      color,
      drivers,
      points: points || 0,
      wins: wins || 0,
      podiums: podiums || 0,
      season: season || 2024
    });

    await constructor.save();
    res.status(201).json(constructor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/constructors/:id', async (req, res) => {
  try {
    const updated = await Constructor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Constructor not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/constructors/:id', async (req, res) => {
  try {
    const deleted = await Constructor.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Constructor not found' });
    res.json({ message: 'Constructor deleted', deletedId: deleted._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PostgreSQL (Drivers) =================
// ВАЖНО: PG будет включаться только если есть реальные env-переменные (или DATABASE_URL)
let pgPool = null;

function hasPgConfig() {
  return Boolean(process.env.DATABASE_URL || process.env.PG_HOST);
}

async function initPostgres() {
  if (!hasPgConfig()) {
    console.log('ℹ️ PostgreSQL not configured (no DATABASE_URL/PG_HOST). /api/drivers will return 503.');
    return;
  }

  const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined
      };

  pgPool = new Pool(config);

  try {
    await pgPool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        team VARCHAR(100) NOT NULL,
        points INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        podiums INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await pgPool.query('SELECT COUNT(*) FROM drivers');
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      console.log('Seeding initial drivers data...');
      const initialDrivers = [
        { name: 'Max Verstappen', team: 'Red Bull', points: 395, wins: 14, podiums: 18 },
        { name: 'Lando Norris', team: 'McLaren', points: 285, wins: 2, podiums: 12 },
        { name: 'Charles Leclerc', team: 'Ferrari', points: 252, wins: 2, podiums: 8 },
        { name: 'Sergio Perez', team: 'Red Bull', points: 229, wins: 2, podiums: 10 },
        { name: 'Oscar Piastri', team: 'McLaren', points: 197, wins: 1, podiums: 7 }
      ];

      for (const d of initialDrivers) {
        await pgPool.query(
          'INSERT INTO drivers (name, team, points, wins, podiums) VALUES ($1, $2, $3, $4, $5)',
          [d.name, d.team, d.points, d.wins, d.podiums]
        );
      }
      console.log('✅ Drivers seeded');
    } else {
      console.log(`✅ Found ${count} drivers in DB`);
    }
  } catch (err) {
    console.error('❌ PostgreSQL init error:', err.message);
    pgPool = null;
  }
}

function pgNotAvailable(res) {
  return res.status(503).json({
    error: 'PostgreSQL is not configured',
    message: 'Add DATABASE_URL (recommended) or PG_* variables in Render Environment.'
  });
}

app.get('/api/drivers', async (req, res) => {
  if (!pgPool) return pgNotAvailable(res);
  try {
    const result = await pgPool.query('SELECT * FROM drivers ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ================= Info =================
app.get('/api/info', (req, res) => {
  res.json({
    project: "F1 Website",
    version: "1.0.0",
    status: "active",
    uptime: process.uptime(),
    lastUpdated: new Date().toISOString().split('T')[0],
  });
});

// ================= 404 =================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      error: 'API endpoint not found',
      message: `The requested API endpoint ${req.originalUrl} does not exist`
    });
  } else {
    res.status(404).render('404', {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.',
      currentUrl: req.originalUrl
    });
  }
});

// ================= Start =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initPostgres();
});
