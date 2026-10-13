import "server-only";
import nodemailer from "nodemailer";

type Email = { para: string; assunto: string; texto: string; html: string };

function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_SENHA);
}

export async function enviarEmail({ para, assunto, texto, html }: Email): Promise<void> {
  if (!smtpConfigurado()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP não configurado: defina SMTP_HOST, SMTP_USUARIO e SMTP_SENHA");
    }
    // Em dev, sem SMTP, mostra o e-mail no terminal (contém links de uso único).
    console.info(`\n[email:dev] Para: ${para}\nAssunto: ${assunto}\n\n${texto}\n`);
    return;
  }

  const porta = Number(process.env.SMTP_PORT ?? 465);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA },
  });

  await transporte.sendMail({
    from: process.env.SMTP_REMETENTE ?? process.env.SMTP_USUARIO,
    to: para,
    subject: assunto,
    text: texto,
    html,
  });
}

/** Escapa texto para interpolar em HTML de e-mail. */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
