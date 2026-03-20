// ===== STATE =====
let photos = [];       // { id, name, dataUrl, tag: null|'ja'|'nee' }
let currentIndex = 0;
let history = [];      // for undo
let isDragging = false;
let startX = 0;
let currentX = 0;

// ===== STORAGE =====
function save() {
  // Save only tags + names (not base64) for performance; base64 separately
  const meta = photos.map(p => ({ id: p.id, name: p.name, tag: p.tag }));
  try {
    localStorage.setItem('swipe_meta', JSON.stringify(meta));
    photos.forEach(p => {
      try { localStorage.setItem('swipe_img_' + p.id, p.dataUrl); } catch (_) {}
    });
  } catch (_) {}
}

function load() {
  try {
    const meta = JSON.parse(localStorage.getItem('swipe_meta') || '[]');
    photos = meta.map(m => ({
      ...m,
      dataUrl: localStorage.getItem('swipe_img_' + m.id) || ''
    })).filter(p => p.dataUrl);
    currentIndex = photos.findIndex(p => p.tag === null);
    if (currentIndex === -1) currentIndex = photos.length;
  } catch (_) { photos = []; currentIndex = 0; }
}

// ===== INIT =====
load();
renderSwipeView();
renderGallery();
setupUpload();

// ===== VIEW SWITCHING =====
function showView(name) {
  document.getElementById('view-swipe').classList.toggle('hidden', name !== 'swipe');
  document.getElementById('view-gallery').classList.toggle('hidden', name !== 'gallery');
  document.getElementById('btn-swipe').classList.toggle('active', name === 'swipe');
  document.getElementById('btn-gallery').classList.toggle('active', name === 'gallery');
  if (name === 'gallery') renderGallery();
  if (name === 'swipe') renderSwipeView();
}

// ===== UPLOAD =====
function setupUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  input.addEventListener('change', e => handleFiles(e.target.files));

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;

  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const id = Date.now() + '_' + Math.random().toString(36).slice(2);
      photos.push({ id, name: file.name, dataUrl: e.target.result, tag: null });
      loaded++;
      if (loaded === files.length) {
        save();
        if (currentIndex >= photos.length) currentIndex = photos.findIndex(p => p.tag === null);
        if (currentIndex === -1) currentIndex = photos.length;
        renderSwipeView();
      }
    };
    reader.readAsDataURL(file);
  });
}

// ===== SWIPE RENDER =====
function renderSwipeView() {
  const stack = document.getElementById('card-stack');
  const emptyState = document.getElementById('empty-state');
  const swipeArea = document.getElementById('swipe-area');
  const uploadZone = document.getElementById('upload-zone');

  const remaining = photos.filter(p => p.tag === null);

  if (photos.length === 0) {
    swipeArea.classList.add('hidden');
    emptyState.classList.remove('visible');
    uploadZone.classList.remove('hidden');
    return;
  }

  uploadZone.classList.remove('hidden');

  if (remaining.length === 0) {
    swipeArea.classList.add('hidden');
    emptyState.classList.add('visible');
    updateProgress();
    return;
  }

  swipeArea.classList.remove('hidden');
  emptyState.classList.remove('visible');

  // Show top 3 unswiped cards
  stack.innerHTML = '';
  const topCards = remaining.slice(0, 3).reverse(); // render bottom first
  topCards.forEach((photo, i) => {
    const card = createCard(photo, i === topCards.length - 1);
    stack.appendChild(card);
  });

  updateProgress();
}

function createCard(photo, isTop) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.id = photo.id;

  const img = document.createElement('img');
  img.src = photo.dataUrl;
  img.alt = photo.name;

  const overlayYes = document.createElement('div');
  overlayYes.className = 'card-overlay yes';
  overlayYes.textContent = '✅ JA';

  const overlayNo = document.createElement('div');
  overlayNo.className = 'card-overlay no';
  overlayNo.textContent = '❌ NEE';

  const filename = document.createElement('div');
  filename.className = 'card-filename';
  filename.textContent = photo.name;

  card.appendChild(img);
  card.appendChild(overlayYes);
  card.appendChild(overlayNo);
  card.appendChild(filename);

  if (isTop) {
    setupCardDrag(card);
  }

  return card;
}

// ===== DRAG / SWIPE =====
function setupCardDrag(card) {
  card.addEventListener('mousedown', onDragStart);
  card.addEventListener('touchstart', onDragStart, { passive: true });
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);
}

function onDragStart(e) {
  isDragging = true;
  startX = e.touches ? e.touches[0].clientX : e.clientX;
  currentX = 0;
}

function onDragMove(e) {
  if (!isDragging) return;
  if (e.cancelable) e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  currentX = clientX - startX;

  const card = document.querySelector('.photo-card:last-child');
  if (!card) return;

  const rotate = currentX * 0.08;
  card.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;

  const overlayYes = card.querySelector('.card-overlay.yes');
  const overlayNo  = card.querySelector('.card-overlay.no');

  const ratio = Math.min(Math.abs(currentX) / 100, 1);

  if (currentX > 20) {
    overlayYes.style.opacity = ratio;
    overlayNo.style.opacity = 0;
    document.getElementById('label-right').classList.add('active');
    document.getElementById('label-left').classList.remove('active');
  } else if (currentX < -20) {
    overlayNo.style.opacity = ratio;
    overlayYes.style.opacity = 0;
    document.getElementById('label-left').classList.add('active');
    document.getElementById('label-right').classList.remove('active');
  } else {
    overlayYes.style.opacity = 0;
    overlayNo.style.opacity = 0;
    document.getElementById('label-left').classList.remove('active');
    document.getElementById('label-right').classList.remove('active');
  }
}

function onDragEnd() {
  if (!isDragging) return;
  isDragging = false;

  document.getElementById('label-left').classList.remove('active');
  document.getElementById('label-right').classList.remove('active');

  const card = document.querySelector('.photo-card:last-child');
  if (!card) return;

  const threshold = 80;
  if (currentX > threshold) {
    triggerSwipe(card, 'right');
  } else if (currentX < -threshold) {
    triggerSwipe(card, 'left');
  } else {
    card.style.transform = '';
    card.querySelectorAll('.card-overlay').forEach(o => o.style.opacity = 0);
  }
  currentX = 0;
}

// ===== SWIPE LOGIC =====
function swipeCard(direction) {
  const card = document.querySelector('.photo-card:last-child');
  if (!card) return;
  triggerSwipe(card, direction === 'right' ? 'right' : 'left');
}

function triggerSwipe(card, direction) {
  const photoId = card.dataset.id;
  const photo = photos.find(p => p.id === photoId);
  if (!photo) return;

  const tag = direction === 'right' ? 'ja' : 'nee';

  // Remove drag listeners
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchend', onDragEnd);

  card.style.transform = '';
  card.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');

  // Show overlay
  const overlay = card.querySelector('.card-overlay.' + (direction === 'right' ? 'yes' : 'no'));
  if (overlay) overlay.style.opacity = 1;

  history.push({ id: photoId, prevTag: photo.tag });
  photo.tag = tag;
  save();

  setTimeout(() => {
    card.remove();
    currentIndex = photos.findIndex(p => p.tag === null);
    if (currentIndex === -1) currentIndex = photos.length;
    renderSwipeView();
  }, 380);
}

// ===== UNDO =====
function undoLast() {
  if (!history.length) return;
  const last = history.pop();
  const photo = photos.find(p => p.id === last.id);
  if (photo) {
    photo.tag = last.prevTag;
    save();
    currentIndex = photos.findIndex(p => p.tag === null);
    if (currentIndex === -1) currentIndex = photos.length;
    renderSwipeView();
  }
}

// ===== PROGRESS =====
function updateProgress() {
  const total = photos.length;
  const done = photos.filter(p => p.tag !== null).length;
  const pct = total ? (done / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    total ? `${done} / ${total} geswiped` : '';
}

// ===== GALLERY =====
let galleryFilter = 'all';

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const emptyEl = document.getElementById('gallery-empty');
  grid.innerHTML = '';

  let filtered = photos;
  if (galleryFilter === 'ja') filtered = photos.filter(p => p.tag === 'ja');
  else if (galleryFilter === 'nee') filtered = photos.filter(p => p.tag === 'nee');
  else if (galleryFilter === 'unswiped') filtered = photos.filter(p => p.tag === null);

  if (!filtered.length) {
    emptyEl.classList.add('visible');
    return;
  }
  emptyEl.classList.remove('visible');

  filtered.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.onclick = () => openLightbox(photo);

    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = photo.name;
    img.loading = 'lazy';

    const tag = document.createElement('div');
    tag.className = 'gallery-tag ' + (photo.tag ? 'tag-' + photo.tag : 'tag-unswiped');
    tag.textContent = photo.tag === 'ja' ? '✅ Ja' : photo.tag === 'nee' ? '❌ Nee' : '⏳';

    const name = document.createElement('div');
    name.className = 'gallery-item-name';
    name.textContent = photo.name;

    item.appendChild(img);
    item.appendChild(tag);
    item.appendChild(name);
    grid.appendChild(item);
  });
}

function filterGallery(filter, btn) {
  galleryFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGallery();
}

function clearAll() {
  if (!confirm('Weet je zeker dat je alle foto\'s wilt wissen?')) return;
  photos.forEach(p => { try { localStorage.removeItem('swipe_img_' + p.id); } catch (_) {} });
  photos = [];
  history = [];
  currentIndex = 0;
  try { localStorage.removeItem('swipe_meta'); } catch (_) {}
  renderGallery();
  renderSwipeView();
}

// ===== LIGHTBOX =====
function openLightbox(photo) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = photo.dataUrl;
  document.getElementById('lightbox-name').textContent = photo.name;

  const tagEl = document.getElementById('lightbox-tag');
  tagEl.className = 'lightbox-tag ' + (photo.tag ? 'tag-' + photo.tag : 'tag-unswiped');
  tagEl.textContent = photo.tag === 'ja' ? '✅ JA — Geliked' :
                      photo.tag === 'nee' ? '❌ NEE — Gepasst' : '⏳ Nog niet geswiped';

  lb.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (lb.classList.contains('open')) { if (e.key === 'Escape') closeLightbox(); return; }
  if (e.key === 'ArrowRight') swipeCard('right');
  if (e.key === 'ArrowLeft')  swipeCard('left');
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) undoLast();
});
