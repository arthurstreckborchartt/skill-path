import { CornerDownLeft, Loader2 } from "lucide-react";
import { PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/**
 * O botão de enviar do compositor, com a troca entre a seta e o círculo de carregando.
 *
 * ## Por que não bastou o `status` do `PromptInputSubmit`
 *
 * Ele já troca o ícone sozinho — `submitted` vira `Spinner` — mas a troca é um corte: um ícone
 * some e o outro aparece no mesmo quadro. Num botão de 16px, corte seco parece falha de
 * renderização, não resposta ao clique. A pessoa acabou de mandar a mensagem e precisa ver que o
 * clique foi recebido; é a única confirmação que existe antes de a resposta chegar.
 *
 * Então o `status` continua indo (ele é quem muda `aria-label` e o comportamento do botão), e o
 * desenho vem de `children` — que o componente usa no lugar do ícone dele quando existe.
 *
 * ## Como os dois ícones ficam no mesmo lugar
 *
 * `grid` com os dois na célula 1/1, em vez de `position: absolute`. Absoluto exigiria altura fixa
 * no pai para não colapsar, e essa altura seria um terceiro número para discordar do tamanho dos
 * ícones. Na grade o pai mede o maior dos dois, que é o que se quer.
 *
 * ## Por que escala, e não só opacidade
 *
 * Só com opacidade a troca lê como falha de carregamento — os dois ícones aparecem meio
 * transparentes no meio do caminho e por um instante é um borrão. Encolhendo quem sai e crescendo
 * quem entra, o olho lê substituição. O giro de -90° no círculo entra pelo mesmo motivo: ele já
 * chega girando, então o `animate-spin` não parece começar do nada.
 *
 * ## `aria-label` em português
 *
 * O componente de origem rotula "Submit" e, quando está gerando, "Stop" — e "Stop" é mentira
 * aqui: não passamos `onStop`, e o botão está desabilitado nesse estado. Quem usa leitor de tela
 * ouviria a oferta de uma ação que não existe.
 */
export function BotaoEnviar({
  carregando,
  desabilitado,
}: {
  carregando: boolean;
  desabilitado: boolean;
}) {
  return (
    <PromptInputSubmit
      status={carregando ? "submitted" : "ready"}
      disabled={desabilitado}
      aria-label={carregando ? "Gerando a resposta" : "Enviar mensagem"}
    >
      <span className="grid size-4 place-items-center">
        <CornerDownLeft
          aria-hidden
          className={cn(
            "botao-enviar-troca col-start-1 row-start-1 size-4 ease-out",
            "transition-[opacity,scale,rotate] duration-300",
            carregando ? "scale-50 opacity-0" : "scale-100 opacity-100",
          )}
        />
        {/*
          Dois elementos, e não um, porque `animate-spin` e a escala disputam a mesma propriedade.
          O keyframe do giro escreve `transform: rotate(...)` a cada quadro e sobrescreve o
          `scale-50` da classe — o círculo entraria sem encolher, e só a opacidade faria a troca.
          O invólucro fica com a transição; o ícone, só com o giro.
        */}
        <span
          className={cn(
            "botao-enviar-troca col-start-1 row-start-1 ease-out",
            /*
             * `scale` e `rotate`, e não `transform`.
             *
             * O Tailwind v4 escreve `scale-50` e `-rotate-90` nas propriedades independentes
             * `scale` e `rotate`, não em `transform` — medido na tela: `transform` fica `none`
             * enquanto `scale` vale `0.5`. Com `transition-[opacity,transform]`, que foi a
             * primeira tentativa, só a opacidade animava e o tamanho saltava.
             */
            "transition-[opacity,scale,rotate] duration-300",
            carregando ? "scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        >
          {/*
            `botao-enviar-girando` não estiliza nada: é a âncora que a exceção de
            `prefers-reduced-motion`, em `styles.css`, usa para devolver o giro. Sem ela o círculo
            aparece parado — e um círculo de carregando parado diz que travou.
          */}
          <Loader2 aria-hidden className="botao-enviar-girando size-4 animate-spin" />
        </span>
      </span>
    </PromptInputSubmit>
  );
}
