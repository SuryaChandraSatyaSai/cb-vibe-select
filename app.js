/**
 * CB VibeSelect — Main Application Controller
 * Manages views, file intake, analysis orchestration, results, and export
 */

import { analyzeImage, findDuplicates } from './analyzer.js';
import {
    isImageFile, formatFileSize, formatDuration, createThumbnail,
    loadImage, getImageDataURL, downloadAsZip, showToast, getScoreClass, getScoreLabel, sleep
} from './utils.js';

// =========================================
// Application State
// =========================================

const state = {
    files: [],           // Original File objects
    results: [],         // Analysis results per image
    selectedIds: new Set(),
    currentTab: 'best',
    currentLightboxIndex: -1,
    analysisStartTime: 0,
    duplicateCount: 0
};

// Make functions accessible from inline HTML onclick handlers
window.scrollToUpload = scrollToUpload;
window.startAnalysis = startAnalysis;
window.resetApp = resetApp;
window.switchTab = switchTab;
window.sortResults = sortResults;
window.toggleSelectAll = toggleSelectAll;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.selectExportOption = selectExportOption;
window.executeExport = executeExport;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.navigateLightbox = navigateLightbox;
window.toggleLightboxSelect = toggleLightboxSelect;
window.toggleCardSelect = toggleCardSelect;


// =========================================
// Initialization
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    initDropzone();
    initFileInputs();
    initNavbar();
    initKeyboard();
});


// =========================================
// Navbar
// =========================================

function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
    });

    // Mobile toggle
    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');
    if (toggle) {
        toggle.addEventListener('click', () => {
            links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
        });
    }
}


// =========================================
// Dropzone & File Intake
// =========================================

function initDropzone() {
    const dropzone = document.getElementById('dropzone');

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleDrop(e);
    });

    // Click on dropzone opens file picker
    dropzone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
            document.getElementById('file-input').click();
        }
    });
}

function initFileInputs() {
    document.getElementById('file-input').addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
    });
    document.getElementById('folder-input').addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
    });
}

async function handleDrop(e) {
    const items = e.dataTransfer.items;
    const files = [];

    if (items) {
        const entries = [];
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
            if (entry) entries.push(entry);
        }

        for (const entry of entries) {
            const entryFiles = await readEntry(entry);
            files.push(...entryFiles);
        }
    } else {
        files.push(...Array.from(e.dataTransfer.files));
    }

    handleFiles(files);
}

function readEntry(entry) {
    return new Promise((resolve) => {
        if (entry.isFile) {
            entry.file((file) => resolve([file]));
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const allFiles = [];

            function readBatch() {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(allFiles);
                        return;
                    }
                    for (const e of entries) {
                        const files = await readEntry(e);
                        allFiles.push(...files);
                    }
                    readBatch(); // Continue reading (batched)
                });
            }
            readBatch();
        } else {
            resolve([]);
        }
    });
}

function handleFiles(files) {
    // Filter to images only
    const imageFiles = files.filter(isImageFile);

    if (imageFiles.length === 0) {
        showToast('No supported image files found. Please upload JPG, PNG, or WebP files.', 'warning');
        return;
    }

    state.files = imageFiles;

    // Update stats
    document.getElementById('stat-total').textContent = imageFiles.length;
    const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('stat-size').textContent = formatFileSize(totalSize);
    const estSeconds = Math.round(imageFiles.length * 0.3);
    document.getElementById('stat-time').textContent = formatDuration(estSeconds);

    // Show start button
    document.getElementById('start-analysis-btn').style.display = 'inline-flex';

    showToast(`${imageFiles.length} images loaded (${formatFileSize(totalSize)})`, 'success');
}


// =========================================
// Navigation helper
// =========================================

function scrollToUpload() {
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
}


// =========================================
// Analysis Pipeline
// =========================================

async function startAnalysis() {
    if (state.files.length === 0) return;

    // Switch to processing view
    document.getElementById('landing-view').style.display = 'none';
    document.getElementById('processing-view').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    state.results = [];
    state.analysisStartTime = Date.now();

    const total = state.files.length;
    let processed = 0;
    let bestCount = 0, acceptableCount = 0, rejectedCount = 0;

    // Update stage
    setStage(1);
    updateProgress('Scanning images...', 0, total);

    // Small delay for UX
    await sleep(500);
    setStage(2);

    const thumbContainer = document.getElementById('processing-thumbnails');
    thumbContainer.innerHTML = '';

    // Process images in batches to avoid freezing the UI
    const BATCH_SIZE = 5;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = state.files.slice(i, Math.min(i + BATCH_SIZE, total));
        const batchPromises = batch.map(async (file, batchIdx) => {
            const globalIdx = i + batchIdx;

            try {
                // Create thumbnail for UI
                const thumbUrl = await createThumbnail(file, 120);

                // Add thumb to processing view
                const thumbEl = document.createElement('div');
                thumbEl.className = 'processing-thumb analyzing';
                thumbEl.id = `proc-thumb-${globalIdx}`;
                thumbEl.innerHTML = `
          <img src="${thumbUrl}" alt="${file.name}">
          <div class="thumb-overlay">
            <span class="thumb-overlay-icon">⟳</span>
          </div>
        `;
                thumbContainer.appendChild(thumbEl);

                // Load full image and analyze
                const img = await loadImage(file);
                const analysis = analyzeImage(img);

                // Store result
                const result = {
                    id: globalIdx,
                    file: file,
                    name: file.name,
                    size: file.size,
                    thumbUrl: thumbUrl,
                    ...analysis
                };

                state.results[globalIdx] = result;

                // Update thumbnail state
                const el = document.getElementById(`proc-thumb-${globalIdx}`);
                if (el) {
                    el.classList.remove('analyzing');
                    el.classList.add('done', analysis.classification === 'best' ? 'best' : 'rejected');
                    el.querySelector('.thumb-overlay-icon').textContent =
                        analysis.classification === 'best' ? '✓' :
                            analysis.classification === 'acceptable' ? '~' : '✕';
                }

                // Count
                if (analysis.classification === 'best') bestCount++;
                else if (analysis.classification === 'acceptable') {
                    acceptableCount++;
                    bestCount++; // acceptable also goes to "best" tab
                }
                else rejectedCount++;

            } catch (err) {
                console.warn(`Failed to analyze ${file.name}:`, err);
                state.results[globalIdx] = {
                    id: globalIdx, file, name: file.name, size: file.size,
                    overallScore: 0, classification: 'rejected',
                    metrics: {}, tags: ['error'], pHash: '', thumbUrl: ''
                };
                rejectedCount++;
            }
        });

        await Promise.all(batchPromises);
        processed = Math.min(i + BATCH_SIZE, total);

        // Update progress UI
        updateProgress('Analyzing quality metrics...', processed, total);
        document.getElementById('live-best').textContent = bestCount;
        document.getElementById('live-acceptable').textContent = acceptableCount;
        document.getElementById('live-rejected').textContent = rejectedCount;
    }

    // Stage 3: Find duplicates
    setStage(3);
    updateProgress('Detecting duplicates...', total, total);
    await sleep(300);

    const validResults = state.results.filter(r => r && r.pHash);
    const duplicates = findDuplicates(validResults);

    // Mark duplicates
    let dupeCount = 0;
    duplicates.forEach((dupes, masterIdx) => {
        dupes.forEach(dupeIdx => {
            const result = validResults[dupeIdx];
            if (result) {
                result.tags.push('dupe');
                result.isDuplicate = true;
                dupeCount++;
            }
        });
    });

    state.duplicateCount = dupeCount;
    document.getElementById('live-duplicates').textContent = dupeCount;

    // Stage 4: Done
    setStage(4);
    updateProgress('Analysis complete!', total, total);

    const elapsed = (Date.now() - state.analysisStartTime) / 1000;
    showToast(`Analysis complete! ${total} images processed in ${formatDuration(elapsed)}`, 'success');

    await sleep(1000);

    // Auto-select best shots
    state.results.forEach(r => {
        if (r && (r.classification === 'best' || r.classification === 'acceptable') && !r.isDuplicate) {
            state.selectedIds.add(r.id);
        }
    });

    showResults();
}

function setStage(activeStage) {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`stage-${i}`);
        el.classList.remove('active', 'done');
        if (i < activeStage) el.classList.add('done');
        else if (i === activeStage) el.classList.add('active');
    }
}

function updateProgress(label, current, total) {
    document.getElementById('progress-label').textContent = label;
    document.getElementById('progress-count').textContent = `${current} / ${total}`;
    const pct = total > 0 ? (current / total) * 100 : 0;
    document.getElementById('progress-bar').style.width = pct + '%';
}


// =========================================
// Results View
// =========================================

function showResults() {
    document.getElementById('processing-view').classList.remove('active');
    document.getElementById('results-view').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update tab counts
    const best = state.results.filter(r => r && (r.classification === 'best' || r.classification === 'acceptable') && !r.isDuplicate);
    const rejected = state.results.filter(r => r && r.classification === 'rejected' && !r.isDuplicate);
    const duplicates = state.results.filter(r => r && r.isDuplicate);

    document.getElementById('tab-count-best').textContent = best.length;
    document.getElementById('tab-count-rejected').textContent = rejected.length;
    document.getElementById('tab-count-duplicates').textContent = duplicates.length;

    renderPhotoGrid();
}

function getFilteredResults() {
    return state.results.filter(r => {
        if (!r) return false;
        switch (state.currentTab) {
            case 'best':
                return (r.classification === 'best' || r.classification === 'acceptable') && !r.isDuplicate;
            case 'rejected':
                return r.classification === 'rejected' && !r.isDuplicate;
            case 'duplicates':
                return r.isDuplicate;
            default:
                return true;
        }
    });
}

function renderPhotoGrid() {
    const grid = document.getElementById('photo-grid');
    grid.innerHTML = '';

    const filtered = getFilteredResults();

    if (filtered.length === 0) {
        grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 64px 24px; color: #9ca3af;">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <p style="font-size: 16px;">No images in this category</p>
      </div>
    `;
        return;
    }

    filtered.forEach(result => {
        const scoreClass = getScoreClass(result.overallScore);
        const isSelected = state.selectedIds.has(result.id);

        const card = document.createElement('div');
        card.className = `photo-card${isSelected ? ' selected' : ''}`;
        card.id = `photo-card-${result.id}`;
        card.onclick = (e) => {
            if (!e.target.closest('.photo-card-select')) {
                openLightbox(result.id);
            }
        };

        const tagsHtml = (result.tags || []).map(tag =>
            `<span class="photo-tag ${tag}">${tag}</span>`
        ).join('');

        card.innerHTML = `
      <div class="photo-card-image">
        <img src="${result.thumbUrl}" alt="${result.name}" loading="lazy">
        <div class="photo-card-select" onclick="event.stopPropagation(); toggleCardSelect(${result.id})">
          ${isSelected ? '✓' : ''}
        </div>
        <div class="photo-card-score ${scoreClass}">${result.overallScore}</div>
      </div>
      <div class="photo-card-info">
        <div class="photo-card-name" title="${result.name}">${result.name}</div>
        <div class="photo-card-meta">
          <span class="photo-card-size">${formatFileSize(result.size)}</span>
          <div class="photo-card-tags">${tagsHtml}</div>
        </div>
      </div>
    `;

        grid.appendChild(card);
    });
}

function switchTab(tab) {
    state.currentTab = tab;

    document.querySelectorAll('.results-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    renderPhotoGrid();
}

function sortResults(value) {
    const [key, dir] = value.split('-');

    state.results.sort((a, b) => {
        if (!a || !b) return 0;
        let va, vb;
        switch (key) {
            case 'score': va = a.overallScore; vb = b.overallScore; break;
            case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
            case 'size': va = a.size; vb = b.size; break;
            default: return 0;
        }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    renderPhotoGrid();
}


// =========================================
// Selection
// =========================================

function toggleCardSelect(id) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
    } else {
        state.selectedIds.add(id);
    }

    const card = document.getElementById(`photo-card-${id}`);
    if (card) {
        card.classList.toggle('selected', state.selectedIds.has(id));
        const selectDiv = card.querySelector('.photo-card-select');
        if (selectDiv) selectDiv.textContent = state.selectedIds.has(id) ? '✓' : '';
    }
}

function toggleSelectAll(checked) {
    const filtered = getFilteredResults();
    filtered.forEach(r => {
        if (checked) state.selectedIds.add(r.id);
        else state.selectedIds.delete(r.id);
    });
    renderPhotoGrid();
}


// =========================================
// Lightbox
// =========================================

function openLightbox(id) {
    const filtered = getFilteredResults();
    const idx = filtered.findIndex(r => r.id === id);
    if (idx === -1) return;

    state.currentLightboxIndex = idx;
    showLightboxImage(filtered[idx]);
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
}

function navigateLightbox(delta) {
    const filtered = getFilteredResults();
    let newIdx = state.currentLightboxIndex + delta;
    if (newIdx < 0) newIdx = filtered.length - 1;
    if (newIdx >= filtered.length) newIdx = 0;
    state.currentLightboxIndex = newIdx;
    showLightboxImage(filtered[newIdx]);
}

async function showLightboxImage(result) {
    // Load full-size image
    const dataUrl = await getImageDataURL(result.file);
    document.getElementById('lightbox-image').src = dataUrl;
    document.getElementById('lightbox-title').textContent = result.name;

    const scoreCircle = document.getElementById('lightbox-score-circle');
    scoreCircle.textContent = result.overallScore;
    scoreCircle.className = `lightbox-score-circle ${getScoreClass(result.overallScore)}`;
    document.getElementById('lightbox-score-label').textContent = getScoreLabel(result.overallScore);

    // Build analysis details
    const details = document.getElementById('lightbox-details');
    details.innerHTML = '';

    if (result.metrics) {
        const metricKeys = ['sharpness', 'brightness', 'contrast', 'colorfulness', 'composition', 'noise'];
        const icons = { sharpness: '🔍', brightness: '☀️', contrast: '◐', colorfulness: '🎨', composition: '📐', noise: '📊' };
        const colors = {
            sharpness: '#2563EB', brightness: '#f97316', contrast: '#8b5cf6',
            colorfulness: '#ec4899', composition: '#22c55e', noise: '#06b6d4'
        };

        metricKeys.forEach(key => {
            const metric = result.metrics[key];
            if (!metric) return;

            const item = document.createElement('div');
            item.className = 'analysis-item';
            item.innerHTML = `
        <span class="analysis-item-label">${icons[key] || '•'} ${metric.label || key}</span>
        <div class="analysis-item-bar">
          <div class="analysis-item-bar-fill" style="width: ${metric.score}%; background: ${colors[key] || '#2563EB'};"></div>
        </div>
        <span class="analysis-item-value" style="color: ${colors[key] || '#2563EB'}">${metric.score}</span>
      `;
            details.appendChild(item);
        });
    }

    // Dimensions
    if (result.dimensions) {
        const dimItem = document.createElement('div');
        dimItem.className = 'analysis-item';
        dimItem.innerHTML = `
      <span class="analysis-item-label">📏 Dimensions</span>
      <span class="analysis-item-value" style="color: var(--gray-600); margin-left: auto;">${result.dimensions.width} × ${result.dimensions.height}</span>
    `;
        details.appendChild(dimItem);
    }

    // File size
    const sizeItem = document.createElement('div');
    sizeItem.className = 'analysis-item';
    sizeItem.innerHTML = `
    <span class="analysis-item-label">💾 File Size</span>
    <span class="analysis-item-value" style="color: var(--gray-600); margin-left: auto;">${formatFileSize(result.size)}</span>
  `;
    details.appendChild(sizeItem);

    // Update select button
    const selectBtn = document.getElementById('lightbox-select-btn');
    const isSelected = state.selectedIds.has(result.id);
    selectBtn.textContent = isSelected ? '✓ Selected' : '✓ Select This Photo';
    selectBtn.style.background = isSelected ? '#22c55e' : '';
}

function toggleLightboxSelect() {
    const filtered = getFilteredResults();
    const result = filtered[state.currentLightboxIndex];
    if (!result) return;

    toggleCardSelect(result.id);

    const selectBtn = document.getElementById('lightbox-select-btn');
    const isSelected = state.selectedIds.has(result.id);
    selectBtn.textContent = isSelected ? '✓ Selected' : '✓ Select This Photo';
    selectBtn.style.background = isSelected ? '#22c55e' : '';
}


// =========================================
// Export
// =========================================

function openExportModal() {
    const count = state.selectedIds.size;
    if (count === 0) {
        showToast('No images selected. Please select images to export.', 'warning');
        return;
    }
    document.getElementById('export-count').textContent = `${count} photo${count !== 1 ? 's' : ''} selected`;
    document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('active');
}

function selectExportOption(element) {
    document.querySelectorAll('.export-option').forEach(o => o.classList.remove('selected'));
    element.classList.add('selected');
}

async function executeExport() {
    const format = document.querySelector('.export-option.selected')?.dataset.format || 'zip';
    const selectedResults = state.results.filter(r => r && state.selectedIds.has(r.id));

    if (selectedResults.length === 0) {
        showToast('No images selected.', 'warning');
        return;
    }

    closeExportModal();
    showToast(`Preparing ${selectedResults.length} images for download...`, 'info');

    if (format === 'zip') {
        try {
            await downloadAsZip(
                selectedResults.map(r => ({ file: r.file, name: r.name })),
                'CB_VibeSelect_BestShots'
            );
            showToast('ZIP download started! Check your downloads folder.', 'success');
        } catch (err) {
            showToast('Failed to create ZIP: ' + err.message, 'error');
        }
    } else {
        // Download individually
        for (const r of selectedResults) {
            const url = URL.createObjectURL(r.file);
            const a = document.createElement('a');
            a.href = url;
            a.download = r.name;
            a.click();
            URL.revokeObjectURL(url);
            await sleep(200); // Stagger downloads to avoid browser blocking
        }
        showToast('Individual downloads started!', 'success');
    }
}


// =========================================
// Reset
// =========================================

function resetApp() {
    state.files = [];
    state.results = [];
    state.selectedIds.clear();
    state.currentTab = 'best';
    state.currentLightboxIndex = -1;
    state.duplicateCount = 0;

    // Hide results & processing, show landing
    document.getElementById('results-view').classList.remove('active');
    document.getElementById('processing-view').classList.remove('active');
    document.getElementById('landing-view').style.display = '';

    // Reset stats
    document.getElementById('stat-total').textContent = '0';
    document.getElementById('stat-size').textContent = '0 MB';
    document.getElementById('stat-time').textContent = '—';
    document.getElementById('start-analysis-btn').style.display = 'none';

    // Reset progress
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('processing-thumbnails').innerHTML = '';

    // Reset file inputs
    document.getElementById('file-input').value = '';
    document.getElementById('folder-input').value = '';

    // Reset tabs
    document.querySelectorAll('.results-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="best"]')?.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Ready for a new upload!', 'info');
}


// =========================================
// Keyboard Shortcuts
// =========================================

function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        // Lightbox navigation
        if (document.getElementById('lightbox').classList.contains('active')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
            if (e.key === ' ') { e.preventDefault(); toggleLightboxSelect(); }
        }

        // Export modal
        if (document.getElementById('export-modal').classList.contains('active')) {
            if (e.key === 'Escape') closeExportModal();
        }
    });
}
