import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import logoAsset from '@/assets/pathly-email-logo.png.asset.json'

const LOGO_URL = `https://pathlyapp.app${logoAsset.url}`

interface EmailLayoutProps {
  preview: string
  eyebrow: string
  title: string
  children: React.ReactNode
  action?: { label: string; href: string }
  footer: string
}

export function EmailLayout({
  preview,
  eyebrow,
  title,
  children,
  action,
  footer,
}: EmailLayoutProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandRow}>
            <Img src={LOGO_URL} width="44" height="44" alt="Pathly" style={brandMark} />
            <Text style={brand}>Pathly</Text>
          </Section>
          <Section style={hero}>
            <Text style={eyebrowStyle}>{eyebrow}</Text>
            <Heading style={heading}>{title}</Heading>
            <Section style={content}>{children}</Section>
            {action ? (
              <Button style={button} href={action.href}>
                {action.label} &nbsp;→
              </Button>
            ) : null}
          </Section>
          <Section style={footerSection}>
            <Text style={footerStyle}>{footer}</Text>
            <Hr style={divider} />
            <Text style={tagline}>Aprenda o que realmente importa para ganhar mais.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const paragraph = {
  color: '#b9c6d6',
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 18px',
}

export const inlineLink = {
  color: '#5ce6cb',
  textDecoration: 'underline',
}

export const code = {
  backgroundColor: '#e8faf5',
  border: '1px solid #b8eadc',
  borderRadius: '8px',
  color: '#063f38',
  fontFamily: 'Courier, monospace',
  fontSize: '30px',
  fontWeight: '700' as const,
  letterSpacing: '6px',
  margin: '8px 0 24px',
  padding: '18px 20px',
  textAlign: 'center' as const,
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  margin: '0',
  padding: '32px 12px',
}

const container = {
  backgroundColor: '#101925',
  border: '1px solid #263647',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  overflow: 'hidden',
  padding: '0',
}

const brandRow = {
  backgroundColor: '#0b121c',
  borderBottom: '1px solid #263647',
  margin: '0',
  padding: '22px 38px',
}

const brandMark = {
  display: 'inline-block',
  margin: '0 12px 0 0',
  verticalAlign: 'middle',
}

const brand = {
  color: '#f4f8fb',
  display: 'inline-block',
  fontSize: '21px',
  fontWeight: '700' as const,
  margin: '0',
  verticalAlign: 'middle',
}

const hero = { padding: '38px 40px 34px' }

const eyebrowStyle = {
  color: '#5ce6cb',
  fontSize: '12px',
  fontWeight: '700' as const,
  letterSpacing: '1px',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
}

const heading = {
  color: '#f4f8fb',
  fontSize: '30px',
  fontWeight: '700' as const,
  lineHeight: '38px',
  margin: '0 0 20px',
}

const content = { margin: '0' }

const button = {
  backgroundColor: '#32d6b6',
  borderRadius: '7px',
  color: '#09231e',
  fontSize: '15px',
  fontWeight: '700' as const,
  margin: '8px 0 10px',
  padding: '14px 22px',
  textDecoration: 'none',
}

const footerSection = {
  backgroundColor: '#0b121c',
  borderTop: '1px solid #263647',
  padding: '23px 40px 26px',
}

const divider = { borderColor: '#263647', margin: '18px 0' }

const footerStyle = {
  color: '#8292a6',
  fontSize: '12px',
  lineHeight: '19px',
  margin: '0 0 12px',
}

const tagline = {
  color: '#5ce6cb',
  fontSize: '12px',
  fontWeight: '700' as const,
  margin: '0',
}