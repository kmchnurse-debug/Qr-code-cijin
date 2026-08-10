const CATEGORIES = [
  { name: '門診', icon: '✚' },
  { name: '病房', icon: '▤' },
  { name: '洗腎室', icon: '◉' },
  { name: '急診', icon: '✦' }
];

const state = { items: [], selectedCategory: null, adminToken: sessionStorage.getItem('adminToken') || '' };
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.adminToken) headers.Authorization = `Bearer ${state.adminToken}`;
  const res = await fetch(`/api/${path}`, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function loadItems() {
  try {
    const data = await api('items');
    state.items = Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    const local = localStorage.getItem('storeroom-items-fallback');
    state.items = local ? JSON.parse(local) : [];
    console.warn('Using local fallback data:', err.message);
  }
  renderCategories();
  renderItems();
  renderAdminList();
  await openQrModeFromUrl();
}

function renderCategories() {
  const grid = $('categoryGrid');
  grid.innerHTML = '';
  for (const c of CATEGORIES) {
    const count = state.items.filter(i => i.category === c.name).length;
    const button = document.createElement('button');
    button.className = `category-card${state.selectedCategory === c.name ? ' active' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="cat-icon">${c.icon}</span><span class="cat-arrow">→</span><div class="cat-name">${c.name}</div><div class="cat-count">${count} 項耗材</div>`;
    button.addEventListener('click', () => { state.selectedCategory = c.name; renderCategories(); renderItems(); });
    grid.appendChild(button);
  }
}

function filteredItems() {
  const q = $('searchInput').value.trim().toLowerCase();
  let items = state.items;
  if (state.selectedCategory) items = items.filter(i => i.category === state.selectedCategory);
  if (q) items = items.filter(i => [i.name, i.code, i.location, i.category].some(v => String(v || '').toLowerCase().includes(q)));
  return items;
}

function renderItems() {
  const grid = $('itemGrid');
  const q = $('searchInput').value.trim();
  const shouldShow = Boolean(state.selectedCategory || q);
  $('catalogEmpty').classList.toggle('hidden', shouldShow);
  $('resultsHeader').classList.toggle('hidden', !shouldShow);
  grid.innerHTML = '';
  if (!shouldShow) return;

  const items = filteredItems();
  $('resultsEyebrow').textContent = q ? 'SEARCH RESULTS' : 'DEPARTMENT';
  $('resultsTitle').textContent = q ? `搜尋「${q}」` : state.selectedCategory;
  $('resultsCount').textContent = `${items.length} 項`;

  if (!items.length) {
    grid.innerHTML = `<div class="catalog-empty"><h2>找不到符合的耗材</h2><p>請調整搜尋文字或切換其他分類。</p></div>`;
    return;
  }

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'item-card';
    const img = item.image ? `<img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}" loading="lazy">` : `<div class="image-placeholder">尚未上傳圖片</div>`;
    card.innerHTML = `<div class="item-image" data-image-id="${escapeAttr(item.id)}">${img}</div>
      <div class="item-body"><div class="item-title">${escapeHtml(item.name)}</div><div class="item-code">${escapeHtml(item.code)}</div>
      <div class="item-location">${escapeHtml(item.location || item.category)}</div>
      <div class="item-actions"><button class="btn btn-dark small" data-qr-id="${escapeAttr(item.id)}">QR Code</button><button class="btn btn-ghost small" data-image-id="${escapeAttr(item.id)}">查看圖片</button></div></div>`;
    grid.appendChild(card);
  }
}

function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function escapeAttr(s='') { return escapeHtml(s); }

function showImage(item) {
  if (!item) return;
  $('modalImage').src = item.image || '';
  $('modalImage').style.display = item.image ? 'block' : 'none';
  $('modalMeta').innerHTML = `<strong>${escapeHtml(item.name)}</strong><br><span class="item-code">${escapeHtml(item.code)}</span>${item.location ? `<br>${escapeHtml(item.location)}` : ''}`;
  $('imageDialog').showModal();
}

function qrUrl(item) {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('item', item.id);
  u.searchParams.set('mode', 'qr');
  return u.toString();
}

function showQr(item) {
  if (!item) return;
  $('qrTitle').textContent = item.name;
  $('qrPreviewImage').src = item.image || '';
  $('qrPreviewCode').textContent = item.code || '';
  if (window.QRious) {
    new QRious({ element: $('qrCanvas'), value: qrUrl(item), size: 260, level: 'H', foreground: '#171717', background: '#ffffff' });
  }
  $('qrDialog').showModal();
}

async function openQrModeFromUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('mode') !== 'qr' || !p.get('item')) return;
  const item = state.items.find(i => i.id === p.get('item'));
  $('app').classList.add('hidden');
  $('qrMode').classList.remove('hidden');
  if (!item) {
    $('qrModeCode').textContent = '查無此耗材資料';
    return;
  }
  $('qrModeImage').src = item.image || '';
  $('qrModeCode').textContent = item.code || '';
}

async function registerVisitor() {
  const keyName = 'storeroom-visitor-registered';
  const already = localStorage.getItem(keyName);
  try {
    const data = await api('visitors', { method: already ? 'GET' : 'POST', body: already ? undefined : JSON.stringify({}) });
    $('visitorCount').textContent = `累積訪客 ${data.count ?? 0} 人`;
    if (!already) localStorage.setItem(keyName, '1');
  } catch {
    $('visitorCount').textContent = '累積訪客 — 人';
  }
}

function setupDialogs() {
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close-dialog]');
    if (close) $(close.dataset.closeDialog)?.close();
    const imageBtn = e.target.closest('[data-image-id]');
    if (imageBtn) showImage(state.items.find(i => i.id === imageBtn.dataset.imageId));
    const qrBtn = e.target.closest('[data-qr-id]');
    if (qrBtn) showQr(state.items.find(i => i.id === qrBtn.dataset.qrId));
  });
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
}

async function login(e) {
  e.preventDefault();
  $('loginError').textContent = '';
  try {
    const data = await api('login', { method: 'POST', body: JSON.stringify({ username: $('loginUsername').value, password: $('loginPassword').value }) });
    state.adminToken = data.token;
    sessionStorage.setItem('adminToken', state.adminToken);
    $('loginDialog').close();
    $('adminDialog').showModal();
    renderAdminList();
  } catch (err) {
    $('loginError').textContent = err.message === 'ADMIN_NOT_CONFIGURED' ? '管理者帳密尚未在 Netlify 環境變數完成設定。' : '帳號或密碼錯誤。';
  }
}

function resetItemForm() {
  $('itemForm').reset(); $('itemId').value = ''; $('itemFormTitle').textContent = '新增耗材';
}

async function imageFileToDataUrl(file) {
  if (!file) return '';
  const img = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .84);
}

async function saveItem(e) {
  e.preventDefault();
  const id = $('itemId').value;
  const existing = state.items.find(i => i.id === id);
  const file = $('itemImageFile').files[0];
  const compressed = file ? await imageFileToDataUrl(file) : '';
  const item = {
    id: id || crypto.randomUUID(),
    name: $('itemName').value.trim(), code: $('itemCode').value.trim(), category: $('itemCategory').value,
    location: $('itemLocation').value.trim(), image: compressed || $('itemImageUrl').value.trim() || existing?.image || '', updatedAt: new Date().toISOString()
  };
  try {
    const data = await api('items', { method: id ? 'PUT' : 'POST', body: JSON.stringify(item) });
    state.items = data.items;
  } catch (err) {
    alert(`儲存失敗：${err.message}`); return;
  }
  resetItemForm(); renderCategories(); renderItems(); renderAdminList();
}

function renderAdminList() {
  const list = $('adminItemList'); if (!list) return;
  $('adminItemCount').textContent = `${state.items.length} 項`;
  list.innerHTML = '';
  for (const item of state.items) {
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = item.image ? `<img class="admin-thumb" src="${escapeAttr(item.image)}" alt="">` : `<div class="admin-thumb"></div>`;
    const text = document.createElement('div'); text.innerHTML = `<div class="admin-row-title">${escapeHtml(item.name)}</div><div class="admin-row-sub">${escapeHtml(item.code)} · ${escapeHtml(item.category)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</div>`;
    const actions = document.createElement('div'); actions.className = 'admin-row-actions'; actions.innerHTML = `<button class="btn btn-ghost small" data-edit="${escapeAttr(item.id)}">編輯</button><button class="btn btn-ghost small" data-delete="${escapeAttr(item.id)}">刪除</button>`;
    row.append(text, actions); list.appendChild(row);
  }
}

async function deleteItem(id) {
  if (!confirm('確定要刪除此耗材？')) return;
  try {
    const data = await api(`items?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.items = data.items; renderCategories(); renderItems(); renderAdminList();
  } catch (err) { alert(`刪除失敗：${err.message}`); }
}

function editItem(id) {
  const i = state.items.find(x => x.id === id); if (!i) return;
  $('itemId').value = i.id; $('itemName').value = i.name || ''; $('itemCode').value = i.code || ''; $('itemCategory').value = i.category || '門診'; $('itemLocation').value = i.location || ''; $('itemImageUrl').value = i.image?.startsWith('http') ? i.image : '';
  $('itemFormTitle').textContent = '編輯耗材'; $('itemName').focus();
}

function bind() {
  $('searchInput').addEventListener('input', renderItems);
  $('adminLoginBtn').addEventListener('click', () => state.adminToken ? $('adminDialog').showModal() : $('loginDialog').showModal());
  $('loginForm').addEventListener('submit', login);
  $('itemForm').addEventListener('submit', saveItem);
  $('itemFormReset').addEventListener('click', resetItemForm);
  $('adminLogoutBtn').addEventListener('click', () => { state.adminToken=''; sessionStorage.removeItem('adminToken'); $('adminDialog').close(); });
  $('adminItemList').addEventListener('click', e => { const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-delete]'); if(edit) editItem(edit.dataset.edit); if(del) deleteItem(del.dataset.delete); });
  $('closeWindowBtn').addEventListener('click', () => { window.close(); setTimeout(() => history.length > 1 ? history.back() : location.assign('./'), 120); });
  setupDialogs();
}

bind();
loadItems();
registerVisitor();
