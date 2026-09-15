import * as React from 'react'

import { Link, Text } from '@react-email/components'
import { EmailLayout, inlineLink, paragraph } from './email-layout'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailLayout
    preview={`Confirme seu novo e-mail da ${siteName}`}
    eyebrow="Segurança da conta"
    title="Confirme seu novo e-mail"
    action={{ label: 'Confirmar alteração', href: confirmationUrl }}
    footer="Se você não solicitou esta alteração, proteja sua conta imediatamente."
  >
    <Text style={paragraph}>
      Você solicitou a alteração do endereço da {siteName} de{' '}
      <Link href={`mailto:${oldEmail}`} style={inlineLink}>{oldEmail}</Link> para{' '}
      <Link href={`mailto:${newEmail}`} style={inlineLink}>{newEmail}</Link>.
    </Text>
  </EmailLayout>
)

export default EmailChangeEmail

