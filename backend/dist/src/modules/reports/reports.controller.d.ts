import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    deviceUptime(req: {
        user: {
            sub: string;
        };
    }, deviceId: string, from: string, to: string): Promise<{
        device: {
            id: string;
            name: string;
        };
        period: {
            from: string;
            to: string;
        };
        summary: {
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        };
        table: import("./reports.service").ReportSegment[];
    }>;
    deviceDaily(req: {
        user: {
            sub: string;
        };
    }, deviceId: string, from: string, to: string): Promise<{
        day: string;
        uptimeSeconds: number;
        downtimeSeconds: number;
        uptimePercentage: number;
    }[]>;
    deviceEvents(req: {
        user: {
            sub: string;
        };
    }, deviceId: string, from: string, to: string): Promise<{
        deviceId: string;
        period: {
            from: string;
            to: string;
        };
        count: number;
        events: {
            timestamp: string;
            status: string;
            transition: string | null;
        }[];
    }>;
    fleetSummary(req: {
        user: {
            sub: string;
        };
    }, from: string, to: string): Promise<{
        period: {
            from: string;
            to: string;
        };
        totals: {
            devices: number;
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        };
        devices: {
            device: {
                id: string;
                name: string;
            };
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        }[];
    }>;
}
