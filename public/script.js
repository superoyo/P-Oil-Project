(() => {
  const form = document.getElementById('register-form');
  const nameEl = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const deptEl = document.getElementById('department');
  const submitBtn = document.getElementById('submit-btn');
  const formMsg = document.getElementById('form-msg');
  const countEl = document.getElementById('count');
  const percentEl = document.getElementById('percent');
  const progressFill = document.getElementById('progress-fill');
  const treeStage = document.querySelector('.tree-stage');
  const dropsEl = document.getElementById('drops');
  const stageBadges = document.querySelectorAll('.stage-badge');

  const TOTAL = 200;

  function stageFromCount(count) {
    const pct = (count / TOTAL) * 100;
    if (pct <= 0) return 0;
    if (pct < 15) return 1;
    if (pct < 50) return 2;
    if (pct < 85) return 3;
    return 4;
  }

  function setBadge(stage) {
    stageBadges.forEach((b) => {
      const s = parseInt(b.dataset.stage, 10);
      b.classList.toggle('active', s === stage || (s < stage && stage === 4));
      if (s === stage) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function applyStats(count, percent) {
    const stage = stageFromCount(count);
    treeStage.dataset.stage = stage;
    setBadge(stage);

    // animate count (safe: always sets final value, animates in background)
    const start = parseInt(countEl.textContent, 10) || 0;
    const target = count;
    countEl.textContent = target;
    if (start !== target) {
      const steps = 16;
      const stepDelay = 50;
      let i = 0;
      countEl.textContent = start;
      const iv = setInterval(() => {
        i++;
        const k = Math.min(1, i / steps);
        countEl.textContent = Math.round(start + (target - start) * k);
        if (k >= 1) {
          countEl.textContent = target;
          clearInterval(iv);
        }
      }, stepDelay);
      // safety: ensure final value after max time
      setTimeout(() => { countEl.textContent = target; clearInterval(iv); }, 1200);
    }

    percentEl.textContent = percent;
    progressFill.style.width = percent + '%';
  }

  async function loadStats() {
    try {
      const r = await fetch('/api/stats');
      const data = await r.json();
      applyStats(data.count, data.percent);
    } catch (e) {
      console.error(e);
    }
  }

  function spawnDrops() {
    if (!dropsEl) return;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const drop = document.createElement('span');
      drop.className = 'drop';
      drop.style.left = (15 + Math.random() * 70) + '%';
      drop.style.animationDelay = (Math.random() * 0.4) + 's';
      drop.style.animationDuration = (0.8 + Math.random() * 0.5) + 's';
      dropsEl.appendChild(drop);
      setTimeout(() => drop.remove(), 1600);
    }
    treeStage.classList.add('shake');
    setTimeout(() => treeStage.classList.remove('shake'), 700);
  }

  function setMsg(text, type) {
    formMsg.textContent = text;
    formMsg.className = 'form-msg' + (type ? ' ' + type : '');
  }

  phoneEl.addEventListener('input', () => {
    phoneEl.value = phoneEl.value.replace(/[^0-9]/g, '').slice(0, 10);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    const department = deptEl.value.trim();

    if (!name || !phone) {
      setMsg('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }
    if (phone.length < 9) {
      setMsg('เบอร์โทรไม่ถูกต้อง', 'error');
      return;
    }

    submitBtn.disabled = true;
    setMsg('กำลังลงทะเบียน...', '');

    try {
      const r = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, department }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg(data.error || 'ไม่สามารถลงทะเบียนได้', 'error');
        submitBtn.disabled = false;
        return;
      }
      setMsg(`✅ ลงทะเบียนสำเร็จ! ขอบคุณ ${data.entry.name} 💚`, 'success');
      form.reset();
      spawnDrops();
      const percent = Math.min(100, Math.round((data.count / data.total) * 100));
      applyStats(data.count, percent);
      // celebrate small confetti when crossing milestones
      if ([10, 50, 100, 150, 200].includes(data.count)) {
        celebrate();
      }
      setTimeout(() => { submitBtn.disabled = false; }, 1200);
    } catch (e) {
      setMsg('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      submitBtn.disabled = false;
    }
  });

  function celebrate() {
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    document.body.appendChild(wrap);
    const colors = ['#00aec7', '#ffd305', '#3aaf7a', '#ff9ec5', '#5fcd97'];
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('span');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(s);
    }
    setTimeout(() => wrap.remove(), 5000);
  }

  loadStats();
  // refresh every 10s in case multiple devices register
  setInterval(loadStats, 10000);
})();
