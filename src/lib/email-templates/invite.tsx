import * as React from 'react'

import { Link, Text } from '@react-email/components'
import { EmailLayout, inlineLink, paragraph } from './email-layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailLayout
    preview={`Você recebeu um convite para a ${siteName}`}
    eyebrow="Convite"
    title="Sua rota começa agora"
    action={{ label: 'Aceitar convite', href: confirmationUrl }}
    footer="Se você não esperava este convite, pode ignorar este e-mail com segurança."
  >
    <Text style={paragraph}>
      Você recebeu um convite para entrar na{' '}
      <Link href={siteUrl} style={inlineLink}><strong>{siteName}</strong></Link>.
      Aceite para criar sua conta e descobrir os próximos passos da sua carreira.
    </Text>
  </EmailLayout>
)

export default InviteEmail

