import * as React from "react";

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
} from "@react-email/components";
import logoAsset from "@/assets/pathly-email-logo.png.asset.json";

const LOGO_URL = `https://pathlyapp.app${logoAsset.url}`;

interface EmailLayoutProps {
  preview: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
  footer: string;
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
            <Img src={LOGO_URL} width="42" height="42" alt="Pathly" style={brandMark} />
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
  );
}

export const paragraph = {
  color: "#53605c",
  fontFamily: "Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 18px",
};

export const inlineLink = {
  color: "#147d64",
  textDecoration: "underline",
};

export const code = {
  backgroundColor: "#edf6f1",
  border: "1px solid #b9e7d3",
  borderRadius: "8px",
  color: "#111816",
  fontFamily: "Courier, monospace",
  fontSize: "30px",
  fontWeight: "700" as const,
  letterSpacing: "6px",
  margin: "8px 0 24px",
  padding: "18px 20px",
  textAlign: "center" as const,
};

const main = {
  backgroundColor: "#f6f8f7",
  fontFamily: "Arial, sans-serif",
  margin: "0",
  padding: "32px 12px",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #d9e2de",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "36px 40px 30px",
};

const brandRow = { margin: "0 0 40px" };

const brandMark = {
  display: "inline-block",
  margin: "0 10px 0 0",
  verticalAlign: "middle",
};

const brand = {
  color: "#111816",
  display: "inline-block",
  fontSize: "19px",
  fontWeight: "700" as const,
  margin: "0",
  verticalAlign: "middle",
};

const eyebrowStyle = {
  color: "#147d64",
  fontSize: "12px",
  fontWeight: "700" as const,
  letterSpacing: "1px",
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
};

const heading = {
  color: "#111816",
  fontSize: "30px",
  fontWeight: "700" as const,
  lineHeight: "38px",
  margin: "0 0 20px",
};

const content = { margin: "0" };

const button = {
  backgroundColor: "#147d64",
  borderRadius: "7px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700" as const,
  margin: "8px 0 10px",
  padding: "13px 22px",
  textDecoration: "none",
};

const divider = { borderColor: "#d9e2de", margin: "30px 0 20px" };

const footerStyle = {
  color: "#718096",
  fontSize: "12px",
  lineHeight: "19px",
  margin: "0 0 12px",
};

const tagline = {
  color: "#147d64",
  fontSize: "12px",
  fontWeight: "700" as const,
  margin: "0",
};
