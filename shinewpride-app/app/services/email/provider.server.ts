import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = {
  id: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL) {
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    if (!from) {
      throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.id) {
      throw new Error("Resend did not return an email id");
    }

    return { id: data.id };
  }
}

let defaultProvider: EmailProvider | undefined;

function getDefaultProvider(): EmailProvider {
  if (!defaultProvider) {
    defaultProvider = new ResendEmailProvider();
  }
  return defaultProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  defaultProvider = provider;
}

export function resetEmailProvider(): void {
  defaultProvider = undefined;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return getDefaultProvider().send(input);
}
