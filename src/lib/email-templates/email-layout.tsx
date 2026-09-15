import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

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
            <Text style={brandMark}>P</Text>
            <Text style={brand}>Pathly</Text>
          </Section>
          <Text style={eyebrowStyle}>{eyebrow}</Text>
          <Heading style={heading}>{title}</Heading>
          <Section style={content}>{children}</Section>
          {action ? (
            <Button style={button} href={action.href}>
              {action.label}
            </Button>
          ) : null}
          <Hr style={divider} />
          <Text style={footerStyle}>{footer}</Text>
          <Text style={tagline}>Aprenda o que realmente importa para ganhar mais.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const paragraph = {
  color: '#475569',
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 18px',
}

export const inlineLink = {
  color: '#087f6f',
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
  backgroundColor: '#ffffff',
  border: '1px solid #dce5e3',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '36px 40px 30px',
}

const brandRow = { margin: '0 0 40px' }

const brandMark = {
  backgroundColor: '#16d3ad',
  borderRadius: '6px',
  color: '#073b34',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '700' as const,
  lineHeight: '30px',
  margin: '0 10px 0 0',
  textAlign: 'center' as const,
  width: '30px',
}

const brand = {
  color: '#101b2a',
  display: 'inline-block',
  fontSize: '19px',
  fontWeight: '700' as const,
  margin: '0',
  verticalAlign: 'middle',
}

const eyebrowStyle = {
  color: '#087f6f',
  fontSize: '12px',
  fontWeight: '700' as const,
  letterSpacing: '1px',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
}

const heading = {
  color: '#101b2a',
  fontSize: '30px',
  fontWeight: '700' as const,
  lineHeight: '38px',
  margin: '0 0 20px',
}

const content = { margin: '0' }

const button = {
  backgroundColor: '#0f9f87',
  borderRadius: '7px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700' as const,
  margin: '8px 0 10px',
  padding: '13px 22px',
  textDecoration: 'none',
}

const divider = { borderColor: '#e5ecea', margin: '30px 0 20px' }

const footerStyle = {
  color: '#718096',
  fontSize: '12px',
  lineHeight: '19px',
  margin: '0 0 12px',
}

const tagline = {
  color: '#087f6f',
  fontSize: '12px',
  fontWeight: '700' as const,
  margin: '0',
}