/* Shared V3.5.1 assignment state and durable delivery. No DOM is required by the factory. */
(function (global) {
  'use strict';
  const ACTIVE = new Set(['pending', 'accepted', 'active']);
  const TERMINAL = new Set(['completed', 'cancelled', 'declined']);
  function memberStatus(row, userId) {
    if (!row) return 'pending';
    if (row.status === 'cancelled' || row.task_status === 'cancelled') return 'cancelled';
    return row.member_states?.[userId]?.status || row.status || 'pending';
  }
  function memberView(row, userId) {
    if (!row) return null;
    return {...row, task_status: row.task_status || row.status, status: memberStatus(row, userId)};
  }
  function createClient({getContext, storage, makeId = () => global.crypto.randomUUID(), now = () => Date.now(), changed = () => {}, locks = global.navigator?.locks}) {
    const inflight = new Map();
    const prefix = c => `ktak35.outbox.v1.${c.roomId}.${c.userId}.`;
    const context = () => {
      const c = getContext();
      if (!c?.roomId || !c?.userId || !c?.sb) throw new Error('請先加入任務房間');
      return c;
    };
    const sameContext = c => {try {const n = context(); return c.roomId === n.roomId && c.userId === n.userId && c.sb === n.sb;} catch {return false;}};
    function list(c = context()) {
      const rows = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix(c))) continue;
        let item;
        try {item = JSON.parse(storage.getItem(key));} catch {throw new Error('待送回報資料無法讀取，請保留資料並回報問題');}
        if (!item || item.roomId !== c.roomId || item.userId !== c.userId || key !== prefix(c) + item.id) throw new Error('待送回報的房間或身分不符');
        rows.push(item);
      }
      return rows.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    }
    function save(c, item) {storage.setItem(prefix(c) + item.id, JSON.stringify(item)); changed();}
    const pendingFor = (id, c = context()) => list(c).find(x => x.assignmentId === id);
    async function send(c, item) {
      if (!sameContext(c)) throw new Error('房間已切換，回報已保留');
      const rpc = item.commander ? 'ktak35_command_assignment_state' : 'ktak35_respond_assignment';
      const args = item.commander
        ? {p_assignment_id: item.assignmentId, p_status: item.status}
        : {p_assignment_id: item.assignmentId, p_status: item.status, p_operation_id: item.id, p_expected_revision: item.expectedRevision};
      const {data, error} = await c.sb.rpc(rpc, args);
      if (error) throw error;
      if (!data || data.id !== item.assignmentId || data.room_id !== c.roomId || !data.member_states) throw new Error('伺服器未確認回報，資料已保留');
      if (item.commander ? data.status !== item.status : data.member_states[c.userId]?.operations?.[item.id] !== item.status) throw new Error('伺服器未確認此筆回報，資料已保留');
      return data;
    }
    function flush({retry = false} = {}) {
      let c;
      try {c = context();} catch {return Promise.resolve({sent: 0});}
      const key = prefix(c);
      if (inflight.has(key)) return inflight.get(key);
      const run = async () => {
        let sent = 0;
        const results = new Map();
        for (const original of list(c)) {
          if (!sameContext(c) || global.navigator?.onLine === false) break;
          if (original.blocked && !retry) continue;
          // Another tab may already have acknowledged this operation.
          if (!storage.getItem(prefix(c) + original.id)) continue;
          try {
            const row = await send(c, original);
            // Remove only the acknowledged operation, never a snapshot of the queue.
            storage.removeItem(prefix(c) + original.id);
            results.set(original.id, row); sent++; changed();
          } catch (error) {
            const permanent = ['42501', '23514', 'P0001'].includes(error?.code);
            save(c, {...original, attempts: (original.attempts || 0) + 1, blocked: permanent,
              error: permanent ? '任務狀態或權限已改變，請確認任務後重試' : '尚未送達，恢復連線後會重試'});
            if (!permanent) break;
          }
        }
        return {sent, results};
      };
      // Defer the work until the promise is registered, including synchronous mocks.
      const promise = Promise.resolve().then(() => locks?.request ? locks.request(key, run) : run()).finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    }
    async function respond(row, status, {commander = false} = {}) {
      const c = context();
      if (!row?.id || row.room_id !== c.roomId) throw new Error('任務不屬於目前房間');
      if (!commander && !(row.assigned_to || []).includes(c.userId)) throw new Error('這項任務未派給你');
      if (pendingFor(row.id, c)) throw new Error('這項任務已有待送回報，請先完成同步');
      const item = {id: makeId(), roomId: c.roomId, userId: c.userId, assignmentId: row.id,
        title: row.title || '任務回報', status, commander, expectedRevision: Number(row.member_states?.[c.userId]?.revision || 0), createdAt: now()};
      // Persist before the first request so a closed tab or lost response cannot lose it.
      save(c, item);
      const out = await flush();
      const acknowledged = !storage.getItem(prefix(c) + item.id);
      return {queued: !acknowledged, row: out.results?.get(item.id) || null};
    }
    async function discard(id) {
      const c = context(), key = prefix(c);
      if (inflight.has(key)) await inflight.get(key);
      if (!sameContext(c)) throw new Error('房間已切換');
      storage.removeItem(key + id); changed();
    }
    return {list, respond, flush, discard, pendingFor, memberStatus, memberView};
  }
  global.KTAK35Operations = {version:'3.5.1',createClient, memberStatus, memberView, ACTIVE, TERMINAL};
  if (!global.document) return;
  const core = () => global.__KTAK35_CORE;
  let client;
  function renderQueue() {
    if (!client || !core()?.roomUuid || !core()?.userId) {document.getElementById('v351Delivery')?.replaceChildren();return;}
    const r=core().roomUuid,u=core().userId,legacyKey=`ktak35.pending.${r}`;
    let items=[],general=[],legacy=[],readError='';
    try {items = client.list();general=global.__KTAK35_PENDING?.list?.()||[];legacy=JSON.parse(localStorage.getItem(legacyKey)||'[]');if(!Array.isArray(legacy))throw Error('舊版待送資料格式異常');} catch (e) {readError=e.message;legacy=[];}
    let panel = document.getElementById('v351Delivery');
    if (!panel) {
      const target = document.getElementById('commandPage');
      if (!target) return;
      panel = document.createElement('section'); panel.id = 'v351Delivery'; panel.className = 'v35Card'; target.prepend(panel);
    }
    panel.replaceChildren(); panel.hidden = !(items.length||general.length||legacy.length||readError);
    if(panel.hidden)return;
    const heading = document.createElement('h3'); heading.textContent = `待送回報 · ${items.length+general.length}`; panel.append(heading);
    const note = document.createElement('p'); note.textContent = '以下回報尚未送達。請保持連線，或確認目前任務狀態後重新同步。'; panel.append(note);
    const retry = document.createElement('button'); retry.textContent = '重新同步';
    retry.onclick = async () => {retry.disabled = true; try {await client.flush({retry:true}); await global.__KTAK35_PENDING?.flush?.(); await global.__KTAK35?.refresh?.();} catch(e){core()?.toast?.(e.message)} finally {renderQueue();}}; panel.append(retry);
    for (const item of items) {
      const row = document.createElement('p'), text = document.createElement('span'), remove = document.createElement('button');
      text.textContent = `${item.title}：${({accepted:'接受',active:'開始執行',completed:'完成',declined:'無法執行',cancelled:'取消'})[item.status] || item.status} · ${item.error || '等待伺服器確認'} `;
      remove.textContent = '移除此筆待送回報';
      remove.onclick = async () => {if (global.confirm('移除後不會再重送這筆回報。請先確認任務目前狀態。')) {await client.discard(item.id); renderQueue();}};
      row.append(text, remove); panel.append(row);
    }
    for(const item of general){
      const row=document.createElement('p'),remove=document.createElement('button');
      row.textContent=({status:'隊員狀態',sector:'搜索區',floor:'樓層狀態'})[item.kind]+' · '+(item.error||'等待送達')+' ';
      remove.textContent='移除此筆待送回報';remove.onclick=async()=>{if(r!==core()?.roomUuid||u!==core()?.userId)return;if(global.confirm('移除後不會再重送這筆回報。請先確認目前狀態。'))await global.__KTAK35_PENDING.discard(item.operationId);};
      row.append(remove);panel.append(row);
    }
    if(legacy.length||readError){
      const details=document.createElement('details'),summary=document.createElement('summary'),explanation=document.createElement('p');
      summary.textContent='舊版待送紀錄 · '+legacy.length+' 筆';details.append(summary);
      explanation.textContent=readError||'舊版沒有記錄操作人的身分，因此這些紀錄已保留，需確認目前帳號與任務狀態後，再由畫面重新操作。';details.append(explanation);
      for(const item of legacy){const p=document.createElement('p');p.textContent=({status:'隊員狀態',sector:'搜索區',floor:'樓層狀態','assignment-state':'任務回報'})[item.kind]+' · '+(item.status||item.patch?.status||'待確認')+(item.id?' · '+String(item.id).slice(0,8):'')+' · '+(item.queuedAt||'時間未記錄');details.append(p);}
      const download=document.createElement('button');download.textContent='匯出保留紀錄';download.onclick=()=>{
        if(r!==core()?.roomUuid||u!==core()?.userId)return;
        const url=URL.createObjectURL(new Blob([localStorage.getItem(legacyKey)||'[]'],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download='ktak-legacy-offline.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      };details.append(download);
      const archive=document.createElement('button');archive.textContent='已確認，封存舊紀錄';archive.onclick=()=>{
        if(r!==core()?.roomUuid||u!==core()?.userId)return;
        if(global.confirm('請確認需要的回報已重新操作。封存會保留一份原始紀錄，停止顯示此提醒。')){
          localStorage.setItem(`ktak35.pending.archived.${r}.${Date.now()}`,localStorage.getItem(legacyKey)||'[]');localStorage.removeItem(legacyKey);renderQueue();
        }
      };details.append(archive);panel.append(details);
    }
  }
  client = createClient({getContext: () => ({roomId:core()?.roomUuid,userId:core()?.userId,sb:core()?.sb}),storage:global.localStorage,changed:()=>queueMicrotask(renderQueue)});
  global.__KTAK35_ASSIGNMENTS = client;
  const recover = () => client.flush().then(async out => {renderQueue(); if (out.sent) {await global.__KTAK35?.refresh?.(); await global.__KTAK35_ASSIGNMENT_PROMPT14?.refresh?.(false);}}).catch(e => console.warn('KTAK delivery', e));
  global.addEventListener('online', recover);
  global.addEventListener('storage', renderQueue);
  global.addEventListener('ktak35:delivery', renderQueue);
  document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') recover();});
  setInterval(() => {if (document.visibilityState === 'visible') recover();}, 30000);
  setTimeout(recover, 1500);
})(globalThis);
