import nodemailer from 'nodemailer';
import { config } from '../config';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  async sendVerificationCode(to: string, code: string, firstName: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"ROR Partnership" <${config.smtp.from}>`,
      to,
      subject: 'Verify Your Email - ROR Partnership',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to ROR Partnership, ${firstName}!</h2>
          <p style="color: #555; font-size: 16px;">Please use the following code to verify your email address:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #555; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const emailService = new EmailService();
