import FallbackAvatar from "@/components/ui/fallback-avatar";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * O avatar da conta, gerado a partir do nome.
 *
 * Existe como componente próprio porque aparece em dois lugares — o cabeçalho do perfil e a aba
 * Perfil do menu inferior — e as duas coisas que o tornam legível são fáceis de esquecer numa
 * cópia:
 *
 * **O recorte é redondo.** O canvas do `FallbackAvatar` já vem circular, com um raio enorme
 * aplicado por ele. Num envoltório de canto quadrado sobra o fundo do envoltório nas quinas, em
 * volta do círculo — foi o que aconteceu na primeira versão, com `rounded-md` e `bg-foreground`:
 * quatro cantos claros ao redor do desenho.
 *
 * **As iniciais usam `mix-blend-difference` com branco.** O desenho varia de tom a cada nome, de
 * quase preto a quase branco, então nenhuma cor fixa serve para o texto por cima. Branco em
 * diferença devolve sempre o inverso do que estiver atrás — contraste máximo em qualquer desenho,
 * e também no caso em que o canvas não renderiza.
 */
export function AvatarConta({ size = 56, className }: { size?: number; className?: string }) {
  const { session } = useSession();
  const bruto = session?.user.user_metadata?.["full_name"];
  const nome = typeof bruto === "string" && bruto.trim() ? bruto : (session?.user.email ?? "conta");

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <FallbackAvatar name={nome} size={size} className="absolute inset-0" />
      {/*
        Abaixo de 32px a inicial não entra: a 20px ela sairia com 7px de altura, pequena demais
        para ler e grande o bastante para sujar o desenho. Nesse tamanho quem identifica é a forma,
        que é o ponto do avatar gerado.
      */}
      {size >= 32 && (
        <span
          className="relative font-display font-semibold text-white mix-blend-difference"
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {iniciais}
        </span>
      )}
    </span>
  );
}
