# 🌱 FEFLDDB Group Town Hall #EarthDay

ระบบลงทะเบียนผู้เข้าร่วมงาน **Far East Fame Line DDB Group Town Hall · Earth Day 2026** พร้อมหน้าหลังบ้านและระบบจับรางวัล Lucky Draw

## ฟีเจอร์

- 📝 **หน้าลงทะเบียน** — กรอก ชื่อ / เบอร์โทร / แผนก
- 🌳 **ต้นไม้เติบโตตามจำนวนผู้ลงทะเบียน** — เมล็ด → ต้นกล้า → ต้นไม้ → เบ่งบาน (4 ขั้น)
- 💧 Animation หยดน้ำเมื่อมีคนลงทะเบียนใหม่ + confetti ตอนถึง milestone
- 🔐 **หลังบ้าน Admin** — ดูรายชื่อ, KPI, ค้นหา, ลบ, ดาวน์โหลด CSV
- 🎁 **Lucky Draw** — สุ่ม 1–20 คน, animation หมุนชื่อ, เก็บประวัติการจับ
- 🎨 ดีไซน์ขาวสะอาด ใช้สี CI ของบริษัท `#00aec7` + `#ffd305`

## วิธีใช้งาน

```bash
npm install
npm start
```

เปิดที่:
- หน้าลงทะเบียน: <http://localhost:4242/>
- หลังบ้าน: <http://localhost:4242/admin>
- Lucky Draw: <http://localhost:4242/lucky-draw>

**Admin Key เริ่มต้น:** `feflddb2026` (เปลี่ยนได้ผ่าน env `ADMIN_KEY`)

## โครงสร้าง

```
feflddb-earthday/
├── server.js           # Express server + REST API
├── package.json
├── public/
│   ├── index.html      # หน้าลงทะเบียน
│   ├── admin.html      # หลังบ้าน
│   ├── lucky-draw.html # Lucky Draw
│   ├── styles.css      # Theme รักโลก + CI
│   └── script.js       # ต้นไม้เติบโต + form
└── registrations.json  # JSON storage (สร้างเมื่อรัน)
```

## API

- `POST /api/register` — ลงทะเบียน (`{ name, phone, department }`)
- `GET /api/stats` — สถิติจำนวนคน + เปอร์เซ็นต์
- `GET /api/admin/registrations?key=<ADMIN_KEY>` — รายการทั้งหมด
- `DELETE /api/admin/registrations/:id` — ลบ (header `x-admin-key`)
- `POST /api/admin/lucky-draw` — สุ่มผู้โชคดี (`{ count, excludePrevious }`)
- `POST /api/admin/winners/clear` — ล้างประวัติจับรางวัล
- `GET /api/admin/export?key=<ADMIN_KEY>` — ดาวน์โหลด CSV

---

© 2026 Far East Fame Line DDB · Together we grow 🌱
