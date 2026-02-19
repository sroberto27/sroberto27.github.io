# XR Filmmaking Vault

**An open taxonomy, database, and similarity-based browsing tool for XR, AR & VR filmmaking tools across the film production pipeline.**

Inspired by [Locomotion Vault](https://locomotionvault.github.io/) (Di Luca et al., CHI 2021).

Live site: [https://sroberto27.github.io/filmXRVault/](https://sroberto27.github.io/filmXRVault/)

---

## Overview

XR Filmmaking Vault collects and organizes research papers, industry reports, and technical systems related to XR/AR/VR in film production. Each entry is coded with a multi-faceted taxonomy covering pipeline stage, use-case, XR modality, platform/hardware, interaction techniques, data formats, target roles, evaluation type, outcomes, openness, and maturity level.

### Features

- **Filter Panel**: Multi-attribute filtering across 9 taxonomy dimensions
- **Gallery Grid**: Responsive card grid with grid/list view toggle
- **Detail Modal**: Full attribute view for each entry
- **Search**: Full-text search across titles, authors, abstracts, and tags
- **Similarity Graph**: Force-directed visualization using Gower-style mixed-data similarity
- **Responsive**: Works on desktop, tablet, and mobile
- **Static Site**: Pure HTML/CSS/JS — no build tools or frameworks required

---

## File Structure

This project lives inside the `filmXRVault/` folder of the `sroberto27.github.io` repository:

```
sroberto27.github.io/          ← existing repo (your personal site)
├── index.html                 ← your existing personal site
├── ...                        ← your other files
└── filmXRVault/               ← this project
    ├── index.html             # Main database page
    ├── about.html             # About, codebook, contribution guide
    ├── css/
    │   └── style.css          # All styles
    ├── js/
    │   └── app.js             # Application logic
    ├── data/
    │   └── database.json      # Versioned database (46 entries)
    └── img/                   # (optional) thumbnails and images
```

---

## Deployment Instructions

Since your GitHub Pages site already exists at `sroberto27.github.io`, you just need to add this as a subfolder:

### Step-by-step

```bash
# 1. Clone your existing repo (skip if you already have it locally)
git clone https://github.com/sroberto27/sroberto27.github.io.git
cd sroberto27.github.io

# 2. Create the filmXRVault folder
mkdir -p filmXRVault

# 3. Copy all project files into it
#    (assuming the downloaded files are in ~/Downloads/xr-filmmaking-vault/)
cp -r ~/Downloads/xr-filmmaking-vault/* filmXRVault/

# 4. Verify the structure looks right
ls -R filmXRVault/
#    Should show: index.html, about.html, css/, js/, data/, img/

# 5. Stage, commit, and push
git add filmXRVault/
git commit -m "Add XR Filmmaking Vault database site"
git push origin main

# 6. Wait ~1 minute for GitHub Pages to rebuild
# 7. Visit https://sroberto27.github.io/filmXRVault/
```

That's it — no settings changes needed since GitHub Pages is already enabled on your repo.

---

## Database Schema

Each entry in `filmXRVault/data/database.json` follows this structure:

```json
{
  "id": 1,
  "title": "Paper Title",
  "authors": ["Author One", "Author Two"],
  "year": 2022,
  "source": "Conference or Journal Name",
  "sourceType": "Conference | Journal | Book | Industry Report",
  "doi": "",
  "url": "",
  "abstract": "Brief description...",
  "pipelineStages": ["Pre-production", "Production", "Post-production"],
  "useCases": ["On-Set Visualization (Virtual Production)"],
  "xrModality": ["VR", "AR", "MR"],
  "platformHardware": ["Projection/Spatial Display"],
  "coreInteraction": ["Perspective/Camera Control"],
  "dataFormats": ["3D Models/Assets", "Game Engine/Scene Files"],
  "targetRoles": ["Director", "Cinematographer/DP"],
  "evaluation": ["Case Study (In-situ)"],
  "reportedOutcomes": ["Creative Enablement"],
  "openScience": "No (Closed)",
  "maturity": "Prototype",
  "tags": ["keyword1", "keyword2"]
}
```

---

## Contributing

### Option 1: Google Form
Submit entries via the [Google Form](https://forms.gle/PLACEHOLDER) — no GitHub account needed.

### Option 2: GitHub Pull Request
1. Fork the `sroberto27/sroberto27.github.io` repository
2. Add entries to `filmXRVault/data/database.json` following the schema above
3. Submit a Pull Request

### Option 3: GitHub Issues
[Open an issue](https://github.com/sroberto27/sroberto27.github.io/issues) to suggest corrections, new entries, or improvements.

---

## Updating the Database

1. Edit `filmXRVault/data/database.json` — add new entries or modify existing ones
2. Ensure each entry has a unique `id` (increment from the last entry)
3. Commit and push — the site updates automatically via GitHub Pages

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox) |
| Logic | Vanilla JavaScript (ES6+) |
| Data | JSON |
| Fonts | Google Fonts (Syne, DM Sans, JetBrains Mono) |
| Hosting | GitHub Pages (subfolder of existing site) |
| Similarity | Gower-style mixed-data metric + force-directed layout |

---

## Citation

```bibtex
@article{xrfilmmakingvault2025,
  title={XR Filmmaking Vault: Unifying XR, AR, and VR Tools Across the
         Film Pipeline with an Open Taxonomy, Database, and
         Similarity-Based Browsing},
  author={[Author Names]},
  year={2025},
  url={https://sroberto27.github.io/filmXRVault/}
}
```

---

## License

Database content is available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Website code is available under [MIT License](https://opensource.org/licenses/MIT).

---

## Acknowledgments

Inspired by [Locomotion Vault](https://locomotionvault.github.io/) — Di Luca, Seifi, Egan & Gonzalez-Franco (CHI 2021).
