import { DurableObject } from 'cloudflare:workers';

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  MEDIA: R2Bucket;
}

type Role = 'mestre' | 'jogador';
type Kind = 'portrait' | 'map';
type Attrs = { str: number; dex: number; con: number; int: number; wis: number; cha: number };
type Character = {
  name: string; ancestry: string; className: string; level: number;
  hp: number; maxHp: number; ac: number; story: string; photoId: string | null; attributes: Attrs;
};
type PublicMember = { id: string; name: string; role: Role; character: Character | null; x: number; y: number; online: boolean };
type ChatMessage = { id: string; memberId: string; sender: string; kind: 'chat' | 'roll' | 'system'; text: string; createdAt: number };
type RoomView = { id: string; name: string; mapId: string | null; me: string; members: PublicMember[]; chat: ChatMessage[] };
type MemberRow = { id: string; name: string; role: Role; token_hash: string; character: string | null; x: number; y: number };
type MediaRow = { id: string; kind: Kind; owner_id: string };
type RoomRow = { id: string; name: string; map_id: string | null };
type WsAttachment = { memberId: string };

const err = (reason: string, status = 400) => Response.json({ error: reason }, { status, headers: { 'Cache-Control': 'no-store' } });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const sane = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bounded = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const token = () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => x.toString(16).padStart(2, '0')).join('');
};
const code = () => {
  const arr = new Uint8Array(7);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
};
const hash = async (value: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
};

function normalizeCharacter(data: unknown): Character | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const name = sane(d.name, 60);
  if (!name) return null;
  const attrs = (d.attributes && typeof d.attributes === 'object' ? d.attributes : {}) as Record<string, unknown>;
  const maxHp = bounded(d.maxHp, 1, 999, 10);
  return {
    name, ancestry: sane(d.ancestry, 40), className: sane(d.className, 40),
    level: bounded(d.level, 1, 20, 1), maxHp,
    hp: bounded(d.hp, 0, 999, maxHp), ac: bounded(d.ac, 0, 99, 10),
    story: sane(d.story, 1200), photoId: typeof d.photoId === 'string' && /^[a-f0-9-]{36}$/.test(d.photoId) ? d.photoId : null,
    attributes: {
      str: bounded(attrs.str, 1, 30, 10), dex: bounded(attrs.dex, 1, 30, 10),
      con: bounded(attrs.con, 1, 30, 10), int: bounded(attrs.int, 1, 30, 10),
      wis: bounded(attrs.wis, 1, 30, 10), cha: bounded(attrs.cha, 1, 30, 10),
    },
  };
}

function safeImage(bytes: Uint8Array, declared: string): boolean {
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const riff = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return (declared === 'image/png' && png) || (declared === 'image/jpeg' && jpeg) || (declared === 'image/webp' && riff);
}

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      // Uma instrução por chamada, compatível com a API SQLite do Durable Object.
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id TEXT PRIMARY KEY, name TEXT NOT NULL, map_id TEXT)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, character TEXT, x REAL NOT NULL DEFAULT 50, y REAL NOT NULL DEFAULT 50)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, member_id TEXT NOT NULL, sender TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner_id TEXT NOT NULL)');
    });
  }

  private room(): RoomRow | undefined {
    return this.ctx.storage.sql.exec<RoomRow>('SELECT * FROM room LIMIT 1').toArray()[0];
  }
  private memberById(id: string): MemberRow | undefined {
    return this.ctx.storage.sql.exec<MemberRow>('SELECT * FROM members WHERE id = ?', id).toArray()[0];
  }
  private async memberByToken(secret: string): Promise<MemberRow | undefined> {
    if (!/^[a-f0-9]{64}$/.test(secret)) return undefined;
    return this.ctx.storage.sql.exec<MemberRow>('SELECT * FROM members WHERE token_hash = ?', await hash(secret)).toArray()[0];
  }
  private mediaRow(id: string): MediaRow | undefined {
    return this.ctx.storage.sql.exec<MediaRow>('SELECT * FROM media WHERE id = ?', id).toArray()[0];
  }
  private publicState(me: string): RoomView {
    const info = this.room();
    if (!info) throw new Error('Mesa não encontrada');
    const live = new Set(this.ctx.getWebSockets().map(ws => (ws.deserializeAttachment() as WsAttachment | null)?.memberId).filter(Boolean));
    const members = this.ctx.storage.sql.exec<MemberRow>('SELECT * FROM members ORDER BY role ASC, name ASC').toArray();
    const chat = this.ctx.storage.sql.exec<{id:string;member_id:string;sender:string;kind:ChatMessage['kind'];text:string;created_at:number}>(
      'SELECT * FROM chat ORDER BY rowid DESC LIMIT 80'
    ).toArray().reverse().map(m => ({ id: m.id, memberId: m.member_id, sender: m.sender, kind: m.kind, text: m.text, createdAt: m.created_at }));
    return {
      id: info.id, name: info.name, mapId: info.map_id, me,
      members: members.map(m => ({
        id: m.id, name: m.name, role: m.role,
        character: m.character ? JSON.parse(m.character) as Character : null,
        x: m.x, y: m.y, online: live.has(m.id),
      })), chat,
    };
  }
  private pushStates(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attach = ws.deserializeAttachment() as WsAttachment | null;
      if (!attach?.memberId) continue;
      try { ws.send(JSON.stringify({ type: 'snapshot', state: this.publicState(attach.memberId) })); }
      catch { /* A conexão caiu, o runtime fechará o socket. */ }
    }
  }
  private addChat(memberId: string, sender: string, kind: ChatMessage['kind'], text: string): void {
    this.ctx.storage.sql.exec('INSERT INTO chat VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), memberId, sender, kind, text, Date.now());
    // Retém apenas 120 mensagens para manter este MVP leve.
    this.ctx.storage.sql.exec('DELETE FROM chat WHERE rowid NOT IN (SELECT rowid FROM chat ORDER BY rowid DESC LIMIT 120)');
  }

  async initialize(roomId: string, roomName: string, masterName: string, secret: string): Promise<{ memberId: string } | null> {
    if (this.room()) return null;
    const memberId = crypto.randomUUID();
    const tokenHash = await hash(secret);
    this.ctx.storage.sql.exec('INSERT INTO room (id, name, map_id) VALUES (?, ?, NULL)', roomId, sane(roomName, 70) || 'Aventura');
    this.ctx.storage.sql.exec('INSERT INTO members (id, name, role, token_hash, character, x, y) VALUES (?, ?, ?, ?, NULL, ?, ?)', memberId, sane(masterName, 32) || 'Mestre', 'mestre', tokenHash, 50, 48);
    this.addChat(memberId, 'Sistema', 'system', 'A mesa foi criada. Que os dados contem boas histórias!');
    return { memberId };
  }
  async join(name: string, secret: string): Promise<{ memberId: string; error?: string }> {
    if (!this.room()) return { memberId: '', error: 'Sala não encontrada.' };
    const tokenHash = await hash(secret);
    const count = this.ctx.storage.sql.exec<{ total: number }>("SELECT COUNT(*) as total FROM members WHERE role = 'jogador'").one().total;
    if (count >= 8) return { memberId: '', error: 'Mesa cheia: limite de 8 jogadores.' };
    const memberId = crypto.randomUUID();
    const pos = this.ctx.storage.sql.exec<{ total: number }>('SELECT COUNT(*) as total FROM members').one().total;
    this.ctx.storage.sql.exec('INSERT INTO members VALUES (?, ?, ?, ?, NULL, ?, ?)', memberId, sane(name, 32) || 'Aventureiro', 'jogador', tokenHash, 20 + (pos % 5) * 14, 55 + Math.floor(pos / 5) * 15);
    this.addChat(memberId, 'Sistema', 'system', `${sane(name, 32) || 'Aventureiro'} entrou na aventura.`);
    this.pushStates();
    return { memberId };
  }
  async whoAmI(secret: string): Promise<{ id: string; role: Role } | null> {
    const m = await this.memberByToken(secret);
    return m ? { id: m.id, role: m.role } : null;
  }
  async snapshot(secret: string): Promise<RoomView | null> {
    const m = await this.memberByToken(secret);
    return m ? this.publicState(m.id) : null;
  }
  async registerMedia(secret: string, id: string, kind: Kind): Promise<boolean> {
    const member = await this.memberByToken(secret);
    if (!member || (kind === 'map' && member.role !== 'mestre')) return false;
    this.ctx.storage.sql.exec('INSERT INTO media VALUES (?, ?, ?)', id, kind, member.id);
    return true;
  }
  async authorizedMedia(secret: string, id: string): Promise<boolean> {
    return !!(await this.memberByToken(secret)) && !!this.mediaRow(id);
  }
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return err('Upgrade WebSocket esperado.', 426);
    const secret = request.headers.get('X-Arcane-Token') ?? '';
    const member = await this.memberByToken(secret);
    if (!member) return err('Sessão inválida.', 401);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ memberId: member.id } satisfies WsAttachment);
    server.send(JSON.stringify({ type: 'snapshot', state: this.publicState(member.id) }));
    this.pushStates();
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'arcane-v1' } });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    const m = attachment?.memberId && this.memberById(attachment.memberId);
    if (!m || typeof message !== 'string' || message.length > 5000) return;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(message) as Record<string, unknown>; } catch { return; }
    switch (payload.type) {
      case 'chat': {
        const msg = sane(payload.text, 600);
        if (!msg) return;
        this.addChat(m.id, m.character ? (JSON.parse(m.character) as Character).name : m.name, 'chat', msg);
        break;
      }
      case 'roll': {
        const faces = bounded(payload.faces, 0, 100, 0);
        if (![4, 6, 8, 10, 12, 20, 100].includes(faces)) return;
        const bytes = new Uint32Array(1);
        const ceiling = Math.floor(2 ** 32 / faces) * faces;
        do { crypto.getRandomValues(bytes); } while (bytes[0] >= ceiling);
        const outcome = (bytes[0] % faces) + 1;
        this.addChat(m.id, m.character ? (JSON.parse(m.character) as Character).name : m.name, 'roll', `🎲 d${faces}: ${outcome}`);
        break;
      }
      case 'character': {
        const c = normalizeCharacter(payload.character);
        if (!c) return;
        if (c.photoId) {
          const media = this.mediaRow(c.photoId);
          if (!media || media.kind !== 'portrait' || media.owner_id !== m.id) return;
        }
        this.ctx.storage.sql.exec('UPDATE members SET character = ? WHERE id = ?', JSON.stringify(c), m.id);
        break;
      }
      case 'move': {
        const target = sane(payload.targetId, 36) || m.id;
        if (target !== m.id && m.role !== 'mestre') return;
        if (!this.memberById(target)) return;
        const x = Number(payload.x), y = Number(payload.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        this.ctx.storage.sql.exec('UPDATE members SET x = ?, y = ? WHERE id = ?', Math.max(4, Math.min(96, x)), Math.max(5, Math.min(95, y)), target);
        break;
      }
      case 'map': {
        if (m.role !== 'mestre') return;
        const id = sane(payload.mediaId, 36);
        const media = this.mediaRow(id);
        if (!media || media.kind !== 'map') return;
        this.ctx.storage.sql.exec('UPDATE room SET map_id = ?', id);
        this.addChat(m.id, 'Sistema', 'system', 'O mestre revelou um novo mapa.');
        break;
      }
      default: return;
    }
    this.pushStates();
  }
  webSocketClose(_ws: WebSocket): void { this.pushStates(); }
  webSocketError(_ws: WebSocket): void { this.pushStates(); }
}

const parseSecret = (request: Request) => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? '';
};
const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return err('Rota não encontrada.', 404);
    if (request.method === 'OPTIONS') return err('Método indisponível.', 405);
    // Evita acesso cross-origin e upgrades iniciados por outros sites.
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return err('Origem não permitida.', 403);
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, project: 'arcane-table', version: '0.2.0' });
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        const data = await request.json() as Record<string, unknown>;
        const name = sane(data.name, 70), host = sane(data.host, 32);
        if (!name || !host) return err('Preencha o nome da sala e do mestre.');
        const id = code(), secret = token();
        const created = await env.ROOMS.getByName(id).initialize(id, name, host, secret);
        if (!created) return err('Falha ao criar sala. Tente novamente.', 409);
        return json({ roomId: id, token: secret, memberId: created.memberId }, 201);
      }
      const parts = /^\/api\/rooms\/([A-Fa-f0-9]{14})(?:\/(join|state|ws|media)(?:\/([a-f0-9-]{36}))?)?$/.exec(url.pathname);
      if (!parts) return err('Rota não encontrada.', 404);
      const roomId = parts[1].toUpperCase(), action = parts[2] || '', mediaId = parts[3] || '';
      const stub = env.ROOMS.getByName(roomId);
      if (action === 'join' && request.method === 'POST') {
        const data = await request.json() as Record<string, unknown>;
        const player = sane(data.name, 32);
        if (!player) return err('Informe seu nome.');
        const secret = token(), joined = await stub.join(player, secret);
        if (joined.error) return err(joined.error, joined.error.includes('cheia') ? 409 : 404);
        return json({ roomId, token: secret, memberId: joined.memberId }, 201);
      }
      if (action === 'ws' && request.method === 'GET') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return err('WebSocket necessário.', 426);
        const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map(x => x.trim());
        const auth = protocols.find(x => /^auth\.[a-f0-9]{64}$/.test(x));
        if (!protocols.includes('arcane-v1') || !auth) return err('Protocolo inválido.', 401);
        const headers = new Headers({ Upgrade: 'websocket', 'X-Arcane-Token': auth.slice(5) });
        return stub.fetch(new Request(`https://room.internal/ws`, { headers }));
      }
      const secret = parseSecret(request);
      if (!secret) return err('Acesso não autorizado.', 401);
      if (action === 'state' && request.method === 'GET') {
        const state = await stub.snapshot(secret);
        return state ? json({ state }) : err('Sessão inválida ou expirada.', 401);
      }
      if (action === 'media' && !mediaId && request.method === 'POST') {
        const kind = url.searchParams.get('kind');
        if (kind !== 'portrait' && kind !== 'map') return err('Tipo inválido.');
        const user = await stub.whoAmI(secret);
        if (!user || (kind === 'map' && user.role !== 'mestre')) return err('Sem permissão.', 403);
        const mime = (request.headers.get('Content-Type') ?? '').split(';')[0];
        const max = kind === 'map' ? 10_000_000 : 5_000_000;
        const len = Number(request.headers.get('Content-Length') ?? -1);
        if (len > max) return err('Imagem muito grande.', 413);
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (!bytes.byteLength || bytes.byteLength > max) return err('Imagem vazia ou excedeu o limite.', 413);
        if (!safeImage(bytes, mime)) return err('Imagem inválida; use JPG, PNG ou WebP.');
        const id = crypto.randomUUID();
        await env.MEDIA.put(`${roomId}/${id}`, bytes, { httpMetadata: { contentType: mime } });
        const accepted = await stub.registerMedia(secret, id, kind);
        if (!accepted) { await env.MEDIA.delete(`${roomId}/${id}`); return err('Falha ao registrar imagem.', 403); }
        return json({ mediaId: id }, 201);
      }
      if (action === 'media' && mediaId && request.method === 'GET') {
        const valid = await stub.authorizedMedia(secret, mediaId);
        if (!valid) return err('Imagem não encontrada ou sem permissão.', 404);
        const object = await env.MEDIA.get(`${roomId}/${mediaId}`);
        if (!object) return err('Imagem não encontrada.', 404);
        return new Response(object.body, {
          headers: { ...baseHeaders, 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
        });
      }
      return err('Rota não encontrada.', 404);
    } catch (e) {
      console.error(JSON.stringify({ route: url.pathname, method: request.method, message: e instanceof Error ? e.message : 'Unexpected error' }));
      return err('Erro interno. Tente novamente.', 500);
    }
  },
} satisfies ExportedHandler<Env>;
