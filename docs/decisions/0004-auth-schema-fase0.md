# ADR 0004 — Auth & Schema (Fase 0: backend de produção)

**Status:** Aceito · **Data:** 2026-06-24 · **Contexto:** Primeira conexão real do app ao Supabase — auth, schema, RLS e proteção de rotas. Construído sobre o scaffold da sessão de 19/06. Fonte da verdade de auth/schema; revisar a cada feature que toque login, sessão ou dados de usuário.

---

## 1. Roteamento
- `/login` — pública (tela de auth).
- `/app` — privada (timeline; port do protótipo via `proto-markup` + `/proto/bundle.js`).
- `/` — redireciona pra `/app` (o middleware joga pro `/login` se não houver sessão).
- `/auth/callback` — route handler que troca o `code` (confirmação de e-mail / OAuth / recuperação) por sessão.
- `/auth/signout` — route handler POST que encerra a sessão.
- `/forgot` — pública; envia e-mail de recuperação (resposta anti-enumeração: sempre "enviado").
- `/reset-password` — privada (exige a sessão de recuperação do link); define a nova senha via `updateUser`.

## 2. Schema de `items` — design `jsonb` (revisado na Etapa 4)
**Histórico:** começou como colunas (`cat`/`subcat`/`title`… text). Ao conectar o feed, o item real do bundle revelou: `id` é **texto** (`v<ts>`, não UUID), há campos sem coluna (`stats`, `author`, `isPrivate`), e `time` é só um rótulo (sem data real). Reverti pro design `jsonb` (sem dado real ainda → recriar foi barato):
```
items(user_id uuid, id text, data jsonb, deleted_at, created_at, updated_at, pk(user_id,id))
```
- `data` = item completo do bundle → **nunca perde campo**, mapeamento trivial, robusto p/ "salvar qualquer coisa" (shape evolui sem migração).
- PK composta `(user_id, id)` → sem colisão entre usuários; `id` é o id gerado pelo client.
- `created_at` real (default no banco) → **destrava o lembrete matinal** (a timeline passa a ter data de verdade).
- `deleted_at` separa timeline de lixeira. Filtragem/ordenação seguem **client-side** (como o bundle já faz).
- Migração canônica: `supabase/migrations/0001_init.sql`.

## 3. RLS default-deny + GRANTs explícitos
- RLS ligado em `profiles`, `items` e `storage.objects`. Política `auth.uid() = user_id` (ou `= id`) nas 4 operações. Usa `(select auth.uid())` (avaliação única — performático).
- **GRANTs explícitos:** este projeto NÃO concede privilégios automaticamente a tabelas criadas via SQL. Sem `grant ... to authenticated`, o usuário logado leva `permission denied`. Então: `authenticated` recebe CRUD; `anon` é revogado (fica 100% bloqueado, nem chega no RLS). RLS por cima limita às próprias linhas.
- Bucket `media` privado; arquivos em `{user_id}/...`; RLS por pasta.
- Trigger `handle_new_user` (`security definer set search_path = ''`) cria o `profile` no signup.

## 4. Sessão — cookie httpOnly forçado (endurecimento)
**Achado:** o `@supabase/ssr` por padrão NÃO marca o `sb-*-auth-token` como `httpOnly` (o client de browser deles lê o cookie) — viola o ADR 0002 e expõe o token a XSS.
**Decisão:** como toda autenticação no Vautch passa pelo **servidor** (server actions, route handlers, middleware), forçamos `httpOnly` em `hardenCookie()` (`src/core/db/supabase/cookie-options.ts`), aplicado no `setAll` de `server.ts` e `middleware.ts`. Resultado verificado: `document.cookie` não expõe o token; a sessão continua funcionando. `secure` só em produção (no localhost http, `secure:true` impediria o cookie). `SameSite=Lax`.
**Consequência:** não usar o client de browser do Supabase para LER sessão/dados — leitura de dados é server-side (mais seguro). O client de browser só inicia OAuth (`signInWithOAuth`), que não lê sessão.

## 5. Middleware matcher — excluir estáticos
O matcher precisa excluir `/proto/`, `/assets/` e extensões de asset (`css/js/woff…`). Sem isso, o request do próprio CSS/JS sem sessão era redirecionado pro `/login` e a página pública quebrava (CSS retornava HTML).

## 6. Feed ↔ Supabase — ponte de sincronização (Etapa 4)
O bundle do protótipo é vanilla e **síncrono** (assume localStorage). Em vez de reescrever suas ~10 chamadas de persistência, uma ponte fina (`public/proto/bundle.js`) faz a sync↔async:
- **API própria** `/api/items` (`GET` lista, `PUT` reconcilia estado completo). Auth 100% server-side (cookie httpOnly) + RLS. O bundle nunca fala direto com o Supabase.
- **Load no init:** `loadFromServer()` busca os itens DESTE usuário → popula o cache (localStorage) → `buildFeed()`. Sem isso, o cache de outra conta no mesmo browser vazaria visualmente.
- **Sync nas escritas:** `localStorage.setItem` é interceptado; escrita em `vault.items`/`vault.trash` agenda um `PUT` (debounce 800ms).
- **Trava anti-perda (`_loadedOk`):** o sync só roda **após** um load bem-sucedido — senão a reconciliação full-state poderia apagar os itens do servidor num blip de rede.
- **Logout limpa o cache** (`vault.items`/`vault.trash`) — anti-vazamento entre contas no mesmo browser.
- **Isolamento provado** (2 contas no localhost): usuário B vê feed vazio; A mantém os seus. RLS garante no banco.

## 7. Pendências (não bloqueiam a Fase 0)
- **Google OAuth:** botão e callback prontos; só funciona após configurar Google Cloud Console + Supabase Auth providers.
- **Confirmação de e-mail:** desligada temporariamente para teste; **religar antes do launch** (system design exige obrigatória).
- **Import do JSON do protótipo:** o botão "importar" já injeta no cache; com a ponte de sync, o conteúdo sobe pro Supabase. Validar com o export real do Paulo.
- **Sync multi-aba/multi-device:** a reconciliação full-state assume um cliente por vez; refinar (merge por timestamp) quando houver uso simultâneo.
