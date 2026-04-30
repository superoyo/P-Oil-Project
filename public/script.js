(() => {
  const form = document.getElementById('register-form');
  const nameEl = document.getElementById('name');
  const deptEl = document.getElementById('department');
  const submitBtn = document.getElementById('submit-btn');
  const formMsg = document.getElementById('form-msg');
  const countEl = document.getElementById('count');
  const percentEl = document.getElementById('percent');
  const progressFill = document.getElementById('progress-fill');
  const treeStage = document.querySelector('.tree-stage');
  const dropsEl = document.getElementById('drops');
  const stageBadges = document.querySelectorAll('.stage-badge');

  let TOTAL = 10;
  const totalEl = document.querySelector('.stat-total');

  function stageFromPercent(pct) {
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
    const stage = stageFromPercent(percent);
    treeStage.dataset.stage = stage;
    setBadge(stage);
    if (totalEl) totalEl.textContent = '/' + TOTAL;

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
      TOTAL = data.total || TOTAL;
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const department = (deptEl.value || '').trim();

    if (!name) {
      setMsg('กรุณากรอกชื่อ-นามสกุล', 'error');
      return;
    }
    if (!department) {
      setMsg('กรุณาเลือกแผนก', 'error');
      return;
    }

    submitBtn.disabled = true;
    setMsg('กำลังลงทะเบียน...', '');

    try {
      const r = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, department }),
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
      TOTAL = data.total || TOTAL;
      applyStats(data.count, data.percent);
      // celebrate small confetti when crossing milestones
      if ([3, 5, 7, 10].includes(data.count)) {
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
