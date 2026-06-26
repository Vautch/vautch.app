# Changelog

Histórico de mudanças do Vautch. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Datas em UTC-3 (horário de Brasília).

## [Não lançado]

## 2026-06-26 — v0.1.4 · relembre navegável, pílula, facade IG e efeito React (pendente de review/deploy)

Rodada das "Pendências da rodada 2026-06-26". Verificado localmente (app real via
bypass DEV + `node --check` + `tsc --noEmit` + `next build`). Ver [ADR 0006](docs/decisions/0006-rodada-relembre-facade-r3f.md) e [ROADMAP](ROADMAP.md).

### ✨ Novidades
- **"Bem-vindo de volta" virou pílula** — uma pílula **opaca** (creme no escuro,
  escura no claro) com **"Visualizar"** (mostra na timeline só o que você guardou
  desde a última visita) e um **×** pra fechar. Virou também um filtro de período
  **"última visita"**.
- **Relembre mostra a nota** — nas miniaturas do relembre, notas sem imagem exibem
  o próprio texto (com reticências) em vez de um ícone.
- **Relembre que carrega aos poucos** — abre com 5 e revela +5 conforme você
  arrasta, até 20 (não despeja tudo de uma vez).
- **Navegar no card maximizado** — ao abrir um item do relembre, dá pra passar
  pelos vizinhos (que **espiam esmaecidos** nas bordas) **arrastando em qualquer
  lugar da tela, pelas setas ←/→ ou pela roda do mouse** — sem sair do maximizado.
  E agora ele **abre sempre cheio**, mesmo com a timeline no modo compacto.
- **Relembre dos "esquecidos" de verdade** — não é mais aleatório: ele puxa o que
  você **menos viu / faz mais tempo**. O app passou a registrar (no seu device) o
  que você abriu, maximizou, expandiu ou ficou olhando por mais de 1 min.
- **Efeito de partículas nos favoritos** — um campo **denso de quadradinhos
  terracota nítidos** acendendo e apagando numa onda, **no fundo** do card
  (tag, embed, ícones e texto ficam por cima), **abraçando** o topo e as laterais.
  Cada favorito é independente; só anima os que estão **na tela** e desliga sozinho
  quando não há nenhum. Tem **painel de ajuste** (densidade, opacidade, intensidade,
  velocidade, onda, zona, laterais, blur e **cor**) com **ajustes separados para
  modo escuro e claro**. Também aparece no card maximizado.
- **Ícones do topo do card** ganham fundo circular nos favoritos (não somem mais
  sobre as partículas).

### ⏳ Pendências
- **Instagram "link broken"** (B7) segue em aberto — a tentativa de pôster/facade
  foi revertida (aplicava em todo post IG e não dá pra detectar a falha cross-origin).
- Migrar imagens (base64 → Supabase Storage); reorganização visual ampla dos
  filtros; tracking de "esquecidos" cross-device; SMTP (Resend); vídeo no Safari.

## 2026-06-25 — v0.1.3 · estabilização + performance + features (pendente de review/deploy)

Fase 1 inteira + Fase 2 (paginação) + Fase 3 (lembrete/carrossel/favoritos).
Verificado localmente (harness estático + testes de lógica + `next build`). Ver [ADR 0005](docs/decisions/0005-fase1-estabilizacao-perf.md) e [ROADMAP](ROADMAP.md).

### 🐛 Correções
- **Datas reais** — os cards mostravam "guardado agora mesmo" sempre. Agora exibem
  data relativa de verdade (agora / há X min / há X h / ontem / há X dias / data),
  vinda do `created_at` do servidor (e do momento do save em itens novos).
- **Ordem dos cards estável** — não embaralha mais após sincronizar/importar. A
  timeline tem ordem canônica (mais novo primeiro, com desempate fixo) e o
  arrastar-pra-reordenar finalmente é respeitado ao recarregar.
- **Scroll não pula mais pro topo** ao expandir/compactar um card no modo compacto.
- **Reticências no modo compacto** — passar o mouse mostra o texto completo (tooltip)
  e editar o título não fica mais "às cegas" dentro da linha cortada.
- **Links patrocinados (boost)** — limpeza de parâmetros refeita: remove o lixo de
  anúncio que quebrava o player (principalmente do Facebook) preservando o que é
  funcional; links comuns (com `?id=`) não são mais mutilados. Quando o embed não dá,
  aparece a prévia + "abrir original".
- **Embed do Instagram (reels)** — o embed agora usa o link que você colou (`/reel/`)
  em vez da forma `/p/` que o Microlink às vezes devolve (embed de reel via `/p/` o
  Instagram rejeita). Itens antigos se autocorrigem ao recarregar (migração já regenera
  embeds IG a partir do link salvo).

### ⚡ Performance
- **Skeleton loading** — placeholders animados enquanto o feed carrega.
- **Scroll infinito** — o feed carrega 10 itens e busca mais conforme você rola, em
  vez de despejar 50+ de uma vez. Preparado para contas grandes.
- **Guard da lixeira** — salvar um item com a lixeira aberta não quebra mais a tela
  (revisão adversarial pegou; agora volta pro feed normal e salva direito).

### ✨ Novidades
- **Ícones novos** (criados pelo Paulo) nos botões da barra — relembre, compacto,
  timeline, filtro e lixeira — coloridos pela cor do texto de cada tema (lixeira em vermelho).
- **Botão de prioridade (★)** na barra — filtra mostrando só os cards favoritados.
- **Favorito em terracota** (era dourado): estrela terracota + degradê terracota
  descendo do topo do card e sumindo no centro (a zona onde o efeito React vai morar).
- **Bem-vindo de volta** — bloco no topo com o que você guardou desde a última visita.
- **Relembre** — carrossel de itens aleatórios, aberto por um botão na barra (antes
  do compacto). Arrasta com o dedo/mouse (sem scrollbar) e, ao tocar num card, ele
  **abre maximizado dentro do app** (sem ir pro link externo).
- **Favoritos (★)** — destaque um card; ele ganha um anel dourado e sobe pro topo.
- **Botão × de limpar** no campo de busca/escrita e no editor de nota.

### ⏳ Pendências
- Migrar imagens (base64 → Supabase Storage) — ganho de rede, próximo passo focado.
- Efeito React Three Fiber nos favoritos (camada de canvas dedicada).
- SMTP customizado (Resend); compatibilidade de vídeo no Safari.

## 2026-06-24 (parte 2) — v0.1.2 · hardening + Google OAuth + e-mail

### 🔒 Segurança
- **Fix de XSS armazenado:** escape de output em título, descrição, URL, imagem
  (metadados de scraping) e nomes de tag/subtag — no feed, lixeira e menus.
  As notas já eram escapadas. Defesa canônica (escape no output).
- Pentest manual confirmou: isolamento por usuário (RLS), token de sessão
  inacessível por JS (httpOnly), e chave pública bloqueada no acesso direto.

### 🔵 Login com Google (OAuth)
- Provider Google configurado (Google Cloud + Supabase) e botão ativado.
- Login social cria a conta na 1ª vez (padrão da indústria) e dispensa
  confirmação de e-mail (o Google já verificou a posse do e-mail).

### ✨ Polimento
- **E-mail "Confirm signup" branded** (logo PNG, sem copyright, card
  centralizado/responsivo, `alt` de fallback) — em `docs/email-templates/`.
- **Anti-flash:** o rodapé "fim do arquivo" só aparece após carregar os dados
  (sem flash de estado errado em conta vazia).
- Callback de auth com mensagem amigável quando o link é aberto em outro
  dispositivo (confirmação cross-device).

### ⏳ Pendências (não bloqueiam)
- Custom SMTP (Resend/SendGrid) para entrega de e-mail em produção.
- Branding da tela de consentimento do Google (app name + logo / custom domain).
- Cross-device auto-login via `token_hash`.

## 2026-06-24 — Fase 0: backend de produção (auth + feed no Supabase)

### ✨ Autenticação
- **Tela de login** (`/login`) no design Vautch (claro/escuro, switch igual ao do app),
  com e-mail/senha, confirmar senha no signup e link "esqueci minha senha".
- **Signup + confirmação de e-mail obrigatória**; **reset de senha**
  (`/forgot` → e-mail → `/reset-password`) com mensagem anti-enumeração.
- **Sessão em cookie httpOnly** (`@supabase/ssr`), endurecida em `cookie-options.ts`
  (httpOnly + Secure + SameSite=Lax) — corrigida a falha do scaffold padrão que
  deixava o token de sessão legível por JavaScript.
- **Middleware** protege rotas privadas; `/` redireciona pra `/app`; assets
  estáticos (`/proto`, `/assets`) liberados. Logout limpa cookie + cache local.

### 🗄️ Banco de dados (Supabase Postgres)
- Schema inicial (`supabase/migrations/0001_init.sql`): `profiles` + `items`
  (design **jsonb** — item completo em `data`, `created_at` real, `deleted_at`
  p/ lixeira, PK composta `(user_id, id)`).
- **RLS default-deny** em tudo (`auth.uid() = user_id`); GRANTs explícitos
  (`authenticated` CRUD, `anon` bloqueado); trigger de profile no signup;
  bucket privado `media`.

### 🔗 Feed conectado ao Supabase
- API `/api/items` (GET lista, PUT reconcilia estado completo) — auth server-side + RLS.
- Ponte de sync no bundle: carrega do servidor no init, sincroniza nas escritas
  (debounce 800ms), trava anti-perda de dados, limpa cache no logout.
- **Isolamento por usuário provado** (2 contas): B não vê dados do A.
- Resiliência: item sem `cat` não derruba mais o feed (default "geral").

### 📦 Migração de dados
- Botões **exportar/importar JSON** no menu; o import sobe pro Supabase antes
  do reload (preserva os dados na migração).

### ⏳ Pendências
- Google OAuth (botão pronto, escondido via `GOOGLE_ENABLED` até configurar o provider).
- Migração do export real; sync multi-aba/device.

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
