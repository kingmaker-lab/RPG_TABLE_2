# API e protocolo de mensagens

## HTTP

| Método | Rota | Autorização | Descrição |
|---|---|---|---|
| GET | `/api/health` | Não | Diagnóstico |
| POST | `/api/rooms` | Não | `{ name, host }` => `{ roomId, token, memberId }` |
| POST | `/api/rooms/:id/join` | Não | `{ name }` => token de jogador |
| GET | `/api/rooms/:id/state` | Bearer | Estado da mesa (snapshot) |
| GET | `/api/rooms/:id/ws` | Subprotocolo WebSocket | Conexão ao vivo |
| POST | `/api/rooms/:id/media?kind=portrait` | Bearer | Corpo binário de imagem => `{ mediaId }` |
| POST | `/api/rooms/:id/media?kind=map` | Bearer + mestre | Corpo binário de imagem => `{ mediaId }` |
| GET | `/api/rooms/:id/media/:uuid` | Bearer | Imagem privada (arquivo) |

`Authorization: Bearer <token>` é a autenticação para requisições HTTP. O WebSocket usa `Sec-WebSocket-Protocol: arcane-v1, auth.<token>` para evitar token de sessão na URL.

## Eventos recebidos pelo Durable Object

```json
{ "type": "chat", "text": "Lanço uma tocha no corredor." }
```
```json
{ "type": "roll", "faces": 20 }
```
```json
{ "type": "move", "targetId": "uuid-membro", "x": 37.2, "y": 64.1 }
```
```json
{ "type": "character", "character": { "name": "Kael", "ancestry": "Humano", "className": "Guerreiro", "level": 1, "hp": 10, "maxHp": 10, "ac": 12, "attributes": { "str": 14, "dex": 12, "con": 11, "int": 10, "wis": 10, "cha": 9 }, "story": "...", "photoId": null } }
```
```json
{ "type": "map", "mediaId": "uuid-da-imagem" }
```

## Eventos enviados ao navegador

Para simplificar o MVP, toda alteração relevante publica um snapshot completo do estado atual:

```json
{ "type": "snapshot", "state": { "id": "AABBCCDDEEFF00", "name": "Aventura", "mapId": null, "me": "uuid", "members": [], "chat": [] } }
```

O cliente usa os IDs para atualizar posições e mídia. Antes de aumentar o número de participantes, mudar para eventos incrementais e controle de frequência de envio.
