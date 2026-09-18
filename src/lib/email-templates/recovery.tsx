import * as React from "react";

import { Text } from "@react-email/components";
import { EmailLayout, paragraph } from "./email-layout";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <EmailLayout
    preview={`Redefina sua senha da ${siteName}`}
    eyebrow="Segurança da conta"
    title="Redefina sua senha"
    action={{ label: "Criar nova senha", href: confirmationUrl }}
    footer="Se você não solicitou a redefinição, ignore este e-mail. Sua senha continuará a mesma."
  >
    <Text style={paragraph}>
      Recebemos uma solicitação para redefinir sua senha da {siteName}. Use o botão abaixo para
      criar uma nova.
    </Text>
  </EmailLayout>
);

export default RecoveryEmail;
