const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4242;
const ADMIN_KEY = process.env.ADMIN_KEY || 'feflddb2026';
const DEFAULT_TOTAL = 10;
const DEFAULT_OFFSET = 0;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function buildStats(data) {
  const registrationCount = data.registrations.length;
  const { baseOffset, totalTarget } = data.settings;
  const displayCount = registrationCount + baseOffset;
  const percent = Math.min(100, Math.round((displayCount / totalTarget) * 100));
  return {
    count: displayCount,
    registrationCount,
    baseOffset,
    total: totalTarget,
    percent,
  };
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key') || req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Wrap async handlers so any rejection sends a 500
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ────────────────────────────────────────
// Public routes
// ────────────────────────────────────────
app.post('/api/register', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const department = String(req.body.department || '').trim();

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
  }
  if (!department) {
    return res.status(400).json({ error: 'กรุณาเลือกแผนก' });
  }

  const data = await db.getAll();
  const dup = data.registrations.find(
    (r) =>
      r.name.trim().toLowerCase() === name.toLowerCase() &&
      (r.department || '').trim().toLowerCase() === department.toLowerCase()
  );
  if (dup) {
    return res.status(409).json({ error: 'ชื่อนี้ลงทะเบียนในแผนกนี้แล้ว' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    phone: '',
    department,
    registeredAt: new Date().toISOString(),
  };
  await db.addRegistration(entry);

  const data2 = await db.getAll();
  const stats = buildStats(data2);
  res.json({ ok: true, ...stats, entry: { id: entry.id, name: entry.name } });
}));

app.get('/api/stats', wrap(async (req, res) => {
  const data = await db.getAll();
  res.json(buildStats(data));
}));

app.get('/api/recent', wrap(async (req, res) => {
  const data = await db.getAll();
  const recent = data.registrations.slice(-10).reverse().map((r) => ({
    name: r.name,
    department: r.department,
  }));
  res.json({ recent });
}));

// ────────────────────────────────────────
// Admin routes
// ────────────────────────────────────────
app.get('/api/admin/registrations', requireAdmin, wrap(async (req, res) => {
  const data = await db.getAll();
  const stats = buildStats(data);
  res.json({
    ...stats,
    registrations: data.registrations.slice().reverse(),
    winners: data.winners,
    settings: data.settings,
  });
}));

app.delete('/api/admin/registrations/:id', requireAdmin, wrap(async (req, res) => {
  const removed = await db.removeRegistration(req.params.id);
  if (!removed) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  const data = await db.getAll();
  res.json({ ok: true, count: data.registrations.length });
}));

app.get('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const data = await db.getAll();
  res.json({ settings: data.settings, ...buildStats(data) });
}));

app.post('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const baseOffset = parseInt(req.body.baseOffset, 10);
  const totalTarget = parseInt(req.body.totalTarget, 10);
  if (Number.isFinite(baseOffset) && baseOffset >= 0) {
    await db.setSetting('baseOffset', baseOffset);
  }
  if (Number.isFinite(totalTarget) && totalTarget > 0) {
    await db.setSetting('totalTarget', totalTarget);
  }
  const data = await db.getAll();
  res.json({ ok: true, settings: data.settings, ...buildStats(data) });
}));

app.post('/api/admin/lucky-draw', requireAdmin, wrap(async (req, res) => {
  const count = Math.max(1, Math.min(20, parseInt(req.body.count, 10) || 1));
  const excludePrevious = !!req.body.excludePrevious;
  const data = await db.getAll();

  const previousIds = new Set();
  for (const round of data.winners) {
    for (const w of round.winners || []) previousIds.add(w.id);
  }
  let pool = data.registrations.slice();
  if (excludePrevious) {
    pool = pool.filter((r) => !previousIds.has(r.id));
  }

  if (pool.length === 0) {
    return res.status(400).json({ error: 'ไม่มีผู้เข้าร่วมที่จับรางวัลได้' });
  }

  const picked = [];
  const drawCount = Math.min(count, pool.length);
  for (let i = 0; i < drawCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  const round = {
    drawnAt: new Date().toISOString(),
    winners: picked.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      department: p.department,
    })),
  };
  await db.addWinnerRound(round);
  res.json({ ok: true, round });
}));

app.post('/api/admin/winners/clear', requireAdmin, wrap(async (req, res) => {
  await db.clearWinners();
  res.json({ ok: true });
}));

app.get('/api/admin/export', requireAdmin, wrap(async (req, res) => {
  const data = await db.getAll();
  const header = 'ลำดับ,ชื่อ-นามสกุล,เบอร์โทร,แผนก,เวลาที่ลงทะเบียน\n';
  const rows = data.registrations
    .map((r, i) => {
      const safe = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
      return [
        i + 1,
        safe(r.name),
        safe(r.phone),
        safe(r.department),
        safe(new Date(r.registeredAt).toLocaleString('th-TH')),
      ].join(',');
    })
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="feflddb-earthday-registrations.csv"'
  );
  res.send('﻿' + header + rows);
}));

// ────────────────────────────────────────
// Page routes
// ────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/lucky-draw', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lucky-draw.html'));
});

app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

// Health check (useful for Railway / uptime monitors)
app.get('/healthz', (req, res) => res.json({ ok: true, db: db.isPostgres ? 'postgres' : 'json' }));

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ────────────────────────────────────────
// Boot
// ────────────────────────────────────────
(async () => {
  try {
    await db.init();
  } catch (e) {
    console.error('❌ Database init failed:', e.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`🌱 FEFLDDB Earth Day Town Hall server running on http://localhost:${PORT}`);
    if (db.isPostgres) {
      console.log(`📦 Storage: PostgreSQL (DATABASE_URL)`);
    } else {
      console.log(`📦 Storage: JSON file at ${db.jsonPath}`);
    }
    console.log(`👉 Public:     http://localhost:${PORT}/`);
    console.log(`👉 Admin:      http://localhost:${PORT}/admin (key: ${ADMIN_KEY})`);
    console.log(`👉 Lucky Draw: http://localhost:${PORT}/lucky-draw`);
    console.log(`👉 TV Display: http://localhost:${PORT}/tv`);
  });
})();
