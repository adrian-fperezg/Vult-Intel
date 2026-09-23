import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import nodemailer from 'nodemailer';
import db from '../../db.js';
import { decryptToken } from "./encrypt.js";
import { sendAlert } from '../notifier.js';

/**
 * Base64url encode a buffer according to RFC 4648
 */
function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email via Gmail REST API.
 * This completely replaces the SMTP dispatch layer to overcome networking/port restrictions.
 */
export async function sendGmailMessage(
  mailboxId: string, 
  emailData: { 
    to: string, 
    subject: string, 
    bodyHtml: string, 
    fromEmail?: string, 
    fromName?: string, 
    attachments?: any[],
    threadId?: string,
    parentMessageId?: string
  }
) {
  const mailbox = await db.prepare("SELECT * FROM outreach_mailboxes WHERE id = ?").get(mailboxId) as any;
  
  if (!mailbox) throw new Error("Mailbox not found");
  
  // Decrypt tokens
  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptToken(mailbox.access_token);
    refreshToken = decryptToken(mailbox.refresh_token);
  } catch (err: any) {
    throw new Error(`Failed to decrypt mailbox tokens: ${err.message}`);
  }

  try {
    // 1. Setup Google OAuth2 client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // 2. Build MIME message using Nodemailer's MailComposer
    // This maintains all our complex logic for attachments, HTML, and signatures
    const fromEmail = emailData.fromEmail || mailbox.smtp_username || mailbox.email;
    const fromName = emailData.fromName || mailbox.name;
    const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    const mailOptions: any = {
      from: fromHeader,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.bodyHtml,
      attachments: emailData.attachments || []
    };

    if (emailData.parentMessageId) {
      mailOptions.headers = {
        'In-Reply-To': emailData.parentMessageId,
        'References': emailData.parentMessageId
      };
    }

    const mail = new MailComposer(mailOptions);
    const messageBuffer = await mail.compile().build();
    const rawMessage = toBase64Url(messageBuffer);

    console.log(`[GMAIL API] Dispatching email from ${fromHeader} to ${emailData.to} via REST API...`);

    // 3. Send via Gmail API
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        threadId: emailData.threadId
      }
    });

    const messageId = res.data.id || 'unknown-gmail-id';
    console.log(`[GMAIL API] Email sent successfully. Gmail ID: ${messageId}`);

    return { messageId };
  } catch (err: any) {
    console.error(`[GMAIL API] Dispatch failed for ${emailData.to}:`, err.message);
    
    await sendAlert({
      source: 'Backend',
      customTitle: '🚨 Gmail API Dispatch Error',
      errorMessage: err.message,
      stackTrace: err.stack,
      payload: { 
        mailboxId, 
        to: emailData.to, 
        subject: emailData.subject,
        api_method: 'gmail.users.messages.send'
      }
    });

    throw err;
  }
}

// Keep the old function name for a moment as an alias to prevent immediate runtime crashes until dependencies are updated
export const sendSmtpMessage = sendGmailMessage;

/**
 * Sends through the mailbox's own SMTP server (mailboxes connected with
 * connection_type 'smtp_imap'). Returns the RFC Message-ID without angle
 * brackets so IMAP replies (In-Reply-To) can be matched back to this email.
 */
export async function sendSmtpMail(
  mailbox: any,
  emailData: {
    to: string;
    subject: string;
    bodyHtml: string;
    fromEmail?: string;
    fromName?: string;
    attachments?: any[];
    parentMessageId?: string;
  }
) {
  if (!mailbox.smtp_host || !mailbox.smtp_password) {
    throw new Error('Mailbox is missing SMTP settings. Please reconnect it in Settings.');
  }

  const port = Number(mailbox.smtp_port) || 587;
  const transporter = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port,
    // 465 is implicit TLS; other ports upgrade with STARTTLS.
    secure: mailbox.smtp_secure === true || mailbox.smtp_secure === 1 || port === 465,
    auth: {
      user: mailbox.smtp_username || mailbox.email,
      pass: decryptToken(mailbox.smtp_password),
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });

  const fromEmail = emailData.fromEmail || mailbox.email;
  const fromName = emailData.fromName || mailbox.name;

  const info = await transporter.sendMail({
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.bodyHtml,
    attachments: emailData.attachments || [],
    ...(emailData.parentMessageId
      ? { inReplyTo: emailData.parentMessageId, references: emailData.parentMessageId }
      : {}),
  });

  return { messageId: String(info.messageId || '').replace(/[<>]/g, '') };
}
