"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
let MailService = MailService_1 = class MailService {
    configService;
    logger = new common_1.Logger(MailService_1.name);
    transporter;
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('EMAIL_HOST'),
            port: this.configService.get('EMAIL_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('EMAIL_USER'),
                pass: this.configService.get('EMAIL_PASSWORD'),
            },
        });
    }
    async sendUserInvitation(email, otp, token) {
        await this.safeSend({
            to: email,
            subject: '🎉 Welcome to ActPulse — Complete Your Setup',
            text: `Welcome to ActPulse!\n\nUse this OTP to activate your account: ${otp}\nActivation Token: ${token}\n\nThis code expires in 30 minutes.`,
            html: this.renderTemplate({
                accentColor: '#3B82F6',
                accentGradient: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 50%, #06B6D4 100%)',
                badgeColor: '#DBEAFE',
                badgeText: '#1E40AF',
                iconSvg: `
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,0.15)"/>
            <path d="M10 18L15.5 23.5L26 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`,
                tag: 'INVITATION',
                title: 'Welcome aboard,<br/>you\'re almost in.',
                subtitle: 'Your ActPulse monitoring workspace is ready — just one step away.',
                body: `
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
            You've been invited to join <strong style="color:#111827;">ActPulse</strong> — the intelligent IoT generator
            and UPS monitoring platform. Use the credentials below to activate your account.
          </p>

          <!-- OTP Block -->
          <div style="margin:0 0 16px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">
              One-Time Password
            </div>
            <div style="background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:1px solid #BFDBFE;border-radius:12px;padding:20px 24px;display:flex;align-items:center;gap:16px;">
              <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1D4ED8;font-family:'Courier New',Courier,monospace;flex:1;">
                ${otp}
              </div>
              <div style="width:6px;height:40px;background:linear-gradient(180deg,#3B82F6,#06B6D4);border-radius:3px;flex-shrink:0;"></div>
            </div>
          </div>

          <!-- Token Block -->
          <div style="margin:0 0 24px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">
              Activation Token
            </div>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px 20px;">
              <code style="font-size:12.5px;color:#374151;word-break:break-all;font-family:'Courier New',Courier,monospace;line-height:1.6;">
                ${token}
              </code>
            </div>
          </div>

          <!-- Expiry Notice -->
          ${renderTimerBadge('#FEF3C7', '#92400E', '#FDE68A', '⏱', 'Expires in 30 minutes — activate before time runs out.')}
        `,
                footer: 'Not expecting this email? You can safely ignore it, or contact your system administrator if something seems wrong.',
            }),
        });
    }
    async sendOtpReset(email, otp) {
        await this.safeSend({
            to: email,
            subject: '🔐 ActPulse — Your Password Reset Code',
            text: `We received a password reset request.\n\nYour OTP is: ${otp}\n\nThis code expires in 10 minutes.`,
            html: this.renderTemplate({
                accentColor: '#F97316',
                accentGradient: 'linear-gradient(135deg, #C2410C 0%, #F97316 50%, #FBBF24 100%)',
                badgeColor: '#FEF3C7',
                badgeText: '#92400E',
                iconSvg: `
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,0.15)"/>
            <rect x="12" y="16" width="12" height="10" rx="2" stroke="white" stroke-width="2" fill="none"/>
            <path d="M14 16V13a4 4 0 0 1 8 0v3" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <circle cx="18" cy="21" r="1.5" fill="white"/>
          </svg>`,
                tag: 'SECURITY',
                title: 'Password reset<br/>requested.',
                subtitle: 'Use the code below to securely reset your ActPulse password.',
                body: `
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
            We received a request to reset the password associated with your <strong style="color:#111827;">ActPulse</strong> account.
            Enter the code below to proceed.
          </p>

          <!-- OTP Block -->
          <div style="margin:0 0 24px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">
              Reset Code
            </div>
            <div style="background:linear-gradient(135deg,#FFF7ED,#FEF3C7);border:1px solid #FDE68A;border-radius:12px;padding:24px;text-align:center;">
              <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#C2410C;font-family:'Courier New',Courier,monospace;">
                ${otp}
              </div>
            </div>
          </div>

          <!-- Expiry Notice -->
          ${renderTimerBadge('#FEF3C7', '#92400E', '#FDE68A', '⏱', 'This code expires in 10 minutes.')}

          <!-- Warning -->
          <div style="margin-top:20px;padding:14px 18px;background:#FFF1F2;border-left:4px solid #F43F5E;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13.5px;color:#9F1239;line-height:1.6;">
              <strong>Didn't request this?</strong> Your account credentials may be at risk. Please secure your account immediately by logging in and changing your password.
            </p>
          </div>
        `,
                footer: 'For your protection, never share this code with anyone — ActPulse support will never ask for your OTP.',
            }),
        });
    }
    async sendPasswordChanged(email) {
        await this.safeSend({
            to: email,
            subject: '✅ ActPulse — Password Changed Successfully',
            text: 'Your ActPulse password was changed successfully. If this was not you, contact support immediately.',
            html: this.renderTemplate({
                accentColor: '#10B981',
                accentGradient: 'linear-gradient(135deg, #065F46 0%, #10B981 50%, #34D399 100%)',
                badgeColor: '#D1FAE5',
                badgeText: '#064E3B',
                iconSvg: `
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,0.15)"/>
            <path d="M11 18l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`,
                tag: 'ACCOUNT UPDATE',
                title: 'Password changed<br/>successfully.',
                subtitle: 'Your ActPulse account security has been updated.',
                body: `
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
            This is a confirmation that the password for your <strong style="color:#111827;">ActPulse</strong> account
            was changed successfully. Your account is now secured with your new credentials.
          </p>

          <!-- Success Block -->
          <div style="margin:0 0 24px;background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border:1px solid #A7F3D0;border-radius:12px;padding:20px 24px;display:flex;align-items:center;gap:16px;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#10B981,#34D399);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">
              ✓
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#065F46;margin-bottom:3px;">Account Secured</div>
              <div style="font-size:13px;color:#047857;line-height:1.5;">Your new password is active and protecting your account.</div>
            </div>
          </div>

          <!-- Security Tips -->
          <div style="margin:0 0 20px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:12px;">
              Security Tips
            </div>
            ${['Use a unique password you do not use elsewhere.', 'Enable two-factor authentication if available.', 'Never share your password with anyone, including support.']
                    .map(tip => `
                <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
                  <div style="width:20px;height:20px;background:#D1FAE5;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-size:11px;color:#065F46;">✓</div>
                  <p style="margin:0;font-size:13.5px;color:#4B5563;line-height:1.5;">${tip}</p>
                </div>
              `).join('')}
          </div>

          <!-- Warning -->
          <div style="padding:14px 18px;background:#FFF1F2;border-left:4px solid #F43F5E;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13.5px;color:#9F1239;line-height:1.6;">
              <strong>Wasn't you?</strong> Contact your administrator immediately and regain access to your account.
            </p>
          </div>
        `,
                footer: 'This is an automated security notification from ActPulse. Please do not reply to this email.',
            }),
        });
    }
    async safeSend(payload) {
        const user = this.configService.get('EMAIL_USER');
        if (!user) {
            this.logger.warn(`Email skipped. Missing EMAIL_USER. Target: ${payload.to}`);
            return;
        }
        await this.transporter.sendMail({
            from: `"ActPulse" <${user}>`,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
        });
    }
    renderTemplate(input) {
        const year = new Date().getFullYear();
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>ActPulse</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email card: max 600px -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- ── LOGO BAR ── -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:10px 20px;background:#0F172A;border-radius:40px;display:inline-block;">
                    <span style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff;">
                      ⚡ ACT<span style="color:${input.accentColor};">PULSE</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO HEADER ── -->
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;background:${input.accentGradient};padding:36px 36px 28px;">

              <!-- Tag + Icon row -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.3);">
                      ${input.tag}
                    </span>
                  </td>
                  <td align="right">
                    ${input.iconSvg}
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin:18px 0 10px;font-size:28px;font-weight:800;color:#fff;line-height:1.2;letter-spacing:-0.5px;">
                ${input.title}
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;">
                ${input.subtitle}
              </p>

              <!-- Decorative bar -->
              <div style="margin-top:24px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;overflow:hidden;">
                <div style="width:60%;height:100%;background:rgba(255,255,255,0.7);border-radius:2px;"></div>
              </div>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="background:#FFFFFF;padding:32px 36px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              ${input.body}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 20px 20px;padding:20px 36px;">
              <p style="margin:0 0 14px;font-size:12.5px;color:#64748B;line-height:1.6;">
                ${input.footer}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#94A3B8;">
                    © ${year} ActPulse. All rights reserved.
                  </td>
                  <td align="right">
                    <span style="display:inline-block;width:8px;height:8px;background:${input.accentColor};border-radius:50%;margin-right:4px;"></span>
                    <span style="font-size:12px;color:${input.accentColor};font-weight:600;">actpulse.io</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BOTTOM NOTE ── -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#94A3B8;line-height:1.6;">
                This email was sent by ActPulse. If you have questions,<br/>
                reach us at <a href="mailto:support@actpulse.io" style="color:${input.accentColor};text-decoration:none;font-weight:600;">support@actpulse.io</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `.trim();
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
function renderTimerBadge(bg, textColor, borderColor, icon, message) {
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 18px;background:${bg};border:1px solid ${borderColor};border-radius:10px;margin-bottom:4px;">
      <span style="font-size:18px;">${icon}</span>
      <p style="margin:0;font-size:13.5px;color:${textColor};font-weight:600;">${message}</p>
    </div>
  `;
}
//# sourceMappingURL=mail.service.js.map