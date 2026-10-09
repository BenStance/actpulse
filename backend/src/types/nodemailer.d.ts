declare module 'nodemailer' {
  export interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }

  export interface Transporter {
    sendMail(message: MailOptions): Promise<unknown>;
  }

  export function createTransport(options: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
  }): Transporter;
}
