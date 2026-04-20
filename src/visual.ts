/*
 * Swimlane Adherence Timeline Visual
 * Power BI Custom Visual - TypeScript + D3.js v5
 */

"use strict";

import "core-js/stable";
import "../style/visual.less";

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions       = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                   = powerbi.extensibility.visual.IVisual;
import ITooltipService           = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem     = powerbi.extensibility.VisualTooltipDataItem;
import DataViewTableRow          = powerbi.DataViewTableRow;

import { VisualSettings } from "./settings";

import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, unknown, null, undefined>;

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
interface ActivityBar {
    agent: string;
    activity: string;
    start: Date;
    end: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MARGIN = { top: 20, right: 20, bottom: 40, left: 130 };
const GRID_INTERVAL_MINUTES = 30;

const DEFAULT_COLORS: Record<string, string> = {
    "in call":    "#4472C4",
    "wrap-up":    "#ED7D31",
    "wrap up":    "#ED7D31",
    "available":  "#70AD47",
    "break":      "#FFC000",
    "lunch":      "#FF0000",
    "training":   "#9B59B6",
    "admin":      "#17A589",
    "admin work": "#17A589",
};

const FALLBACK_PALETTE = [
    "#5B9BD5", "#F4A460", "#90EE90", "#FFD700",
    "#FF6B6B", "#C39BD3", "#48C9B0", "#F0B27A",
    "#85C1E9", "#82E0AA", "#F7DC6F", "#A569BD",
];

function sanitizePropName(name: string): string {
    const s = name.replace(/[^a-zA-Z0-9]/g, "_");
    return /^[0-9_]/.test(s) ? "p" + s : s;
}

function formatTime(d: Date): string {
    return d3.timeFormat("%H:%M")(d);
}

function durationMinutes(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 60000);
}

// ---------------------------------------------------------------------------
// Visual class
// ---------------------------------------------------------------------------
export class SwimlaneVisual implements IVisual {
    private svg!: Selection<SVGSVGElement>;
    private container!: Selection<SVGGElement>;
    private tooltipService!: ITooltipService;
    private settings!: VisualSettings;
    private uniqueActivities: string[] = [];
    private activityColorMap: Record<string, string> = {};

    constructor(options?: VisualConstructorOptions) {
        if (!options) { return; }
        this.tooltipService = options.host.tooltipService;
        this.svg = d3.select(options.element)
            .append("svg").classed("swimlane-visual", true);
        this.container = this.svg.append("g")
            .classed("container", true)
            .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    }

    // -----------------------------------------------------------------------
    public update(options: VisualUpdateOptions): void {
        if (this.tooltipService) {
            this.tooltipService.hide({ immediately: true, isTouchEvent: false });
        }
        this.container.selectAll("*").remove();

        const dataView = options.dataViews && options.dataViews[0];
        if (!dataView || !dataView.table || !dataView.table.rows || dataView.table.rows.length === 0) {
            return;
        }

        this.settings = VisualSettings.parse<VisualSettings>(dataView);

        const columns   = dataView.table.columns;
        const idxAgent    = columns.findIndex(c => c.roles && c.roles["agent"]);
        const idxActivity = columns.findIndex(c => c.roles && c.roles["activity"]);
        const idxStart    = columns.findIndex(c => c.roles && c.roles["startTime"]);
        const idxEnd      = columns.findIndex(c => c.roles && c.roles["endTime"]);

        if (idxAgent < 0 || idxActivity < 0 || idxStart < 0 || idxEnd < 0) { return; }

        const bars: ActivityBar[] = [];
        for (const row of dataView.table.rows as DataViewTableRow[]) {
            const agent    = row[idxAgent]    as string;
            const activity = row[idxActivity] as string;
            const rawStart = row[idxStart];
            const rawEnd   = row[idxEnd];
            if (!agent || !activity || rawStart == null || rawEnd == null) { continue; }
            const start = new Date(rawStart as string | number);
            const end   = new Date(rawEnd   as string | number);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) { continue; }
            bars.push({ agent, activity, start, end });
        }
        if (bars.length === 0) { return; }

        // Build color map: persisted > default > fallback
        const uniqueActivities = Array.from(new Set(bars.map(b => b.activity)));
        const actColorsObj = dataView.metadata?.objects?.["activityColors"] as Record<string, any> | undefined;
        let fallbackIdx = 0;

        for (const activity of uniqueActivities) {
            const fillVal    = actColorsObj?.[sanitizePropName(activity)];
            const storedColor = fillVal?.solid?.color as string | undefined;
            if (storedColor) {
                this.activityColorMap[activity] = storedColor;
            } else if (!this.activityColorMap[activity]) {
                const def = DEFAULT_COLORS[activity.toLowerCase().trim()];
                this.activityColorMap[activity] = def
                    ? def
                    : FALLBACK_PALETTE[fallbackIdx++ % FALLBACK_PALETTE.length];
            }
        }
        // Remove stale entries
        for (const k of Object.keys(this.activityColorMap)) {
            if (!uniqueActivities.includes(k)) { delete this.activityColorMap[k]; }
        }
        this.uniqueActivities = uniqueActivities;

        const colorFor = (activity: string): string =>
            this.activityColorMap[activity] || "#BFBFBF";

        // Layout
        const agents      = Array.from(new Set(bars.map(b => b.agent))).sort();
        const { rowHeight, barPadding }               = this.settings.swimlane;
        const { startHour, endHour }                  = this.settings.xAxis;
        const { show: showLabels, fontSize, minBarWidth } = this.settings.labels;

        const totalWidth  = options.viewport.width;
        const totalHeight = options.viewport.height;
        const innerWidth  = totalWidth  - MARGIN.left - MARGIN.right;
        const innerHeight = agents.length * rowHeight;

        this.svg
            .attr("width",  totalWidth)
            .attr("height", Math.max(totalHeight, innerHeight + MARGIN.top + MARGIN.bottom));

        // BUG FIX: use min start date so domain is stable across renders
        const minStart = d3.min(bars, b => b.start) as Date;
        const refDate  = new Date(minStart);
        refDate.setHours(0, 0, 0, 0);

        const xStart = new Date(refDate); xStart.setHours(startHour, 0, 0, 0);
        const xEnd   = new Date(refDate); xEnd.setHours(endHour,     0, 0, 0);

        const xScale = d3.scaleTime().domain([xStart, xEnd]).range([0, innerWidth]);
        const yScale = d3.scaleBand().domain(agents).range([0, innerHeight]).paddingInner(0).paddingOuter(0);

        const tickInterval = d3.timeMinute.every(GRID_INTERVAL_MINUTES) as d3.TimeInterval;

        // X axis
        this.container.append("g")
            .classed("x-axis", true)
            .attr("transform", `translate(0,${innerHeight})`)
            .call(
                d3.axisBottom<Date>(xScale)
                    .ticks(tickInterval)
                    .tickFormat(d3.timeFormat("%H:%M") as (d: Date) => string)
            )
            .selectAll("text").style("font-size", "11px");

        // Gridlines
        this.container.append("g").classed("grid-lines", true)
            .selectAll<SVGLineElement, Date>("line.grid")
            .data(xScale.ticks(tickInterval)).enter().append("line").classed("grid", true)
            .attr("x1", (d: Date) => xScale(d) as number)
            .attr("x2", (d: Date) => xScale(d) as number)
            .attr("y1", 0).attr("y2", innerHeight)
            .attr("stroke", "#ddd").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");

        // Y axis
        const yAxisG = this.container.append("g").classed("y-axis", true)
            .call(d3.axisLeft<string>(yScale).tickSize(0));
        yAxisG.select(".domain").remove();
        yAxisG.selectAll("text")
            .style("font-size", "12px").style("font-weight", "600").attr("dx", "-6px");

        // Borders & lane separators
        this.container.append("line")
            .attr("x1", 0).attr("x2", innerWidth).attr("y1", 0).attr("y2", 0)
            .attr("stroke", "#ccc").attr("stroke-width", 1);
        this.container.append("g").classed("lanes", true)
            .selectAll<SVGLineElement, string>("line.lane-sep")
            .data(agents).enter().append("line").classed("lane-sep", true)
            .attr("x1", 0).attr("x2", innerWidth)
            .attr("y1", (d: string) => (yScale(d) as number) + rowHeight)
            .attr("y2", (d: string) => (yScale(d) as number) + rowHeight)
            .attr("stroke", "#ccc").attr("stroke-width", 1);

        // Bars
        const barsG     = this.container.append("g").classed("bars", true);
        const barHeight = rowHeight - barPadding * 2;
        const self      = this;

        const clampedX = (d: ActivityBar): number => {
            const s = d.start < xStart ? xStart : d.start;
            return xScale(s) as number;
        };
        const clampedW = (d: ActivityBar): number => {
            const s = d.start < xStart ? xStart : d.start;
            const e = d.end   > xEnd   ? xEnd   : d.end;
            return Math.max(0, (xScale(e) as number) - (xScale(s) as number));
        };

        const barSel = barsG.selectAll<SVGRectElement, ActivityBar>("rect.bar")
            .data(bars).enter().append("rect").classed("bar", true)
            .attr("x",      (d: ActivityBar) => clampedX(d))
            .attr("y",      (d: ActivityBar) => (yScale(d.agent) as number) + barPadding)
            .attr("width",  (d: ActivityBar) => clampedW(d))
            .attr("height", barHeight)
            .attr("fill",   (d: ActivityBar) => colorFor(d.activity))
            .attr("rx", 2).attr("ry", 2)
            .style("pointer-events", "all");

        barSel
            .on("mouseover", function(d: ActivityBar) {
                const ev = d3.event as MouseEvent;
                const items: VisualTooltipDataItem[] = [
                    { displayName: "Agent",    value: d.agent },
                    { displayName: "Activity", value: d.activity },
                    { displayName: "Start",    value: formatTime(d.start) },
                    { displayName: "End",      value: formatTime(d.end) },
                    { displayName: "Duration", value: `${durationMinutes(d.start, d.end)} min` },
                ];
                self.tooltipService.show({
                    dataItems: items, identities: [],
                    coordinates: [ev.clientX, ev.clientY], isTouchEvent: false,
                });
            })
            .on("mousemove", function(d: ActivityBar) {
                const ev = d3.event as MouseEvent;
                const items: VisualTooltipDataItem[] = [
                    { displayName: "Agent",    value: d.agent },
                    { displayName: "Activity", value: d.activity },
                    { displayName: "Start",    value: formatTime(d.start) },
                    { displayName: "End",      value: formatTime(d.end) },
                    { displayName: "Duration", value: `${durationMinutes(d.start, d.end)} min` },
                ];
                self.tooltipService.move({
                    dataItems: items, identities: [],
                    coordinates: [ev.clientX, ev.clientY], isTouchEvent: false,
                });
            })
            .on("mouseout", function() {
                self.tooltipService.hide({ immediately: false, isTouchEvent: false });
            });

        // Bar labels
        if (showLabels) {
            barsG.selectAll<SVGTextElement, ActivityBar>("text.bar-label")
                .data(bars).enter().append("text").classed("bar-label", true)
                .attr("x", (d: ActivityBar) => clampedX(d) + clampedW(d) / 2)
                .attr("y", (d: ActivityBar) =>
                    (yScale(d.agent) as number) + barPadding + barHeight / 2 + fontSize / 3)
                .attr("text-anchor", "middle")
                .style("font-size", `${fontSize}px`).style("fill", "#fff")
                .style("pointer-events", "none")
                .text((d: ActivityBar) => clampedW(d) >= minBarWidth ? d.activity : "");
        }
    }

    // -----------------------------------------------------------------------
    // Dynamic format pane
    // -----------------------------------------------------------------------
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        if (!this.uniqueActivities || this.uniqueActivities.length === 0) {
            return { cards: [] };
        }

        const colorSlices: powerbi.visuals.FormattingSlice[] = this.uniqueActivities.map(activity => {
            const slice: powerbi.visuals.SimpleVisualFormattingSlice = {
                uid:         `actColor_${sanitizePropName(activity)}`,
                displayName: activity,
                control: {
                    type: powerbi.visuals.FormattingComponent.ColorPicker,
                    properties: {
                        descriptor: {
                            objectName:   "activityColors",
                            propertyName: sanitizePropName(activity),
                        },
                        value: { value: this.activityColorMap[activity] || "#BFBFBF" },
                    },
                },
            };
            return slice;
        });

        const numSlice = (
            objectName: string, propertyName: string,
            displayName: string, value: number
        ): powerbi.visuals.SimpleVisualFormattingSlice => ({
            uid:         `${objectName}_${propertyName}`,
            displayName,
            control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                    descriptor: { objectName, propertyName },
                    value,
                },
            },
        });

        return {
            cards: [
                {
                    uid: "activityColorsCard", displayName: "Activity Colors",
                    groups: [{ uid: "activityColorsGroup", displayName: "Colors", slices: colorSlices }],
                },
                {
                    uid: "xAxisCard", displayName: "X-Axis",
                    groups: [{ uid: "xAxisGroup", displayName: "Range", slices: [
                        numSlice("xAxis", "startHour", "Start Hour", this.settings?.xAxis?.startHour ?? 9),
                        numSlice("xAxis", "endHour",   "End Hour",   this.settings?.xAxis?.endHour   ?? 18),
                    ]}],
                },
                {
                    uid: "swimlaneCard", displayName: "Swimlane",
                    groups: [{ uid: "swimlaneGroup", displayName: "Layout", slices: [
                        numSlice("swimlane", "rowHeight",  "Row Height (px)",  this.settings?.swimlane?.rowHeight  ?? 40),
                        numSlice("swimlane", "barPadding", "Bar Padding (px)", this.settings?.swimlane?.barPadding ?? 6),
                    ]}],
                },
                {
                    uid: "labelsCard", displayName: "Bar Labels",
                    groups: [{ uid: "labelsGroup", displayName: "Text", slices: [
                        numSlice("labels", "fontSize",    "Font Size",                    this.settings?.labels?.fontSize    ?? 10),
                        numSlice("labels", "minBarWidth", "Min Bar Width for Label (px)", this.settings?.labels?.minBarWidth ?? 30),
                    ]}],
                },
            ],
        };
    }
}
