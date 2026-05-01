import nodemailer from 'nodemailer';

export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const verifyUrl = `${process.env.CLIENT_URL ?? 'http://localhost:8080'}/verify-email?token=${opts.token}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 32px 16px; }
        .card { background: #ffffff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
        .logo-icon { background: #6366f1; border-radius: 8px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }
        .logo-icon svg { width: 20px; height: 20px; fill: none; stroke: #fff; stroke-width: 2; }
        .logo-name { font-weight: 700; font-size: 16px; color: #18181b; }
        h1 { font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
        p { font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 16px; }
        .btn { display: block; background: #6366f1; color: #ffffff !important; text-decoration: none; text-align: center; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
        .footer { font-size: 11px; color: #a1a1aa; text-align: center; margin-top: 32px; }
        .note { background: #f4f4f5; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #71717a; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
          </div>
          <span class="logo-name">SynapChain AI</span>
        </div>
        <h1>Verify your email</h1>
        <p>Hi <strong>${opts.name}</strong>, thanks for signing up! Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" class="btn">Verify Email Address →</a>
        <div class="note">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</div>
        <div class="footer">© ${new Date().getFullYear()} SynapChain AI · This is an automated message, do not reply.</div>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({
    from: `"SynapChain AI" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: 'Verify your SynapChain AI email',
    html,
  });
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  role: string;
  password: string;
  companyName?: string;
}) {
  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    operations_manager: 'Operations Manager',
    supplier: 'Supplier',
    business_analyst: 'Business Analyst',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 32px 16px; }
        .card { background: #ffffff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
        .logo-icon { background: #6366f1; border-radius: 8px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }
        .logo-icon svg { width: 20px; height: 20px; fill: none; stroke: #fff; stroke-width: 2; }
        .logo-name { font-weight: 700; font-size: 16px; color: #18181b; }
        h1 { font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
        p { font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 16px; }
        .creds { background: #f4f4f5; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
        .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e4e4e7; }
        .cred-row:last-child { border-bottom: none; }
        .cred-label { font-size: 12px; color: #71717a; font-weight: 500; }
        .cred-value { font-size: 13px; color: #18181b; font-weight: 600; font-family: monospace; }
        .badge { display: inline-block; background: #ede9fe; color: #6d28d9; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
        .btn { display: block; background: #6366f1; color: #ffffff !important; text-decoration: none; text-align: center; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
        .footer { font-size: 11px; color: #a1a1aa; text-align: center; margin-top: 32px; }
        .warning { background: #fef9c3; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #854d0e; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
          </div>
          <span class="logo-name">SynapChain AI</span>
        </div>

        <h1>Welcome to ${opts.companyName ?? 'SynapChain AI'} 👋</h1>
        <p>Hi <strong>${opts.name}</strong>, your account has been created by an administrator. Here are your login credentials:</p>

        <div class="creds">
          <div class="cred-row">
            <span class="cred-label">Email</span>
            <span class="cred-value">${opts.to}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Password</span>
            <span class="cred-value">${opts.password}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Role</span>
            <span class="badge">${roleLabel[opts.role] ?? opts.role}</span>
          </div>
        </div>

        <a href="${process.env.CLIENT_URL ?? 'http://localhost:8080'}/login" class="btn">Sign in to your account →</a>

        <div class="warning">
          🔒 Please change your password after your first login for security.
        </div>

        <div class="footer">
          © ${new Date().getFullYear()} SynapChain AI · This is an automated message, do not reply.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"SynapChain AI" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: `Your SynapChain AI account is ready`,
    html,
  });
}
