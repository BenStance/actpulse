import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    summary(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        totalDevices: number;
        activeDevices: number;
        onlineDevices: number;
        onCount: number;
        offCount: number;
    }>;
    uptime(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        [x: string]: string | number;
        day: string;
    }[]>;
    downtime(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        [x: string]: string | number;
        day: string;
    }[]>;
    activity(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        id: string;
        deviceId: string;
        deviceName: string;
        status: import("../../common/enums/sensor-status.enum").SensorStatus;
        recordedAt: Date;
    }[]>;
}
