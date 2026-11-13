import './styles.css';

type Role = 'mestre' | 'jogador';
type Character = {
  name: string; ancestry: string; className: string; level: number;
  hp: number; maxHp: number; ac: number; story: string; photoId: string | null;
  attributes: { str:number; dex:number; con:number; int:number; wis:number; cha:number };
};
type Member = { id: string; name: string; role: Role; character: Character | null; x: number; y: number; online: boolean };
type Chat = { id: string; memberId: string; sender: string; kind: 'chat'|'roll'|'system'; text: string; createdAt: number };
type RoomState = { id: string; name: string; mapId: string | null; me: string; members: Member[]; chat: Chat[] };
type ServerFrame = { type: 'snapshot'; state: RoomState };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const message = (target: string, text: string) => { $(target).textContent = text; };
const sessionKey = (id: string) => `arcane-v02:${id}`;
let roomId = '';
let secret = '';
let state: RoomState | null = null;
let ws: WebSocket | null = null;
let portraitFile: File | null = null;
const mediaCache = new Map<string, Promise<string>>();
let reconnectTimer: number | undefined;
let closedByUser = false;
const requireMe = () => state?.members.find(x => x.id === state?.me) || null;
const isMaster = () => requireMe()?.role === 'mestre';

function setConnection(text: string, ok: boolean) {
  const node = $('conn-status');
  node.textContent = `● ${text}`;
  node.className = `badge ${ok ? 'connected' : 'disconnected'}`;
}
async function api<T>(path: string, opts: RequestInit = {}, authorized = true): Promise<T> {
  const headers = new Headers(opts.headers);
  if (authorized && secret) headers.set('Authorization', `Bearer ${secret}`);
  const response = await fetch(path, { ...opts, headers, cache: 'no-store' });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as T;
}
const jsonBody = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
function showWelcome(join: string | null) {
  $('welcome').hidden = false;
  $('game').hidden = true;
  $('create-panel').hidden = !!join;
  $('join-panel').hidden = !join;
  if (join) message('invite-description', `Convite para a sala ${join}. Escolha um nome para entrar.`);
}
function navigateToRoom(id: string) {
  const link = new URL(location.href);
  link.searchParams.set('room', id);
  history.replaceState(null, '', link);
}
function persist(id: string, auth: string) { localStorage.setItem(sessionKey(id), auth); }
async function enter(id: string, auth: string) {
  if (ws) { closedByUser = true; ws.close(); }
  roomId = id;
  secret = auth;
  mediaCache.clear();
  try {
    const data = await api<{state: RoomState}>(`/api/rooms/${roomId}/state`);
    state = data.state;
    navigateToRoom(id);
    $('welcome').hidden = true;
    $('game').hidden = false;
    render();
    closedByUser = false;
    connect();
  } catch (e) {
    localStorage.removeItem(sessionKey(id));
    secret = '';
    setConnection('Sem sessão', false);
    showWelcome(id);
    message('welcome-error', errorText(e));
  }
}
function errorText(e: unknown) { return e instanceof Error ? e.message : 'Falha desconhecida.'; }
async function createRoom(ev: Event) {
  ev.preventDefault(); message('welcome-error', '');
  const button = $<HTMLButtonElement>('create-form').querySelector('button')!;
  button.disabled = true;
  try {
    const name = input('room-name').value.trim(), host = input('host-name').value.trim();
    const d = await api<{ roomId: string; token: string }>('/api/rooms', jsonBody({ name, host }), false);
    persist(d.roomId, d.token);
    await enter(d.roomId, d.token);
  } catch(e) { message('welcome-error', errorText(e)); }
  finally { button.disabled = false; }
}
async function joinRoom(ev: Event) {
  ev.preventDefault(); message('welcome-error', '');
  const code = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';
  if (!/^[A-F0-9]{14}$/.test(code)) { message('welcome-error', 'Código de sala inválido.'); return; }
  const button = $<HTMLButtonElement>('join-form').querySelector('button')!;
  button.disabled = true;
  try {
    const d = await api<{roomId: string; token: string}>(`/api/rooms/${code}/join`, jsonBody({ name: input('player-name').value }), false);
    persist(d.roomId, d.token);
    await enter(d.roomId, d.token);
  } catch(e) { message('welcome-error', errorText(e)); }
  finally { button.disabled = false; }
}
function connect() {
  if (!roomId || !secret) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(reconnectTimer);
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${scheme}//${location.host}/api/rooms/${roomId}/ws`, ['arcane-v1', `auth.${secret}`]);
  setConnection('Conectando...', false);
  ws.onopen = () => setConnection('Ao vivo', true);
  ws.onmessage = (event: MessageEvent<string>) => {
    try {
      const frame = JSON.parse(event.data) as ServerFrame;
      if (frame.type === 'snapshot') { state = frame.state; render(); }
    } catch { /* ignore malformed frames */ }
  };
  ws.onclose = () => {
    setConnection('Reconectando', false);
    if (!closedByUser) reconnectTimer = window.setTimeout(connect, 2200);
  };
  ws.onerror = () => setConnection('Falha de conexão', false);
}
function send(payload: unknown): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setConnection('Sem conexão', false);
    return false;
  }
  ws.send(JSON.stringify(payload));
  return true;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (css) node.className = css;
  if (text) node.textContent = text;
  return node;
}
function render() {
  if (!state) return;
  message('game-title', state.name);
  message('role-label', isMaster() ? '👑 PAINEL DO MESTRE' : '⚔ JOGADOR DA CAMPANHA');
  message('room-code', `Sala ${state.id}`);
  message('player-count', `${state.members.length}/9`);
  $('map-upload-btn').hidden = !isMaster();
  renderPlayers();
  renderMap();
  renderChat();
}
async function mediaUrl(id: string): Promise<string> {
  let task = mediaCache.get(id);
  if (!task) {
    task = (async () => {
      const response = await fetch(`/api/rooms/${roomId}/media/${id}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível abrir a imagem.');
      return URL.createObjectURL(await response.blob());
    })();
    task.catch(() => mediaCache.delete(id));
    mediaCache.set(id, task);
  }
  return task;
}
function attachPicture(target: HTMLElement, id: string) {
  const image = element('img');
  target.append(image);
  mediaUrl(id).then(src => { if (image.isConnected) image.src = src; }).catch(() => image.remove());
}
function renderPlayers() {
  if (!state) return;
  const host = $('players'); host.replaceChildren();
  for (const member of state.members) {
    const card = element('div', 'player');
    const avatar = element('span', 'player-avatar', member.character ? '' : '✦');
    if (member.character?.photoId) attachPicture(avatar, member.character.photoId);
    const details = element('div','player-info');
    const name = element('strong','', member.character?.name || member.name);
    const descr = element('small','', `${member.role === 'mestre' ? '👑 Mestre' : 'Jogador'} · ${member.character?.className || 'Sem ficha'}${member.online ? ' · ● online' : ''}`);
    details.append(name,descr); card.append(avatar,details); host.append(card);
  }
}
function boardPos(clientX: number, clientY: number): {x:number;y:number} {
  const rect = $('board').getBoundingClientRect();
  return {
    x: Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.min(95, Math.max(5, ((clientY - rect.top) / rect.height) * 100)),
  };
}
function renderMap() {
  if (!state) return;
  const currentMap = state.mapId;
  const map = $<HTMLImageElement>('board-map');
  map.hidden = !currentMap;
  $('board-empty').hidden = !!currentMap;
  if (currentMap && map.dataset.id !== currentMap) {
    map.dataset.id = currentMap;
    mediaUrl(currentMap).then(src => { if (map.dataset.id === currentMap) map.src = src; }).catch(() => map.hidden = true);
  }
  const layer = $('token-layer'); layer.replaceChildren();
  for (const member of state.members) {
    const tok = element('div', `token ${member.id === state.me ? 'mine' : ''} ${member.role === 'mestre' ? 'master' : ''}`, member.character?.photoId ? '' : '✦');
    tok.style.left = `${member.x}%`; tok.style.top = `${member.y}%`;
    tok.title = `${member.character?.name || member.name} (${member.role})`;
    if (member.character?.photoId) attachPicture(tok, member.character.photoId);
    const label = element('label', '', member.character?.name || member.name);
    tok.append(label);
    if (member.id === state.me || isMaster()) makeDraggable(tok, member);
    layer.append(tok);
  }
}
function makeDraggable(tok: HTMLElement, member: Member) {
  let dragging = false;
  tok.addEventListener('pointerdown', (e: PointerEvent) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); dragging = true; tok.setPointerCapture(e.pointerId); });
  tok.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const pos = boardPos(e.clientX, e.clientY);
    tok.style.left = `${pos.x}%`; tok.style.top = `${pos.y}%`;
  });
  tok.addEventListener('pointerup', (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const pos = boardPos(e.clientX, e.clientY);
    send({ type: 'move', targetId: member.id, ...pos });
  });
  tok.addEventListener('pointercancel', () => { dragging = false; renderMap(); });
}
function renderChat() {
  if (!state) return;
  const log = $('chat-log');
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 65;
  const oldLast = log.lastElementChild?.getAttribute('data-msg');
  const newLast = state.chat.at(-1)?.id;
  if (oldLast === newLast) return;
  log.replaceChildren();
  for (const chat of state.chat) {
    const item = element('div', `message ${chat.kind === 'roll' ? 'roll' : ''}`);
    item.dataset.msg = chat.id;
    const title = element('strong', '', chat.sender);
    const when = element('time','', new Date(chat.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
    title.append(when);
    const content = element('p','',chat.text);
    item.append(title, content); log.append(item);
  }
  if (atBottom || !oldLast) log.scrollTop = log.scrollHeight;
}
async function optimizeImage(file: File, kind: 'portrait'|'map'): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use apenas JPG, PNG ou WebP.');
  if (file.size > 16_000_000) throw new Error('Arquivo original muito grande (máximo 16 MB).');
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const limit = kind === 'map' ? 2400 : 640;
    const ratio = Math.min(1, limit / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const max = kind === 'map' ? 1_700_000 : 900_000;
    for (const quality of [0.88, 0.74, 0.58, 0.4]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size && blob.size <= max) return blob;
    }
    throw new Error('Imagem ainda ficou grande. Use outra foto ou um mapa menor.');
  } finally { image.close(); }
}
async function upload(file: File, kind: 'portrait'|'map'): Promise<string> {
  const optimized = await optimizeImage(file, kind);
  const result = await api<{mediaId: string}>(`/api/rooms/${roomId}/media?kind=${kind}`, {
    method: 'POST', headers: { 'Content-Type': optimized.type }, body: optimized,
  });
  return result.mediaId;
}
function sheetField(id: string, value: string | number) { input(id).value = String(value); }
function number(id: string, lo: number, hi: number, fallback: number) {
  const parsed = Number(input(id).value);
  return Number.isFinite(parsed) ? Math.min(hi, Math.max(lo, Math.round(parsed))) : fallback;
}
function openSheet() {
  const c = requireMe()?.character;
  portraitFile = null;
  message('sheet-error','');
  sheetField('c-name', c?.name || '');
  sheetField('c-ancestry', c?.ancestry || 'Humano');
  sheetField('c-class', c?.className || 'Guerreiro');
  sheetField('c-level', c?.level ?? 1);
  sheetField('c-hp', c?.hp ?? 10);
  sheetField('c-maxhp', c?.maxHp ?? 10);
  sheetField('c-ac', c?.ac ?? 10);
  sheetField('c-story', c?.story || '');
  for (const key of ['str','dex','con','int','wis','cha'] as const) sheetField(`c-${key}`, c?.attributes?.[key] ?? 10);
  const photo = $('photo-preview'); photo.replaceChildren();
  photo.textContent = '✧';
  if (c?.photoId) { photo.textContent = ''; attachPicture(photo, c.photoId); }
  $<HTMLDialogElement>('character-dialog').showModal();
}
function previewPhoto(file: File) {
  portraitFile = file;
  const photo = $('photo-preview'); photo.replaceChildren();
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 16_000_000) { message('sheet-error','Use JPG, PNG ou WebP de até 16 MB; a foto será otimizada.'); portraitFile = null; return; }
  const blob = URL.createObjectURL(file);
  const img = element('img'); img.src = blob;
  img.onload = () => URL.revokeObjectURL(blob);
  img.onerror = () => URL.revokeObjectURL(blob);
  photo.append(img);
}
async function saveSheet(ev: Event) {
  ev.preventDefault();
  const button = $<HTMLButtonElement>('save-sheet');
  button.disabled = true;
  message('sheet-error','');
  try {
    const existing = requireMe()?.character;
    const name = input('c-name').value.trim();
    if (!name) throw new Error('Dê um nome ao personagem.');
    const photoId = portraitFile ? await upload(portraitFile, 'portrait') : existing?.photoId || null;
    const attrs = Object.fromEntries((['str','dex','con','int','wis','cha'] as const).map(a => [a, number(`c-${a}`,1,30,10)]));
    const c: Character = {
      name, ancestry: input('c-ancestry').value.trim(), className: input('c-class').value.trim(),
      level: number('c-level',1,20,1), hp: number('c-hp',0,999,10), maxHp: number('c-maxhp',1,999,10),
      ac: number('c-ac',0,99,10), story: $<HTMLTextAreaElement>('c-story').value.trim(),
      photoId, attributes: attrs as unknown as Character['attributes'],
    };
    if (!send({ type: 'character', character: c })) throw new Error('Aguarde a conexão com a sala.');
    $<HTMLDialogElement>('character-dialog').close();
  } catch(e) { message('sheet-error',errorText(e)); }
  finally { button.disabled = false; }
}

$('create-form').addEventListener('submit', createRoom);
$('join-form').addEventListener('submit', joinRoom);
$('back-home').addEventListener('click', () => { history.replaceState(null,'',location.pathname); showWelcome(null); message('welcome-error',''); });
$('copy-link').addEventListener('click', async () => {
  const link = new URL(location.href); link.searchParams.set('room', roomId);
  try { await navigator.clipboard.writeText(link.toString()); message('board-message','Convite copiado!'); }
  catch { window.prompt('Copie o link de convite:', link.toString()); }
});
$('edit-character').addEventListener('click', openSheet);
$('close-sheet').addEventListener('click', () => $<HTMLDialogElement>('character-dialog').close());
$('portrait-file').addEventListener('change', (ev: Event) => {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (file) previewPhoto(file);
  (ev.target as HTMLInputElement).value = '';
});
$('character-form').addEventListener('submit', saveSheet);
$('map-file').addEventListener('change', async ev => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file || !isMaster()) return;
  message('board-message','Enviando mapa...');
  try { const mediaId = await upload(file,'map'); send({type:'map',mediaId}); message('board-message','Mapa enviado.'); }
  catch(e) { message('board-message',errorText(e)); }
  (ev.target as HTMLInputElement).value = '';
});
$('board').addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('.token')) return;
  if (!state) return;
  const pos = boardPos((e as MouseEvent).clientX,(e as MouseEvent).clientY);
  send({ type: 'move', targetId: state.me, ...pos });
});
$('chat-form').addEventListener('submit', e => {
  e.preventDefault(); const text = input('chat-input').value.trim();
  if (!text) return;
  if (send({ type:'chat', text })) input('chat-input').value = '';
});
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-roll]')) {
  btn.addEventListener('click', () => send({ type:'roll', faces: Number(btn.dataset.roll?.slice(1)) }));
}
window.addEventListener('beforeunload', () => {
  closedByUser = true;
  for (const value of mediaCache.values()) value.then(url => URL.revokeObjectURL(url)).catch(() => {});
});
const current = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';
if (/^[A-F0-9]{14}$/.test(current)) {
  const stored = localStorage.getItem(sessionKey(current));
  if (stored) void enter(current, stored); else showWelcome(current);
} else showWelcome(null);
