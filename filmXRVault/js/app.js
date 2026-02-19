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
    fetch('data/database.json')
      .then(r => r.json())
      .then(data => {
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
      })
      .catch(err => {
        console.error('Failed to load database:', err);
        const gallery = $('#gallery-grid');
        if (gallery) gallery.innerHTML = '<div class="empty-state"><h3>Error Loading Database</h3><p>Could not load the entry database. Please check the data file.</p></div>';
      });
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

    function drawSimilarityGraph() {
      if (database.length === 0) return;

      const threshold = thresholdSlider ? parseFloat(thresholdSlider.value) : 0.5;
      const colorBy = colorSelect ? colorSelect.value : 'maturity';
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Compute positions using simple force-directed layout substitute (MDS-like)
      const positions = computePositions(database, width, height);

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

      // Build SVG
      let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

      // Draw edges
      for (let i = 0; i < database.length; i++) {
        for (let j = i + 1; j < database.length; j++) {
          const sim = computeSimilarity(database[i], database[j]);
          if (sim >= threshold) {
            svg += `<line x1="${positions[i].x}" y1="${positions[i].y}" x2="${positions[j].x}" y2="${positions[j].y}" stroke="rgba(0,212,255,${sim * 0.15})" stroke-width="1"/>`;
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

        const r = 6;
        svg += `<circle cx="${positions[i].x}" cy="${positions[i].y}" r="${r}" fill="${color}" stroke="rgba(255,255,255,0.15)" stroke-width="1" class="sim-node-svg" data-id="${entry.id}" style="cursor:pointer">
          <title>${entry.title} (${entry.year})</title>
        </circle>`;
      });

      svg += '</svg>';
      canvas.innerHTML = svg;

      // Node click events
      $$('.sim-node-svg', canvas).forEach(node => {
        node.addEventListener('click', () => {
          const id = parseInt(node.dataset.id);
          openModal(id);
        });
        node.addEventListener('mouseenter', (e) => {
          node.setAttribute('r', '10');
          node.setAttribute('stroke-width', '2');
          showSimTooltip(e, node.dataset.id);
        });
        node.addEventListener('mouseleave', () => {
          node.setAttribute('r', '6');
          node.setAttribute('stroke-width', '1');
          hideSimTooltip();
        });
      });
    }

    function showSimTooltip(e, id) {
      const entry = database.find(d => d.id === parseInt(id));
      if (!entry) return;
      let tooltip = $('#sim-tooltip');
      if (!tooltip) return;
      tooltip.innerHTML = `<strong>${entry.title}</strong><br>${entry.year} · ${entry.authors[0]}${entry.authors.length > 1 ? ' et al.' : ''}`;
      tooltip.style.display = 'block';
      const rect = canvas.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    }

    function hideSimTooltip() {
      const tooltip = $('#sim-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }

    // Compute 2D positions (simplified MDS using similarity as spring lengths)
    function computePositions(data, w, h) {
      const n = data.length;
      const padding = 50;
      const usableW = w - 2 * padding;
      const usableH = h - 2 * padding;

      // Initialize positions in a spiral
      const positions = data.map((_, i) => {
        const angle = (i / n) * Math.PI * 6;
        const radius = (i / n) * Math.min(usableW, usableH) * 0.4;
        return {
          x: w / 2 + Math.cos(angle) * radius,
          y: h / 2 + Math.sin(angle) * radius
        };
      });

      // Simple force-directed iteration
      const iterations = 80;
      const repulsion = 500;
      const attraction = 0.01;

      for (let iter = 0; iter < iterations; iter++) {
        const forces = positions.map(() => ({ fx: 0, fy: 0 }));

        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = positions[j].x - positions[i].x;
            const dy = positions[j].y - positions[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 1;

            // Repulsion
            const repF = repulsion / (dist * dist);
            forces[i].fx -= (dx / dist) * repF;
            forces[i].fy -= (dy / dist) * repF;
            forces[j].fx += (dx / dist) * repF;
            forces[j].fy += (dy / dist) * repF;

            // Attraction based on similarity
            const sim = computeSimilarity(data[i], data[j]);
            if (sim > 0.3) {
              const attF = attraction * sim * dist;
              forces[i].fx += (dx / dist) * attF;
              forces[i].fy += (dy / dist) * attF;
              forces[j].fx -= (dx / dist) * attF;
              forces[j].fy -= (dy / dist) * attF;
            }
          }
        }

        // Apply forces with damping
        const damping = 0.5 * (1 - iter / iterations);
        positions.forEach((pos, i) => {
          pos.x += forces[i].fx * damping;
          pos.y += forces[i].fy * damping;
          // Constrain to bounds
          pos.x = Math.max(padding, Math.min(w - padding, pos.x));
          pos.y = Math.max(padding, Math.min(h - padding, pos.y));
        });
      }

      return positions;
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

    // Initial draw
    drawSimilarityGraph();

    // Redraw on controls change
    if (thresholdSlider) thresholdSlider.addEventListener('input', drawSimilarityGraph);
    if (colorSelect) colorSelect.addEventListener('change', drawSimilarityGraph);

    // Redraw on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawSimilarityGraph, 200);
    });
  }

  // ---- Public API ----
  window.XRVault = {
    openModal,
    closeModal,
    removeFilter
  };

})();
