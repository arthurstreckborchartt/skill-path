import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailLayout, paragraph } from './email-layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailLayout
    preview={`Seu acesso seguro à ${siteName}`}
    eyebrow="Acesso seguro"
    title="Seu link de acesso"
    action={{ label: 'Entrar na Pathly', href: confirmationUrl }}
    footer="Se você não solicitou este link, pode ignorar este e-mail com segurança."
  >
    <Text style={paragraph}>
      Use o botão abaixo para entrar na {siteName}. Por segurança, este link expira em breve.
    </Text>
  </EmailLayout>
)

export default MagicLinkEmail

