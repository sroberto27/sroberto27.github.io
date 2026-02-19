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

  // ---- Similarity Visualization (Arc Diagram, Locomotion Vault style) ----
  function initSimilarityViz() {
    const canvas = $('#similarity-canvas');
    if (!canvas) return;

    const thresholdSlider = $('#sim-threshold');
    const colorSelect = $('#sim-color-by');
    const sortSelect = $('#sim-sort-by');
    const scrollContainer = $('#sim-arc-scroll');

    // Pre-compute all pairwise similarities once
    let simMatrix = [];

    function precomputeSimilarity() {
      const n = database.length;
      simMatrix = Array.from({ length: n }, () => new Float32Array(n));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const s = computeSimilarity(database[i], database[j]);
          simMatrix[i][j] = s;
          simMatrix[j][i] = s;
        }
      }
    }

    function getSortedIndices() {
      const sortBy = sortSelect ? sortSelect.value : 'year';
      const indices = database.map((_, i) => i);

      const maturityOrder = { 'Concept': 0, 'Prototype': 1, 'Deployed/Pilot': 2, 'Commercial/Production-Ready': 3 };
      const sourceOrder = { 'Conference': 0, 'Journal': 1, 'Book': 2, 'Industry Report': 3 };

      indices.sort((a, b) => {
        const ea = database[a], eb = database[b];
        switch (sortBy) {
          case 'year': return ea.year - eb.year || ea.title.localeCompare(eb.title);
          case 'maturity': return (maturityOrder[ea.maturity] || 0) - (maturityOrder[eb.maturity] || 0) || ea.year - eb.year;
          case 'sourceType': return (sourceOrder[ea.sourceType] || 0) - (sourceOrder[eb.sourceType] || 0) || ea.year - eb.year;
          case 'title': return ea.title.localeCompare(eb.title);
          default: return 0;
        }
      });
      return indices;
    }

    function drawArcDiagram() {
      if (database.length === 0) return;

      const threshold = thresholdSlider ? parseFloat(thresholdSlider.value) : 0.5;
      const colorBy = colorSelect ? colorSelect.value : 'maturity';
      const sorted = getSortedIndices();
      const n = sorted.length;

      // Layout constants
      const nodeSpacing = 32;
      const nodeRadius = 8;
      const labelHeight = 140;
      const arcAreaHeight = 350;
      const topPad = 20;
      const leftPad = 40;
      const totalWidth = leftPad * 2 + (n - 1) * nodeSpacing + 20;
      const nodeY = topPad + arcAreaHeight;
      const totalHeight = nodeY + 20 + labelHeight;

      // Color mapping
      const colorMap = {
        maturity: { 'Concept': '#8892a4', 'Prototype': '#00d4ff', 'Deployed/Pilot': '#7b5cff', 'Commercial/Production-Ready': '#ffaa2c' },
        xrModality: { 'VR': '#00d4ff', 'AR': '#ff3d71', 'MR': '#7b5cff' },
        sourceType: { 'Conference': '#00d4ff', 'Journal': '#7b5cff', 'Book': '#ffaa2c', 'Industry Report': '#ff3d71' }
      };

      function getColor(entry) {
        const colors = colorMap[colorBy] || colorMap.maturity;
        if (colorBy === 'xrModality') {
          return colors[(entry.xrModality || [])[0]] || '#8892a4';
        }
        return colors[entry[colorBy]] || '#8892a4';
      }

      // Node x positions
      const nodeX = sorted.map((_, i) => leftPad + i * nodeSpacing);

      // Position lookup: original DB index → horizontal position index
      const posOf = {};
      sorted.forEach((dbIdx, posIdx) => { posOf[dbIdx] = posIdx; });

      // Build SVG
      let svg = `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

      // --- Draw arcs ---
      // Collect edges above threshold
      const edges = [];
      for (let pi = 0; pi < n; pi++) {
        for (let pj = pi + 1; pj < n; pj++) {
          const di = sorted[pi];
          const dj = sorted[pj];
          const sim = simMatrix[di][dj];
          if (sim >= threshold) {
            edges.push({ pi, pj, sim });
          }
        }
      }

      // Sort edges so wider arcs draw first (behind)
      edges.sort((a, b) => (b.pj - b.pi) - (a.pj - a.pi));

      for (const edge of edges) {
        const x1 = nodeX[edge.pi];
        const x2 = nodeX[edge.pj];
        const span = Math.abs(x2 - x1);
        const midX = (x1 + x2) / 2;
        // Arc height proportional to span (matching Locomotion Vault look)
        const arcH = span * 0.5;
        const opacity = 0.15 + edge.sim * 0.35;

        svg += `<path d="M ${x1} ${nodeY} Q ${midX} ${nodeY - arcH} ${x2} ${nodeY}" fill="none" stroke="rgba(200,210,225,${opacity})" stroke-width="1"/>`;
      }

      // --- Draw nodes ---
      sorted.forEach((dbIdx, posIdx) => {
        const entry = database[dbIdx];
        const cx = nodeX[posIdx];
        const color = getColor(entry);

        svg += `<circle cx="${cx}" cy="${nodeY}" r="${nodeRadius}" fill="${color}" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" class="arc-node" data-id="${entry.id}" data-idx="${posIdx}" style="cursor:pointer"/>`;
      });

      // --- Draw labels ---
      sorted.forEach((dbIdx, posIdx) => {
        const entry = database[dbIdx];
        const cx = nodeX[posIdx];
        const labelY = nodeY + 14;

        // Truncate title
        let label = entry.title;
        if (label.length > 28) label = label.substring(0, 26) + '…';

        svg += `<text x="${cx}" y="${labelY}" transform="rotate(55, ${cx}, ${labelY})" font-size="9" font-family="'DM Sans', sans-serif" fill="var(--text-muted)" class="arc-label" data-id="${entry.id}" style="cursor:pointer">${escapeHtml(label)}</text>`;
      });

      svg += '</svg>';
      canvas.innerHTML = svg;

      // --- Bind events ---
      $$('.arc-node, .arc-label', canvas).forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal(parseInt(el.dataset.id));
        });
      });

      $$('.arc-node', canvas).forEach(node => {
        const posIdx = parseInt(node.dataset.idx);
        node.addEventListener('mouseenter', (e) => {
          node.setAttribute('r', String(nodeRadius + 4));
          node.setAttribute('stroke-width', '2.5');
          highlightConnections(posIdx, threshold, sorted, nodeX, nodeY);
          showSimTooltip(e, node.dataset.id);
        });
        node.addEventListener('mouseleave', () => {
          node.setAttribute('r', String(nodeRadius));
          node.setAttribute('stroke-width', '1.2');
          clearHighlights();
          hideSimTooltip();
        });
      });
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function highlightConnections(hoverPosIdx, threshold, sorted, nodeX, nodeY) {
      // Add highlight arcs for the hovered node
      const svgEl = canvas.querySelector('svg');
      if (!svgEl) return;

      // Remove old highlights
      clearHighlights();

      const hoverDbIdx = sorted[hoverPosIdx];

      sorted.forEach((dbIdx, posIdx) => {
        if (posIdx === hoverPosIdx) return;
        const sim = simMatrix[hoverDbIdx][dbIdx];
        if (sim < threshold) return;

        const x1 = nodeX[Math.min(hoverPosIdx, posIdx)];
        const x2 = nodeX[Math.max(hoverPosIdx, posIdx)];
        const span = Math.abs(x2 - x1);
        const midX = (x1 + x2) / 2;
        const arcH = span * 0.5;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${nodeY} Q ${midX} ${nodeY - arcH} ${x2} ${nodeY}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(0,212,255,0.7)');
        path.setAttribute('stroke-width', '2');
        path.classList.add('arc-highlight');
        svgEl.appendChild(path);
      });
    }

    function clearHighlights() {
      $$('.arc-highlight', canvas).forEach(el => el.remove());
    }

    function showSimTooltip(e, id) {
      const entry = database.find(d => d.id === parseInt(id));
      if (!entry) return;
      const tooltip = $('#sim-tooltip');
      if (!tooltip) return;
      tooltip.innerHTML = `<strong>${entry.title}</strong><br><span style="opacity:0.7">${entry.year} · ${entry.authors[0]}${entry.authors.length > 1 ? ' et al.' : ''}<br>${entry.maturity} · ${(entry.xrModality || []).join(', ')}</span>`;
      tooltip.style.display = 'block';
      const wrapper = $('#sim-wrapper');
      const rect = wrapper.getBoundingClientRect();
      const x = Math.min(e.clientX - rect.left + 14, rect.width - 270);
      const y = Math.max(e.clientY - rect.top - 60, 10);
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }

    function hideSimTooltip() {
      const tooltip = $('#sim-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }

    // --- Horizontal drag-scroll ---
    if (scrollContainer) {
      let isDown = false;
      let startX, scrollLeft;

      scrollContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('arc-node') || e.target.classList.contains('arc-label')) return;
        isDown = true;
        startX = e.pageX - scrollContainer.offsetLeft;
        scrollLeft = scrollContainer.scrollLeft;
      });
      scrollContainer.addEventListener('mouseleave', () => { isDown = false; });
      scrollContainer.addEventListener('mouseup', () => { isDown = false; });
      scrollContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollContainer.offsetLeft;
        scrollContainer.scrollLeft = scrollLeft - (x - startX);
      });
    }

    // --- Init ---
    precomputeSimilarity();
    drawArcDiagram();

    // Redraw on controls change
    if (thresholdSlider) thresholdSlider.addEventListener('input', drawArcDiagram);
    if (colorSelect) colorSelect.addEventListener('change', drawArcDiagram);
    if (sortSelect) sortSelect.addEventListener('change', drawArcDiagram);

    // Redraw on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawArcDiagram, 250);
    });
  }

  // Gower-style similarity for mixed attributes
  function computeSimilarity(a, b) {
    let totalWeight = 0;
    let totalSim = 0;

    const arrayFields = ['pipelineStages', 'useCases', 'xrModality', 'platformHardware', 'coreInteraction', 'dataFormats', 'targetRoles', 'evaluation', 'reportedOutcomes', 'tags'];

    arrayFields.forEach(field => {
      const setA = new Set(a[field] || []);
      const setB = new Set(b[field] || []);
      if (setA.size === 0 && setB.size === 0) return;
      const union = new Set([...setA, ...setB]);
      const intersection = [...setA].filter(x => setB.has(x));
      totalSim += union.size > 0 ? intersection.length / union.size : 0;
      totalWeight += 1;
    });

    const catFields = ['maturity', 'openScience', 'sourceType'];
    catFields.forEach(field => {
      if (a[field] && b[field]) {
        totalSim += a[field] === b[field] ? 1 : 0;
        totalWeight += 1;
      }
    });

    if (a.year && b.year) {
      totalSim += Math.max(0, 1 - Math.abs(a.year - b.year) / 12);
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
