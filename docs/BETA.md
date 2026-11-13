# Beta jogável 0.3

## Jornada de teste
1. Mestre cria a sala e salva o link de convite.
2. Dois jogadores entram com navegadores diferentes.
3. Cada jogador abre «Minha ficha», atribui nome/classe/atributos e escolhe retrato.
4. Mestre envia mapa (JPG/PNG/WebP, compactação automática).
5. Todos movem tokens e verificam sincronização.
6. Conversa e dados aparecem para todos.
7. Atualize os navegadores: ficha, mapa, posições e últimas 120 mensagens devem persistir.

## Limitações e segurança
- Sem autenticação por conta, o convite é o controle de ingresso. Guarde convites em privado.
- Retratos/mapas ficam dentro do armazenamento SQLite da sala, com limites de 900 KB/1,7 MB por arquivo, 18 MB total e 30 arquivos.
- Não há mecanismo de exclusão de jogador, expulsão ou recuperação de token de sessão.
- Há throttle por membro em chat/rolagens/movimentos, mas ainda não há limite por IP de criação de salas.
- Beta experimental; não carregar conteúdo sensível ou confidencial.
- `deploy/worker.mjs` contém UI e Worker compilados em módulo único, para deploy via API sem build/npm. Fontes autorais em `src/`.
