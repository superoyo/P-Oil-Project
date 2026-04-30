# 🌱 FEFLDDB Group Town Hall #EarthDay

ระบบลงทะเบียนผู้เข้าร่วมงาน **Far East Fame Line DDB Group Town Hall · Earth Day 2026** พร้อมหน้าหลังบ้าน, ระบบจับรางวัล Lucky Draw และจอแสดงผลบนทีวี

## ฟีเจอร์

- 📝 **หน้าลงทะเบียน** — กรอก ชื่อ / เบอร์โทร / แผนก
- 🌳 **ต้นไม้เติบโตตามจำนวนผู้ลงทะเบียน** — เมล็ด → ต้นกล้า → ต้นไม้ → เบ่งบาน
- 💧 Animation หยดน้ำเมื่อมีคนลงทะเบียนใหม่ + confetti ตอน milestone
- 🔐 **หลังบ้าน Admin** — ดูรายชื่อ, KPI, ค้นหา, ลบ, ดาวน์โหลด CSV, ตั้งค่ายอดเริ่มต้น
- 🎁 **Lucky Draw** — สุ่ม 1–20 คน + เก็บประวัติ
- 📺 **TV Display (`/tv`)** — เปิดบนจอใหญ่ มีต้นไม้, QR code, counter live
- 🗄️ **Database** — PostgreSQL (production) หรือ JSON file (local dev)
- 🎨 ธีมขาวสะอาด ใช้สี CI `#00aec7` + `#ffd305`

## หน้าที่มี

| Path | คำอธิบาย |
|------|----------|
| `/` | หน้าลงทะเบียน |
| `/admin` | หลังบ้าน (ต้องใส่ Admin Key) |
| `/lucky-draw` | จับฉลาก |
| `/tv` | จอทีวี + QR code |
| `/healthz` | Health check |

## ตัวแปรสภาพแวดล้อม (Environment Variables)

| Variable | Required | Default | คำอธิบาย |
|----------|----------|---------|----------|
| `DATABASE_URL` | optional | - | Postgres URL — ถ้าไม่ตั้งจะใช้ JSON file |
| `ADMIN_KEY` | optional | `feflddb2026` | รหัส admin |
| `PORT` | optional | `4242` | พอร์ต |

ถ้า `DATABASE_URL` ตั้งไว้ → ระบบจะ auto สร้าง tables (`registrations`, `winner_rounds`, `settings`) ตอน startup

## รันบนเครื่อง (local dev)

```bash
npm install
npm start
```

เปิดที่ <http://localhost:4242/>

หากไม่ได้ตั้ง `DATABASE_URL` ระบบจะเก็บข้อมูลใน `registrations.json` (อยู่ใน `.gitignore`)

## 🚂 Deploy บน Railway (มี Persistent Database)

1. Push repo นี้ขึ้น GitHub แล้วเชื่อม Railway กับ repo
2. ใน Railway project, กด **+ New** → **Database** → **PostgreSQL**
   - Railway จะ auto-inject `DATABASE_URL` เข้า service ของแอปให้
3. (แนะนำ) ตั้ง env เพิ่ม:
   - `ADMIN_KEY` = รหัสของคุณ
   - `NODE_ENV` = `production`
4. Deploy — ตอน startup จะเห็น log:
   ```
   📦 Storage: PostgreSQL (DATABASE_URL)
   ```
5. Redeploy โค้ดได้ตามต้องการ → ข้อมูลผู้ลงทะเบียนยังอยู่ครบ ✅

## โครงสร้าง

```
feflddb-earthday/
├── server.js            # Express + REST API
├── db.js                # Storage layer (Postgres / JSON)
├── package.json
├── public/
│   ├── index.html       # หน้าลงทะเบียน
│   ├── admin.html       # หลังบ้าน + ตั้งค่า
│   ├── lucky-draw.html  # Lucky Draw
│   ├── tv.html          # TV Display + QR
│   ├── styles.css       # Theme
│   └── script.js        # Tree + form logic
└── registrations.json   # Local fallback (ใน .gitignore)
```

## API

### Public
- `POST /api/register` — ลงทะเบียน (`{ name, phone, department }`)
- `GET /api/stats` — `{ count, registrationCount, baseOffset, total, percent }`
- `GET /api/recent` — 10 ชื่อล่าสุด (ไม่มีเบอร์)

### Admin (auth: `x-admin-key` header หรือ `?key=` query)
- `GET /api/admin/registrations` — รายการทั้งหมด
- `DELETE /api/admin/registrations/:id`
- `GET /api/admin/settings` / `POST /api/admin/settings` — `{ baseOffset, totalTarget }`
- `POST /api/admin/lucky-draw` — `{ count, excludePrevious }`
- `POST /api/admin/winners/clear`
- `GET /api/admin/export` — ดาวน์โหลด CSV

---

© 2026 Far East Fame Line DDB · Together we grow 🌱
