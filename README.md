# 🐉 Arcane Table | The Workshop

**Beta jogável 0.3**. Um MVP de mesa virtual de RPG pelo navegador, **sem 3D**. Até **1 mestre + 8 jogadores** por sala. O primeiro protótipo local do criador de fichas foi preservado em `legacy/criador-v01.html`.

## Incluído nesta versão

- Criar salas privadas por **link de convite** (quem tem o link pode tentar ingressar).
- Identidade de mestre e jogadores com tokens de sessão por navegador.
- Chat de texto sincronizado por WebSocket; resultados de dados gerados pelo servidor (d4, d6, d8, d10, d12, d20).
- Ficha básica com espécie, classe, nível, atributos, PV, CA, história e **foto enviada pelo jogador**.
- Mapa 2D, upload de imagem pelo mestre, token circular com a foto, arrastar/soltar, ou clicar para mover o próprio token.
- Estado da sala, posição dos tokens, fichas e últimas 120 mensagens persistidos via Durable Objects (SQLite).
- Retratos e mapas compactados no navegador e persistidos no SQLite da sala (Durable Objects), com acesso autenticado; não depende de R2.
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

O beta dispensa R2. O deployment via API pode usar `deploy/worker.mjs` em um único módulo com os assets inline, juntamente com a binding ROOMS para GameRoom. Deploy adicional via `cf` requer configuração e teste.

## Segurança e limitações deliberadas

- **Beta para testes fechados.** Sem cadastro permanente, banimento, revalidação de sessão ou revogação de token. O segredo de sessão é salvo no `localStorage` do navegador. Use HTTPS em produção.
- Quem obtiver o link da sala pode ingressar como jogador até o limite. Em produção adicionar convite individual, autorização persistente e controle de participantes pelo mestre.
- O servidor verifica permissões: apenas mestre altera mapa; jogadores alteram somente sua ficha e seu token; mestre pode arrastar tokens dos outros.
- Upload limitado a PNG/JPEG/WebP; o navegador converte em JPEG, com até 900 KB para retratos e 1,7 MB para mapas após otimização. Cada sala comporta até 18 MB e 30 mídias. O backend verifica assinatura básica do formato e guarda o arquivo no SQLite privado do Durable Object. Para abrir a plataforma ao público adicionar processamento/re-encoding de imagens, dimensionamento e política de conteúdo.
- Existe limitação inicial de frequência por sessão WebSocket para chat, dados e movimento; ainda não há rate limiting por IP para criação de salas. Antes de expor publicamente adicionar limitação de chat, entradas, upload e criação de salas, métricas e logs com anonimização.
- O chat retém **somente 120 mensagens** por sala. Não há backup/exportação automática nesta versão.
- **Não há suporte oficial completo de regras D&D 5e**: atributos e rolagens são genéricos; não incluímos conteúdo proprietário de livros oficiais.
- Fichas ficam vinculadas à **sala e à sessão local**, ainda não são uma biblioteca de personagens reutilizáveis entre campanhas.

## Status de validação desta entrega

Os arquivos TypeScript foram transpilados pelo TypeScript 5.8 local e o bundle `deploy/worker.mjs` passou no `node --check`. A publicação via API e os testes HTTP serão registrados separadamente. A instalação npm completa e o build oficial do CLI `cf` não foram executados neste ambiente.

## Próximo passo

Testar duas conexões simultâneas, upload e movimentação; depois adicionar controle de entrada pelo mestre, névoa de guerra e um inventário leve, mantendo o sistema leve.


## Beta 0.3: disponibilidade

- **Entrar**: abrir o site, criar sala, copiar convite, compartilhar.
- **Jogadores**: abrir o convite em outro navegador ou janela privativa, entrar com nome, abrir «Minha ficha» e carregar foto.
- **Mestre**: pode carregar mapa, arrastar os tokens e narrar no chat.
- **Dados**: d4, d6, d8, d10, d12, d20 no chat, calculados pelo servidor.
- **Limites**: 1 mestre + 8 jogadores; sala vinculada ao navegador; sem lobby global/contas; não compartilhar links de salas públicas.
- **Imagens**: otimização automática, até 30 arquivos e 18 MB armazenados em cada sala. Não há limpeza automática nem botão de excluir nesta versão.
- **Privacidade**: chaves de sessão são salvas no `localStorage`, não em cookies; revogação e gestão de jogadores ficam para a próxima versão.
