import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private readonly logger;
    private readonly transporter;
    constructor(configService: ConfigService);
    sendUserInvitation(email: string, otp: string, token: string): Promise<void>;
    sendOtpReset(email: string, otp: string): Promise<void>;
    sendPasswordChanged(email: string): Promise<void>;
    private safeSend;
    private renderTemplate;
}
