/*
 * Settings / formatting model for the Swimlane Adherence Visual
 */

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class XAxisSettings {
    public startHour: number = 9;
    public endHour: number   = 18;
}

export class SwimlaneSettings {
    public rowHeight: number  = 40;
    public barPadding: number = 6;
}

export class LabelSettings {
    public show: boolean       = true;
    public fontSize: number    = 10;
    public minBarWidth: number = 30;
}

export class VisualSettings extends DataViewObjectsParser {
    public xAxis: XAxisSettings     = new XAxisSettings();
    public swimlane: SwimlaneSettings = new SwimlaneSettings();
    public labels: LabelSettings    = new LabelSettings();
}
