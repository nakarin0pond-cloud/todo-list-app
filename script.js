// Advanced To-Do — features: persist, theme, edit, due, priority, drag-drop, export/import, animations
const input = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('taskList');
const progress = document.getElementById('progressBar');
const count = document.getElementById('taskCount');
const themeToggle = document.getElementById('themeToggle');
const dueInput = document.getElementById('dueInput');
const prioritySelect = document.getElementById('prioritySelect');
const filters = document.querySelectorAll('.filters button');
const template = document.getElementById('taskTemplate');
const addSample = document.getElementById('addSample');
const clearCompleted = document.getElementById('clearCompleted');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let filter = localStorage.getItem('filter') || 'all';
let theme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark', theme === 'dark');
themeToggle.setAttribute('aria-pressed', theme === 'dark');function save(){ localStorage.setItem('tasks', JSON.stringify(tasks)); }
function saveSettings(){ localStorage.setItem('filter', filter); localStorage.setItem('theme', theme); }
function fmtDate(d){ if(!d) return ''; const dt = new Date(d); return dt.toLocaleDateString(); }function render(){
  list.innerHTML = '';
  const filtered = tasks.filter(t=>{
    if(filter==='active') return !t.done;
    if(filter==='completed') return t.done;
    return true;
  });
  if(filtered.length===0){
    const empty = document.createElement('div');
    empty.className='empty fade-in';
    empty.innerHTML = '<strong>No tasks</strong><div class="muted">Add your first task ✨</div>';
    list.appendChild(empty);
  } else {
    filtered.forEach((task, idx)=>{
      const node = template.content.cloneNode(true);
      const li = node.querySelector('li');
      li.dataset.index = tasks.indexOf(task);
      li.classList.add('fade-in');
      if(task.done) li.classList.add('completed');
      const txt = li.querySelector('.text');
      txt.textContent = task.text;
      const due = li.querySelector('.due');
      due.textContent = task.due ? Due: ${fmtDate(task.due)} : '';
      const pri = li.querySelector('.priority');
      pri.textContent = task.priority==='high' ? 'High' : task.priority==='low' ? 'Low' : '';
      const check = li.querySelector('.check');
      if(task.done) check.classList.add('done');
      check.onclick = ()=> toggle(tasks.indexOf(task));
      li.querySelector('.delete').onclick = ()=> removeTask(tasks.indexOf(task));
      li.querySelector('.edit').onclick = ()=> editTask(tasks.indexOf(task));
      li.addEventListener('dragstart', (e)=>{
        li.classList.add('dragging');
        e.dataTransfer.setData('text/plain', tasks.indexOf(task));
      });
      li.addEventListener('dragend', ()=> li.classList.remove('dragging'));
      li.addEventListener('dragover', e=>{
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if(!dragging || dragging===li) return;
        const from = Number(dragging.dataset.index);
        const to = Number(li.dataset.index);
        if(from===to) return;
        tasks.splice(to,0, tasks.splice(from,1)[0]);
        save(); render();
      });
      txt.ondblclick = ()=> editTask(tasks.indexOf(task));
      list.appendChild(node);
    });
  }
  updateStats();
  document.querySelectorAll('.filters button').forEach(b=>{
    b.setAttribute('aria-selected', b.dataset.filter===filter);
  });
  saveSettings();
}function add(){
  const text = input.value.trim();
  if(!text) return pulse(input);
  tasks.push({
    text,
    done:false,
    due: dueInput.value || null,
    priority: prioritySelect.value || 'normal',
    created: Date.now()
  });
  input.value=''; dueInput.value=''; prioritySelect.value='normal';
  save(); render(); pulse(addBtn);
}function toggle(i){ tasks[i].done = !tasks[i].done; save(); render(); }
function removeTask(i){ if(!confirm('Delete this task?')) return; tasks.splice(i,1); save(); render(); pulse(document.body); }
function editTask(i){
  const t = tasks[i];
  const newText = prompt('Edit task', t.text);
  if(newText===null) return;
  t.text = newText.trim() || t.text;
  const newDue = prompt('Due date (YYYY-MM-DD) — leave empty to clear', t.due || '');
  if(newDue!==null) t.due = newDue.trim() || null;
  save(); render();
}function updateStats(){
  const done = tasks.filter(t=>t.done).length;
  const total = tasks.length;
  const percent = total ? Math.round(done/total*100) : 0;
  progress.style.width = percent + '%';
  progress.setAttribute('aria-valuenow', percent);
  count.textContent = ${total-done} tasks left;
  progress.classList.add('bump');
  setTimeout(()=>progress.classList.remove('bump'),360);
}function pulse(el){ el.classList.add('bump'); setTimeout(()=>el.classList.remove('bump'),360) }addBtn.onclick = add;
input.addEventListener('keypress', e=>{ if(e.key==='Enter') add(); });
filters.forEach(btn=> btn.onclick = ()=>{ filter = btn.dataset.filter; render(); });
themeToggle.onclick = ()=>{
  theme = theme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('dark', theme==='dark');
  themeToggle.setAttribute('aria-pressed', theme==='dark');
  saveSettings();
};
addSample.onclick = ()=>{
  tasks.push({text:'Prepare portfolio README',done:false,due:null,priority:'high',created:Date.now()});
  tasks.push({text:'Implement drag & drop',done:false,due:null,priority:'normal',created:Date.now()});
  tasks.push({text:'Polish animations',done:false,due:null,priority:'low',created:Date.now()});
  save(); render();
};
clearCompleted.onclick = ()=>{
  if(!confirm('Clear all completed tasks?')) return;
  tasks = tasks.filter(t=>!t.done);
  save(); render();
};exportBtn.onclick = ()=>{
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tasks.json'; a.click();
  URL.revokeObjectURL(url);
};
importBtn.onclick = ()=> importFile.click();
importFile.onchange = (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const imported = JSON.parse(evt.target.result);
      if(Array.isArray(imported)){
        tasks = imported; save(); render();
        alert('Imported tasks');
      }
    }catch(err){ alert('Import failed'); }
  };
  reader.readAsText(f);
};document.addEventListener('keydown', e=>{
  const active = document.activeElement;
  if(active && active.closest && active.closest('.task')) return;
  if(e.key==='/' && document.activeElement!==input){ e.preventDefault(); input.focus(); }
});render();
save();
saveSettings();
