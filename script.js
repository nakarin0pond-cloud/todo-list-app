/**
 * PlanFlow — Calendar Planner
 * Views: Month, Week, Day
 * Features: Range events, time-based slots, animations, localStorage persist
 */

// ── State ─────────────────────────────────────────────────────────────────────
let events = JSON.parse(localStorage.getItem('planflow_events')) || [];
let today  = new Date();
let cursor = new Date(today.getFullYear(), today.getMonth(), 1); // month cursor
let view   = 'month'; // month | week | day
let dayViewDate = new Date(today);
let editingEventId = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const calHeader     = document.getElementById('calHeader');
const calGrid       = document.getElementById('calGrid');
const mainTitle     = document.getElementById('mainTitle');
const miniTitle     = document.getElementById('miniTitle');
const prevMonthBtn  = document.getElementById('prevMonth');
const nextMonthBtn  = document.getElementById('nextMonth');
const mainPrev      = document.getElementById('mainPrev');
const mainNext      = document.getElementById('mainNext');
const todayBtn      = document.getElementById('todayBtn');
const addEventBtn   = document.getElementById('addEventBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar       = document.getElementById('sidebar');
const upcomingList  = document.getElementById('upcomingList');
const viewTabs      = document.querySelectorAll('.view-tab');
const viewMonth     = document.getElementById('viewMonth');
const viewWeek      = document.getElementById('viewWeek');
const viewDay       = document.getElementById('viewDay');
const detailModal   = document.getElementById('detailModal');
const detailClose   = document.getElementById('detailClose');
const dayModal      = document.getElementById('dayModal');
const dayModalClose = document.getElementById('dayModalClose');
const dayModalTitle = document.getElementById('dayModalTitle');
const dayModalEvents= document.getElementById('dayModalEvents');
const dayModalAdd   = document.getElementById('dayModalAdd');
const deleteEventBtn= document.getElementById('deleteEventBtn');

// ── Utilities ─────────────────────────────────────────────────────────────────
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const CAT_ICONS = { study:'📚', work:'💼', meet:'🤝', health:'💪', personal:'✨', deadline:'🔥' };
const CAT_COLORS = { study:'var(--study)', work:'var(--work)', meet:'var(--meet)',
                     health:'var(--health)', personal:'var(--personal)', deadline:'var(--deadline)' };

function save() { localStorage.setItem('planflow_events', JSON.stringify(events)); }

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

function parseDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}

function formatDate(str) {
  if (!str) return '';
  const d = parseDate(str);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h,m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr === 0 ? 12 : hr > 12 ? hr-12 : hr}:${m} ${ampm}`;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

// ── Background Canvas ─────────────────────────────────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function initParticles() {
    particles = Array.from({length: 60}, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      a: Math.random() * 0.4 + 0.1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79,142,247,${p.a})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }

  resize(); initParticles(); draw();
  window.addEventListener('resize', () => { resize(); initParticles(); });
})();

// ── Add Event ─────────────────────────────────────────────────────────────────
addEventBtn.onclick = () => {
  const title = document.getElementById('evTitle').value.trim();
  if (!title) { shake(document.getElementById('evTitle')); return; }
  const start = document.getElementById('evStart').value;
  const end   = document.getElementById('evEnd').value || start;
  if (!start) { shake(document.getElementById('evStart')); return; }

  const ev = {
    id:        genId(),
    title,
    category:  document.getElementById('evCategory').value,
    start,
    end:       end >= start ? end : start,
    startTime: document.getElementById('evStartTime').value || '09:00',
    endTime:   document.getElementById('evEndTime').value   || '10:00',
    note:      document.getElementById('evNote').value.trim()
  };

  events.push(ev);
  save(); render();

  // Clear form
  document.getElementById('evTitle').value = '';
  document.getElementById('evNote').value  = '';
  document.getElementById('evStart').value = '';
  document.getElementById('evEnd').value   = '';
  document.getElementById('evCategory').value = 'study';
};

// ── Navigation ────────────────────────────────────────────────────────────────
prevMonthBtn.onclick = mainPrev.onclick = () => {
  if (view === 'month' || view === 'week') {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  } else {
    dayViewDate.setDate(dayViewDate.getDate() - 1);
  }
  render();
};
nextMonthBtn.onclick = mainNext.onclick = () => {
  if (view === 'month' || view === 'week') {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  } else {
    dayViewDate.setDate(dayViewDate.getDate() + 1);
  }
  render();
};
todayBtn.onclick = () => {
  today = new Date();
  cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  dayViewDate = new Date(today);
  render();
};

// ── Sidebar Toggle ─────────────────────────────────────────────────────────────
sidebarToggle.onclick = () => sidebar.classList.toggle('collapsed');

// ── View Switch ───────────────────────────────────────────────────────────────
viewTabs.forEach(tab => {
  tab.onclick = () => {
    view = tab.dataset.view;
    viewTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    render();
  };
});

// ── Render Controller ─────────────────────────────────────────────────────────
function render() {
  updateTitles();
  renderUpcoming();
  if (view === 'month') {
    viewMonth.classList.remove('hidden');
    viewWeek.classList.add('hidden');
    viewDay.classList.add('hidden');
    renderMonth();
  } else if (view === 'week') {
    viewMonth.classList.add('hidden');
    viewWeek.classList.remove('hidden');
    viewDay.classList.add('hidden');
    renderWeek();
  } else {
    viewMonth.classList.add('hidden');
    viewWeek.classList.add('hidden');
    viewDay.classList.remove('hidden');
    renderDay();
  }
}

function updateTitles() {
  const m = MONTHS[cursor.getMonth()];
  const y = cursor.getFullYear();
  miniTitle.textContent = `${m.slice(0,3)} ${y}`;
  if (view === 'month') mainTitle.textContent = `${m} ${y}`;
  else if (view === 'week') {
    const ws = getWeekStart(cursor);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    mainTitle.textContent = ws.getMonth() === we.getMonth()
      ? `${MONTHS[ws.getMonth()].slice(0,3)} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
      : `${MONTHS[ws.getMonth()].slice(0,3)} ${ws.getDate()} – ${MONTHS[we.getMonth()].slice(0,3)} ${we.getDate()}`;
  } else {
    mainTitle.textContent = `${DAYS[dayViewDate.getDay()]} ${dayViewDate.getDate()} ${MONTHS[dayViewDate.getMonth()]} ${dayViewDate.getFullYear()}`;
  }
}

// ── Month View ─────────────────────────────────────────────────────────────────
function renderMonth() {
  // Header
  calHeader.innerHTML = DAYS.map(d => `<div class="cal-dow">${d}</div>`).join('');

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays  = new Date(y, m, 0).getDate();
  const todayStr  = dateStr(today);

  calGrid.innerHTML = '';

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.style.animationDelay = `${(i % 7) * 0.03}s`;

    let cellDate, isOtherMonth = false;
    if (i < firstDay) {
      cellDate = new Date(y, m-1, prevDays - firstDay + i + 1);
      isOtherMonth = true;
    } else if (i >= firstDay + daysInMonth) {
      cellDate = new Date(y, m+1, i - firstDay - daysInMonth + 1);
      isOtherMonth = true;
    } else {
      cellDate = new Date(y, m, i - firstDay + 1);
    }

    const dStr = dateStr(cellDate);
    if (isOtherMonth) cell.classList.add('other-month');
    if (dStr === todayStr) cell.classList.add('today');

    // Day number
    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = cellDate.getDate();
    cell.appendChild(num);

    // Events on this day
    const dayEvents = getEventsOnDate(dStr);
    const MAX_SHOW = 3;
    dayEvents.slice(0, MAX_SHOW).forEach(ev => {
      const pill = document.createElement('div');
      pill.className = `ev-pill ${ev.category}`;
      pill.textContent = `${CAT_ICONS[ev.category]} ${ev.title}`;
      pill.title = ev.title;
      pill.onclick = e => { e.stopPropagation(); openDetail(ev.id); };
      cell.appendChild(pill);
    });
    if (dayEvents.length > MAX_SHOW) {
      const more = document.createElement('div');
      more.className = 'more-events';
      more.textContent = `+${dayEvents.length - MAX_SHOW} more`;
      more.onclick = e => { e.stopPropagation(); openDayModal(dStr, cellDate); };
      cell.appendChild(more);
    }

    cell.onclick = () => openDayModal(dStr, cellDate);
    calGrid.appendChild(cell);
  }
}

// ── Week View ─────────────────────────────────────────────────────────────────
function getWeekStart(d) {
  const day = d.getDay();
  const result = new Date(d);
  result.setDate(d.getDate() - day + (d.getMonth() !== cursor.getMonth() ? 0 : 0));
  // Use cursor month's first day's week start
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const ws = new Date(first);
  ws.setDate(first.getDate() - first.getDay());
  return ws;
}

function renderWeek() {
  const weekEl = document.getElementById('weekGrid');
  weekEl.innerHTML = '';

  const ws = getWeekStart(cursor);
  const todayStr = dateStr(today);
  const HOURS = Array.from({length:24}, (_,i)=>i);

  // Time column
  const timeCol = document.createElement('div');
  timeCol.className = 'week-time-col';
  HOURS.forEach(h => {
    const lbl = document.createElement('div');
    lbl.className = 'week-time-label';
    lbl.textContent = h === 0 ? '' : `${h}:00`;
    timeCol.appendChild(lbl);
  });
  weekEl.appendChild(timeCol);

  // Days columns
  const daysWrap = document.createElement('div');
  daysWrap.className = 'week-days';

  for (let d = 0; d < 7; d++) {
    const date = new Date(ws); date.setDate(ws.getDate() + d);
    const dStr = dateStr(date);
    const col  = document.createElement('div');
    col.className = 'week-day-col';
    if (dStr === todayStr) col.classList.add('today-col');

    // Header
    const header = document.createElement('div');
    header.className = 'week-day-header';
    header.innerHTML = `<div class="week-day-name">${DAYS[d]}</div><div class="week-day-num">${date.getDate()}</div>`;
    header.onclick = () => { view = 'day'; dayViewDate = new Date(date); render(); };
    col.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'week-day-body';

    HOURS.forEach(h => {
      const slot = document.createElement('div');
      slot.className = 'week-hour-slot half';
      body.appendChild(slot);
    });

    // Now line
    if (dStr === todayStr) {
      const now = new Date();
      const pct = (now.getHours() * 60 + now.getMinutes()) / (24*60) * 100;
      const line = document.createElement('div');
      line.className = 'week-now-line';
      line.style.top = pct + '%';
      body.appendChild(line);
    }

    // Events
    getEventsOnDate(dStr).forEach(ev => {
      const el = document.createElement('div');
      el.className = `week-ev ${ev.category}`;
      el.style.cssText = getTimeStyle(ev, 60);
      el.textContent = ev.title;
      el.onclick = e => { e.stopPropagation(); openDetail(ev.id); };
      body.appendChild(el);
    });

    col.appendChild(body);
    daysWrap.appendChild(col);
  }

  weekEl.appendChild(daysWrap);
}

// ── Day View ──────────────────────────────────────────────────────────────────
function renderDay() {
  const dv = document.getElementById('dayView');
  dv.innerHTML = '';

  const dStr    = dateStr(dayViewDate);
  const todayStr = dateStr(today);
  const HOURS   = Array.from({length:24}, (_,i)=>i);

  // Header banner
  const banner = document.createElement('div');
  banner.className = 'day-header-banner';
  banner.innerHTML = `
    <div class="day-header-big">${dayViewDate.getDate()}</div>
    <div class="day-header-sub">${DAYS[dayViewDate.getDay()]}, ${MONTHS[dayViewDate.getMonth()]} ${dayViewDate.getFullYear()}${dStr===todayStr?' — Today':''}</div>
  `;

  const inner = document.createElement('div');
  inner.style.cssText = 'flex:1;display:flex;overflow:hidden;';

  // Time col
  const timeCol = document.createElement('div');
  timeCol.className = 'day-time-col';
  HOURS.forEach(h => {
    const lbl = document.createElement('div');
    lbl.className = 'day-time-label';
    lbl.textContent = h === 0 ? '' : `${h}:00`;
    timeCol.appendChild(lbl);
  });

  // Events col
  const evCol = document.createElement('div');
  evCol.className = 'day-events-col';
  HOURS.forEach(h => {
    const slot = document.createElement('div');
    slot.className = 'day-hour-slot half';
    evCol.appendChild(slot);
  });

  // Now line
  if (dStr === todayStr) {
    const now = new Date();
    const pct = (now.getHours() * 60 + now.getMinutes()) / (24*60) * 100;
    const line = document.createElement('div');
    line.className = 'day-now-line';
    line.style.top = pct + '%';
    evCol.appendChild(line);
  }

  // Events
  getEventsOnDate(dStr).forEach(ev => {
    const el = document.createElement('div');
    el.className = `day-ev ${ev.category}`;
    el.style.cssText = getTimeStyle(ev, 64);
    el.innerHTML = `<div class="ev-time">${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}</div>${CAT_ICONS[ev.category]} ${ev.title}`;
    el.onclick = () => openDetail(ev.id);
    evCol.appendChild(el);
  });

  inner.appendChild(timeCol);
  inner.appendChild(evCol);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  wrapper.appendChild(banner);
  wrapper.appendChild(inner);
  dv.appendChild(wrapper);
}

// ── Time Positioning Helper ───────────────────────────────────────────────────
function getTimeStyle(ev, hourHeight) {
  const [sh,sm] = ev.startTime.split(':').map(Number);
  const [eh,em] = ev.endTime.split(':').map(Number);
  const top      = (sh * 60 + sm) / 60 * hourHeight;
  let   height   = ((eh * 60 + em) - (sh * 60 + sm)) / 60 * hourHeight;
  if (height < 18) height = 18;
  const color    = CAT_COLORS[ev.category];
  return `
    top: ${top}px;
    height: ${height}px;
    background: ${color}22;
    border-left: 3px solid ${color};
    color: ${color};
  `;
}

// ── Events on a Date ──────────────────────────────────────────────────────────
function getEventsOnDate(dStr) {
  return events.filter(ev => {
    return dStr >= ev.start && dStr <= (ev.end || ev.start);
  }).sort((a,b) => a.startTime.localeCompare(b.startTime));
}

// ── Upcoming Sidebar ──────────────────────────────────────────────────────────
function renderUpcoming() {
  const todayStr = dateStr(today);
  const upcoming = events
    .filter(ev => ev.end >= todayStr || ev.start >= todayStr)
    .sort((a,b) => a.start.localeCompare(b.start) || a.startTime.localeCompare(b.startTime))
    .slice(0, 8);

  upcomingList.innerHTML = '';
  if (!upcoming.length) {
    upcomingList.innerHTML = '<div class="no-events" style="padding:10px 0">No upcoming events</div>';
    return;
  }
  upcoming.forEach((ev, i) => {
    const item = document.createElement('div');
    item.className = 'upcoming-item';
    item.style.animationDelay = `${i * 0.05}s`;
    item.innerHTML = `
      <div class="upcoming-dot" style="background:${CAT_COLORS[ev.category]}"></div>
      <div class="upcoming-info">
        <div class="upcoming-title">${CAT_ICONS[ev.category]} ${ev.title}</div>
        <div class="upcoming-date">${formatDate(ev.start)}${ev.start!==ev.end ? ` → ${formatDate(ev.end)}` : ''} · ${formatTime(ev.startTime)}</div>
      </div>
    `;
    item.onclick = () => openDetail(ev.id);
    upcomingList.appendChild(item);
  });
}

// ── Day Modal ─────────────────────────────────────────────────────────────────
let dayModalCurrentDate = null;
function openDayModal(dStr, dateObj) {
  dayModalCurrentDate = dStr;
  dayModalTitle.textContent = `${DAYS[dateObj.getDay()]} ${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`;
  const dayEvs = getEventsOnDate(dStr);
  dayModalEvents.innerHTML = '';
  if (!dayEvs.length) {
    dayModalEvents.innerHTML = '<div class="no-events">No events this day</div>';
  } else {
    dayEvs.forEach(ev => {
      const row = document.createElement('div');
      row.className = 'day-modal-ev';
      row.innerHTML = `
        <div class="dot" style="background:${CAT_COLORS[ev.category]}"></div>
        <div class="info">
          <div class="title">${CAT_ICONS[ev.category]} ${ev.title}</div>
          <div class="time">${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}</div>
        </div>
      `;
      row.onclick = () => { closeDayModal(); openDetail(ev.id); };
      dayModalEvents.appendChild(row);
    });
  }
  dayModal.classList.remove('hidden');
}
function closeDayModal() { dayModal.classList.add('hidden'); }
dayModalClose.onclick = closeDayModal;
dayModal.onclick = e => { if (e.target === dayModal) closeDayModal(); };
dayModalAdd.onclick = () => {
  closeDayModal();
  document.getElementById('evStart').value = dayModalCurrentDate;
  document.getElementById('evEnd').value   = dayModalCurrentDate;
  document.getElementById('evTitle').focus();
  if (sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed');
};

// ── Detail Modal ──────────────────────────────────────────────────────────────
function openDetail(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;

  document.getElementById('detailStripe').style.background = CAT_COLORS[ev.category];
  document.getElementById('detailIcon').textContent  = CAT_ICONS[ev.category];
  document.getElementById('detailTitle').textContent = ev.title;

  const meta = document.getElementById('detailMeta');
  meta.innerHTML = `
    <div class="detail-meta-row"><span>📅</span><span>${formatDate(ev.start)}${ev.start!==ev.end ? ` — ${formatDate(ev.end)}` : ''}</span></div>
    <div class="detail-meta-row"><span>🕐</span><span>${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}</span></div>
    <div class="detail-meta-row"><span>🏷</span><span>${ev.category.charAt(0).toUpperCase()+ev.category.slice(1)}</span></div>
  `;

  const noteEl = document.getElementById('detailNote');
  noteEl.textContent = ev.note || '';
  noteEl.style.display = ev.note ? 'block' : 'none';

  detailModal.classList.remove('hidden');
}
function closeDetail() { detailModal.classList.add('hidden'); editingEventId = null; }
detailClose.onclick = closeDetail;
detailModal.onclick = e => { if (e.target === detailModal) closeDetail(); };
deleteEventBtn.onclick = () => {
  if (!editingEventId) return;
  events = events.filter(e => e.id !== editingEventId);
  save(); render(); closeDetail();
};

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDetail(); closeDayModal(); }
  if (e.key === 'ArrowLeft'  && !isInputFocused()) { mainPrev.click(); }
  if (e.key === 'ArrowRight' && !isInputFocused()) { mainNext.click(); }
  if (e.key === 'm' && !isInputFocused()) { switchView('month'); }
  if (e.key === 'w' && !isInputFocused()) { switchView('week');  }
  if (e.key === 'd' && !isInputFocused()) { switchView('day');   }
  if (e.key === 't' && !isInputFocused()) { todayBtn.click();    }
});
function isInputFocused() {
  const t = document.activeElement?.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
}
function switchView(v) {
  view = v;
  viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === v));
  render();
}

// ── Animation Helpers ─────────────────────────────────────────────────────────
function shake(el) {
  el.style.animation = 'none'; void el.offsetWidth;
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => el.style.animation = '', { once: true });
}

// ── Sample Events ─────────────────────────────────────────────────────────────
function loadSampleIfEmpty() {
  if (events.length > 0) return;
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');

  const next = (offset) => {
    const dt = new Date(today); dt.setDate(today.getDate() + offset);
    return dateStr(dt);
  };

  events = [
    { id:genId(), title:'🎓 Study JavaScript Basics', category:'study',    start:next(0),  end:next(4),  startTime:'09:00', endTime:'11:00', note:'Cover: variables, functions, DOM manipulation' },
    { id:genId(), title:'📝 Portfolio Review',        category:'work',     start:next(1),  end:next(1),  startTime:'14:00', endTime:'15:30', note:'Review and update portfolio projects' },
    { id:genId(), title:'🤝 Team Meeting',            category:'meet',     start:next(2),  end:next(2),  startTime:'10:00', endTime:'11:00', note:'' },
    { id:genId(), title:'💪 Morning Run',             category:'health',   start:next(0),  end:next(6),  startTime:'07:00', endTime:'07:45', note:'5km every morning' },
    { id:genId(), title:'🔥 Project Deadline',        category:'deadline', start:next(7),  end:next(7),  startTime:'17:00', endTime:'18:00', note:'Submit final project' },
    { id:genId(), title:'✨ Personal Dev',            category:'personal', start:next(3),  end:next(5),  startTime:'20:00', endTime:'21:30', note:'Read: Clean Code book' },
  ];
  save();
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadSampleIfEmpty();
render();

// Inject shake keyframe
const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`;
document.head.appendChild(styleEl);
