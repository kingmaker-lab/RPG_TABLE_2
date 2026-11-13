import { DurableObject } from 'cloudflare:workers';
const HTML = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <meta name=\"theme-color\" content=\"#121018\" />\n  <meta name=\"description\" content=\"Arcane Table: mesa virtual de RPG 2D com personagens personalizados, dados e chat multiplayer.\" />\n  <title>Arcane Table | The Workshop</title>\n  <link rel=\"stylesheet\" href=\"/styles.css\" />\n</head>\n<body>\n  <div id=\"app\">\n    <header class=\"topbar\">\n      <div class=\"brand\"><div class=\"logo\">⚔</div><div><small>THE WORKSHOP · RPG</small><strong>ARCANE TABLE</strong></div></div>\n      <div class=\"right-head\"><span class=\"badge\" id=\"conn-status\">● Aguardando</span><span class=\"version\">BETA 0.3</span></div>\n    </header>\n\n    <main>\n      <section id=\"welcome\" class=\"welcome\">\n        <div class=\"hero-text\"><span class=\"eyebrow\">SEU MUNDO COMEÇA AQUI</span><h1>Uma mesa.<br><em>Infinitas histórias.</em></h1><p>Convide seus amigos, escolha sua foto, crie um personagem e aventure-se em um mapa 2D. O mestre guia. Os dados decidem.</p><div class=\"hero-runes\">✧ &nbsp; D20 &nbsp; ✧ &nbsp; 2D &nbsp; ✧ &nbsp; MULTIPLAYER &nbsp; ✧</div></div>\n        <div class=\"welcome-card\">\n          <div id=\"create-panel\"><h2>👑 Criar uma mesa</h2><p>Você será o mestre e receberá o link de convite.</p><form id=\"create-form\"><label>Nome da aventura<input id=\"room-name\" maxlength=\"70\" required value=\"A Masmorra Esquecida\" /></label><label>Seu nome na mesa<input id=\"host-name\" maxlength=\"32\" required placeholder=\"Ex.: Mestre Ôni\" /></label><button class=\"gold-btn\" type=\"submit\">Criar sala →</button></form></div>\n          <div id=\"join-panel\" hidden><h2>🎲 Entrar na aventura</h2><p id=\"invite-description\">Você recebeu um convite para uma mesa.</p><form id=\"join-form\"><label>Como devemos te chamar?<input id=\"player-name\" maxlength=\"32\" required placeholder=\"Ex.: Renard\" /></label><button class=\"gold-btn\" type=\"submit\">Entrar na sala →</button></form><button id=\"back-home\" class=\"text-btn\">Criar minha própria mesa</button></div>\n          <p id=\"welcome-error\" role=\"alert\" class=\"error\"></p>\n        </div>\n      </section>\n\n      <section id=\"game\" class=\"game\" hidden>\n        <div class=\"game-head\"><div><div class=\"eyebrow\" id=\"role-label\">MESA DE AVENTURA</div><h1 id=\"game-title\">Aventura</h1></div><div class=\"game-actions\"><span id=\"room-code\" class=\"room-code\"></span><button id=\"copy-link\" class=\"btn\">🔗 Copiar convite</button><button id=\"edit-character\" class=\"gold-btn\">✦ Minha ficha</button></div></div>\n        <div class=\"game-layout\">\n          <aside class=\"sidebar players-panel\"><h2>⚔ Aventureiros <span id=\"player-count\" class=\"count\">0</span></h2><div id=\"players\" class=\"players\"></div><div class=\"panel-foot\">Clique em sua ficha para editá-la. O mestre também pode movimentar os tokens.</div></aside>\n          <section class=\"table-panel\"><div class=\"table-toolbar\"><div><strong>🗺️ Mapa da aventura</strong><small id=\"map-hint\">Clique no cenário para mover seu personagem.</small></div><div class=\"map-buttons\"><label id=\"map-upload-btn\" class=\"btn\" hidden>⬆ Mapa do mestre<input id=\"map-file\" type=\"file\" accept=\"image/png,image/jpeg,image/webp\" hidden /></label></div></div><div id=\"board\" class=\"board\" aria-label=\"Mapa interativo 2D\"><img id=\"board-map\" hidden alt=\"Mapa enviado pelo mestre\" /><div class=\"board-grid\"></div><div class=\"board-center\" id=\"board-empty\"><span>✦</span><strong>O mundo aguarda seu mestre</strong><small>O mestre pode enviar um mapa. Tokens funcionam mesmo sem imagem.</small></div><div id=\"token-layer\" class=\"token-layer\"></div></div><div class=\"board-footer\"><span>◇ Mapa 2D · Sem personagens 3D</span><span id=\"board-message\">Arraste seu token ou clique no mapa.</span></div></section>\n          <aside class=\"sidebar chat-panel\"><div class=\"chat-head\"><h2>💬 Crônicas da mesa</h2><small>Chat e dados ao vivo</small></div><div id=\"chat-log\" class=\"chat-log\" aria-live=\"polite\"></div><form id=\"chat-form\" class=\"chat-form\"><input id=\"chat-input\" maxlength=\"600\" autocomplete=\"off\" placeholder=\"Escreva sua ação ou fala...\" required /><button type=\"submit\" title=\"Enviar mensagem\">➤</button></form><div class=\"dice-bar\"><span>🎲 Rolar:</span><button data-roll=\"d4\">d4</button><button data-roll=\"d6\">d6</button><button data-roll=\"d8\">d8</button><button data-roll=\"d10\">d10</button><button data-roll=\"d12\">d12</button><button data-roll=\"d20\">d20</button></div></aside>\n        </div>\n      </section>\n    </main>\n\n    <dialog id=\"character-dialog\" class=\"character-dialog\"><form id=\"character-form\" method=\"dialog\"><div class=\"dialog-head\"><div><small class=\"eyebrow\">PERSONAGEM</small><h2>Minha ficha</h2></div><button type=\"button\" id=\"close-sheet\" class=\"close-btn\" aria-label=\"Fechar\">✕</button></div><div class=\"sheet-layout\"><div class=\"sheet-photo\"><div id=\"photo-preview\" class=\"photo-preview\">✧</div><label class=\"btn photo-button\">📷 Escolher retrato<input id=\"portrait-file\" type=\"file\" accept=\"image/png,image/jpeg,image/webp\" hidden /></label><p>Foto vira token 2D no mapa. O retrato será otimizado para o tabuleiro.</p></div><div class=\"sheet-details\"><label>Nome do personagem<input id=\"c-name\" maxlength=\"60\" required placeholder=\"Ex.: Renard Wolfen\" /></label><div class=\"two-col\"><label>Espécie<input id=\"c-ancestry\" maxlength=\"40\" value=\"Humano\" /></label><label>Classe<input id=\"c-class\" maxlength=\"40\" value=\"Guerreiro\" /></label><label>Nível<input id=\"c-level\" type=\"number\" min=\"1\" max=\"20\" value=\"1\" /></label><label>Armadura (CA)<input id=\"c-ac\" type=\"number\" min=\"0\" max=\"99\" value=\"10\" /></label><label>Vida atual<input id=\"c-hp\" type=\"number\" min=\"0\" max=\"999\" value=\"10\" /></label><label>Vida máxima<input id=\"c-maxhp\" type=\"number\" min=\"1\" max=\"999\" value=\"10\" /></label></div><span class=\"subheading\">Atributos</span><div class=\"attributes\"><label>FOR<input id=\"c-str\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label><label>DES<input id=\"c-dex\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label><label>CON<input id=\"c-con\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label><label>INT<input id=\"c-int\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label><label>SAB<input id=\"c-wis\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label><label>CAR<input id=\"c-cha\" type=\"number\" min=\"1\" max=\"30\" value=\"10\" /></label></div><label>História / anotações<textarea id=\"c-story\" maxlength=\"1200\" rows=\"3\" placeholder=\"Quem é seu aventureiro?\"></textarea></label></div></div><div class=\"dialog-actions\"><span id=\"sheet-error\" class=\"error\" role=\"alert\"></span><button id=\"save-sheet\" type=\"submit\" class=\"gold-btn\">Salvar ficha</button></div></form></dialog>\n  </div>\n  <script src=\"/client.js\" defer></script>\n</body>\n</html>\n";
const CLIENT = "\nconst $ = (id) => document.getElementById(id);\nconst input = (id) => $(id);\nconst message = (target, text) => { $(target).textContent = text; };\nconst sessionKey = (id) => `arcane-v02:${id}`;\nlet roomId = '';\nlet secret = '';\nlet state = null;\nlet ws = null;\nlet portraitFile = null;\nconst mediaCache = new Map();\nlet reconnectTimer;\nlet closedByUser = false;\nconst requireMe = () => state?.members.find(x => x.id === state?.me) || null;\nconst isMaster = () => requireMe()?.role === 'mestre';\nfunction setConnection(text, ok) {\n    const node = $('conn-status');\n    node.textContent = `● ${text}`;\n    node.className = `badge ${ok ? 'connected' : 'disconnected'}`;\n}\nasync function api(path, opts = {}, authorized = true) {\n    const headers = new Headers(opts.headers);\n    if (authorized && secret)\n        headers.set('Authorization', `Bearer ${secret}`);\n    const response = await fetch(path, { ...opts, headers, cache: 'no-store' });\n    const body = await response.json().catch(() => ({}));\n    if (!response.ok)\n        throw new Error(body.error || `HTTP ${response.status}`);\n    return body;\n}\nconst jsonBody = (value) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });\nfunction showWelcome(join) {\n    $('welcome').hidden = false;\n    $('game').hidden = true;\n    $('create-panel').hidden = !!join;\n    $('join-panel').hidden = !join;\n    if (join)\n        message('invite-description', `Convite para a sala ${join}. Escolha um nome para entrar.`);\n}\nfunction navigateToRoom(id) {\n    const link = new URL(location.href);\n    link.searchParams.set('room', id);\n    history.replaceState(null, '', link);\n}\nfunction persist(id, auth) { localStorage.setItem(sessionKey(id), auth); }\nasync function enter(id, auth) {\n    if (ws) {\n        closedByUser = true;\n        ws.close();\n    }\n    roomId = id;\n    secret = auth;\n    mediaCache.clear();\n    try {\n        const data = await api(`/api/rooms/${roomId}/state`);\n        state = data.state;\n        navigateToRoom(id);\n        $('welcome').hidden = true;\n        $('game').hidden = false;\n        render();\n        closedByUser = false;\n        connect();\n    }\n    catch (e) {\n        localStorage.removeItem(sessionKey(id));\n        secret = '';\n        setConnection('Sem sessão', false);\n        showWelcome(id);\n        message('welcome-error', errorText(e));\n    }\n}\nfunction errorText(e) { return e instanceof Error ? e.message : 'Falha desconhecida.'; }\nasync function createRoom(ev) {\n    ev.preventDefault();\n    message('welcome-error', '');\n    const button = $('create-form').querySelector('button');\n    button.disabled = true;\n    try {\n        const name = input('room-name').value.trim(), host = input('host-name').value.trim();\n        const d = await api('/api/rooms', jsonBody({ name, host }), false);\n        persist(d.roomId, d.token);\n        await enter(d.roomId, d.token);\n    }\n    catch (e) {\n        message('welcome-error', errorText(e));\n    }\n    finally {\n        button.disabled = false;\n    }\n}\nasync function joinRoom(ev) {\n    ev.preventDefault();\n    message('welcome-error', '');\n    const code = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';\n    if (!/^[A-F0-9]{14}$/.test(code)) {\n        message('welcome-error', 'Código de sala inválido.');\n        return;\n    }\n    const button = $('join-form').querySelector('button');\n    button.disabled = true;\n    try {\n        const d = await api(`/api/rooms/${code}/join`, jsonBody({ name: input('player-name').value }), false);\n        persist(d.roomId, d.token);\n        await enter(d.roomId, d.token);\n    }\n    catch (e) {\n        message('welcome-error', errorText(e));\n    }\n    finally {\n        button.disabled = false;\n    }\n}\nfunction connect() {\n    if (!roomId || !secret)\n        return;\n    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))\n        return;\n    clearTimeout(reconnectTimer);\n    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';\n    ws = new WebSocket(`${scheme}//${location.host}/api/rooms/${roomId}/ws`, ['arcane-v1', `auth.${secret}`]);\n    setConnection('Conectando...', false);\n    ws.onopen = () => setConnection('Ao vivo', true);\n    ws.onmessage = (event) => {\n        try {\n            const frame = JSON.parse(event.data);\n            if (frame.type === 'snapshot') {\n                state = frame.state;\n                render();\n            }\n        }\n        catch { /* ignore malformed frames */ }\n    };\n    ws.onclose = () => {\n        setConnection('Reconectando', false);\n        if (!closedByUser)\n            reconnectTimer = window.setTimeout(connect, 2200);\n    };\n    ws.onerror = () => setConnection('Falha de conexão', false);\n}\nfunction send(payload) {\n    if (!ws || ws.readyState !== WebSocket.OPEN) {\n        setConnection('Sem conexão', false);\n        return false;\n    }\n    ws.send(JSON.stringify(payload));\n    return true;\n}\nfunction element(tag, css = '', text = '') {\n    const node = document.createElement(tag);\n    if (css)\n        node.className = css;\n    if (text)\n        node.textContent = text;\n    return node;\n}\nfunction render() {\n    if (!state)\n        return;\n    message('game-title', state.name);\n    message('role-label', isMaster() ? '👑 PAINEL DO MESTRE' : '⚔ JOGADOR DA CAMPANHA');\n    message('room-code', `Sala ${state.id}`);\n    message('player-count', `${state.members.length}/9`);\n    $('map-upload-btn').hidden = !isMaster();\n    renderPlayers();\n    renderMap();\n    renderChat();\n}\nasync function mediaUrl(id) {\n    let task = mediaCache.get(id);\n    if (!task) {\n        task = (async () => {\n            const response = await fetch(`/api/rooms/${roomId}/media/${id}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });\n            if (!response.ok)\n                throw new Error('Não foi possível abrir a imagem.');\n            return URL.createObjectURL(await response.blob());\n        })();\n        task.catch(() => mediaCache.delete(id));\n        mediaCache.set(id, task);\n    }\n    return task;\n}\nfunction attachPicture(target, id) {\n    const image = element('img');\n    target.append(image);\n    mediaUrl(id).then(src => { if (image.isConnected)\n        image.src = src; }).catch(() => image.remove());\n}\nfunction renderPlayers() {\n    if (!state)\n        return;\n    const host = $('players');\n    host.replaceChildren();\n    for (const member of state.members) {\n        const card = element('div', 'player');\n        const avatar = element('span', 'player-avatar', member.character ? '' : '✦');\n        if (member.character?.photoId)\n            attachPicture(avatar, member.character.photoId);\n        const details = element('div', 'player-info');\n        const name = element('strong', '', member.character?.name || member.name);\n        const descr = element('small', '', `${member.role === 'mestre' ? '👑 Mestre' : 'Jogador'} · ${member.character?.className || 'Sem ficha'}${member.online ? ' · ● online' : ''}`);\n        details.append(name, descr);\n        card.append(avatar, details);\n        host.append(card);\n    }\n}\nfunction boardPos(clientX, clientY) {\n    const rect = $('board').getBoundingClientRect();\n    return {\n        x: Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)),\n        y: Math.min(95, Math.max(5, ((clientY - rect.top) / rect.height) * 100)),\n    };\n}\nfunction renderMap() {\n    if (!state)\n        return;\n    const currentMap = state.mapId;\n    const map = $('board-map');\n    map.hidden = !currentMap;\n    $('board-empty').hidden = !!currentMap;\n    if (currentMap && map.dataset.id !== currentMap) {\n        map.dataset.id = currentMap;\n        mediaUrl(currentMap).then(src => { if (map.dataset.id === currentMap)\n            map.src = src; }).catch(() => map.hidden = true);\n    }\n    const layer = $('token-layer');\n    layer.replaceChildren();\n    for (const member of state.members) {\n        const tok = element('div', `token ${member.id === state.me ? 'mine' : ''} ${member.role === 'mestre' ? 'master' : ''}`, member.character?.photoId ? '' : '✦');\n        tok.style.left = `${member.x}%`;\n        tok.style.top = `${member.y}%`;\n        tok.title = `${member.character?.name || member.name} (${member.role})`;\n        if (member.character?.photoId)\n            attachPicture(tok, member.character.photoId);\n        const label = element('label', '', member.character?.name || member.name);\n        tok.append(label);\n        if (member.id === state.me || isMaster())\n            makeDraggable(tok, member);\n        layer.append(tok);\n    }\n}\nfunction makeDraggable(tok, member) {\n    let dragging = false;\n    tok.addEventListener('pointerdown', (e) => { if (e.button !== 0)\n        return; e.preventDefault(); e.stopPropagation(); dragging = true; tok.setPointerCapture(e.pointerId); });\n    tok.addEventListener('pointermove', (e) => {\n        if (!dragging)\n            return;\n        const pos = boardPos(e.clientX, e.clientY);\n        tok.style.left = `${pos.x}%`;\n        tok.style.top = `${pos.y}%`;\n    });\n    tok.addEventListener('pointerup', (e) => {\n        if (!dragging)\n            return;\n        dragging = false;\n        const pos = boardPos(e.clientX, e.clientY);\n        send({ type: 'move', targetId: member.id, ...pos });\n    });\n    tok.addEventListener('pointercancel', () => { dragging = false; renderMap(); });\n}\nfunction renderChat() {\n    if (!state)\n        return;\n    const log = $('chat-log');\n    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 65;\n    const oldLast = log.lastElementChild?.getAttribute('data-msg');\n    const newLast = state.chat.at(-1)?.id;\n    if (oldLast === newLast)\n        return;\n    log.replaceChildren();\n    for (const chat of state.chat) {\n        const item = element('div', `message ${chat.kind === 'roll' ? 'roll' : ''}`);\n        item.dataset.msg = chat.id;\n        const title = element('strong', '', chat.sender);\n        const when = element('time', '', new Date(chat.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));\n        title.append(when);\n        const content = element('p', '', chat.text);\n        item.append(title, content);\n        log.append(item);\n    }\n    if (atBottom || !oldLast)\n        log.scrollTop = log.scrollHeight;\n}\nasync function optimizeImage(file, kind) {\n    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))\n        throw new Error('Use apenas JPG, PNG ou WebP.');\n    if (file.size > 16_000_000)\n        throw new Error('Arquivo original muito grande (máximo 16 MB).');\n    const image = await createImageBitmap(file);\n    try {\n        const canvas = document.createElement('canvas');\n        const limit = kind === 'map' ? 2400 : 640;\n        const ratio = Math.min(1, limit / Math.max(image.width, image.height));\n        canvas.width = Math.max(1, Math.round(image.width * ratio));\n        canvas.height = Math.max(1, Math.round(image.height * ratio));\n        const ctx = canvas.getContext('2d');\n        if (!ctx)\n            throw new Error('Seu navegador não conseguiu processar a imagem.');\n        ctx.fillStyle = '#ffffff';\n        ctx.fillRect(0, 0, canvas.width, canvas.height);\n        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);\n        const max = kind === 'map' ? 1_700_000 : 900_000;\n        for (const quality of [0.88, 0.74, 0.58, 0.4]) {\n            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));\n            if (blob && blob.size && blob.size <= max)\n                return blob;\n        }\n        throw new Error('Imagem ainda ficou grande. Use outra foto ou um mapa menor.');\n    }\n    finally {\n        image.close();\n    }\n}\nasync function upload(file, kind) {\n    const optimized = await optimizeImage(file, kind);\n    const result = await api(`/api/rooms/${roomId}/media?kind=${kind}`, {\n        method: 'POST', headers: { 'Content-Type': optimized.type }, body: optimized,\n    });\n    return result.mediaId;\n}\nfunction sheetField(id, value) { input(id).value = String(value); }\nfunction number(id, lo, hi, fallback) {\n    const parsed = Number(input(id).value);\n    return Number.isFinite(parsed) ? Math.min(hi, Math.max(lo, Math.round(parsed))) : fallback;\n}\nfunction openSheet() {\n    const c = requireMe()?.character;\n    portraitFile = null;\n    message('sheet-error', '');\n    sheetField('c-name', c?.name || '');\n    sheetField('c-ancestry', c?.ancestry || 'Humano');\n    sheetField('c-class', c?.className || 'Guerreiro');\n    sheetField('c-level', c?.level ?? 1);\n    sheetField('c-hp', c?.hp ?? 10);\n    sheetField('c-maxhp', c?.maxHp ?? 10);\n    sheetField('c-ac', c?.ac ?? 10);\n    sheetField('c-story', c?.story || '');\n    for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'])\n        sheetField(`c-${key}`, c?.attributes?.[key] ?? 10);\n    const photo = $('photo-preview');\n    photo.replaceChildren();\n    photo.textContent = '✧';\n    if (c?.photoId) {\n        photo.textContent = '';\n        attachPicture(photo, c.photoId);\n    }\n    $('character-dialog').showModal();\n}\nfunction previewPhoto(file) {\n    portraitFile = file;\n    const photo = $('photo-preview');\n    photo.replaceChildren();\n    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 16_000_000) {\n        message('sheet-error', 'Use JPG, PNG ou WebP de até 16 MB; a foto será otimizada.');\n        portraitFile = null;\n        return;\n    }\n    const blob = URL.createObjectURL(file);\n    const img = element('img');\n    img.src = blob;\n    img.onload = () => URL.revokeObjectURL(blob);\n    img.onerror = () => URL.revokeObjectURL(blob);\n    photo.append(img);\n}\nasync function saveSheet(ev) {\n    ev.preventDefault();\n    const button = $('save-sheet');\n    button.disabled = true;\n    message('sheet-error', '');\n    try {\n        const existing = requireMe()?.character;\n        const name = input('c-name').value.trim();\n        if (!name)\n            throw new Error('Dê um nome ao personagem.');\n        const photoId = portraitFile ? await upload(portraitFile, 'portrait') : existing?.photoId || null;\n        const attrs = Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => [a, number(`c-${a}`, 1, 30, 10)]));\n        const c = {\n            name, ancestry: input('c-ancestry').value.trim(), className: input('c-class').value.trim(),\n            level: number('c-level', 1, 20, 1), hp: number('c-hp', 0, 999, 10), maxHp: number('c-maxhp', 1, 999, 10),\n            ac: number('c-ac', 0, 99, 10), story: $('c-story').value.trim(),\n            photoId, attributes: attrs,\n        };\n        if (!send({ type: 'character', character: c }))\n            throw new Error('Aguarde a conexão com a sala.');\n        $('character-dialog').close();\n    }\n    catch (e) {\n        message('sheet-error', errorText(e));\n    }\n    finally {\n        button.disabled = false;\n    }\n}\n$('create-form').addEventListener('submit', createRoom);\n$('join-form').addEventListener('submit', joinRoom);\n$('back-home').addEventListener('click', () => { history.replaceState(null, '', location.pathname); showWelcome(null); message('welcome-error', ''); });\n$('copy-link').addEventListener('click', async () => {\n    const link = new URL(location.href);\n    link.searchParams.set('room', roomId);\n    try {\n        await navigator.clipboard.writeText(link.toString());\n        message('board-message', 'Convite copiado!');\n    }\n    catch {\n        window.prompt('Copie o link de convite:', link.toString());\n    }\n});\n$('edit-character').addEventListener('click', openSheet);\n$('close-sheet').addEventListener('click', () => $('character-dialog').close());\n$('portrait-file').addEventListener('change', (ev) => {\n    const file = ev.target.files?.[0];\n    if (file)\n        previewPhoto(file);\n    ev.target.value = '';\n});\n$('character-form').addEventListener('submit', saveSheet);\n$('map-file').addEventListener('change', async (ev) => {\n    const file = ev.target.files?.[0];\n    if (!file || !isMaster())\n        return;\n    message('board-message', 'Enviando mapa...');\n    try {\n        const mediaId = await upload(file, 'map');\n        send({ type: 'map', mediaId });\n        message('board-message', 'Mapa enviado.');\n    }\n    catch (e) {\n        message('board-message', errorText(e));\n    }\n    ev.target.value = '';\n});\n$('board').addEventListener('click', e => {\n    if (e.target.closest('.token'))\n        return;\n    if (!state)\n        return;\n    const pos = boardPos(e.clientX, e.clientY);\n    send({ type: 'move', targetId: state.me, ...pos });\n});\n$('chat-form').addEventListener('submit', e => {\n    e.preventDefault();\n    const text = input('chat-input').value.trim();\n    if (!text)\n        return;\n    if (send({ type: 'chat', text }))\n        input('chat-input').value = '';\n});\nfor (const btn of document.querySelectorAll('[data-roll]')) {\n    btn.addEventListener('click', () => send({ type: 'roll', faces: Number(btn.dataset.roll?.slice(1)) }));\n}\nwindow.addEventListener('beforeunload', () => {\n    closedByUser = true;\n    for (const value of mediaCache.values())\n        value.then(url => URL.revokeObjectURL(url)).catch(() => { });\n});\nconst current = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';\nif (/^[A-F0-9]{14}$/.test(current)) {\n    const stored = localStorage.getItem(sessionKey(current));\n    if (stored)\n        void enter(current, stored);\n    else\n        showWelcome(current);\n}\nelse\n    showWelcome(null);\n";
const CSS = ":root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#f2e9e5;background:#100f16;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse 70% 65% at 78% 0%,#281b34 0%,transparent 80%),#100f16}button,input,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}[hidden]{display:none!important}.topbar{height:80px;border-bottom:1px solid #3c303c;display:flex;justify-content:space-between;align-items:center;padding:0 clamp(16px,4vw,60px);background:#16121caa}.brand{display:flex;align-items:center;gap:13px}.logo{width:48px;height:48px;display:grid;place-items:center;border:1px solid #a47e4b;border-radius:12px;color:#e9c083;font-size:25px;background:linear-gradient(130deg,#392840,#18151d)}.brand small{display:block;color:#cda873;letter-spacing:.16em;font-weight:800;font-size:9px}.brand strong{display:block;font:24px Georgia,serif;color:#f6e9da;margin-top:4px}.right-head{display:flex;gap:14px;align-items:center}.badge{font-size:12px;color:#d4bbc0}.badge.connected{color:#9cdeb4}.badge.disconnected{color:#e4aa98}.version,.room-code{padding:7px 11px;border:1px solid #493749;border-radius:99px;color:#c7ab8e;font-size:11px;letter-spacing:.08em}.eyebrow{color:#d6a971;letter-spacing:.16em;font-size:11px;font-weight:850}.welcome{display:grid;grid-template-columns:1.15fr minmax(300px,.85fr);align-items:center;max-width:1120px;min-height:calc(100vh - 80px);margin:auto;padding:50px 25px;gap:70px}.hero-text h1{font:normal clamp(43px,6.2vw,78px)/1.06 Georgia,serif;letter-spacing:-.025em;margin:20px 0}.hero-text em{color:#e0b477;font-weight:400}.hero-text p{max-width:490px;color:#bbb0bd;line-height:1.8;font-size:16px}.hero-runes{color:#b29671;letter-spacing:.12em;font-size:12px;margin-top:32px}.welcome-card,.sidebar,.table-panel{background:#1a1722;border:1px solid #423544;border-radius:17px;box-shadow:0 20px 70px #0003}.welcome-card{padding:30px}.welcome-card h2,.sidebar h2,.chat-head h2{font:normal 22px Georgia,serif;margin:0 0 8px}.welcome-card p{font-size:13px;color:#aa9caa;line-height:1.5;margin-bottom:25px}label{display:block;color:#d8cccf;font-size:12px;font-weight:700;letter-spacing:.01em}input:not([type=file]),textarea{margin-top:8px;width:100%;padding:12px 14px;border:1px solid #4a3c4b;border-radius:9px;background:#100e17;color:#f3e9e4;outline:none}input:focus,textarea:focus{border-color:#d0a46b}.welcome-card label{margin:17px 0}.gold-btn,.btn{border:1px solid #6b5360;padding:11px 14px;border-radius:9px;transition:.15s ease;color:#eadbd1;font-size:13px;font-weight:750;background:#2a2230;white-space:nowrap}.gold-btn{background:linear-gradient(115deg,#bf925b,#efd19c);border-color:#e2bf89;color:#241922}.gold-btn:hover,.btn:hover{filter:brightness(1.12)}.welcome-card .gold-btn{width:100%;margin-top:8px;padding:14px}.text-btn{border:0;background:transparent;color:#e2b478;text-decoration:underline;margin-top:16px}.error{color:#ffb5a9;font-size:12px;min-height:16px}.game{margin:0 auto;padding:27px clamp(12px,2vw,30px) 34px;max-width:1780px}.game-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:22px}.game-head h1{font:normal clamp(24px,3vw,37px) Georgia,serif;margin:6px 0 0}.game-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.game-layout{display:grid;grid-template-columns:230px minmax(0,1fr) 320px;gap:15px;align-items:stretch;min-height:620px}.sidebar{padding:18px;min-width:0}.players-panel h2{display:flex;align-items:center;justify-content:space-between}.count{font:13px ui-sans-serif,sans-serif;color:#d3ae77;border:1px solid #5b494b;border-radius:99px;padding:4px 8px}.players{display:grid;gap:9px;margin-top:21px}.player{display:flex;align-items:center;gap:10px;padding:9px;background:#221c2a;border:1px solid #3b313f;border-radius:11px;min-width:0}.player-avatar{border:2px solid #9d724a;flex:none;border-radius:50%;width:43px;height:43px;object-fit:cover;background:#453145;display:grid;place-items:center;font-size:18px}.player-info{min-width:0}.player-info strong{font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.player-info small{display:block;margin-top:3px;color:#ad9aad;font-size:10px}.panel-foot{margin-top:22px;border-top:1px solid #3b313f;padding-top:16px;color:#a69aa7;font-size:11px;line-height:1.6}.table-panel{overflow:hidden;min-width:0;display:flex;flex-direction:column}.table-toolbar,.board-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:17px 18px}.table-toolbar{border-bottom:1px solid #413643}.table-toolbar strong{font-size:14px;display:block}.table-toolbar small{font-size:11px;color:#a797a4;margin-top:6px;display:block}.map-buttons{display:flex;gap:9px}.board{position:relative;background:radial-gradient(ellipse at 50% 50%,#30263b,#1a1625 73%);aspect-ratio:16/11;overflow:hidden;user-select:none;touch-action:none;min-height:400px}.board>img{width:100%;height:100%;object-fit:fill;position:absolute;inset:0}.board-grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff15 1px,transparent 1px),linear-gradient(90deg,#ffffff15 1px,transparent 1px);background-size:7.14% 10%;pointer-events:none}.board-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;color:#9e91a2;pointer-events:none;padding:16px}.board-center span{font:72px Georgia,serif;color:#a17b6c}.board-center strong{font:21px Georgia,serif;color:#c6b0a5}.board-center small{max-width:270px;line-height:1.6}.token-layer{position:absolute;inset:0;pointer-events:none}.token{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;border:3px solid #b49b75;background:#252031;box-shadow:0 0 0 3px #111a,0 8px 22px #0009;display:grid;place-items:center;color:#f8deaf;font-size:22px;touch-action:none;cursor:grab}.token.mine{border-color:#efcb8f;box-shadow:0 0 0 3px #ecc98144,0 8px 22px #000a}.token.master{border-color:#da9cd6}.token img{width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none}.token label{position:absolute;top:54px;left:50%;transform:translateX(-50%);white-space:nowrap;max-width:120px;text-overflow:ellipsis;overflow:hidden;background:#110f19de;border:1px solid #58404b;border-radius:5px;padding:3px 6px;font-size:10px;color:#fff;pointer-events:none}.board-footer{border-top:1px solid #463b49;font-size:10px;color:#96899a;flex-wrap:wrap}.chat-panel{display:flex;flex-direction:column;min-height:620px;padding:0}.chat-head{padding:20px 17px 16px;border-bottom:1px solid #423643}.chat-head h2{font-size:20px}.chat-head small{color:#a998a9}.chat-log{flex:1;min-height:270px;max-height:590px;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:11px}.message{font-size:12px;background:#231d2a;border:1px solid #392e3c;padding:10px 11px;border-radius:10px;line-height:1.55;overflow-wrap:anywhere}.message strong{display:block;color:#e6bb83;margin-bottom:4px;font-size:11px}.message.roll{background:#302331;border-color:#69506a}.message.roll strong{color:#e6cb8c}.message time{font-size:10px;color:#91818f;font-weight:400;float:right}.message p{white-space:pre-wrap;margin:0}.chat-form{display:flex;gap:7px;padding:0 13px 10px}.chat-form input{min-width:0;margin:0}.chat-form button{border:1px solid #ad8559;background:#d5ad76;color:#291c20;font-size:18px;border-radius:8px;padding:0 12px}.dice-bar{border-top:1px solid #443744;padding:12px;display:flex;align-items:center;gap:4px;justify-content:space-between}.dice-bar span{color:#b8a8b2;font-size:11px;white-space:nowrap}.dice-bar button{border:1px solid #594453;background:#322534;color:#efcd9c;border-radius:7px;font-size:11px;padding:8px 6px}.character-dialog{width:min(850px,calc(100vw - 18px));max-height:92vh;overflow:auto;background:#1b1722;color:#f4ebea;border:1px solid #8a6950;border-radius:17px;padding:0;box-shadow:0 35px 85px #000b}.character-dialog::backdrop{background:#08070aba;backdrop-filter:blur(5px)}.dialog-head{padding:19px 24px;border-bottom:1px solid #4a3948;display:flex;justify-content:space-between;align-items:center}.dialog-head h2{font:29px Georgia,serif;margin:5px 0 0}.close-btn{border:0;background:#312735;color:white;border-radius:7px;padding:9px 11px}.sheet-layout{display:grid;grid-template-columns:210px 1fr;gap:20px;padding:22px}.sheet-photo{text-align:center}.photo-preview{width:175px;height:175px;margin:0 auto 17px;border-radius:50%;border:4px solid #76553f;background:#34283c;display:grid;place-items:center;font:75px Georgia,serif;color:#cbaa79;overflow:hidden}.photo-preview img{width:100%;height:100%;object-fit:cover}.sheet-photo p{font-size:11px;color:#a696a7;line-height:1.55}.sheet-details label{margin:0 0 12px}.sheet-details input,.sheet-details textarea{padding:9px 10px;font-size:13px;margin-top:5px}.sheet-details textarea{width:100%;resize:vertical}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:0 11px}.subheading{font-size:12px;color:#d8ae77;display:block;margin-bottom:10px}.attributes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:14px}.attributes label{text-align:center;font-size:10px;color:#ccbbad}.attributes input{text-align:center;padding:8px 3px}.dialog-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #433546;padding:15px 21px}.dialog-actions .error{max-width:65%}@media(max-width:1150px){.game-layout{grid-template-columns:200px minmax(0,1fr)}.chat-panel{grid-column:1/-1;min-height:370px}.chat-log{max-height:300px}.board{aspect-ratio:16/10}.welcome{gap:25px}}@media(max-width:700px){.topbar{height:67px}.logo{width:37px;height:37px}.brand strong{font-size:17px}.version{display:none}.welcome{grid-template-columns:1fr;padding:40px 16px;gap:27px}.hero-text h1{font-size:46px}.game-head{align-items:start;flex-direction:column}.game-layout{grid-template-columns:1fr}.players-panel{grid-row:2}.chat-panel{grid-column:1}.board{min-height:330px}.game-actions .btn,.game-actions .gold-btn{padding:9px}.sheet-layout{grid-template-columns:1fr}.sheet-photo{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center}.photo-preview{margin:0;width:100px;height:100px;font-size:45px}.sheet-photo p{width:100%}.attributes{grid-template-columns:repeat(3,minmax(0,1fr))}.table-toolbar{flex-wrap:wrap}.player{display:inline-flex;margin-right:6px}.players{display:block}}\n";

const err = (reason, status = 400) => Response.json({ error: reason }, { status, headers: { 'Cache-Control': 'no-store' } });
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const sane = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bounded = (value, min, max, fallback) => {
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
const hash = async (value) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
};
function normalizeCharacter(data) {
    if (!data || typeof data !== 'object')
        return null;
    const d = data;
    const name = sane(d.name, 60);
    if (!name)
        return null;
    const attrs = (d.attributes && typeof d.attributes === 'object' ? d.attributes : {});
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
function safeImage(bytes, declared) {
    const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const riff = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    return (declared === 'image/png' && png) || (declared === 'image/jpeg' && jpeg) || (declared === 'image/webp' && riff);
}
export class GameRoom extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => {
            // Uma instrução por chamada, compatível com a API SQLite do Durable Object.
            this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id TEXT PRIMARY KEY, name TEXT NOT NULL, map_id TEXT)');
            this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, character TEXT, x REAL NOT NULL DEFAULT 50, y REAL NOT NULL DEFAULT 50)');
            this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, member_id TEXT NOT NULL, sender TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL)');
            this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner_id TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, size INTEGER NOT NULL)');
        });
    }
    room() {
        return this.ctx.storage.sql.exec('SELECT * FROM room LIMIT 1').toArray()[0];
    }
    memberById(id) {
        return this.ctx.storage.sql.exec('SELECT * FROM members WHERE id = ?', id).toArray()[0];
    }
    async memberByToken(secret) {
        if (!/^[a-f0-9]{64}$/.test(secret))
            return undefined;
        return this.ctx.storage.sql.exec('SELECT * FROM members WHERE token_hash = ?', await hash(secret)).toArray()[0];
    }
    mediaRow(id) {
        return this.ctx.storage.sql.exec('SELECT * FROM media WHERE id = ?', id).toArray()[0];
    }
    publicState(me) {
        const info = this.room();
        if (!info)
            throw new Error('Mesa não encontrada');
        const live = new Set(this.ctx.getWebSockets().map(ws => ws.deserializeAttachment()?.memberId).filter(Boolean));
        const members = this.ctx.storage.sql.exec('SELECT * FROM members ORDER BY role ASC, name ASC').toArray();
        const chat = this.ctx.storage.sql.exec('SELECT * FROM chat ORDER BY rowid DESC LIMIT 80').toArray().reverse().map(m => ({ id: m.id, memberId: m.member_id, sender: m.sender, kind: m.kind, text: m.text, createdAt: m.created_at }));
        return {
            id: info.id, name: info.name, mapId: info.map_id, me,
            members: members.map(m => ({
                id: m.id, name: m.name, role: m.role,
                character: m.character ? JSON.parse(m.character) : null,
                x: m.x, y: m.y, online: live.has(m.id),
            })), chat,
        };
    }
    pushStates() {
        for (const ws of this.ctx.getWebSockets()) {
            const attach = ws.deserializeAttachment();
            if (!attach?.memberId)
                continue;
            try {
                ws.send(JSON.stringify({ type: 'snapshot', state: this.publicState(attach.memberId) }));
            }
            catch { /* A conexão caiu, o runtime fechará o socket. */ }
        }
    }
    addChat(memberId, sender, kind, text) {
        this.ctx.storage.sql.exec('INSERT INTO chat VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), memberId, sender, kind, text, Date.now());
        // Retém apenas 120 mensagens para manter este MVP leve.
        this.ctx.storage.sql.exec('DELETE FROM chat WHERE rowid NOT IN (SELECT rowid FROM chat ORDER BY rowid DESC LIMIT 120)');
    }
    async initialize(roomId, roomName, masterName, secret) {
        if (this.room())
            return null;
        const memberId = crypto.randomUUID();
        const tokenHash = await hash(secret);
        this.ctx.storage.sql.exec('INSERT INTO room (id, name, map_id) VALUES (?, ?, NULL)', roomId, sane(roomName, 70) || 'Aventura');
        this.ctx.storage.sql.exec('INSERT INTO members (id, name, role, token_hash, character, x, y) VALUES (?, ?, ?, ?, NULL, ?, ?)', memberId, sane(masterName, 32) || 'Mestre', 'mestre', tokenHash, 50, 48);
        this.addChat(memberId, 'Sistema', 'system', 'A mesa foi criada. Que os dados contem boas histórias!');
        return { memberId };
    }
    async join(name, secret) {
        if (!this.room())
            return { memberId: '', error: 'Sala não encontrada.' };
        const tokenHash = await hash(secret);
        const count = this.ctx.storage.sql.exec("SELECT COUNT(*) as total FROM members WHERE role = 'jogador'").one().total;
        if (count >= 8)
            return { memberId: '', error: 'Mesa cheia: limite de 8 jogadores.' };
        const memberId = crypto.randomUUID();
        const pos = this.ctx.storage.sql.exec('SELECT COUNT(*) as total FROM members').one().total;
        this.ctx.storage.sql.exec('INSERT INTO members VALUES (?, ?, ?, ?, NULL, ?, ?)', memberId, sane(name, 32) || 'Aventureiro', 'jogador', tokenHash, 20 + (pos % 5) * 14, 55 + Math.floor(pos / 5) * 15);
        this.addChat(memberId, 'Sistema', 'system', `${sane(name, 32) || 'Aventureiro'} entrou na aventura.`);
        this.pushStates();
        return { memberId };
    }
    async whoAmI(secret) {
        const m = await this.memberByToken(secret);
        return m ? { id: m.id, role: m.role } : null;
    }
    async snapshot(secret) {
        const m = await this.memberByToken(secret);
        return m ? this.publicState(m.id) : null;
    }
    async saveMedia(secret, id, kind, mime, bytes) {
        const member = await this.memberByToken(secret);
        if (!member || (kind === 'map' && member.role !== 'mestre'))
            return false;
        if (bytes.byteLength === 0 || bytes.byteLength > (kind === 'map' ? 1_700_000 : 900_000))
            return false;
        const tally = this.ctx.storage.sql.exec('SELECT COALESCE(SUM(size),0) as total, COUNT(*) as count FROM media').one();
        if (tally.total + bytes.byteLength > 18_000_000 || tally.count >= 30)
            return false;
        this.ctx.storage.sql.exec('INSERT INTO media VALUES (?, ?, ?, ?, ?, ?)', id, kind, member.id, mime, bytes, bytes.byteLength);
        return true;
    }
    async readMedia(secret, id) {
        if (!(await this.memberByToken(secret)))
            return null;
        const row = this.mediaRow(id);
        return row ? { mime: row.mime, bytes: row.bytes } : null;
    }
    async fetch(request) {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
            return err('Upgrade WebSocket esperado.', 426);
        const secret = request.headers.get('X-Arcane-Token') ?? '';
        const member = await this.memberByToken(secret);
        if (!member)
            return err('Sessão inválida.', 401);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ memberId: member.id });
        server.send(JSON.stringify({ type: 'snapshot', state: this.publicState(member.id) }));
        this.pushStates();
        return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'arcane-v1' } });
    }
    recentActions = new Map();
    throttle(memberId, kind, minimumInterval) {
        const key = `${memberId}:${kind}`, now = Date.now();
        const last = this.recentActions.get(key) ?? 0;
        if (now - last < minimumInterval)
            return true;
        this.recentActions.set(key, now);
        return false;
    }
    async webSocketMessage(ws, message) {
        const attachment = ws.deserializeAttachment();
        const m = attachment?.memberId && this.memberById(attachment.memberId);
        if (!m || typeof message !== 'string' || message.length > 5000)
            return;
        let payload;
        try {
            payload = JSON.parse(message);
        }
        catch {
            return;
        }
        switch (payload.type) {
            case 'chat': {
                if (this.throttle(m.id, 'chat', 650))
                    return;
                const msg = sane(payload.text, 600);
                if (!msg)
                    return;
                this.addChat(m.id, m.character ? JSON.parse(m.character).name : m.name, 'chat', msg);
                break;
            }
            case 'roll': {
                if (this.throttle(m.id, 'roll', 450))
                    return;
                const faces = bounded(payload.faces, 0, 100, 0);
                if (![4, 6, 8, 10, 12, 20, 100].includes(faces))
                    return;
                const bytes = new Uint32Array(1);
                const ceiling = Math.floor(2 ** 32 / faces) * faces;
                do {
                    crypto.getRandomValues(bytes);
                } while (bytes[0] >= ceiling);
                const outcome = (bytes[0] % faces) + 1;
                this.addChat(m.id, m.character ? JSON.parse(m.character).name : m.name, 'roll', `🎲 d${faces}: ${outcome}`);
                break;
            }
            case 'character': {
                if (this.throttle(m.id, 'character', 350))
                    return;
                const c = normalizeCharacter(payload.character);
                if (!c)
                    return;
                if (c.photoId) {
                    const media = this.mediaRow(c.photoId);
                    if (!media || media.kind !== 'portrait' || media.owner_id !== m.id)
                        return;
                }
                this.ctx.storage.sql.exec('UPDATE members SET character = ? WHERE id = ?', JSON.stringify(c), m.id);
                break;
            }
            case 'move': {
                if (this.throttle(m.id, 'move', 80))
                    return;
                const target = sane(payload.targetId, 36) || m.id;
                if (target !== m.id && m.role !== 'mestre')
                    return;
                if (!this.memberById(target))
                    return;
                const x = Number(payload.x), y = Number(payload.y);
                if (!Number.isFinite(x) || !Number.isFinite(y))
                    return;
                this.ctx.storage.sql.exec('UPDATE members SET x = ?, y = ? WHERE id = ?', Math.max(4, Math.min(96, x)), Math.max(5, Math.min(95, y)), target);
                break;
            }
            case 'map': {
                if (m.role !== 'mestre')
                    return;
                const id = sane(payload.mediaId, 36);
                const media = this.mediaRow(id);
                if (!media || media.kind !== 'map')
                    return;
                this.ctx.storage.sql.exec('UPDATE room SET map_id = ?', id);
                this.addChat(m.id, 'Sistema', 'system', 'O mestre revelou um novo mapa.');
                break;
            }
            default: return;
        }
        this.pushStates();
    }
    webSocketClose(_ws) { this.pushStates(); }
    webSocketError(_ws) { this.pushStates(); }
}
const parseSecret = (request) => {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '');
    return match?.[1] ?? '';
};
const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store',
};
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (!url.pathname.startsWith('/api/')) {
      const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' ws: wss:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
      const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':csp };
      if (request.method !== 'GET' && request.method !== 'HEAD') return err('Método indisponível.', 405);
      if (url.pathname === '/' || url.pathname === '/index.html') return new Response(request.method === 'HEAD' ? null : HTML, { headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'} });
      if (url.pathname === '/client.js') return new Response(request.method === 'HEAD' ? null : CLIENT, { headers: {...headers, 'Content-Type': 'application/javascript; charset=utf-8'} });
      if (url.pathname === '/styles.css') return new Response(request.method === 'HEAD' ? null : CSS, { headers: {...headers, 'Content-Type': 'text/css; charset=utf-8'} });
      return err('Rota não encontrada.', 404);
    }
        if (request.method === 'OPTIONS')
            return err('Método indisponível.', 405);
        // Evita acesso cross-origin e upgrades iniciados por outros sites.
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin)
            return err('Origem não permitida.', 403);
        try {
            if (url.pathname === '/api/health' && request.method === 'GET')
                return json({ ok: true, project: 'arcane-table', version: '0.3.0-beta', storage: 'durable-objects' });
            if (url.pathname === '/api/rooms' && request.method === 'POST') {
                const data = await request.json();
                const name = sane(data.name, 70), host = sane(data.host, 32);
                if (!name || !host)
                    return err('Preencha o nome da sala e do mestre.');
                const id = code(), secret = token();
                const created = await env.ROOMS.getByName(id).initialize(id, name, host, secret);
                if (!created)
                    return err('Falha ao criar sala. Tente novamente.', 409);
                return json({ roomId: id, token: secret, memberId: created.memberId }, 201);
            }
            const parts = /^\/api\/rooms\/([A-Fa-f0-9]{14})(?:\/(join|state|ws|media)(?:\/([a-f0-9-]{36}))?)?$/.exec(url.pathname);
            if (!parts)
                return err('Rota não encontrada.', 404);
            const roomId = parts[1].toUpperCase(), action = parts[2] || '', mediaId = parts[3] || '';
            const stub = env.ROOMS.getByName(roomId);
            if (action === 'join' && request.method === 'POST') {
                const data = await request.json();
                const player = sane(data.name, 32);
                if (!player)
                    return err('Informe seu nome.');
                const secret = token(), joined = await stub.join(player, secret);
                if (joined.error)
                    return err(joined.error, joined.error.includes('cheia') ? 409 : 404);
                return json({ roomId, token: secret, memberId: joined.memberId }, 201);
            }
            if (action === 'ws' && request.method === 'GET') {
                if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
                    return err('WebSocket necessário.', 426);
                const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map(x => x.trim());
                const auth = protocols.find(x => /^auth\.[a-f0-9]{64}$/.test(x));
                if (!protocols.includes('arcane-v1') || !auth)
                    return err('Protocolo inválido.', 401);
                const headers = new Headers({ Upgrade: 'websocket', 'X-Arcane-Token': auth.slice(5) });
                return stub.fetch(new Request(`https://room.internal/ws`, { headers }));
            }
            const secret = parseSecret(request);
            if (!secret)
                return err('Acesso não autorizado.', 401);
            if (action === 'state' && request.method === 'GET') {
                const state = await stub.snapshot(secret);
                return state ? json({ state }) : err('Sessão inválida ou expirada.', 401);
            }
            if (action === 'media' && !mediaId && request.method === 'POST') {
                const kind = url.searchParams.get('kind');
                if (kind !== 'portrait' && kind !== 'map')
                    return err('Tipo inválido.');
                const user = await stub.whoAmI(secret);
                if (!user || (kind === 'map' && user.role !== 'mestre'))
                    return err('Sem permissão.', 403);
                const mime = (request.headers.get('Content-Type') ?? '').split(';')[0];
                const max = kind === 'map' ? 1_700_000 : 900_000;
                const len = Number(request.headers.get('Content-Length') ?? -1);
                if (len > max)
                    return err('Imagem muito grande. Reduza a resolução.', 413);
                const bytes = new Uint8Array(await request.arrayBuffer());
                if (!bytes.byteLength || bytes.byteLength > max)
                    return err('Imagem vazia ou excedeu o limite.', 413);
                if (!safeImage(bytes, mime))
                    return err('Imagem inválida; use JPG, PNG ou WebP.');
                const id = crypto.randomUUID();
                if (!await stub.saveMedia(secret, id, kind, mime, bytes))
                    return err('Limite de armazenamento da sala atingido ou acesso negado.', 413);
                return json({ mediaId: id }, 201);
            }
            if (action === 'media' && mediaId && request.method === 'GET') {
                const media = await stub.readMedia(secret, mediaId);
                if (!media)
                    return err('Imagem não encontrada ou sem permissão.', 404);
                return new Response(media.bytes, {
                    headers: { ...baseHeaders, 'Content-Type': media.mime },
                });
            }
            return err('Rota não encontrada.', 404);
        }
        catch (e) {
            console.error(JSON.stringify({ route: url.pathname, method: request.method, message: e instanceof Error ? e.message : 'Unexpected error' }));
            return err('Erro interno. Tente novamente.', 500);
        }
    },
};
