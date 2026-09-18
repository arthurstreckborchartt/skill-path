import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pathly.theme.v1";

/** Cor da barra do navegador no celular — precisa bater com `--background` de cada tema. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#fafafa",
  dark: "#202020",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Roda no <head>, antes da primeira pintura, para o tema certo já valer no primeiro quadro.
 * Sem isso o app pinta claro e pisca para escuro depois da hidratação.
 *
 * Mantenha em sincronia com `applyTheme` — é a mesma regra escrita duas vezes porque esta versão
 * precisa ser uma string sem imports, executável antes do bundle carregar.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var c=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';
var d=c==='dark'||(c!=='light'&&window.matchMedia('${DARK_QUERY}').matches);
var r=document.documentElement;
r.classList.toggle('dark',d);
r.style.colorScheme=d?'dark':'light';
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute('content',d?'${THEME_COLOR.dark}':'${THEME_COLOR.light}');
}catch(e){}})()`;

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

/**
 * Mantém o app colado no tema do sistema enquanto a preferência for "system". Fica montado no
 * root, não na tela de Configurações: a troca de tema no aparelho tem que pegar em qualquer
 * página aberta, não só onde existe o seletor.
 */
export function useSystemThemeSync() {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => {
      if (readThemeChoice() !== "system") return;
      applyTheme(media.matches ? "dark" : "light");
    };

    media.addEventListener("change", sync);
    // No celular a troca de tema acontece fora do navegador, nos Ajustes do aparelho: ao voltar
    // para a aba, reconfere em vez de confiar só no evento, que nem sempre chega em segundo plano.
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);

    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
}

/**
 * Preferência de tema. Guardada só no `localStorage`: não existe tabela de perfil no Supabase e
 * criar uma só para isto seria migração desnecessária — a escolha é por aparelho, como no
 * sistema operacional.
 */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = readThemeChoice();
    setChoiceState(stored);
    setResolved(resolveTheme(stored));
  }, []);

  // Com "tema do sistema", trocar o tema do aparelho muda o app com a página aberta.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const next = media.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* navegação privada: o tema vale só nesta sessão */
    }
    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyTheme(nextResolved);
  }, []);

  return { choice, resolved, setChoice };
}
