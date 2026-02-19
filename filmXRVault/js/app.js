/* ========================================
   XR FILMMAKING VAULT — Main Application
   ======================================== */

(function () {
  'use strict';

  // ---- State ----
  let database = [];
  let filteredData = [];
  let activeFilters = {};
  let searchQuery = '';
  let currentSort = 'year-desc';
  let currentView = 'grid';

  // ---- Filter Definitions (from codebook) ----
  const FILTER_DEFS = [
    {
      key: 'pipelineStages',
      label: 'Pipeline Stage',
      type: 'multi',
      values: ['Pre-production', 'Production', 'Post-production']
    },
    {
      key: 'useCases',
      label: 'Use Case',
      type: 'multi',
      values: [
        'Previsualization & Storyboarding',
        'Virtual Location Scouting/Set Design',
        'On-Set Visualization (Virtual Production)',
        'Immersive Storytelling (XR Content Creation)',
        'Remote Collaboration',
        'Training & Rehearsal',
        'Post-production Review'
      ]
    },
    {
      key: 'xrModality',
      label: 'XR Modality',
      type: 'multi',
      values: ['AR', 'VR', 'MR']
    },
    {
      key: 'platformHardware',
      label: 'Platform / Hardware',
      type: 'multi',
      values: [
        'VR HMD (Tethered)',
        'VR HMD (Standalone)',
        'AR/MR Headset',
        'Mobile Device (Handheld AR)',
        'Projection/Spatial Display',
        'Tracking System / Tracked Rig',
        'Other Peripherals'
      ]
    },
    {
      key: 'targetRoles',
      label: 'Target Role',
      type: 'multi',
      values: [
        'Director',
        'Cinematographer/DP',
        'Production Designer/Art Department',
        'VFX Supervisor/Artist',
        'Editor/Post-production',
        'Producer/Coordinator',
        'Actor/Performer',
        'Other Crew'
      ]
    },
    {
      key: 'evaluation',
      label: 'Evaluation Type',
      type: 'multi',
      values: [
        'User Study (Formal)',
        'Expert Review/Feedback',
        'Case Study (In-situ)',
        'Controlled Experiment (Quantitative Metrics)',
        'Qualitative Analysis',
        'No Formal Evaluation (Demo/Analysis)'
      ]
    },
    {
      key: 'maturity',
      label: 'Maturity Level',
      type: 'multi',
      values: ['Concept', 'Prototype', 'Deployed/Pilot', 'Commercial/Production-Ready']
    },
    {
      key: 'sourceType',
      label: 'Source Type',
      type: 'single',
      values: ['Conference', 'Journal', 'Book', 'Industry Report']
    },
    {
      key: 'openScience',
      label: 'Open Science',
      type: 'single',
      values: ['No (Closed)', 'Code Available (Open-Source)', 'Data Available', 'Code & Data Available']
    }
  ];

  // ---- DOM Elements ----
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Primary: load from the <script src="data/database.js"> global
    // Fallback: fetch JSON (works on web servers but not file://)
    if (window.XR_DATABASE) {
      onDataLoaded(window.XR_DATABASE);
    } else {
      fetch('data/database.json')
        .then(r => r.json())
        .then(data => onDataLoaded(data))
        .catch(err => {
          console.error('Failed to load database:', err);
          const gallery = $('#gallery-grid');
          if (gallery) gallery.innerHTML = '<div class="empty-state"><h3>Error Loading Database</h3><p>Could not load the entry database. Please check the data file.</p></div>';
        });
    }
  }

  function onDataLoaded(data) {
    database = data;
    filteredData = [...data];
    buildFilterPanel();
    renderGallery();
    updateStats();
    initSearch();
    initViewToggles();
    initSort();
    initMobileMenu();
    initFilterDrawer();
    initSimilarityViz();
    initTabs();
  }

  // ---- Filter Panel ----
  function buildFilterPanel() {
    const panel = $('#filter-sections');
    if (!panel) return;

    panel.innerHTML = '';

    FILTER_DEFS.forEach(def => {
      const section = document.createElement('div');
      section.className = 'filter-section';
      section.dataset.key = def.key;

      const counts = countFilterValues(def.key, def.values);

      section.innerHTML = `
        <div class="filter-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="filter-section-title">${def.label}</span>
          <span class="filter-toggle">▼</span>
        </div>
        <div class="filter-options">
          ${def.values.map(val => `
            <label class="filter-option">
              <input type="checkbox" data-key="${def.key}" value="${val}">
              <span class="filter-label">${val}</span>
              <span class="filter-count">${counts[val] || 0}</span>
            </label>
          `).join('')}
        </div>
      `;

      panel.appendChild(section);
    });

    // Bind checkbox events
    $$('#filter-sections input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', onFilterChange);
    });

    // Reset button
    const resetBtn = $('#filter-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
  }

  function countFilterValues(key, values) {
    const counts = {};
    values.forEach(v => { counts[v] = 0; });
    database.forEach(entry => {
      const val = entry[key];
      if (Array.isArray(val)) {
        val.forEach(v => { if (counts[v] !== undefined) counts[v]++; });
      } else if (typeof val === 'string') {
        if (counts[val] !== undefined) counts[val]++;
      }
    });
    return counts;
  }

  function onFilterChange(e) {
    const key = e.target.dataset.key;
    const value = e.target.value;
    const checked = e.target.checked;

    if (!activeFilters[key]) activeFilters[key] = [];

    if (checked) {
      if (!activeFilters[key].includes(value)) activeFilters[key].push(value);
    } else {
      activeFilters[key] = activeFilters[key].filter(v => v !== value);
      if (activeFilters[key].length === 0) delete activeFilters[key];
    }

    applyFilters();
    renderActiveFilterTags();
  }

  function resetFilters() {
    activeFilters = {};
    searchQuery = '';
    const searchInput = $('#search-input');
    if (searchInput) searchInput.value = '';
    $$('#filter-sections input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    applyFilters();
    renderActiveFilterTags();
    updateSearchClear();
  }

  function applyFilters() {
    filteredData = database.filter(entry => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          entry.title,
          entry.authors.join(' '),
          entry.source,
          entry.abstract,
          (entry.tags || []).join(' ')
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      // Attribute filters
      for (const [key, values] of Object.entries(activeFilters)) {
        if (values.length === 0) continue;
        const entryVal = entry[key];
        if (Array.isArray(entryVal)) {
          if (!values.some(v => entryVal.includes(v))) return false;
        } else {
          if (!values.includes(entryVal)) return false;
        }
      }

      return true;
    });

    sortData();
    renderGallery();
    updateResultsCount();
  }

  function renderActiveFilterTags() {
    const container = $('#active-filters');
    if (!container) return;
    container.innerHTML = '';

    for (const [key, values] of Object.entries(activeFilters)) {
      values.forEach(val => {
        const tag = document.createElement('span');
        tag.className = 'active-filter-tag';
        tag.innerHTML = `${val} <button onclick="window.XRVault.removeFilter('${key}','${val.replace(/'/g, "\\'")}')">&times;</button>`;
        container.appendChild(tag);
      });
    }
  }

  function removeFilter(key, value) {
    if (activeFilters[key]) {
      activeFilters[key] = activeFilters[key].filter(v => v !== value);
      if (activeFilters[key].length === 0) delete activeFilters[key];
    }

    // Uncheck corresponding checkbox
    const cb = $(`input[data-key="${key}"][value="${value}"]`);
    if (cb) cb.checked = false;

    applyFilters();
    renderActiveFilterTags();
  }

  // ---- Search ----
  function initSearch() {
    const input = $('#search-input');
    const clearBtn = $('#search-clear');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = input.value.trim();
        applyFilters();
        updateSearchClear();
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        searchQuery = '';
        applyFilters();
        updateSearchClear();
      });
    }
  }

  function updateSearchClear() {
    const clearBtn = $('#search-clear');
    if (clearBtn) {
      clearBtn.classList.toggle('visible', searchQuery.length > 0);
    }
  }

  // ---- Sorting ----
  function initSort() {
    const select = $('#sort-select');
    if (!select) {
      select && select.addEventListener('change', () => {
        currentSort = select.value;
        sortData();
        renderGallery();
      });
    }
    if (select) {
      select.addEventListener('change', () => {
        currentSort = select.value;
        sortData();
        renderGallery();
      });
    }
  }

  function sortData() {
    switch (currentSort) {
      case 'year-desc':
        filteredData.sort((a, b) => b.year - a.year);
        break;
      case 'year-asc':
        filteredData.sort((a, b) => a.year - b.year);
        break;
      case 'title-asc':
        filteredData.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        filteredData.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
  }

  // ---- View Toggles ----
  function initViewToggles() {
    $$('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view;
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = $('#gallery-grid');
        if (grid) {
          grid.classList.toggle('list-view', currentView === 'list');
        }
      });
    });
  }

  // ---- Gallery Rendering ----
  function renderGallery() {
    const grid = $('#gallery-grid');
    if (!grid) return;

    if (filteredData.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <h3>No entries found</h3>
          <p>Try adjusting your filters or search query.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filteredData.map((entry, i) => {
      const modalities = (entry.xrModality || []).slice(0, 3).map(m =>
        `<span class="tag tag-modality">${m}</span>`
      ).join('');

      const stages = (entry.pipelineStages || []).slice(0, 2).map(s =>
        `<span class="tag tag-pipeline">${s.replace('Pre-production', 'Pre').replace('Post-production', 'Post')}</span>`
      ).join('');

      const maturity = entry.maturity
        ? `<span class="tag tag-maturity">${entry.maturity.replace('Commercial/Production-Ready', 'Commercial')}</span>`
        : '';

      return `
        <div class="entry-card" data-id="${entry.id}" onclick="window.XRVault.openModal(${entry.id})" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
          <div class="card-year">${entry.year}</div>
          <div class="card-title">${entry.title}</div>
          <div class="card-authors">${entry.authors.join(', ')}</div>
          <div class="card-source">${entry.source}</div>
          <div class="card-tags">
            ${stages}${modalities}${maturity}
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Stats ----
  function updateStats() {
    const el = $('#stat-entries');
    if (el) el.textContent = database.length;

    const attrEl = $('#stat-attributes');
    if (attrEl) attrEl.textContent = FILTER_DEFS.length + 2; // +tags, +abstract

    const yearEl = $('#stat-years');
    if (yearEl) {
      const years = database.map(e => e.year);
      yearEl.textContent = `${Math.min(...years)}–${Math.max(...years)}`;
    }
  }

  function updateResultsCount() {
    const el = $('#results-count');
    if (el) {
      el.innerHTML = `Showing <strong>${filteredData.length}</strong> of <strong>${database.length}</strong> entries`;
    }
  }

  // ---- Detail Modal ----
  function openModal(id) {
    const entry = database.find(e => e.id === id);
    if (!entry) return;

    const overlay = $('#modal-overlay');
    const content = $('#modal-inner');
    if (!overlay || !content) return;

    const makeAttr = (label, values) => {
      if (!values || (Array.isArray(values) && values.length === 0)) return '';
      const arr = Array.isArray(values) ? values : [values];
      return `
        <div class="modal-attr-item">
          <div class="modal-attr-label">${label}</div>
          <div class="modal-attr-value">
            ${arr.map(v => `<span class="attr-badge">${v}</span>`).join('')}
          </div>
        </div>
      `;
    };

    content.innerHTML = `
      <button class="modal-close" onclick="window.XRVault.closeModal()">&times;</button>
      <div class="modal-header">
        <div class="modal-year">${entry.year} · ${entry.sourceType || ''}</div>
        <h2 class="modal-title">${entry.title}</h2>
        <div class="modal-authors">${entry.authors.join(', ')}</div>
        <div class="modal-source">${entry.source}${entry.doi ? ` · <a href="https://doi.org/${entry.doi}" target="_blank">DOI</a>` : ''}${entry.url ? ` · <a href="${entry.url}" target="_blank">Link</a>` : ''}</div>
      </div>
      <div class="modal-body">
        <div class="modal-section">
          <div class="modal-section-title">Abstract</div>
          <p class="modal-abstract">${entry.abstract || 'No abstract available.'}</p>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">Taxonomy Attributes</div>
          <div class="modal-attr-grid">
            ${makeAttr('Pipeline Stage(s)', entry.pipelineStages)}
            ${makeAttr('Use Case(s)', entry.useCases)}
            ${makeAttr('XR Modality', entry.xrModality)}
            ${makeAttr('Platform / Hardware', entry.platformHardware)}
            ${makeAttr('Core Interaction', entry.coreInteraction)}
            ${makeAttr('Data Formats', entry.dataFormats)}
            ${makeAttr('Target Role(s)', entry.targetRoles)}
            ${makeAttr('Evaluation', entry.evaluation)}
            ${makeAttr('Reported Outcomes', entry.reportedOutcomes)}
            ${makeAttr('Open Science', entry.openScience)}
            ${makeAttr('Maturity', entry.maturity)}
          </div>
        </div>
        ${entry.tags && entry.tags.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">Tags</div>
          <div class="modal-attr-value">
            ${entry.tags.map(t => `<span class="attr-badge highlight">${t}</span>`).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;

    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = $('#modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }

  // Close modal on overlay click
  document.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Close modal on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---- Mobile Menu ----
  function initMobileMenu() {
    const btn = $('#mobile-menu-btn');
    const nav = $('#site-nav');
    if (btn && nav) {
      btn.addEventListener('click', () => nav.classList.toggle('open'));
    }
  }

  // ---- Filter Drawer (mobile) ----
  function initFilterDrawer() {
    const toggleBtn = $('#filter-drawer-toggle');
    const panel = $('#filter-panel');
    const backdrop = $('#filter-backdrop');

    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('visible');
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (panel) panel.classList.remove('open');
        backdrop.classList.remove('visible');
      });
    }
  }

  // ---- Tabs (Gallery / Similarity) ----
  function initTabs() {
    $$('.section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        $$('.section-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        const content = $(`#tab-${target}`);
        if (content) content.classList.add('active');
      });
    });
  }

  // ---- Similarity Visualization ----
  function initSimilarityViz() {
    const canvas = $('#similarity-canvas');
    if (!canvas) return;

    const thresholdSlider = $('#sim-threshold');
    const colorSelect = $('#sim-color-by');
    const zoomInBtn = $('#sim-zoom-in');
    const zoomOutBtn = $('#sim-zoom-out');
    const zoomResetBtn = $('#sim-zoom-reset');

    // Zoom / pan state
    let viewBox = { x: 0, y: 0, w: 1000, h: 700 };
    const defaultViewBox = { x: 0, y: 0, w: 1000, h: 700 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let nodePositions = [];

    // Pre-compute positions once (reused across redraws)
    function computeLayout() {
      if (database.length === 0) return [];
      const n = database.length;
      const W = 1000;
      const H = 700;
      const padding = 60;

      // Initialize positions in a large circle
      const positions = database.map((_, i) => {
        const angle = (i / n) * Math.PI * 2;
        const radius = Math.min(W, H) * 0.35;
        return {
          x: W / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
          y: H / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40
        };
      });

      // Force-directed layout — higher repulsion to spread nodes
      const iterations = 150;
      const repulsion = 2500;
      const attraction = 0.005;

      for (let iter = 0; iter < iterations; iter++) {
        const forces = positions.map(() => ({ fx: 0, fy: 0 }));
        const cooling = 1 - (iter / iterations);

        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = positions[j].x - positions[i].x;
            const dy = positions[j].y - positions[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

            // Repulsion — all pairs push apart
            const repF = repulsion / (dist * dist);
            const ux = dx / dist;
            const uy = dy / dist;
            forces[i].fx -= ux * repF;
            forces[i].fy -= uy * repF;
            forces[j].fx += ux * repF;
            forces[j].fy += uy * repF;

            // Attraction — similar nodes pull together
            const sim = computeSimilarity(database[i], database[j]);
            if (sim > 0.25) {
              const idealDist = (1 - sim) * 300 + 40;
              const attF = attraction * (dist - idealDist);
              forces[i].fx += ux * attF;
              forces[i].fy += uy * attF;
              forces[j].fx -= ux * attF;
              forces[j].fy -= uy * attF;
            }
          }

          // Gravity toward center
          const cx = positions[i].x - W / 2;
          const cy = positions[i].y - H / 2;
          forces[i].fx -= cx * 0.0003;
          forces[i].fy -= cy * 0.0003;
        }

        // Apply forces with cooling
        const step = 0.6 * cooling;
        positions.forEach((pos, i) => {
          pos.x += Math.max(-20, Math.min(20, forces[i].fx * step));
          pos.y += Math.max(-20, Math.min(20, forces[i].fy * step));
          pos.x = Math.max(padding, Math.min(W - padding, pos.x));
          pos.y = Math.max(padding, Math.min(H - padding, pos.y));
        });
      }

      return positions;
    }

    nodePositions = computeLayout();

    function drawSimilarityGraph() {
      if (database.length === 0 || nodePositions.length === 0) return;

      const threshold = thresholdSlider ? parseFloat(thresholdSlider.value) : 0.45;
      const colorBy = colorSelect ? colorSelect.value : 'maturity';
      const W = 1000;
      const H = 700;

      // Color mapping
      const colorMap = {
        maturity: {
          'Concept': '#8892a4',
          'Prototype': '#00d4ff',
          'Deployed/Pilot': '#7b5cff',
          'Commercial/Production-Ready': '#ffaa2c'
        },
        xrModality: {
          'VR': '#00d4ff',
          'AR': '#ff3d71',
          'MR': '#7b5cff'
        },
        sourceType: {
          'Conference': '#00d4ff',
          'Journal': '#7b5cff',
          'Book': '#ffaa2c',
          'Industry Report': '#ff3d71'
        }
      };

      // Build SVG with viewBox for zoom/pan
      const vb = viewBox;
      let svg = `<svg width="100%" height="100%" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet" id="sim-svg">`;

      // Draw edges
      for (let i = 0; i < database.length; i++) {
        for (let j = i + 1; j < database.length; j++) {
          const sim = computeSimilarity(database[i], database[j]);
          if (sim >= threshold) {
            const opacity = 0.06 + sim * 0.18;
            svg += `<line x1="${nodePositions[i].x}" y1="${nodePositions[i].y}" x2="${nodePositions[j].x}" y2="${nodePositions[j].y}" stroke="rgba(0,212,255,${opacity})" stroke-width="${0.5 + sim * 1.5}"/>`;
          }
        }
      }

      // Draw nodes
      database.forEach((entry, i) => {
        const colors = colorMap[colorBy] || colorMap.maturity;
        let color = '#8892a4';

        if (colorBy === 'xrModality') {
          const mod = (entry.xrModality || [])[0];
          color = colors[mod] || '#8892a4';
        } else if (colorBy === 'maturity') {
          color = colors[entry.maturity] || '#8892a4';
        } else if (colorBy === 'sourceType') {
          color = colors[entry.sourceType] || '#8892a4';
        }

        const r = 10;
        svg += `<circle cx="${nodePositions[i].x}" cy="${nodePositions[i].y}" r="${r}" fill="${color}" fill-opacity="0.85" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" class="sim-node-svg" data-id="${entry.id}" data-idx="${i}" style="cursor:pointer"/>`;
      });

      svg += '</svg>';
      canvas.innerHTML = svg;

      // Bind node events
      $$('.sim-node-svg', canvas).forEach(node => {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal(parseInt(node.dataset.id));
        });
        node.addEventListener('mouseenter', (e) => {
          node.setAttribute('r', '15');
          node.setAttribute('stroke-width', '2.5');
          node.setAttribute('fill-opacity', '1');
          showSimTooltip(e, node.dataset.id);
        });
        node.addEventListener('mouseleave', () => {
          node.setAttribute('r', '10');
          node.setAttribute('stroke-width', '1.5');
          node.setAttribute('fill-opacity', '0.85');
          hideSimTooltip();
        });
      });

      // Bind pan on SVG
      const svgEl = $('#sim-svg');
      if (svgEl) {
        svgEl.addEventListener('mousedown', onPanStart);
        svgEl.addEventListener('mousemove', onPanMove);
        svgEl.addEventListener('mouseup', onPanEnd);
        svgEl.addEventListener('mouseleave', onPanEnd);
        svgEl.addEventListener('wheel', onZoomWheel, { passive: false });

        // Touch support
        svgEl.addEventListener('touchstart', onTouchStart, { passive: false });
        svgEl.addEventListener('touchmove', onTouchMove, { passive: false });
        svgEl.addEventListener('touchend', onPanEnd);
      }
    }

    // --- Tooltip ---
    function showSimTooltip(e, id) {
      const entry = database.find(d => d.id === parseInt(id));
      if (!entry) return;
      const tooltip = $('#sim-tooltip');
      if (!tooltip) return;
      tooltip.innerHTML = `<strong>${entry.title}</strong><br><span style="opacity:0.7">${entry.year} · ${entry.authors[0]}${entry.authors.length > 1 ? ' et al.' : ''}</span>`;
      tooltip.style.display = 'block';
      const wrapper = $('#sim-wrapper');
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.left = Math.min(e.clientX - rect.left + 14, rect.width - 260) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 12) + 'px';
    }

    function hideSimTooltip() {
      const tooltip = $('#sim-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }

    // --- Pan ---
    function onPanStart(e) {
      if (e.target.classList.contains('sim-node-svg')) return;
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    }

    function onPanMove(e) {
      if (!isPanning) return;
      const dx = (e.clientX - panStart.x) * (viewBox.w / canvas.clientWidth);
      const dy = (e.clientY - panStart.y) * (viewBox.h / canvas.clientHeight);
      viewBox.x -= dx;
      viewBox.y -= dy;
      panStart = { x: e.clientX, y: e.clientY };
      updateViewBox();
    }

    function onPanEnd() {
      isPanning = false;
      canvas.style.cursor = 'grab';
    }

    // --- Touch pan ---
    function onTouchStart(e) {
      if (e.touches.length === 1) {
        isPanning = true;
        panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }

    function onTouchMove(e) {
      if (!isPanning || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = (e.touches[0].clientX - panStart.x) * (viewBox.w / canvas.clientWidth);
      const dy = (e.touches[0].clientY - panStart.y) * (viewBox.h / canvas.clientHeight);
      viewBox.x -= dx;
      viewBox.y -= dy;
      panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      updateViewBox();
    }

    // --- Zoom ---
    function onZoomWheel(e) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      zoomAt(e.clientX, e.clientY, factor);
    }

    function zoomAt(clientX, clientY, factor) {
      const rect = canvas.getBoundingClientRect();
      const mx = ((clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
      const my = ((clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;

      const newW = Math.max(200, Math.min(3000, viewBox.w * factor));
      const newH = Math.max(140, Math.min(2100, viewBox.h * factor));

      viewBox.x = mx - (mx - viewBox.x) * (newW / viewBox.w);
      viewBox.y = my - (my - viewBox.y) * (newH / viewBox.h);
      viewBox.w = newW;
      viewBox.h = newH;
      updateViewBox();
    }

    function zoomBy(factor) {
      const rect = canvas.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    }

    function resetView() {
      viewBox = { ...defaultViewBox };
      updateViewBox();
    }

    function updateViewBox() {
      const svgEl = $('#sim-svg');
      if (svgEl) svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }

    // --- Button bindings ---
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomBy(0.75));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomBy(1.33));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetView);

    // Initial draw
    drawSimilarityGraph();

    // Redraw on controls change (keeps positions, just updates edges/colors)
    if (thresholdSlider) thresholdSlider.addEventListener('input', drawSimilarityGraph);
    if (colorSelect) colorSelect.addEventListener('change', drawSimilarityGraph);

    // Redraw on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawSimilarityGraph, 200);
    });
  }

  // Gower-style similarity for mixed attributes
  function computeSimilarity(a, b) {
    let totalWeight = 0;
    let totalSim = 0;

    // Multi-label Jaccard similarity for array fields
    const arrayFields = ['pipelineStages', 'useCases', 'xrModality', 'platformHardware', 'coreInteraction', 'dataFormats', 'targetRoles', 'evaluation', 'reportedOutcomes', 'tags'];

    arrayFields.forEach(field => {
      const setA = new Set(a[field] || []);
      const setB = new Set(b[field] || []);
      if (setA.size === 0 && setB.size === 0) return;

      const union = new Set([...setA, ...setB]);
      const intersection = [...setA].filter(x => setB.has(x));
      const jaccard = union.size > 0 ? intersection.length / union.size : 0;
      totalSim += jaccard;
      totalWeight += 1;
    });

    // Categorical similarity
    const catFields = ['maturity', 'openScience', 'sourceType'];
    catFields.forEach(field => {
      if (a[field] && b[field]) {
        totalSim += a[field] === b[field] ? 1 : 0;
        totalWeight += 1;
      }
    });

    // Year proximity (normalized)
    if (a.year && b.year) {
      const maxYearDiff = 12;
      const yearSim = 1 - Math.abs(a.year - b.year) / maxYearDiff;
      totalSim += Math.max(0, yearSim);
      totalWeight += 1;
    }

    return totalWeight > 0 ? totalSim / totalWeight : 0;
  }

  // ---- Public API ----
  window.XRVault = {
    openModal,
    closeModal,
    removeFilter
  };

})();
