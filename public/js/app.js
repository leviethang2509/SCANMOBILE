/**
 * CAM SCAN TO PDF - Web Application Logic
 * Hỗ trợ chụp ảnh tài liệu qua camera, đánh số trang tự động và chuyển đổi sang file PDF
 */

// IndexedDB configuration for persistent Directory Handle storage
const IDB_NAME = 'CamScanToPdfDB';
const IDB_STORE = 'handles';
const IDB_DIR_KEY = 'savedDirectoryHandle';

// State Management
const state = {
  directoryHandle: null,
  folderPath: '',
  folderHistory: [],
  documentTitle: 'HoSoTaiLieu',
  startPage: 1,
  watermarkPage: true,
  filterMode: 'enhance',
  cameraStream: null,
  selectedDeviceId: '',
  capturedPages: [], // Array of { id, dataUrl, pageNum, rotation, width, height }
  isCapturing: false,
  lastGeneratedPdfBlob: null,
  lastGeneratedFilename: '',
  serverAvailable: false,
  audioContext: null
};

// DOM Elements
const elements = {
  // Navigation & Tabs
  navScanTab: document.getElementById('navScanTab'),
  navHistoryTab: document.getElementById('navHistoryTab'),
  scanView: document.getElementById('scanView'),
  historyView: document.getElementById('historyView'),
  historyCount: document.getElementById('historyCount'),
  historyTableBody: document.getElementById('historyTableBody'),
  btnClearHistory: document.getElementById('btnClearHistory'),

  // Stepper cards
  stepCard1: document.getElementById('stepCard1'),
  stepCard2: document.getElementById('stepCard2'),
  stepCard3: document.getElementById('stepCard3'),
  stepCard4: document.getElementById('stepCard4'),

  // Configuration (B1 & B2)
  folderDisplayInput: document.getElementById('folderDisplayInput'),
  btnPickFolder: document.getElementById('btnPickFolder'),
  folderHistorySelect: document.getElementById('folderHistorySelect'),
  folderStatusBadge: document.getElementById('folderStatusBadge'),
  documentTitleInput: document.getElementById('documentTitleInput'),
  startPageInput: document.getElementById('startPageInput'),
  btnDecStartPage: document.getElementById('btnDecStartPage'),
  btnIncStartPage: document.getElementById('btnIncStartPage'),
  previewFilenameDisplay: document.getElementById('previewFilenameDisplay'),
  chkWatermarkPage: document.getElementById('chkWatermarkPage'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),
  filterSelect: document.getElementById('filterSelect'),
  fileImageInput: document.getElementById('fileImageInput'),
  btnUploadImages: document.getElementById('btnUploadImages'),

  // Camera & Viewfinder (B3)
  cameraSelect: document.getElementById('cameraSelect'),
  resolutionSelect: document.getElementById('resolutionSelect'),
  btnToggleGuide: document.getElementById('btnToggleGuide'),
  chkShutterSound: document.getElementById('chkShutterSound'),
  btnSwitchCam: document.getElementById('btnSwitchCam'),
  btnRestartCam: document.getElementById('btnRestartCam'),
  viewfinderWrapper: document.getElementById('viewfinderWrapper'),
  camVideo: document.getElementById('camVideo'),
  captureCanvas: document.getElementById('captureCanvas'),
  shutterFlash: document.getElementById('shutterFlash'),
  hudPageNumber: document.getElementById('hudPageNumber'),
  documentGuide: document.getElementById('documentGuide'),
  capturedCountBadge: document.getElementById('capturedCountBadge'),
  btnCapture: document.getElementById('btnCapture'),
  captureBtnPageNum: document.getElementById('captureBtnPageNum'),
  btnOpenReview: document.getElementById('btnOpenReview'),
  thumbnailFilmstrip: document.getElementById('thumbnailFilmstrip'),
  btnClearAllSnaps: document.getElementById('btnClearAllSnaps'),

  // Review Modal (B4)
  reviewModal: document.getElementById('reviewModal'),
  btnCloseReviewModal: document.getElementById('btnCloseReviewModal'),
  btnCancelReview: document.getElementById('btnCancelReview'),
  btnReviewAddMore: document.getElementById('btnReviewAddMore'),
  btnReviewUploadMore: document.getElementById('btnReviewUploadMore'),
  btnConfirmSavePdf: document.getElementById('btnConfirmSavePdf'),
  modalReviewCount: document.getElementById('modalReviewCount'),
  reviewDocTitle: document.getElementById('reviewDocTitle'),
  reviewPageRange: document.getElementById('reviewPageRange'),
  reviewFilename: document.getElementById('reviewFilename'),
  reviewFolderPath: document.getElementById('reviewFolderPath'),
  reviewGalleryGrid: document.getElementById('reviewGalleryGrid'),

  // Zoom Modal
  zoomModal: document.getElementById('zoomModal'),
  btnCloseZoomModal: document.getElementById('btnCloseZoomModal'),
  zoomImage: document.getElementById('zoomImage'),
  zoomModalTitle: document.getElementById('zoomModalTitle'),

  // Success Modal (B6)
  successModal: document.getElementById('successModal'),
  successFilename: document.getElementById('successFilename'),
  successFolderPath: document.getElementById('successFolderPath'),
  successPagesSummary: document.getElementById('successPagesSummary'),
  btnOpenPdfTab: document.getElementById('btnOpenPdfTab'),
  btnOpenExplorerFolder: document.getElementById('btnOpenExplorerFolder'),
  btnStartNewScan: document.getElementById('btnStartNewScan'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// 1. INITIALIZATION & STORAGE HELPERS (B1)
// ==========================================

async function initApp() {
  loadStoredPreferences();
  await checkServerStatus();
  await initIndexedDB();
  await loadSavedDirectoryHandle();
  updateFilenamePreview();
  updateActivePageUI();
  setupEventListeners();
  renderHistoryTable();
  await initCamera();
}

// IndexedDB for FileSystemDirectoryHandle
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandleToDB(key, val) {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    return new Promise((res) => {
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch (err) {
    console.warn('IDB write error:', err);
    return false;
  }
}

async function getHandleFromDB(key) {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    return new Promise((res) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  } catch (err) {
    console.warn('IDB read error:', err);
    return null;
  }
}

async function initIndexedDB() {
  try {
    await openDB();
  } catch (e) {
    console.warn('IndexedDB not supported or disabled:', e);
  }
}

// Check if local Node.js server is running
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      state.serverAvailable = true;
      if (data.config && data.config.defaultDir && !state.folderPath) {
        state.folderPath = data.config.defaultDir;
        elements.folderDisplayInput.value = state.folderPath;
        updateFolderBadge(true, 'Thư mục máy chủ');
      }
      if (data.config && data.config.historyDirs) {
        mergeFolderHistory(data.config.historyDirs);
      }
    }
  } catch (e) {
    state.serverAvailable = false;
  }
}

// B1: Load stored folder preferences & history
function loadStoredPreferences() {
  try {
    const savedTitle = localStorage.getItem('camScan_docTitle');
    if (savedTitle) {
      state.documentTitle = savedTitle;
      elements.documentTitleInput.value = savedTitle;
    }

    const savedStartPage = localStorage.getItem('camScan_startPage');
    if (savedStartPage) {
      state.startPage = parseInt(savedStartPage, 10) || 1;
      elements.startPageInput.value = state.startPage;
    }

    const savedHistory = localStorage.getItem('camScan_folderHistory');
    if (savedHistory) {
      state.folderHistory = JSON.parse(savedHistory) || [];
      renderFolderHistorySelect();
    }

    const lastPath = localStorage.getItem('camScan_lastFolderPath');
    if (lastPath) {
      state.folderPath = lastPath;
      elements.folderDisplayInput.value = lastPath;
      updateFolderBadge(true, 'Đã nhớ từ trước');
    }
  } catch (err) {
    console.error('Error loading preferences:', err);
  }
}

function mergeFolderHistory(newDirs) {
  if (!Array.isArray(newDirs)) return;
  newDirs.forEach(dir => {
    if (dir && !state.folderHistory.includes(dir)) {
      state.folderHistory.unshift(dir);
    }
  });
  state.folderHistory = state.folderHistory.slice(0, 15);
  localStorage.setItem('camScan_folderHistory', JSON.stringify(state.folderHistory));
  renderFolderHistorySelect();
}

function renderFolderHistorySelect() {
  elements.folderHistorySelect.innerHTML = '<option value="">-- Danh sách thư mục đã dùng trước đó --</option>';
  state.folderHistory.forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder;
    opt.textContent = folder;
    if (folder === state.folderPath) {
      opt.selected = true;
    }
    elements.folderHistorySelect.appendChild(opt);
  });
}

function updateFolderBadge(ready, text) {
  if (ready) {
    elements.folderStatusBadge.textContent = text || 'Đã sẵn sàng';
    elements.folderStatusBadge.style.color = '#10b981';
    elements.folderStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    elements.folderStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    elements.stepCard1.classList.add('completed');
  } else {
    elements.folderStatusBadge.textContent = 'Chưa chọn';
    elements.folderStatusBadge.style.color = '#818cf8';
    elements.folderStatusBadge.style.borderColor = 'rgba(99, 102, 241, 0.3)';
    elements.folderStatusBadge.style.background = 'rgba(99, 102, 241, 0.15)';
    elements.stepCard1.classList.remove('completed');
  }
}

// B1: Restore saved directory handle from IndexedDB
async function loadSavedDirectoryHandle() {
  if (!('showDirectoryPicker' in window)) return;
  try {
    const handle = await getHandleFromDB(IDB_DIR_KEY);
    if (handle) {
      state.directoryHandle = handle;
      const folderName = handle.name || 'Thư mục đã chọn';
      state.folderPath = folderName;
      elements.folderDisplayInput.value = folderName;
      updateFolderBadge(true, `Sẵn sàng: ${folderName}`);
    }
  } catch (e) {
    console.warn('Could not restore directory handle:', e);
  }
}

// B1: Choose folder action (supports browser Directory Picker & server fallback)
async function pickFolder() {
  // Option A: Browser File System Access API
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Verify write permission
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        state.directoryHandle = handle;
        state.folderPath = handle.name;
        elements.folderDisplayInput.value = handle.name;
        await saveHandleToDB(IDB_DIR_KEY, handle);
        
        // Add to history
        mergeFolderHistory([handle.name]);
        localStorage.setItem('camScan_lastFolderPath', handle.name);

        updateFolderBadge(true, `Sẵn sàng: ${handle.name}`);
        showToast(`Đã chọn thư mục: ${handle.name}`, 'success');
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('DirectoryPicker error:', err);
      }
    }
  }

  // Option B: Prompt user or use prompt dialog for Windows path
  const currentVal = state.folderPath || (navigator.platform.includes('Win') ? 'C:\\ScannedPDFs' : '/Documents/ScannedPDFs');
  const userPath = prompt('Nhập đường dẫn thư mục lưu file PDF trên máy tính của bạn:', currentVal);
  if (userPath && userPath.trim()) {
    const cleaned = userPath.trim();
    state.folderPath = cleaned;
    elements.folderDisplayInput.value = cleaned;
    mergeFolderHistory([cleaned]);
    localStorage.setItem('camScan_lastFolderPath', cleaned);
    updateFolderBadge(true, 'Đã lưu đường dẫn');

    // Notify server if running
    if (state.serverAvailable) {
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDir: cleaned })
      }).catch(() => {});
    }

    showToast(`Đã đặt thư mục lưu: ${cleaned}`, 'success');
  }
}

// ==========================================
// 2. FILENAME & STEPPER LOGIC (B2 & B5)
// ==========================================

// B5 formula: TenHoSo_p(trang bat dau)_p(trang ket thuc).pdf
function computeFilename() {
  const cleanTitle = (state.documentTitle || 'HoSoTaiLieu')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_');
  
  const startP = Math.max(1, state.startPage);
  const totalCaptured = state.capturedPages.length;
  // If no pages captured yet, preview as 1 page from startP
  const endP = totalCaptured > 0 ? (startP + totalCaptured - 1) : startP;

  return `${cleanTitle}_p${startP}_p${endP}.pdf`;
}

function updateFilenamePreview() {
  const fn = computeFilename();
  elements.previewFilenameDisplay.textContent = fn;
}

// B3 Note: Update UI indicators for current active page
function updateActivePageUI() {
  const currentTargetPage = state.startPage + state.capturedPages.length;
  
  // HUD overlay on camera
  elements.hudPageNumber.textContent = `TRANG ${currentTargetPage}`;
  
  // Shutter button text
  elements.captureBtnPageNum.textContent = currentTargetPage;
  
  // Total counter
  const total = state.capturedPages.length;
  elements.capturedCountBadge.textContent = total;
  elements.modalReviewCount.textContent = total;

  // Review button enable/disable
  elements.btnOpenReview.disabled = total === 0;

  // Stepper highlights
  if (total > 0) {
    elements.stepCard2.classList.add('completed');
    elements.stepCard3.classList.add('active');
  } else {
    elements.stepCard3.classList.remove('active');
  }

  updateFilenamePreview();
}

// ==========================================
// 3. CAMERA & CAPTURE LOGIC (B3)
// ==========================================

async function initCamera() {
  try {
    // Check permission / devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Trình duyệt không hỗ trợ Camera. Vui lòng chạy trên Chrome/Edge với localhost hoặc HTTPS!', 'error');
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');

    elements.cameraSelect.innerHTML = '';
    if (videoDevices.length === 0) {
      elements.cameraSelect.innerHTML = '<option value="">Không tìm thấy camera</option>';
    } else {
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${index + 1}`;
        elements.cameraSelect.appendChild(option);
      });
      state.selectedDeviceId = videoDevices[0].deviceId;
    }

    await startCameraStream();
  } catch (err) {
    console.error('Camera init error:', err);
    showToast('Lỗi truy cập camera: ' + err.message, 'error');
  }
}

async function startCameraStream() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
  }

  const resVal = elements.resolutionSelect.value;
  let widthConstraint = { ideal: 1920 };
  let heightConstraint = { ideal: 1080 };

  if (resVal === '4k') {
    widthConstraint = { ideal: 3840 };
    heightConstraint = { ideal: 2160 };
  } else if (resVal === '720') {
    widthConstraint = { ideal: 1280 };
    heightConstraint = { ideal: 720 };
  }

  const constraints = {
    audio: false,
    video: {
      deviceId: state.selectedDeviceId ? { exact: state.selectedDeviceId } : undefined,
      facingMode: state.selectedDeviceId ? undefined : { ideal: 'environment' },
      width: widthConstraint,
      height: heightConstraint
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.cameraStream = stream;
    elements.camVideo.srcObject = stream;
    elements.camVideo.play();
  } catch (err) {
    console.warn('Could not start camera with exact constraints, trying fallback:', err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
      state.cameraStream = fallbackStream;
      elements.camVideo.srcObject = fallbackStream;
      elements.camVideo.play();
    } catch (fallbackErr) {
      showToast('Không thể kết nối đến camera: ' + fallbackErr.message, 'error');
    }
  }
}

// Quick switch camera (Front / Back / External) for iPhone and touch screens
async function switchCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');

    if (videoDevices.length <= 1) {
      showToast('Thiết bị chỉ có 1 camera hoặc chưa được cấp đủ quyền.', 'error');
      return;
    }

    const currentIdx = videoDevices.findIndex(d => d.deviceId === state.selectedDeviceId);
    const nextIdx = (currentIdx + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIdx];

    state.selectedDeviceId = nextDevice.deviceId;
    elements.cameraSelect.value = nextDevice.deviceId;

    await startCameraStream();
    showToast(`Đã chuyển sang: ${nextDevice.label || 'Camera ' + (nextIdx + 1)}`, 'success');
  } catch (err) {
    showToast('Lỗi khi đổi camera: ' + err.message, 'error');
  }
}

// Shutter Audio Click (Synthesized realistic shutter sound using Web Audio API)
function playShutterSound() {
  if (!elements.chkShutterSound.checked) return;
  try {
    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = state.audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Double click shutter mechanism
    const now = ctx.currentTime;
    
    // Click 1 (Mechanical tap)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(100, now + 0.04);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.04);

    // Click 2 (Spring release)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    gain2.gain.setValueAtTime(0.6, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.12);
  } catch (e) {
    // Audio context may require prior user interaction
  }
}

// B3: Capture single page in sequence
function captureCurrentPage() {
  if (state.isCapturing) return;
  if (!elements.camVideo.videoWidth) {
    showToast('Camera chưa sẵn sàng, vui lòng đợi giây lát...', 'error');
    return;
  }

  state.isCapturing = true;

  // Visual Shutter Flash
  elements.shutterFlash.classList.add('flashing');
  setTimeout(() => elements.shutterFlash.classList.remove('flashing'), 120);

  // Audio effect
  playShutterSound();

  // Tactile Haptic Vibration for iPhone / Mobile
  if (navigator.vibrate) {
    try { navigator.vibrate([40]); } catch (e) {}
  }

  const video = elements.camVideo;
  const canvas = elements.captureCanvas;
  const vWidth = video.videoWidth;
  const vHeight = video.videoHeight;

  canvas.width = vWidth;
  canvas.height = vHeight;
  const ctx = canvas.getContext('2d');

  // Draw natural video frame
  ctx.drawImage(video, 0, 0, vWidth, vHeight);

  // Apply Document Enhancement filter if selected
  const filter = elements.filterSelect.value;
  if (filter === 'grayscale' || filter === 'enhance') {
    applyCanvasFilter(ctx, vWidth, vHeight, filter);
  }

  const pageNum = state.startPage + state.capturedPages.length;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  const newPageItem = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    dataUrl: dataUrl,
    pageNum: pageNum,
    rotation: 0,
    width: vWidth,
    height: vHeight,
    timestamp: new Date().toLocaleTimeString('vi-VN')
  };

  state.capturedPages.push(newPageItem);

  // Update UI and add thumbnail to filmstrip
  appendThumbnailToFilmstrip(newPageItem);
  updateActivePageUI();

  showToast(`Đã chụp thành công: Trang ${pageNum}`, 'success');

  state.isCapturing = false;
}

// Thêm ảnh từ máy / thư viện ảnh điện thoại để convert sang PDF giữ nguyên ảnh
function handleImageFilesUpload(files) {
  if (!files || files.length === 0) return;
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('Vui lòng chọn các tệp hình ảnh hợp lệ (JPG, PNG, WebP...)', 'error');
    return;
  }

  showToast(`Đang tải và xử lý ${imageFiles.length} hình ảnh...`, 'success');

  let loadedCount = 0;
  // Sắp xếp tự nhiên theo tên file nếu chọn nhiều ảnh
  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  imageFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const pageNum = state.startPage + state.capturedPages.length;
        const newPageItem = {
          id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          dataUrl: dataUrl,
          pageNum: pageNum,
          rotation: 0,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          timestamp: new Date().toLocaleTimeString('vi-VN')
        };
        state.capturedPages.push(newPageItem);
        appendThumbnailToFilmstrip(newPageItem);
        updateActivePageUI();

        loadedCount++;
        if (loadedCount === imageFiles.length) {
          showToast(`Đã thêm thành công ${loadedCount} ảnh vào hồ sơ!`, 'success');
          if (elements.reviewModal.classList.contains('show')) {
            renderReviewModalGallery();
          }
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Canvas image filter processing (Enhance contrast & sharpen text)
function applyCanvasFilter(ctx, width, height, mode) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  if (mode === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      // Luminance formula
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Adaptive document contrast stretch
      const adjusted = gray > 140 ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }
  } else if (mode === 'enhance') {
    // High contrast for documents
    const contrast = 1.25; // 25% contrast boost
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128;
      data[i + 1] = factor * (data[i + 1] - 128) + 128;
      data[i + 2] = factor * (data[i + 2] - 128) + 128;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// B3: Append thumbnail to the live filmstrip
function appendThumbnailToFilmstrip(pageItem) {
  // Clear placeholder if first page
  const placeholder = elements.thumbnailFilmstrip.querySelector('.strip-empty-placeholder');
  if (placeholder) placeholder.remove();

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'thumb-item';
  thumbWrap.id = `thumb_${pageItem.id}`;
  thumbWrap.title = `Nhấp để phóng to Trang ${pageItem.pageNum}`;

  thumbWrap.innerHTML = `
    <span class="thumb-badge">Trang ${pageItem.pageNum}</span>
    <img src="${pageItem.dataUrl}" alt="Trang ${pageItem.pageNum}">
    <button type="button" class="thumb-delete-btn" title="Xóa trang này">&times;</button>
  `;

  // Click thumbnail to zoom
  thumbWrap.querySelector('img').addEventListener('click', () => {
    openZoomModal(pageItem.dataUrl, `Kiểm tra Trang ${pageItem.pageNum}`);
  });

  // Delete button
  thumbWrap.querySelector('.thumb-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deletePage(pageItem.id);
  });

  elements.thumbnailFilmstrip.appendChild(thumbWrap);
  // Auto scroll to latest thumbnail
  elements.thumbnailFilmstrip.scrollLeft = elements.thumbnailFilmstrip.scrollWidth;
}

function refreshFilmstrip() {
  elements.thumbnailFilmstrip.innerHTML = '';
  if (state.capturedPages.length === 0) {
    elements.thumbnailFilmstrip.innerHTML = `
      <div class="strip-empty-placeholder">
        Chưa có ảnh nào được chụp. Nhấn "CHỤP TRANG ${state.startPage}" hoặc phím Space để bắt đầu.
      </div>
    `;
    return;
  }
  state.capturedPages.forEach(p => appendThumbnailToFilmstrip(p));
}

// Delete page and renumber pages sequentially from startPage
function deletePage(id) {
  const idx = state.capturedPages.findIndex(p => p.id === id);
  if (idx !== -1) {
    state.capturedPages.splice(idx, 1);
    // Renumber pages chronologically based on startPage
    renumberPages();
    refreshFilmstrip();
    updateActivePageUI();
    if (elements.reviewModal.classList.contains('show')) {
      renderReviewModalGallery();
    }
    showToast('Đã xóa 1 trang', 'success');
  }
}

function renumberPages() {
  state.capturedPages.forEach((p, idx) => {
    p.pageNum = state.startPage + idx;
  });
}

function clearAllCapturedPages() {
  if (state.capturedPages.length === 0) return;
  if (confirm(`Bạn có chắc muốn xóa toàn bộ ${state.capturedPages.length} trang vừa chụp để chụp lại từ đầu không?`)) {
    state.capturedPages = [];
    refreshFilmstrip();
    updateActivePageUI();
    showToast('Đã xóa toàn bộ các trang chụp.', 'success');
  }
}

// ==========================================
// 4. REVIEW & CONFIRMATION MODAL (B4)
// ==========================================

function openReviewModal() {
  if (state.capturedPages.length === 0) {
    showToast('Vui lòng chụp ít nhất 1 trang trước khi xem lại!', 'error');
    return;
  }

  // Populate B4 summary info
  const startP = state.startPage;
  const endP = startP + state.capturedPages.length - 1;
  const total = state.capturedPages.length;

  elements.reviewDocTitle.textContent = state.documentTitle || 'HoSoTaiLieu';
  elements.reviewPageRange.textContent = `Từ trang ${startP} đến trang ${endP} (Tổng ${total} trang)`;
  elements.reviewFilename.textContent = computeFilename();
  elements.reviewFolderPath.textContent = state.folderPath || 'Thư mục mặc định';

  renderReviewModalGallery();

  elements.reviewModal.classList.add('show');
  elements.stepCard4.classList.add('active');
}

function closeReviewModal() {
  elements.reviewModal.classList.remove('show');
}

function renderReviewModalGallery() {
  const grid = elements.reviewGalleryGrid;
  grid.innerHTML = '';

  state.capturedPages.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.id = `review_card_${item.id}`;

    card.innerHTML = `
      <div class="review-card-img-wrap" title="Nhấp để phóng to kiểm tra nét chữ">
        <span class="review-card-page-badge">Trang ${item.pageNum}</span>
        <img src="${item.dataUrl}" alt="Trang ${item.pageNum}" style="transform: rotate(${item.rotation}deg);">
      </div>
      <div class="review-actions-bar">
        <button type="button" class="icon-btn btn-rotate" title="Xoay 90° theo chiều kim đồng hồ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        <button type="button" class="icon-btn btn-zoom" title="Phóng to kiểm tra">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button type="button" class="icon-btn btn-move-left" title="Di chuyển lên trước" ${index === 0 ? 'disabled' : ''}>
          ←
        </button>
        <button type="button" class="icon-btn btn-move-right" title="Di chuyển xuống sau" ${index === state.capturedPages.length - 1 ? 'disabled' : ''}>
          →
        </button>
        <button type="button" class="icon-btn icon-btn-danger btn-del" title="Xóa trang này">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    // Rotate 90 deg
    card.querySelector('.btn-rotate').addEventListener('click', () => {
      item.rotation = (item.rotation + 90) % 360;
      const img = card.querySelector('img');
      img.style.transform = `rotate(${item.rotation}deg)`;
    });

    // Zoom inspection
    const imgWrap = card.querySelector('.review-card-img-wrap');
    imgWrap.addEventListener('click', () => {
      openZoomModal(item.dataUrl, `Kiểm tra chi tiết: Trang ${item.pageNum}`);
    });
    card.querySelector('.btn-zoom').addEventListener('click', () => {
      openZoomModal(item.dataUrl, `Kiểm tra chi tiết: Trang ${item.pageNum}`);
    });

    // Move left/right
    card.querySelector('.btn-move-left').addEventListener('click', () => {
      if (index > 0) {
        const temp = state.capturedPages[index];
        state.capturedPages[index] = state.capturedPages[index - 1];
        state.capturedPages[index - 1] = temp;
        renumberPages();
        renderReviewModalGallery();
        refreshFilmstrip();
      }
    });

    card.querySelector('.btn-move-right').addEventListener('click', () => {
      if (index < state.capturedPages.length - 1) {
        const temp = state.capturedPages[index];
        state.capturedPages[index] = state.capturedPages[index + 1];
        state.capturedPages[index + 1] = temp;
        renumberPages();
        renderReviewModalGallery();
        refreshFilmstrip();
      }
    });

    // Delete
    card.querySelector('.btn-del').addEventListener('click', () => {
      deletePage(item.id);
    });

    grid.appendChild(card);
  });
}

// Zoom Modal
function openZoomModal(dataUrl, title) {
  elements.zoomImage.src = dataUrl;
  elements.zoomModalTitle.textContent = title || 'Chi tiết ảnh quét';
  elements.zoomModal.classList.add('show');
}

function closeZoomModal() {
  elements.zoomModal.classList.remove('show');
}

// ==========================================
// 5. GENERATE & EXPORT PDF (B5 & B6)
// ==========================================

async function generateAndExportPdf() {
  if (state.capturedPages.length === 0) {
    showToast('Chưa có trang nào để xuất PDF!', 'error');
    return;
  }

  // Ensure jspdf is available
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    showToast('Lỗi thư viện jsPDF chưa tải xong. Vui lòng thử lại!', 'error');
    return;
  }

  const btnConfirm = elements.btnConfirmSavePdf;
  btnConfirm.disabled = true;
  btnConfirm.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Đang tạo PDF (${state.capturedPages.length} trang)...
  `;

  try {
    const fileName = computeFilename();
    const pageSizeMode = (elements.pageSizeSelect && elements.pageSizeSelect.value) || 'original';
    let pdf = null;

    for (let i = 0; i < state.capturedPages.length; i++) {
      const pageItem = state.capturedPages[i];
      
      // Giữ nguyên hình ảnh & kích thước thực tế
      const processed = await getProcessedImage(pageItem.dataUrl, pageItem.rotation);
      const imgW = processed.width;
      const imgH = processed.height;

      if (pageSizeMode === 'original') {
        // GIỮ NGUYÊN HÌNH ẢNH 100%: Trang PDF khớp chuẩn xác pixel của ảnh gốc, không bị co giãn, không bị méo!
        const isLandscape = imgW > imgH;
        if (i === 0) {
          pdf = new jsPDF({
            orientation: isLandscape ? 'l' : 'p',
            unit: 'px',
            format: [imgW, imgH],
            hotfixes: ['px_scaling']
          });
        } else {
          pdf.addPage([imgW, imgH], isLandscape ? 'l' : 'p');
        }

        pdf.addImage(processed.dataUrl, 'JPEG', 0, 0, imgW, imgH, undefined, 'NONE');

        // Optional page number watermark at bottom
        if (elements.chkWatermarkPage.checked) {
          const fontSize = Math.max(14, Math.round(imgW * 0.022));
          pdf.setFontSize(fontSize);
          pdf.setTextColor(120, 120, 120);
          pdf.text(`Trang ${pageItem.pageNum}`, imgW - fontSize * 4.5, imgH - fontSize * 1.2);
        }
      } else {
        // Khổ A4 tiêu chuẩn: Căn vừa tỉ lệ (contain), tuyệt đối không méo hình!
        const a4W = 210;
        const a4H = 297;
        const isLandscape = imgW > imgH;
        const pageW = isLandscape ? a4H : a4W;
        const pageH = isLandscape ? a4W : a4H;

        if (i === 0) {
          pdf = new jsPDF({
            orientation: isLandscape ? 'l' : 'p',
            unit: 'mm',
            format: 'a4'
          });
        } else {
          pdf.addPage('a4', isLandscape ? 'l' : 'p');
        }

        const margin = 5;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const imgRatio = imgW / imgH;
        const pageRatio = maxW / maxH;

        let renderW, renderH;
        if (imgRatio > pageRatio) {
          renderW = maxW;
          renderH = maxW / imgRatio;
        } else {
          renderH = maxH;
          renderW = maxH * imgRatio;
        }

        const posX = margin + (maxW - renderW) / 2;
        const posY = margin + (maxH - renderH) / 2;

        pdf.addImage(processed.dataUrl, 'JPEG', posX, posY, renderW, renderH, undefined, 'NONE');

        if (elements.chkWatermarkPage.checked) {
          pdf.setFontSize(10);
          pdf.setTextColor(120, 120, 120);
          pdf.text(`Trang ${pageItem.pageNum}`, pageW - 25, pageH - 4);
        }
      }
    }

    // Get PDF Output Blob and Base64
    const pdfBlob = pdf.output('blob');
    state.lastGeneratedPdfBlob = pdfBlob;
    state.lastGeneratedFilename = fileName;

    // B6: Save directly to chosen directory
    let savedSuccessfully = false;
    let finalSaveLocation = state.folderPath || 'Thư mục tải về';

    // Strategy 1: Browser File System Access API
    if (state.directoryHandle) {
      try {
        const fileHandle = await state.directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        savedSuccessfully = true;
        finalSaveLocation = state.directoryHandle.name;
      } catch (fsErr) {
        console.warn('Native DirectoryHandle write failed, trying server fallback:', fsErr);
      }
    }

    // Strategy 2: Server API endpoint if running with Node.js local server
    if (!savedSuccessfully && state.serverAvailable) {
      try {
        const base64Data = await blobToBase64(pdfBlob);
        const res = await fetch('/api/save-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileName,
            folderPath: state.folderPath,
            pdfBase64: base64Data,
            totalPages: state.capturedPages.length,
            startPage: state.startPage,
            endPage: state.startPage + state.capturedPages.length - 1,
            documentTitle: state.documentTitle
          })
        });

        if (res.ok) {
          const data = await res.json();
          savedSuccessfully = true;
          finalSaveLocation = data.folderPath || state.folderPath;
        }
      } catch (srvErr) {
        console.warn('Server save failed, using direct download:', srvErr);
      }
    }

    // Strategy 3: Standard browser download fallback
    if (!savedSuccessfully) {
      downloadBlob(pdfBlob, fileName);
      finalSaveLocation = 'Thư mục Downloads của trình duyệt';
      savedSuccessfully = true;
    }

    // Record into scan history
    recordHistoryItem({
      fileName: fileName,
      folderPath: finalSaveLocation,
      documentTitle: state.documentTitle,
      startPage: state.startPage,
      endPage: state.startPage + state.capturedPages.length - 1,
      totalPages: state.capturedPages.length,
      fileSize: (pdfBlob.size / (1024 * 1024)).toFixed(2) + ' MB',
      timestamp: new Date().toLocaleString('vi-VN')
    });

    closeReviewModal();
    openSuccessModal(fileName, finalSaveLocation);

  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast('Lỗi xuất PDF: ' + err.message, 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Xác Nhận & Xuất File PDF
    `;
  }
}

// Giữ nguyên hình ảnh và kích thước tự nhiên của ảnh (hỗ trợ xoay nếu có)
function getProcessedImage(dataUrl, degrees) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isRotated = degrees !== 0 && degrees % 360 !== 0;
      if (!isRotated) {
        resolve({
          dataUrl: dataUrl,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
        return;
      }
      const c = document.createElement('canvas');
      const rad = (degrees * Math.PI) / 180;
      const is90or270 = degrees === 90 || degrees === 270;
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const w = is90or270 ? naturalH : naturalW;
      const h = is90or270 ? naturalW : naturalH;
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -naturalW / 2, -naturalH / 2);
      resolve({
        dataUrl: c.toDataURL('image/jpeg', 0.95),
        width: w,
        height: h
      });
    };
    img.src = dataUrl;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(',')[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ==========================================
// 6. SUCCESS MODAL & HISTORY MANAGEMENT
// ==========================================

function openSuccessModal(fileName, folderPath) {
  elements.successFilename.textContent = fileName;
  elements.successFolderPath.textContent = folderPath;
  const startP = state.startPage;
  const endP = startP + state.capturedPages.length - 1;
  elements.successPagesSummary.textContent = `${state.capturedPages.length} trang (Từ trang ${startP} đến trang ${endP})`;

  if (!state.serverAvailable) {
    if (elements.btnOpenExplorerFolder) {
      elements.btnOpenExplorerFolder.textContent = (navigator.share) ? 'Chia Sẻ / Lưu Tệp' : 'Tải Lại File PDF';
    }
  } else {
    if (elements.btnOpenExplorerFolder) {
      elements.btnOpenExplorerFolder.textContent = 'Mở Thư Mục Chứa File';
    }
  }

  elements.successModal.classList.add('show');
}

function closeSuccessModal() {
  elements.successModal.classList.remove('show');
}

function recordHistoryItem(item) {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('camScan_history') || '[]');
  } catch (e) {
    history = [];
  }
  history.unshift(item);
  history = history.slice(0, 30);
  localStorage.setItem('camScan_history', JSON.stringify(history));
  renderHistoryTable();
}

function renderHistoryTable() {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('camScan_history') || '[]');
  } catch (e) {
    history = [];
  }

  elements.historyCount.textContent = history.length;

  if (history.length === 0) {
    elements.historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 32px;">
          Chưa có lịch sử lưu hồ sơ nào. Hãy bắt đầu quét bộ hồ sơ đầu tiên!
        </td>
      </tr>
    `;
    return;
  }

  elements.historyTableBody.innerHTML = '';
  history.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size: 0.8rem; color: var(--text-muted);">${item.timestamp}</td>
      <td style="font-weight: 600; color: #fff;">${item.documentTitle}</td>
      <td><span class="badge-tag">Trang ${item.startPage} - ${item.endPage} (${item.totalPages} tr)</span></td>
      <td style="font-family: var(--font-mono); color: #38bdf8; font-size: 0.8125rem;">${item.fileName}</td>
      <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.folderPath}</td>
      <td>
        <span style="color: #10b981; font-size: 0.8rem; font-weight: 600;">✓ Đã lưu</span>
      </td>
    `;
    elements.historyTableBody.appendChild(tr);
  });
}

function clearAllHistory() {
  if (confirm('Bạn có chắc muốn xóa sạch toàn bộ lịch sử quét hồ sơ không?')) {
    localStorage.removeItem('camScan_history');
    if (state.serverAvailable) {
      fetch('/api/history/clear', { method: 'POST' }).catch(() => {});
    }
    renderHistoryTable();
    showToast('Đã xóa sạch lịch sử quét.', 'success');
  }
}

// Start Next Scan Session
function prepareNextScanSession() {
  closeSuccessModal();
  
  // Advance document title or keep folder & reset pages
  state.capturedPages = [];
  refreshFilmstrip();
  
  // Auto-increment page number for next document or reset to 1
  const nextStart = prompt('Nhập số trang bắt đầu cho bộ hồ sơ mới tiếp theo:', '1');
  if (nextStart) {
    state.startPage = parseInt(nextStart, 10) || 1;
    elements.startPageInput.value = state.startPage;
    localStorage.setItem('camScan_startPage', state.startPage);
  }

  updateActivePageUI();
  showToast('Đã chuẩn bị sẵn sàng cho bộ hồ sơ mới!', 'success');
}

// ==========================================
// 7. EVENT LISTENERS & SHORTCUTS (KEYBOARD)
// ==========================================

function setupEventListeners() {
  // Navigation tabs
  elements.navScanTab.addEventListener('click', () => {
    elements.navScanTab.classList.add('active');
    elements.navHistoryTab.classList.remove('active');
    elements.scanView.classList.remove('hidden');
    elements.historyView.classList.add('hidden');
  });

  elements.navHistoryTab.addEventListener('click', () => {
    elements.navHistoryTab.classList.add('active');
    elements.navScanTab.classList.remove('active');
    elements.historyView.classList.remove('hidden');
    elements.scanView.classList.add('hidden');
    renderHistoryTable();
  });

  elements.btnClearHistory.addEventListener('click', clearAllHistory);

  // B1: Folder picking & History select
  elements.btnPickFolder.addEventListener('click', pickFolder);
  elements.folderHistorySelect.addEventListener('change', (e) => {
    const chosen = e.target.value;
    if (chosen) {
      state.folderPath = chosen;
      elements.folderDisplayInput.value = chosen;
      localStorage.setItem('camScan_lastFolderPath', chosen);
      updateFolderBadge(true, `Đã chọn: ${chosen}`);
      showToast(`Đã chuyển sang thư mục: ${chosen}`, 'success');
    }
  });

  // B2: Document Title & Start Page inputs
  elements.documentTitleInput.addEventListener('input', (e) => {
    state.documentTitle = e.target.value.trim();
    localStorage.setItem('camScan_docTitle', state.documentTitle);
    updateFilenamePreview();
  });

  elements.startPageInput.addEventListener('input', (e) => {
    state.startPage = Math.max(1, parseInt(e.target.value, 10) || 1);
    localStorage.setItem('camScan_startPage', state.startPage);
    renumberPages();
    refreshFilmstrip();
    updateActivePageUI();
  });

  elements.btnIncStartPage.addEventListener('click', () => {
    state.startPage += 1;
    elements.startPageInput.value = state.startPage;
    localStorage.setItem('camScan_startPage', state.startPage);
    renumberPages();
    refreshFilmstrip();
    updateActivePageUI();
  });

  elements.btnDecStartPage.addEventListener('click', () => {
    if (state.startPage > 1) {
      state.startPage -= 1;
      elements.startPageInput.value = state.startPage;
      localStorage.setItem('camScan_startPage', state.startPage);
      renumberPages();
      refreshFilmstrip();
      updateActivePageUI();
    }
  });

  // Camera Settings
  elements.cameraSelect.addEventListener('change', (e) => {
    state.selectedDeviceId = e.target.value;
    startCameraStream();
  });

  elements.resolutionSelect.addEventListener('change', () => {
    startCameraStream();
  });

  if (elements.btnSwitchCam) {
    elements.btnSwitchCam.addEventListener('click', switchCamera);
  }

  elements.btnRestartCam.addEventListener('click', () => {
    startCameraStream();
    showToast('Đang làm mới kết nối camera...', 'success');
  });

  elements.btnToggleGuide.addEventListener('click', () => {
    elements.documentGuide.classList.toggle('hidden');
  });

  // B3: Capture Actions
  elements.btnCapture.addEventListener('click', captureCurrentPage);
  elements.btnClearAllSnaps.addEventListener('click', clearAllCapturedPages);

  // Chọn ảnh có sẵn từ máy / thư viện để convert sang PDF
  if (elements.btnUploadImages) {
    elements.btnUploadImages.addEventListener('click', () => {
      if (elements.fileImageInput) elements.fileImageInput.click();
    });
  }

  if (elements.btnReviewUploadMore) {
    elements.btnReviewUploadMore.addEventListener('click', () => {
      if (elements.fileImageInput) elements.fileImageInput.click();
    });
  }

  if (elements.fileImageInput) {
    elements.fileImageInput.addEventListener('change', (e) => {
      handleImageFilesUpload(e.target.files);
      e.target.value = '';
    });
  }

  // B4: Review & Confirm Actions
  elements.btnOpenReview.addEventListener('click', openReviewModal);
  elements.btnCloseReviewModal.addEventListener('click', closeReviewModal);
  elements.btnCancelReview.addEventListener('click', closeReviewModal);
  elements.btnReviewAddMore.addEventListener('click', closeReviewModal);

  // B5 & B6: Confirm & Save PDF
  elements.btnConfirmSavePdf.addEventListener('click', generateAndExportPdf);

  // Zoom Modal close
  elements.btnCloseZoomModal.addEventListener('click', closeZoomModal);
  elements.zoomModal.addEventListener('click', (e) => {
    if (e.target === elements.zoomModal) closeZoomModal();
  });

  // Success Modal Actions
  elements.btnOpenPdfTab.addEventListener('click', () => {
    if (state.lastGeneratedPdfBlob) {
      const url = URL.createObjectURL(state.lastGeneratedPdfBlob);
      window.open(url, '_blank');
    }
  });

  elements.btnOpenExplorerFolder.addEventListener('click', async () => {
    if (state.serverAvailable) {
      fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: state.folderPath })
      }).then(() => showToast('Đang mở thư mục trên Windows Explorer...', 'success'))
        .catch(() => showToast('Không thể mở Explorer từ xa', 'error'));
    } else {
      // Static mode (GitHub Pages, iPhone, Mobile): Web Share API or re-download
      if (state.lastGeneratedPdfBlob) {
        const fileName = state.lastGeneratedFilename || 'TaiLieuScan.pdf';
        const file = new File([state.lastGeneratedPdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: fileName,
              text: 'Tài liệu PDF vừa quét bằng Cam Scan to PDF'
            });
            return;
          } catch (e) {
            if (e.name !== 'AbortError') console.warn(e);
          }
        }
        downloadBlob(state.lastGeneratedPdfBlob, fileName);
        showToast(`Đã tải xuống file: ${fileName}`, 'success');
      }
    }
  });

  elements.btnStartNewScan.addEventListener('click', prepareNextScanSession);

  // Keyboard Shortcuts: Spacebar or Enter to Capture
  window.addEventListener('keydown', (e) => {
    // Only capture if not typing inside an input
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (!isTyping) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        // If review modal is open, don't snap
        if (!elements.reviewModal.classList.contains('show') && !elements.zoomModal.classList.contains('show')) {
          captureCurrentPage();
        }
      } else if (e.code === 'Escape') {
        closeZoomModal();
        closeReviewModal();
        closeSuccessModal();
      }
    }
  });
}

// Notification Toast
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', initApp);
