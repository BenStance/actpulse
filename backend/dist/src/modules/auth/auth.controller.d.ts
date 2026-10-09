import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, req: {
        ip?: string;
    }): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("../../common/enums/user-role.enum").UserRole;
            organizationId: string | null;
            isActive: boolean;
            isActivated: boolean;
            organization: {
                id: string;
                name: string;
                isActive: boolean;
            } | null;
            equipmentIds: string[];
            deviceIds: string[];
        };
    }>;
    logout(req: {
        headers: {
            authorization?: string;
        };
        user: {
            sub: string;
        };
    }): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto, req: {
        ip?: string;
    }): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto, req: {
        ip?: string;
    }): Promise<{
        message: string;
    }>;
    me(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        id: string;
        name: string;
        email: string;
        role: import("../../common/enums/user-role.enum").UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    updateMe(req: {
        user: {
            sub: string;
        };
    }, dto: UpdateProfileDto): Promise<{
        id: string;
        name: string;
        email: string;
        role: import("../../common/enums/user-role.enum").UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    changePassword(req: {
        user: {
            sub: string;
        };
    }, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
