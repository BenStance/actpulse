export declare class CreateDeviceDto {
    organizationId: string;
    siteId: string;
    equipmentId: string;
    name: string;
    deviceIdentifier: string;
    hardwareModel?: string;
    firmwareVersion?: string;
    heartbeatIntervalSeconds?: number;
    offlineTimeoutSeconds?: number;
}
