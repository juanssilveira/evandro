export interface SendPasswordResetEmailParams {
  email: string;
  name?: string | null;
  resetUrl: string;
  token: string;
}

export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  return Boolean(apiKey && apiKey.trim().length > 0);
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "Evandro Watch <onboarding@resend.dev>";

  if (!apiKey || apiKey.trim().length === 0) {
    console.warn("[Email Service] RESEND_API_KEY não está configurada. Email de reset não enviado.");
    return {
      success: false,
      error: "Serviço de email não configurado.",
    };
  }

  const { email, name, resetUrl } = params;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Redefinição de senha — Evandro Watch",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Redefinição de Senha</h2>
            <p style="font-size: 14px; line-height: 24px; color: #374151; margin-bottom: 24px;">
              Olá ${name ? `<strong>${name}</strong>` : ""}, recebemos uma solicitação para redefinir a senha da sua conta Evandro Watch.
            </p>
            <div style="margin-bottom: 24px;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">
                Redefinir minha senha
              </a>
            </div>
            <p style="font-size: 12px; line-height: 20px; color: #6b7280; margin-bottom: 8px;">
              Se o botão não funcionar, copie e cole o seguinte link no seu navegador:
            </p>
            <p style="font-size: 12px; line-height: 20px; color: #3b82f6; word-break: break-all;">
              <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="font-size: 11px; color: #9ca3af;">
              Se você não solicitou esta redefinição, nenhuma ação é necessária.
            </p>
          </div>
        `,
        text: `Olá, recebemos uma solicitação para redefinir sua senha no Evandro Watch.\n\nAcesse o link abaixo para criar uma nova senha:\n${resetUrl}\n\nSe você não solicitou isso, desconsidere esta mensagem.`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[Email Service] Resend API error (${response.status}):`, errorText);
      return {
        success: false,
        error: `Falha ao enviar e-mail: ${response.statusText || errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido ao enviar e-mail.";
    console.error("[Email Service] Exception sending password reset email:", error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
