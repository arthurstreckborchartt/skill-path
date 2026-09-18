import * as React from "react";

import { Link, Text } from "@react-email/components";
import { EmailLayout, inlineLink, paragraph } from "./email-layout";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailLayout
    preview={`Confirme seu e-mail para começar na ${siteName}`}
    eyebrow="Seu próximo passo começa aqui"
    title="Confirme seu e-mail"
    action={{ label: "Confirmar meu e-mail", href: confirmationUrl }}
    footer="Se você não criou uma conta, pode ignorar este e-mail com segurança."
  >
    <Text style={paragraph}>
      Obrigado por entrar na{" "}
      <Link href={siteUrl} style={inlineLink}>
        <strong>{siteName}</strong>
      </Link>
      . Confirme o endereço{" "}
      <Link href={`mailto:${recipient}`} style={inlineLink}>
        {recipient}
      </Link>{" "}
      para começar a construir sua rota profissional.
    </Text>
  </EmailLayout>
);

export default SignupEmail;
