/**
 * PlanFlow — script.js
 *
 * Key algorithm: renderMonth() computes event spans per-row so that
 * multi-day events display as continuous bars across week rows,
 * exactly like Google Calendar.
 *
 * Views: Month (span bars) | Week (time grid) | Day (time grid)
 * Persist: localStorage
 * Category: preset + custom text
 */

'use strict';

/* ── Constants ───────────────────────────────────────────────── */
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const PRESET_CATS = {
  study:    { label:'Study',    icon:'📚', color:'#4f87f5' },
  work:     { label:'Work',     icon:'💼', color:'#a78bfa' },
  meet:     { label:'Meeting',  icon:'🤝', color:'#2dd4a0' },
  health:   { label:'Health',   icon:'💪', color:'#fb923c' },
  personal: { label:'Personal', icon:'✨', color:'#f472b6' },
  deadline: { label:'Deadline', icon:'🔥', color:'#f95959' },
};
const CUSTOM_COLOR = '#facc15';

/* ── State ───────────────────────────────────────────────────── */
let events   = JSON.parse(localStorage.getItem('pf_events')) || [];
let today    = new Date();
let cursor   = new Date(today.getFullYear(), today.getMonth(), 1);
let dayDate  = new Date(today);
let view     = 'month';
let selCat   = 'study';   // 'study'|'work'|...|'' (custom)
let detailId = null;
let dmDate   = null;

/* ── Helpers ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/** Return YYYY-MM-DD for a Date object */
function ds(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

/** Parse YYYY-MM-DD to local Date (no UTC shift) */
function pd(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}

function fmtDate(s) {
  if (!s) return '';
  const d = pd(s);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h===0?12:h>12?h-12:h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function todayStr() { return ds(today); }

function catColor(ev) {
  if (ev.category === '') return CUSTOM_COLOR;
  return PRESET_CATS[ev.category]?.color || CUSTOM_COLOR;
}
function catIcon(ev) {
  if (ev.category === '') return '🏷';
  return PRESET_CATS[ev.category]?.icon || '🏷';
}
function catClass(ev) {
  return ev.category === '' ? 'custom' : ev.category;
}

function save() {
  localStorage.setItem('pf_events', JSON.stringify(events));
}

/* ── Background canvas ───────────────────────────────────────── */
(function initCanvas() {
  const canvas = $('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, pts;

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  function init() {
    pts = Array.from({length:55}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      r: Math.random()*1.4+.3,
      vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.18,
      a: Math.random()*.35+.08
    }));
  }
  function draw() {
    ctx.clearRect(0,0,w,h);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(99,102,241,${p.a})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x<0||p.x>w) p.vx *= -1;
      if (p.y<0||p.y>h) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  resize(); init(); draw();
  window.addEventListener('resize', () => { resize(); init(); });
})();

/* ── Category pill selection ─────────────────────────────────── */
const catPillsEl = $('catPills');
catPillsEl.addEventListener('click', e => {
  const pill = e.target.closest('.cat-pill');
  if (!pill) return;
  selCat = pill.dataset.cat;

  // Update active styles
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');

  // Show/hide custom input
  const wrap = $('customCatWrap');
  if (selCat === '') {
    wrap.classList.remove('hidden');
    $('customCatInput').focus();
  } else {
    wrap.classList.add('hidden');
  }
});

/* ── Add Event ───────────────────────────────────────────────── */
$('addBtn').addEventListener('click', addEvent);
$('fTitle').addEventListener('keydown', e => { if (e.key === 'Enter') addEvent(); });

function addEvent() {
  const title = $('fTitle').value.trim();
  if (!title) { shake($('fTitle')); return; }

  const start = $('fStart').value;
  if (!start) { shake($('fStart')); return; }

  let end = $('fEnd').value || start;
  if (end < start) end = start;

  // Custom category label
  const customLabel = ($('customCatInput').value.trim()) || '🏷 Custom';

  const ev = {
    id:          genId(),
    title,
    category:    selCat,          // '' means custom
    customLabel: selCat === '' ? customLabel : '',
    start, end,
    startTime:   $('fSTime').value || '09:00',
    endTime:     $('fETime').value || '10:00',
    note:        $('fNote').value.trim(),
  };

  events.push(ev);
  save();
  render();
  popAnim($('addBtn'));

  // Reset
  $('fTitle').value = '';
  $('fNote').value  = '';
  $('fStart').value = '';
  $('fEnd').value   = '';
  $('fSTime').value = '09:00';
  $('fETime').value = '10:00';
  $('fTitle').focus();
}

/* ── Navigation ──────────────────────────────────────────────── */
$('prevBtn').onclick = () => {
  if (view === 'day') { dayDate.setDate(dayDate.getDate()-1); }
  else cursor = new Date(cursor.getFullYear(), cursor.getMonth()-1, 1);
  render();
};
$('nextBtn').onclick = () => {
  if (view === 'day') { dayDate.setDate(dayDate.getDate()+1); }
  else cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
  render();
};
$('todayBtn').onclick = () => {
  today   = new Date();
  cursor  = new Date(today.getFullYear(), today.getMonth(), 1);
  dayDate = new Date(today);
  render();
};

/* ── Sidebar ─────────────────────────────────────────────────── */
$('sidebarToggle').onclick = () => $('sidebar').classList.toggle('closed');
$('sidebarClose').onclick  = () => $('sidebar').classList.add('closed');

/* ── View Switching ──────────────────────────────────────────── */
document.querySelectorAll('.view-tab').forEach(btn => {
  btn.onclick = () => switchView(btn.dataset.view);
});

function switchView(v) {
  view = v;
  document.querySelectorAll('.view-tab')
    .forEach(b => b.classList.toggle('active', b.dataset.view === v));
  render();
}

/* ── Keyboard ────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const inp = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
  if (e.key === 'Escape') { closeAll(); return; }
  if (inp) return;
  if (e.key === 'ArrowLeft')  $('prevBtn').click();
  if (e.key === 'ArrowRight') $('nextBtn').click();
  if (e.key === 'm') switchView('month');
  if (e.key === 'w') switchView('week');
  if (e.key === 'd') switchView('day');
  if (e.key === 't') $('todayBtn').click();
});

function closeAll() {
  $('detailOv').classList.add('hidden');
  $('dayPopOv').classList.add('hidden');
}

/* ================================================================
   RENDER CONTROLLER
   ================================================================ */
function render() {
  updateTitle();
  renderLegend();
  renderUpcoming();

  $('vMonth').classList.toggle('hidden', view !== 'month');
  $('vWeek').classList.toggle('hidden',  view !== 'week');
  $('vDay').classList.toggle('hidden',   view !== 'day');

  if (view === 'month') renderMonth();
  else if (view === 'week') renderWeek();
  else renderDay();
}

function updateTitle() {
  const m = MONTH_NAMES[cursor.getMonth()];
  const y = cursor.getFullYear();
  if (view === 'month') {
    $('calTitle').textContent = `${m} ${y}`;
  } else if (view === 'week') {
    const ws = weekStart(cursor);
    const we = new Date(ws); we.setDate(ws.getDate()+6);
    $('calTitle').textContent =
      ws.getMonth() === we.getMonth()
        ? `${MONTH_NAMES[ws.getMonth()].slice(0,3)} ${ws.getDate()}–${we.getDate()}, ${y}`
        : `${MONTH_NAMES[ws.getMonth()].slice(0,3)} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()].slice(0,3)} ${we.getDate()}`;
  } else {
    $('calTitle').textContent =
      `${DAY_NAMES[dayDate.getDay()]} ${dayDate.getDate()} ${MONTH_NAMES[dayDate.getMonth()]} ${dayDate.getFullYear()}`;
  }
}

function renderLegend() {
  const el = $('legend');
  el.innerHTML = '';
  Object.entries(PRESET_CATS).forEach(([key, cat]) => {
    const d = document.createElement('div'); d.className = 'leg-item';
    d.innerHTML = `<div class="leg-dot" style="background:${cat.color}"></div>${cat.label}`;
    el.appendChild(d);
  });
  // custom
  const d = document.createElement('div'); d.className = 'leg-item';
  d.innerHTML = `<div class="leg-dot" style="background:${CUSTOM_COLOR}"></div>Custom`;
  el.appendChild(d);
}

/* ================================================================
   MONTH VIEW — span-bar rendering algorithm
   ================================================================

   For each week row (7 days), we compute which events are "active"
   and assign them to visual "lanes" (rows of bars). An event keeps
   the same lane across rows so bars look continuous.

   Result: events that span multiple weeks show as a bar that
   starts at the left edge and ends at the right edge of each row,
   with the title only shown on the start cell.
   ================================================================ */
function renderMonth() {
  /* -- day-of-week header -- */
  const dowBar = $('dowBar');
  dowBar.innerHTML = DAY_NAMES.map(d => `<div class="dow-cell">${d}</div>`).join('');

  const grid = $('monthGrid');
  grid.innerHTML = '';

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();
  const tStr = todayStr();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const numRows = totalCells / 7;

  /* Build date strings for all cells */
  const cellDates = [];
  for (let i = 0; i < totalCells; i++) {
    let date, other = false;
    if (i < firstDow) {
      date = new Date(y, m-1, prevMonthDays - firstDow + i + 1); other = true;
    } else if (i >= firstDow + daysInMonth) {
      date = new Date(y, m+1, i - firstDow - daysInMonth + 1); other = true;
    } else {
      date = new Date(y, m, i - firstDow + 1);
    }
    cellDates.push({ date, dStr: ds(date), other });
  }

  /* Sort events: longer first (so big spans claim top lanes) */
  const sortedEvents = [...events].sort((a,b) => {
    const lenA = (pd(a.end) - pd(a.start)) / 86400000;
    const lenB = (pd(b.end) - pd(b.start)) / 86400000;
    return lenB - lenA;
  });

  /* Per-cell: array of lanes. lanes[lane] = event id or null */
  const cellLanes = Array.from({length: totalCells}, () => []);

  /* Track which lane each event occupies (per row) */
  const evLaneMap = {}; // evId -> lane index (same for whole event)

  /* Assign lanes */
  sortedEvents.forEach(ev => {
    // Find all cell indices this event covers
    const coveredCells = [];
    for (let ci = 0; ci < totalCells; ci++) {
      const dStr = cellDates[ci].dStr;
      if (dStr >= ev.start && dStr <= ev.end) coveredCells.push(ci);
    }
    if (coveredCells.length === 0) return;

    // Find lowest lane that is free for ALL covered cells in the same row
    // Events must use same lane across their entire span
    let lane = 0;
    let found = false;
    while (!found) {
      found = coveredCells.every(ci => !cellLanes[ci][lane]);
      if (!found) lane++;
    }
    evLaneMap[ev.id] = lane;
    coveredCells.forEach(ci => { cellLanes[ci][lane] = ev.id; });
  });

  /* Build DOM */
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    for (let colIdx = 0; colIdx < 7; colIdx++) {
      const ci = rowIdx * 7 + colIdx;
      const { date, dStr, other } = cellDates[ci];

      const cell = document.createElement('div');
      cell.className = 'day-cell'
        + (other ? ' dim' : '')
        + (dStr === tStr ? ' today' : '');
      cell.style.animationDelay = `${colIdx * 0.025}s`;

      /* Day number */
      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = date.getDate();
      cell.appendChild(num);

      /* Event bars for this cell */
      const laneCount = cellLanes[ci].length;
      const MAX_LANES = 3; // how many bars to show before "+N more"
      let shown = 0;
      const overflow = [];

      for (let lane = 0; lane < laneCount; lane++) {
        const evId = cellLanes[ci][lane];
        if (!evId) {
          // Empty lane — add spacer to preserve lane positions
          if (shown < MAX_LANES) {
            const spacer = document.createElement('div');
            spacer.style.height = '18px';
            cell.appendChild(spacer);
            shown++;
          }
          continue;
        }
        const ev = sortedEvents.find(e => e.id === evId);
        if (!ev) continue;

        if (shown < MAX_LANES) {
          const isStart    = dStr === ev.start;
          const isEnd      = dStr === ev.end;
          const isRangeEv  = ev.start !== ev.end;

          // Is this the first cell of this event in THIS row?
          const isRowStart = colIdx === 0 || cellDates[ci-1]?.dStr < ev.start || colIdx === 0;
          // Actually: show title only if this is the true start OR the leftmost visible cell in this row
          const isFirstInRow = (colIdx === 0) || (dStr === ev.start);
          const isLastInRow  = (colIdx === 6) || (dStr === ev.end);

          let shape;
          if (!isRangeEv) {
            shape = 'single';
          } else if (isFirstInRow && isLastInRow) {
            shape = 'single'; // fills just this segment of row
          } else if (isFirstInRow) {
            shape = 'range-start';
          } else if (isLastInRow) {
            shape = 'range-end';
          } else {
            shape = 'range-mid';
          }

          const bar = document.createElement('div');
          bar.className = `ev-bar ${catClass(ev)} ${shape}`;

          // Title visible only at true start or leftmost row position
          const showTitle = isFirstInRow;
          const label = ev.category === ''
            ? ev.customLabel
            : `${catIcon(ev)} ${ev.title}`;
          bar.innerHTML = `<span class="bar-text">${showTitle ? label : ''}</span>`;
          if (!showTitle) bar.setAttribute('aria-hidden','true');

          bar.title = `${ev.title} (${fmtDate(ev.start)}${ev.start !== ev.end ? ' → '+fmtDate(ev.end) : ''})`;
          bar.onclick = e => { e.stopPropagation(); openDetail(ev.id); };
          cell.appendChild(bar);
          shown++;
        } else {
          // Only count unique events for overflow
          if (!overflow.includes(evId)) overflow.push(evId);
        }
      }

      if (overflow.length > 0) {
        const more = document.createElement('div');
        more.className = 'more-btn';
        more.textContent = `+${overflow.length} more`;
        more.onclick = e => { e.stopPropagation(); openDayModal(dStr, date); };
        cell.appendChild(more);
      }

      cell.onclick = () => openDayModal(dStr, date);
      grid.appendChild(cell);
    }
  }
}

/* ================================================================
   WEEK VIEW
   ================================================================ */
function weekStart(d) {
  const ws = new Date(d.getFullYear(), d.getMonth(), 1);
  ws.setDate(ws.getDate() - ws.getDay());
  return ws;
}

function renderWeek() {
  const HOURS = Array.from({length:24},(_,i)=>i);
  const tStr  = todayStr();
  const ws    = weekStart(cursor);

  /* Time gutter */
  const gut = $('wGutter'); gut.innerHTML = '';
  gut.innerHTML = `<div class="gutter-spacer" style="height:46px"></div>`;
  HOURS.forEach(h => {
    const el = document.createElement('div'); el.className = 't-label';
    el.textContent = h === 0 ? '' : `${String(h).padStart(2,'0')}:00`;
    gut.appendChild(el);
  });

  const cols = $('weekCols'); cols.innerHTML = '';
  for (let d = 0; d < 7; d++) {
    const date  = new Date(ws); date.setDate(ws.getDate() + d);
    const dStr  = ds(date);
    const col   = document.createElement('div'); col.className = 'w-day-col';
    if (dStr === tStr) col.classList.add('today-col');

    /* Header */
    const head = document.createElement('div'); head.className = 'w-day-head';
    head.innerHTML = `<div class="w-day-name">${DAY_NAMES[d]}</div><div class="w-day-num">${date.getDate()}</div>`;
    head.onclick = () => { dayDate = new Date(date); switchView('day'); };
    col.appendChild(head);

    /* Body with hour slots */
    const body = document.createElement('div'); body.className = 'w-day-body';
    HOURS.forEach(() => {
      const slot = document.createElement('div'); slot.className = 'h-slot';
      body.appendChild(slot);
    });

    /* Now line */
    if (dStr === tStr) {
      const now = new Date();
      const line = document.createElement('div'); line.className = 'now-line';
      line.style.top = `${(now.getHours()*60+now.getMinutes())/60*60}px`;
      body.appendChild(line);
    }

    /* Events */
    eventsOnDate(dStr).forEach(ev => {
      const el = buildTimeEv(ev, 60, 'w-ev t-ev');
      body.appendChild(el);
    });

    col.appendChild(body);
    cols.appendChild(col);
  }
}

/* ================================================================
   DAY VIEW
   ================================================================ */
function renderDay() {
  const HOURS = Array.from({length:24},(_,i)=>i);
  const dStr   = ds(dayDate);
  const tStr   = todayStr();

  /* Banner */
  $('dayBanner').innerHTML = `
    <div class="day-big">${dayDate.getDate()}</div>
    <div class="day-meta">${DAY_NAMES[dayDate.getDay()]}, ${MONTH_NAMES[dayDate.getMonth()]} ${dayDate.getFullYear()}${dStr===tStr ? ' · Today' : ''}</div>
  `;

  /* Gutter */
  const gut = $('dGutter'); gut.innerHTML = '';
  HOURS.forEach(h => {
    const el = document.createElement('div'); el.className = 't-label';
    el.textContent = h === 0 ? '' : `${String(h).padStart(2,'0')}:00`;
    gut.appendChild(el);
  });

  /* Body */
  const cols = $('dayCols'); cols.innerHTML = '';
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;position:relative;overflow-y:auto;';

  HOURS.forEach(() => {
    const slot = document.createElement('div'); slot.className = 'h-slot';
    body.appendChild(slot);
  });

  if (dStr === tStr) {
    const now  = new Date();
    const line = document.createElement('div'); line.className = 'now-line';
    line.style.top = `${(now.getHours()*60+now.getMinutes())/60*60}px`;
    body.appendChild(line);
  }

  eventsOnDate(dStr).forEach(ev => {
    const el = buildTimeEv(ev, 60, 'd-ev t-ev');
    el.style.left = '4px'; el.style.right = '4px';
    body.appendChild(el);
  });

  cols.appendChild(body);
}

/* ── Build time-positioned event element ─────────────────────── */
function buildTimeEv(ev, hourH, extraClass) {
  const [sh, sm] = ev.startTime.split(':').map(Number);
  const [eh, em] = ev.endTime.split(':').map(Number);
  const top    = (sh*60+sm)/60*hourH;
  let   height = ((eh*60+em)-(sh*60+sm))/60*hourH;
  if (height < 18) height = 18;

  const color = catColor(ev);
  const el = document.createElement('div');
  el.className = `${extraClass} ${catClass(ev)}`;
  el.style.cssText = `
    top:${top}px; height:${height}px;
    background:${color}20;
    border-left:3px solid ${color};
    color:${color};
  `;
  const label = ev.category === '' ? ev.customLabel : `${catIcon(ev)} ${ev.title}`;
  el.innerHTML = `
    <div class="ev-time">${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}</div>
    <div class="ev-label">${label}</div>
  `;
  el.onclick = () => openDetail(ev.id);
  return el;
}

/* ── Events active on a date ─────────────────────────────────── */
function eventsOnDate(dStr) {
  return events
    .filter(e => dStr >= e.start && dStr <= (e.end||e.start))
    .sort((a,b) => a.startTime.localeCompare(b.startTime));
}

/* ── Upcoming sidebar ────────────────────────────────────────── */
function renderUpcoming() {
  const tStr = todayStr();
  const list = events
    .filter(e => (e.end||e.start) >= tStr)
    .sort((a,b) => a.start.localeCompare(b.start) || a.startTime.localeCompare(b.startTime))
    .slice(0, 8);

  const el = $('upcomingList'); el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<div class="up-empty">No upcoming events ✨</div>';
    return;
  }
  list.forEach((ev, i) => {
    const item = document.createElement('div'); item.className = 'up-item';
    item.style.animationDelay = `${i * 0.05}s`;
    const label = ev.category === '' ? ev.customLabel : `${catIcon(ev)} ${ev.title}`;
    item.innerHTML = `
      <div class="up-color" style="background:${catColor(ev)}"></div>
      <div style="min-width:0;flex:1">
        <div class="up-title">${label}</div>
        <div class="up-date">${fmtDate(ev.start)}${ev.start!==ev.end ? ' → '+fmtDate(ev.end) : ''} · ${fmtTime(ev.startTime)}</div>
      </div>
    `;
    item.onclick = () => openDetail(ev.id);
    el.appendChild(item);
  });
}

/* ── Detail modal ────────────────────────────────────────────── */
function openDetail(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  detailId = id;

  const color = catColor(ev);
  const label = ev.category === '' ? ev.customLabel : `${catIcon(ev)} ${ev.title}`;

  $('modalAccent').style.background = color;
  $('dIcon').textContent = catIcon(ev);
  $('dTitle').textContent = ev.title;

  $('dMeta').innerHTML = `
    <li><span class="mi">📅</span><span class="mv">${fmtDate(ev.start)}${ev.start!==ev.end?' → '+fmtDate(ev.end):''}</span></li>
    <li><span class="mi">🕐</span><span class="mv">${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}</span></li>
    <li><span class="mi">🏷</span><span class="mv">${ev.category===''?ev.customLabel:(PRESET_CATS[ev.category]?.label||ev.category)}</span></li>
  `;

  const note = $('dNote');
  note.textContent = ev.note || '';
  note.style.display = ev.note ? 'block' : 'none';

  $('detailOv').classList.remove('hidden');
}

$('detailClose').onclick = () => $('detailOv').classList.add('hidden');
$('detailOv').onclick    = e => { if (e.target === $('detailOv')) $('detailOv').classList.add('hidden'); };
$('delBtn').onclick      = () => {
  if (!detailId) return;
  events = events.filter(e => e.id !== detailId);
  save(); render();
  $('detailOv').classList.add('hidden');
};

/* ── Day popup modal ─────────────────────────────────────────── */
function openDayModal(dStr, dateObj) {
  dmDate = dStr;
  $('dayPopTitle').textContent =
    `${DAY_NAMES[dateObj.getDay()]} ${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const evs  = eventsOnDate(dStr);
  const list = $('dayPopList'); list.innerHTML = '';

  if (!evs.length) {
    list.innerHTML = '<div class="dp-empty">No events — add one 👇</div>';
  } else {
    evs.forEach(ev => {
      const row = document.createElement('div'); row.className = 'dp-item';
      const lbl = ev.category==='' ? ev.customLabel : `${catIcon(ev)} ${ev.title}`;
      row.innerHTML = `
        <div class="dp-dot" style="background:${catColor(ev)}"></div>
        <div>
          <div class="dp-title">${lbl}</div>
          <div class="dp-time">${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}</div>
        </div>
      `;
      row.onclick = () => { closeDayModal(); openDetail(ev.id); };
      list.appendChild(row);
    });
  }
  $('dayPopOv').classList.remove('hidden');
}

function closeDayModal() { $('dayPopOv').classList.add('hidden'); }
$('dayPopClose').onclick = closeDayModal;
$('dayPopOv').onclick    = e => { if (e.target === $('dayPopOv')) closeDayModal(); };
$('quickAddBtn').onclick = () => {
  closeDayModal();
  $('fStart').value = dmDate || '';
  $('fEnd').value   = dmDate || '';
  $('fTitle').focus();
  $('sidebar').classList.remove('closed');
};

/* ── Animation helpers ───────────────────────────────────────── */
function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), {once:true});
}
function popAnim(el) {
  el.classList.remove('popBounce');
  void el.offsetWidth;
  el.classList.add('popBounce');
  el.addEventListener('animationend', () => el.classList.remove('popBounce'), {once:true});
}

/* ── Sample data ─────────────────────────────────────────────── */
function loadSamples() {
  if (events.length > 0) return;
  const next = o => { const d = new Date(today); d.setDate(today.getDate()+o); return ds(d); };
  events = [
    { id:genId(), title:'Study JavaScript',       category:'study',    customLabel:'', start:next(0),  end:next(6),  startTime:'09:00', endTime:'11:00', note:'Cover: variables, functions, async/await, DOM' },
    { id:genId(), title:'Portfolio Review',       category:'work',     customLabel:'', start:next(1),  end:next(1),  startTime:'14:00', endTime:'15:30', note:'Review and polish all 3 projects' },
    { id:genId(), title:'Morning Workout',        category:'health',   customLabel:'', start:next(0),  end:next(13), startTime:'07:00', endTime:'07:45', note:'5km run every morning' },
    { id:genId(), title:'Team Sync',              category:'meet',     customLabel:'', start:next(2),  end:next(2),  startTime:'10:00', endTime:'11:00', note:'' },
    { id:genId(), title:'Project Deadline',       category:'deadline', customLabel:'', start:next(8),  end:next(8),  startTime:'17:00', endTime:'18:00', note:'Final submission' },
    { id:genId(), title:'Clean Code reading',     category:'personal', customLabel:'', start:next(4),  end:next(9),  startTime:'20:00', endTime:'21:30', note:'Chapters 4–7' },
    { id:genId(), title:'🎸 Guitar Practice',    category:'',         customLabel:'🎸 Guitar Practice', start:next(3), end:next(10), startTime:'18:00', endTime:'19:00', note:'Custom category demo' },
  ];
  save();
}

/* ── Init ────────────────────────────────────────────────────── */
loadSamples();
render();
