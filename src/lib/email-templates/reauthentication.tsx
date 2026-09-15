import * as React from 'react'

import { Text } from '@react-email/components'
import { code, EmailLayout, paragraph } from './email-layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailLayout
    preview="Seu código de verificação da Pathly"
    eyebrow="Verificação de segurança"
    title="Confirme que é você"
    footer="Este código expira em breve. Se você não solicitou a verificação, ignore este e-mail."
  >
    <Text style={paragraph}>Use o código abaixo para confirmar sua identidade:</Text>
    <Text style={code}>{token}</Text>
  </EmailLayout>
)

export default ReauthenticationEmail

