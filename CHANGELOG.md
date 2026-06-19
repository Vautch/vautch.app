# Changelog

Histórico de mudanças do Vautch. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Datas em UTC-3 (horário de Brasília).

## [Não lançado]

## 2026-06-19

### ✨ Novidades
- **Marcar como visto** — botão de olho em cada card. Ao marcar, o card fica mais
  discreto (opacidade reduzida, com transição suave) e aparece um balão
  "Marcado como visto". Clicar de novo desfaz.
- **Arrastar pra reorganizar** — agora dá pra pegar o card e arrastar pra onde
  quiser. Os outros cards se reorganizam com animação fluida e o card "encaixa"
  no lugar mais próximo ao soltar.
- **Modo compacto** — visualização enxuta da lista, com mini-thumbnail. Clique
  duas vezes (ou toque, no celular) pra expandir um card.
- **Dicas contextuais** — balõezinhos que saem do próprio botão clicado,
  ensinando a expandir e arrastar. Texto específico pra desktop ("clique duas
  vezes / arraste") e celular ("toque / segure o dedo").
- **App no ar** — protótipo rodando em produção (Next.js + Vercel) com 100% de
  fidelidade visual ao original.

### 🐛 Correções
- **Tema sem flash** — acabou o "pisca" de tela clara → escura ao dar refresh.
  O tema salvo é aplicado antes da página pintar; primeiro acesso entra em claro.
- **Erro de console eliminado** — o aviso do React/Next sobre `<script>` no tema
  foi resolvido (migrado para `next/script`).
- **Drag não some mais o card** — a animação ficou visível e fluida do começo ao fim.
- **Tooltips e menus inteligentes** — sempre ficam dentro da tela; se não cabem,
  são empurrados pra caber e a setinha se reposiciona pra continuar apontando o botão.
- **Menu de tag no celular** — volta a subir acima do teclado pra não ser coberto.
- **Menu de tag** — não estoura mais a largura da tela; "categoria" virou "tag"
  (consistente com "subtag").
- **"não mostrar dicas"** — texto agora legível no modo escuro.
- **Lote inicial de bugs** — estado vazio na primeira abertura, filtro no modo
  compacto, sobreposição de camadas (z-index), editor de nota, conteúdo privado
  do Facebook e altura de threads.
