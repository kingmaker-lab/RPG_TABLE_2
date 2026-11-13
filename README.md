# 🐉 Arcane Table | The Workshop

**Versão de estrutura 0.2**. Um MVP de mesa virtual de RPG pelo navegador, **sem 3D**. Até **1 mestre + 8 jogadores** por sala. O primeiro protótipo local do criador de fichas foi preservado em `legacy/criador-v01.html`.

## Incluído nesta versão

- Criar salas privadas por **link de convite** (quem tem o link pode tentar ingressar).
- Identidade de mestre e jogadores com tokens de sessão por navegador.
- Chat de texto sincronizado por WebSocket; resultados de dados gerados pelo servidor (d4, d6, d8, d10, d12, d20).
- Ficha básica com espécie, classe, nível, atributos, PV, CA, história e **foto enviada pelo jogador**.
- Mapa 2D, upload de imagem pelo mestre, token circular com a foto, arrastar/soltar, ou clicar para mover o próprio token.
- Estado da sala, posição dos tokens, fichas e últimas 120 mensagens persistidos via Durable Objects (SQLite).
- Imagens persistidas em bucket privado R2 e servidas mediante autorização do participante.
- UI responsiva para desktop e celular, usando HTML/CSS/TypeScript. Não há modelos 3D.

## Organização

```text
arcane-table-v02/
├── index.html               # UI das salas, mesa e editor de ficha
├── src/
│   ├── client/
│   │   ├── main.ts          # Frontend: conexão, ficha, chat, mapa 2D
│   │   └── styles.css       # Tema visual
│   └── server/
│       └── index.ts         # Worker e classe GameRoom (Durable Object)
├── cloudflare.config.ts     # Deploy com cf (CLI beta)
├── vite.config.ts           # Servidor de desenvolvimento/bundler
├── docs/
│   ├── ARQUITETURA.md       # Diagramas, limites, segurança e roadmap
│   └── API.md               # Protocolo HTTP e WebSocket
├── legacy/criador-v01.html  # Criador standalone anterior
├── package.json
└── tsconfig.json
```

## Como executar

> **Pré-requisitos:** Node.js 22.18+ e npm; `cf` (Cloudflare CLI) requer esta versão mínima. A CLI `cf` e `cloudflare.config.ts` ainda são beta.

No terminal:

```bash
cd arcane-table-v02
npm install
npm run dev
```

O comando `cf dev` aciona o Vite/Cloudflare plugin. Abra a URL local informada no terminal e use duas abas ou navegadores para criar e entrar na mesma sala. O backend deve funcionar **localmente com simulação de Durable Object e R2**, sem publicar. A configuração do CLI pode exigir ajustes quando houver mudanças no beta.

Para construir e publicar na conta Cloudflare:

```bash
npm run check
npm run build
npx cf auth login
npm run deploy
```

O bucket R2 `arcane-table-media` precisa existir na conta e estar vinculado. Consulte `cf cli search "create r2 bucket"` para obter o comando atualizado de provisionamento. Nenhum bucket foi criado nem Worker publicado por este pacote.

## Segurança e limitações deliberadas

- **Somente protótipo para testes fechados.** Sem cadastro permanente, banimento, revalidação de sessão ou revogação de token. O segredo de sessão é salvo no `localStorage` do navegador. Use HTTPS em produção.
- Quem obtiver o link da sala pode ingressar como jogador até o limite. Em produção adicionar convite individual, autorização persistente e controle de participantes pelo mestre.
- O servidor verifica permissões: apenas mestre altera mapa; jogadores alteram somente sua ficha e seu token; mestre pode arrastar tokens dos outros.
- Upload limitado a formatos PNG/JPEG/WebP e 5 MB para retratos, 10 MB para mapas. O backend verifica assinatura básica do formato e guarda os arquivos em R2 privado. Para abrir a plataforma ao público adicionar processamento/re-encoding de imagens, dimensionamento e política de conteúdo.
- Sem rate limiting por IP ou por sessão ainda. Antes de expor publicamente adicionar limitação de chat, entradas, upload e criação de salas, métricas e logs com anonimização.
- O chat retém **somente 120 mensagens** por sala. Não há backup/exportação automática nesta versão.
- **Não há suporte oficial completo de regras D&D 5e**: atributos e rolagens são genéricos; não incluímos conteúdo proprietário de livros oficiais.
- Fichas ficam vinculadas à **sala e à sessão local**, ainda não são uma biblioteca de personagens reutilizáveis entre campanhas.

## Status de validação desta entrega

Os arquivos foram organizados e a **sintaxe** TypeScript foi verificada por transpiração local. Neste ambiente o registro npm estava inacessível e o Node instalado era 22.16.0, abaixo do mínimo de `cf`. Por isso **não foi possível instalar dependências, fazer o build oficial nem testar o multiplayer end-to-end**. O funcionamento de produção ainda deve ser validado em um ambiente com as dependências e bindings configurados.

## Próximo passo

Testar duas conexões simultâneas, upload e movimentação; depois adicionar controle de entrada pelo mestre, névoa de guerra e um inventário leve, mantendo o sistema leve.
