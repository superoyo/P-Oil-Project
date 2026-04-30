const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4242;
const DATA_FILE = path.join(__dirname, 'registrations.json');
const ADMIN_KEY = process.env.ADMIN_KEY || 'feflddb2026';
const TOTAL_EMPLOYEES = 10;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { registrations: [], winners: [] };
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return {
      registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
    };
  } catch (e) {
    return { registrations: [], winners: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phoneRaw = String(req.body.phone || '').trim();
  const department = String(req.body.department || '').trim();
  const phone = normalizePhone(phoneRaw);

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
  }
  if (!phone || phone.length < 9 || phone.length > 10) {
    return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง' });
  }

  const data = loadData();
  const exists = data.registrations.find((r) => r.phone === phone);
  if (exists) {
    return res.status(409).json({ error: 'เบอร์โทรนี้ลงทะเบียนแล้ว' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    phone,
    department,
    registeredAt: new Date().toISOString(),
  };
  data.registrations.push(entry);
  saveData(data);

  res.json({
    ok: true,
    count: data.registrations.length,
    total: TOTAL_EMPLOYEES,
    entry: { id: entry.id, name: entry.name },
  });
});

app.get('/api/stats', (req, res) => {
  const data = loadData();
  res.json({
    count: data.registrations.length,
    total: TOTAL_EMPLOYEES,
    percent: Math.min(100, Math.round((data.registrations.length / TOTAL_EMPLOYEES) * 100)),
  });
});

app.get('/api/recent', (req, res) => {
  const data = loadData();
  const recent = data.registrations.slice(-10).reverse().map((r) => ({
    name: r.name,
    department: r.department,
  }));
  res.json({ recent });
});

app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  const data = loadData();
  res.json({
    count: data.registrations.length,
    total: TOTAL_EMPLOYEES,
    registrations: data.registrations.slice().reverse(),
    winners: data.winners,
  });
});

app.delete('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const before = data.registrations.length;
  data.registrations = data.registrations.filter((r) => r.id !== req.params.id);
  if (data.registrations.length === before) {
    return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  }
  saveData(data);
  res.json({ ok: true, count: data.registrations.length });
});

app.post('/api/admin/lucky-draw', requireAdmin, (req, res) => {
  const count = Math.max(1, Math.min(20, parseInt(req.body.count, 10) || 1));
  const excludePrevious = !!req.body.excludePrevious;
  const data = loadData();

  const previousIds = new Set(data.winners.map((w) => w.id));
  let pool = data.registrations.slice();
  if (excludePrevious) {
    pool = pool.filter((r) => !previousIds.has(r.id));
  }

  if (pool.length === 0) {
    return res.status(400).json({ error: 'ไม่มีผู้เข้าร่วมที่จับรางวัลได้' });
  }

  const picked = [];
  const available = pool.slice();
  const drawCount = Math.min(count, available.length);
  for (let i = 0; i < drawCount; i++) {
    const idx = Math.floor(Math.random() * available.length);
    picked.push(available.splice(idx, 1)[0]);
  }

  const round = {
    drawnAt: new Date().toISOString(),
    winners: picked.map((p) => ({ id: p.id, name: p.name, phone: p.phone, department: p.department })),
  };
  data.winners.unshift(round);
  saveData(data);
  res.json({ ok: true, round });
});

app.post('/api/admin/winners/clear', requireAdmin, (req, res) => {
  const data = loadData();
  data.winners = [];
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/admin/export', requireAdmin, (req, res) => {
  const data = loadData();
  const header = 'ลำดับ,ชื่อ-นามสกุล,เบอร์โทร,แผนก,เวลาที่ลงทะเบียน\n';
  const rows = data.registrations
    .map((r, i) => {
      const safe = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
      return [i + 1, safe(r.name), safe(r.phone), safe(r.department), safe(new Date(r.registeredAt).toLocaleString('th-TH'))].join(',');
    })
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="feflddb-earthday-registrations.csv"');
  res.send('﻿' + header + rows);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/lucky-draw', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lucky-draw.html'));
});

app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

app.listen(PORT, () => {
  console.log(`🌱 FEFLDDB Earth Day Town Hall server running on http://localhost:${PORT}`);
  console.log(`👉 Public:     http://localhost:${PORT}/`);
  console.log(`👉 Admin:      http://localhost:${PORT}/admin (key: ${ADMIN_KEY})`);
  console.log(`👉 Lucky Draw: http://localhost:${PORT}/lucky-draw`);
  console.log(`👉 TV Display: http://localhost:${PORT}/tv`);
});
