# Swimlane Adherence Timeline

A Power BI custom visual (.pbiviz) that renders a **swimlane / Gantt-style timeline** for tracking call center agent schedule adherence.

---

## Preview

Each agent gets their own horizontal swimlane. Activity blocks are colored by type, labeled when wide enough, and show a rich tooltip on hover.

---

## Installation

1. Download `dist/swimlaneAdherenceVisual.pbiviz` from this repository
2. In Power BI Desktop open the **Visualizations** pane → click **"..."** → **Import a visual from a file**
3. Select the downloaded `.pbiviz` file
4. The visual icon will appear in your Visualizations pane

---

## Data roles

| Field | Type | Description |
|-------|------|-------------|
| **Agent** | Text | One swimlane per unique value |
| **Activity** | Text | Bar label and color key |
| **Start Time** | DateTime | Bar start |
| **End Time** | DateTime | Bar end |

---

## Format pane

| Section | Option | Default |
|---------|--------|---------|
| **Activity Colors** | One color picker per activity detected in your data | See below |
| **X-Axis** | Start Hour | 9 |
| **X-Axis** | End Hour | 18 |
| **Swimlane** | Row Height (px) | 40 |
| **Swimlane** | Bar Padding (px) | 6 |
| **Bar Labels** | Font Size | 10 |
| **Bar Labels** | Min Bar Width for Label (px) | 30 |

### Default activity colors

| Activity name | Color |
|--------------|-------|
| In Call | `#4472C4` |
| Wrap-Up | `#ED7D31` |
| Available | `#70AD47` |
| Break | `#FFC000` |
| Lunch | `#FF0000` |
| Training | `#9B59B6` |
| Admin | `#17A589` |
| *(any other)* | Auto-assigned distinct color |

Colors can be changed per-activity in the Format pane under **Activity Colors**.

---

## Features

- One swimlane per unique agent, sorted alphabetically
- Activity bars clamped to the visible time window
- Gridlines every 30 minutes
- Bar labels hidden automatically when a bar is too narrow
- Tooltip shows agent, activity, start time, end time and duration in minutes
- All activity colors editable from the Format pane
- Unknown activity names receive distinct auto-assigned colors

