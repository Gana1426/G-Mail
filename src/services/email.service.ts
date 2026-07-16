import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "@/config";

export class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!config.email.user || !config.email.pass) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }

    return this.transporter;
  }

  private async sendMail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn("[Email] SMTP not configured — email not sent to", to);
      return;
    }

    await transporter.sendMail({
      from: `"${config.app.name}" <${config.email.user}>`,
      to,
      replyTo: config.email.admin,
      subject,
      html,
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${config.app.url}/verify-email?token=${token}`;

    await this.sendMail(
      email,
      `Verify your ${config.app.name} account`,
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ${config.app.name}</h2>
          <p>Please verify your email address to activate your account.</p>
          <p>
            <a href="${verifyUrl}"
               style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              Verify Email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `
    );

    if (config.app.env === "development") {
      console.log(`[Email] Verification link for ${email}: ${verifyUrl}`);
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.app.url}/reset-password?token=${token}`;

    await this.sendMail(
      email,
      `Reset your ${config.app.name} password`,
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>We received a request to reset your password. Click the button below to set a new password.</p>
          <p>
            <a href="${resetUrl}"
               style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Or copy this link: <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `
    );

    if (config.app.env === "development") {
      console.log(`[Email] Password reset link for ${email}: ${resetUrl}`);
    }
  }
}

export const emailService = new EmailService();
