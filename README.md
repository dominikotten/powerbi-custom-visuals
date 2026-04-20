# Swimlane Adherence Timeline — Power BI Custom Visual

A swimlane / Gantt-style timeline for tracking call-center agent schedule adherence.

---

## Project structure

```
custom vis/
├── assets/
│   └── icon.png          ← replace with your 20×20 PNG icon
├── src/
│   ├── visual.ts         ← main visual logic (D3.js v5)
│   └── settings.ts       ← formatting / color-palette model
├── style/
│   └── visual.less       ← LESS stylesheet
├── capabilities.json     ← Power BI data roles & formatting objects
├── pbiviz.json           ← visual metadata
├── package.json
├── tsconfig.json
└── tslint.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 16 |
| npm | ≥ 8 |
| Power BI Visuals Tools | 4.x (`npm i -g powerbi-visuals-tools`) |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add a placeholder icon (required by pbiviz)
#    Copy any 20×20 PNG to assets/icon.png

# 3. Start dev server (live-reload in Power BI Desktop)
pbiviz start

# 4. Package for distribution
pbiviz package
# → dist/swimlaneAdherenceVisual.pbiviz
```

---

## Data roles

| Role | Type | Description |
|------|------|-------------|
| **Agent** | Text | Y-axis swimlane label |
| **Activity** | Text | Bar label & color key |
| **Start Time** | DateTime | Bar start |
| **End Time** | DateTime | Bar end |

---

## Activity color mapping

The visual recognises the following activity names (case-insensitive) and maps them to the default palette. All colours can be overridden in the **Activity Colors** formatting pane.

| Activity name in data | Default colour |
|-----------------------|---------------|
| Phone Call | #4472C4 |
| Break | #ED7D31 |
| Training | #A9D18E |
| Meeting | #FFC000 |
| Lunch | #FF0000 |
| Admin Work / Admin | #9DC3E6 |
| Coaching | #7030A0 |
| (anything else) | #BFBFBF |

---

## Formatting options

| Group | Option | Default |
|-------|--------|---------|
| X-Axis | Start Hour | 9 |
| X-Axis | End Hour | 18 |
| Swimlane | Row Height (px) | 40 |
| Swimlane | Bar Padding (px) | 6 |
| Bar Labels | Show Labels | true |
| Bar Labels | Font Size | 10 |
| Bar Labels | Min Bar Width for Label | 30 |
| Activity Colors | (one per activity) | see above |
