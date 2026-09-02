if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Error:', err)); }); }

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
const customSwal = Swal.mixin({ confirmButtonColor: '#4361ee', cancelButtonColor: '#8d99ae' });

let kpiSettingsCache = []; 
let inventoryDataCache=[], currentCalDate=new Date(), calendarEvents=[], myChart=null, selectedItems=new Set(), currentMemoCode="", sortCol=4, sortAsc=false, logoClickCount=0;
let logDataCache = [], bomDataCache = [], itemMasterCache = [], incomingDataCache = [], isAdmin = false;

const holidays2026 = { "2026-01-01": "신정", "2026-02-16": "설날 전날", "2026-02-17": "설날", "2026-02-18": "설날 다음날", "2026-03-01": "삼일절", "2026-05-05": "어린이날", "2026-08-15": "광복절", "2026-09-25": "추석", "2026-10-03": "개천절", "2026-10-09": "한글날", "2026-12-25": "성탄절" };

function toggleMobileMenu() { if (window.innerWidth > 768) { document.querySelector('.sidebar').classList.toggle('collapsed'); } else { document.getElementById('mainMenu').classList.toggle('open'); } }
function closeMobileMenu(){ document.getElementById('mainMenu').classList.remove('open'); }

function toggleSubmenu(id) { 
    if (window.innerWidth > 768) { const sidebar = document.querySelector('.sidebar'); if (sidebar && sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed'); }
    const targetSub = document.getElementById(id); if (!targetSub) return;
    document.querySelectorAll('.submenu').forEach(sub => { if (sub.id !== id) sub.classList.remove('open'); });
    targetSub.classList.toggle('open'); document.querySelectorAll('.menu-item').forEach(e => e.classList.remove('active'));
    if (targetSub.previousElementSibling) targetSub.previousElementSibling.classList.add('active');
}
function clickProdMenu(pageId, el) { document.querySelectorAll('.submenu-item').forEach(e => e.classList.remove('active-sub')); el.classList.add('active-sub'); switchPage(pageId, document.getElementById('menuProdMain')); }

function switchPage(pid, el) { 
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value !== '') {
        searchInput.value = ''; 
        if (typeof filterTableByKeyword === 'function') filterTableByKeyword(''); 
        if (typeof closeFeatured === 'function') closeFeatured(); 
    }
    resetMultiSelection(); 
    if (el) { document.querySelectorAll('.menu-item').forEach(e => e.classList.remove('active')); el.classList.add('active'); document.querySelectorAll('.submenu').forEach(sub => { if (el.nextElementSibling !== sub) sub.classList.remove('open'); }); } 
    document.querySelectorAll('.page-section').forEach(e => e.classList.remove('active-page')); 
    const targetPage = document.getElementById('page-' + pid); if (targetPage) targetPage.classList.add('active-page'); 
    
    const kpi = document.getElementById('kpiSection'); const miniKpi = document.getElementById('miniKpiSection');
    if (pid === 'dashboard') { if(kpi) kpi.style.display = 'grid'; if(miniKpi) miniKpi.style.display = 'flex'; } else { if(kpi) kpi.style.display = 'none'; if(miniKpi) miniKpi.style.display = 'none'; } 
    if (pid === 'system_log') { loadSystemLogs(); }
}

window.onload = function() {
    checkAuthStatus(); toggleAutoRefreshState(true); 
    loadKpiSettings();
    
    try { if(typeof loadItemMaster === 'function') loadItemMaster(); } catch(e) {}
    try { if(typeof loadSettings === 'function') loadSettings(); } catch(e) {}
    try { if(typeof loadNotices === 'function') loadNotices(); } catch(e) {}
    try { if(typeof loadDDays === 'function') loadDDays(); } catch(e) {}
    try { if(typeof loadLogs === 'function') loadLogs(); } catch(e) {}
    try { if(typeof loadArchive === 'function') loadArchive(); } catch(e) {}
    try { if(typeof loadBoard === 'function') loadBoard(); } catch(e) {}
    try { if(typeof loadCalendarEvents === 'function') loadCalendarEvents(); } catch(e) {}
    try { if(typeof loadHistory === 'function') loadHistory(); } catch(e) {}
    try { if(typeof loadProductionRecords === 'function') loadProductionRecords(); } catch(e) {}
    try { if(typeof loadPartPrices === 'function') loadPartPrices(); } catch(e) {}
    try { if(typeof loadBomTree === 'function') loadBomTree(); } catch(e) {}
    try { if(typeof loadIncoming === 'function') loadIncoming(); } catch(e) {}
    try { if(typeof loadSupplierData === 'function') loadSupplierData(); } catch(e) {}
    
    try { renderRecentSearch(); checkUrlSearchParam(); } catch(e) {}
    
    const histDateInput = document.getElementById('histDate'); if(histDateInput) histDateInput.valueAsDate=new Date();
    const mainContent = document.querySelector('.main-content'); if(mainContent) mainContent.addEventListener('scroll', scrollFunction);
    
    document.addEventListener('keydown', e => { 
        if(e.key==='Escape') { document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none'); if(document.getElementById('featuredSection').classList.contains('active')) closeFeatured(); } 
    });
};

let autoRefreshInterval = null, isAutoRefreshOn = false;
function toggleAutoRefreshState(forceState) {
    isAutoRefreshOn = forceState !== undefined ? forceState : !isAutoRefreshOn;
    const btn = document.getElementById('btnAutoRefresh'); if(!btn) return;
    if (isAutoRefreshOn) { btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> <span>자동갱신 ON</span>'; btn.style.background = 'linear-gradient(135deg, var(--success), #2a9d8f)'; if (!forceState) showToast("자동 갱신 켜짐"); refreshInventoryData(); autoRefreshInterval = setInterval(() => { refreshInventoryData(); }, 300000); } 
    else { btn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>자동갱신 OFF</span>'; btn.style.background = 'var(--gray)'; clearInterval(autoRefreshInterval); autoRefreshInterval = null; if (!forceState) showToast("자동 갱신 꺼짐"); }
}

function updateDatalist() {
    const dl = document.getElementById('inventoryDatalist'); let dlHtml = ''; const addedCodes = new Set();
    if (itemMasterCache && itemMasterCache.length > 0) { itemMasterCache.forEach(i => { const code = i.PROD_CD.trim(); if (!addedCodes.has(code)) { dlHtml += `<option value="${code}">${i.PROD_DES}</option>`; addedCodes.add(code); } }); }
    if (inventoryDataCache && inventoryDataCache.length > 0) { inventoryDataCache.forEach(i => { const code = i.PROD_CD.trim(); if (!addedCodes.has(code)) { dlHtml += `<option value="${code}">${i.PROD_DES}</option>`; addedCodes.add(code); } }); }
    dl.innerHTML = dlHtml;
}

async function loadItemMaster() { try { const res = await fetch('/api/item_master'); const data = await res.json(); if(data.status === 'success') { itemMasterCache = data.items; updateDatalist(); } } catch(e) {} }
async function checkAuthStatus() { try { const res = await fetch('/api/auth/check'); const data = await res.json(); isAdmin = data.is_admin; updateUIForAdmin(); } catch(e) {} }
let settingsMenuClicked = null; 
function openLoginModal() { document.getElementById('loginModal').style.display = 'flex'; document.getElementById('loginPassword').value = ''; const idInput = document.getElementById('loginId'); if(idInput) { idInput.value = ''; idInput.focus(); } else { document.getElementById('loginPassword').focus(); } }
function clickSettingsMenu(el) { if (!isAdmin) { settingsMenuClicked = el; openLoginModal(); return; } switchPage('settings', el); }

async function handleLogin() {
    const id = document.getElementById('loginId').value.trim();
    const pw = document.getElementById('loginPassword').value.trim();
    if(!id || !pw) { customSwal.fire({icon:'warning', text:'입력해주세요.'}); return; }
    
    try {
        const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: id, password: pw}) });
        const res = await r.json();
        
        if(res.status === 'success') {
            isAdmin = true;
            userName = res.name;
            document.getElementById('loginModal').style.display = 'none';
            showToast(userName + "님 환영합니다!");
            updateUIForAdmin(); 
            
            if (typeof loadArchive === 'function') loadArchive();
            if (typeof loadPartPrices === 'function') loadPartPrices();
            if (typeof loadBomTree === 'function') loadBomTree();
            if (typeof loadHistory === 'function') loadHistory();
            if (typeof loadProductionRecords === 'function') loadProductionRecords();
            if (typeof loadLogs === 'function') loadLogs();

            if (typeof showMorningBriefing === 'function') { showMorningBriefing(); }
            if (settingsMenuClicked) { switchPage('settings', settingsMenuClicked); settingsMenuClicked = null; }
        } else {
            customSwal.fire({icon:'error', text:'로그인 실패'});
        }
    } catch(e) {
        console.error("로그인 에러:", e);
        customSwal.fire({icon:'error', text:'서버 연결 오류'});
    }
}

async function handleLogout() { const result = await customSwal.fire({ title: '로그아웃', text: "로그아웃 하시겠습니까?", icon: 'question', showCancelButton: true }); if(result.isConfirmed) { await fetch('/api/auth/logout', {method: 'POST'}); window.location.reload(); } }

function updateUIForAdmin() {
    document.querySelectorAll('.admin-only').forEach(el => {
        if(isAdmin) {
            if(el.tagName === 'TH' || el.tagName === 'TD') { el.style.setProperty('display', 'table-cell', 'important'); } 
            else if(el.tagName === 'BUTTON' || el.classList.contains('btn-upload')) { el.style.setProperty('display', 'inline-flex', 'important'); } 
            else { el.style.setProperty('display', 'block', 'important'); }
        } else {
            el.style.setProperty('display', 'none', 'important');
        }
    });
    const memoInput = document.getElementById('featMemo');
    if(memoInput) {
        memoInput.readOnly = !isAdmin;
        memoInput.style.background = isAdmin ? "#ffffff" : "#f8fafc";
        memoInput.placeholder = isAdmin ? "내용 입력..." : "등록된 메모가 없습니다. (관리자 전용)";
    }
}


async function refreshInventoryData() {
    try { 
        document.getElementById('lastUpdated').innerText = "업데이트 중..."; 
        const res = await fetch('/api/inventory'); 
        if (!res.ok) throw new Error("서버 오류"); 
        const data = await res.json();
        if(data.status === "success") {
            inventoryDataCache = data.items; 
            try { updateDatalist(); } catch(e){ console.error(e); }
            try { const input = document.getElementById('searchInput'); filterTableByKeyword(input ? input.value : ''); } catch(e){ console.error(e); }
            
            if(kpiSettingsCache.length === 0) await loadKpiSettings();
            try { renderDynamicKpiCards(inventoryDataCache); } catch(e){ console.error(e); }
            
            document.getElementById('lastUpdated').innerHTML = `<i class="fa-solid fa-clock"></i> ${data.update_time}`;
            try { checkUrlSearchParam(); } catch(e) { console.error(e); }

            showToast("새로고침 완료");
        }
    } catch(e) { 
        console.error("refreshInventoryData 오류:", e);
        document.getElementById('lastUpdated').innerHTML = `<span style="color:#e63946;">연결 지연</span>`; 
    }
}

async function loadKpiSettings() {
    try {
        const res = await fetch('/api/kpi');
        kpiSettingsCache = await res.json();
        renderKpiSettingsList();
    } catch(e) { console.error("KPI 설정 로드 실패", e); }
}

function renderDynamicKpiCards(inventoryItems) {
    const kpiSection = document.getElementById('kpiSection');
    const miniKpiSection = document.getElementById('miniKpiSection');
    if(!kpiSection || !miniKpiSection) return;
    
    kpiSection.innerHTML = ''; 
    miniKpiSection.innerHTML = ''; 
    
    kpiSettingsCache.forEach(kpi => {
        let totalQty = 0;
        inventoryItems.forEach(item => {
            if (item.PROD_CD.trim() === kpi.code.trim()) {
                // 👇 창고명이 지정되어 있다면 해당 창고만 합산하도록 조건 추가
                const itemWh = (item.WH_DES || item.WH_CD || "미지정").trim();
                if (!kpi.warehouse || kpi.warehouse === "" || kpi.warehouse === "전체" || itemWh.includes(kpi.warehouse)) {
                    totalQty += parseFloat(item.BAL_QTY || 0);
                }
            }
        });
        
        const isShort = totalQty < kpi.safe_qty;
        const badgeDisplay = isShort ? 'inline-block' : 'none';
        const cardStyle = isShort ? 'border-color: var(--danger) !important;' : '';

        // 이름 뒤에 창고명이 있다면 표시해줍니다 (예: S26 밴드 [공장창고])
        const displayName = kpi.warehouse ? `${kpi.name} <span style="font-size:11px; color:var(--primary);">[${kpi.warehouse}]</span>` : kpi.name;

        if (kpi.type === 'mini') {
            const html = `<div class="mini-kpi-container" style="margin-bottom: 0; ${cardStyle}"><div class="mini-kpi-title"><img src="/static/${kpi.img}" style="height:25px;" onerror="this.style.display='none'" loading="lazy"> ${displayName}</div><div style="text-align:right;"><div class="mini-kpi-value" style="${isShort ? 'color:var(--danger);' : ''}">${totalQty.toLocaleString()}</div><div style="font-size:12px; color:var(--gray);">안전재고 ${kpi.safe_qty} <span class="badge-danger" style="display:${badgeDisplay};">부족</span></div></div></div>`;
            miniKpiSection.insertAdjacentHTML('beforeend', html);
        } 
        else {
            const html = `<div class="kpi-card" style="${cardStyle}"><div class="kpi-header"><span class="kpi-title">${displayName}</span><img src="/static/${kpi.img}" onerror="this.style.display='none'" loading="lazy"></div><div class="kpi-value">${totalQty.toLocaleString()}</div><div class="kpi-trend">안전재고 ${kpi.safe_qty} <span class="badge-danger" style="display:${badgeDisplay};">부족</span></div></div>`;
            kpiSection.insertAdjacentHTML('beforeend', html);
        }
    });
}

function openKpiModal() {
    if(!isAdmin){ openLoginModal(); return; }
    
    document.getElementById('kpiEditId').value = '';
    document.getElementById('kpiType').value = 'main'; 
    document.getElementById('kpiName').value = '';
    document.getElementById('kpiCode').value = '';
    document.getElementById('kpiWarehouse').value = '';
    document.getElementById('kpiSafeQty').value = '';
    document.getElementById('kpiImg').value = '';
    
    document.getElementById('kpiModal').style.display = 'flex';
    renderKpiSettingsList();
}

function renderKpiSettingsList() {
    const list = document.getElementById('kpiList');
    if(!list) return;
    list.innerHTML = kpiSettingsCache.map(k => {
        const typeBadge = k.type === 'mini' ? '<span style="background:#fca311; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">미니</span>' : '<span style="background:var(--primary); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">메인</span>';

const whBadge = k.warehouse ? `<span style="background:#64748b; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">${k.warehouse}</span>` : `<span style="background:#94a3b8; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">전체창고</span>`;
        
        return `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><span>${typeBadge}<strong>${k.name}</strong> (${k.code}) - 안전: ${k.safe_qty}</span><div style="display:flex; gap:5px;"><button class="btn-small admin-only" style="background:#4cc9f0; color:white; margin:0;" onclick="editKpi(${k.id})"><i class="fa-solid fa-pen"></i></button><button class="btn-small admin-only" style="background:var(--danger); color:white; margin:0;" onclick="deleteKpi(${k.id})">×</button></div></li>`;
    }).join('');
}

function editKpi(id) {
    const kpi = kpiSettingsCache.find(k => k.id === id);
    if(!kpi) return;
    
    document.getElementById('kpiEditId').value = kpi.id;
    document.getElementById('kpiType').value = kpi.type || 'main'; 
    document.getElementById('kpiName').value = kpi.name;
    document.getElementById('kpiCode').value = kpi.code;
    document.getElementById('kpiWarehouse').value = kpi.warehouse || '';
    document.getElementById('kpiSafeQty').value = kpi.safe_qty;
    document.getElementById('kpiImg').value = kpi.img || '';
}

async function saveKpi() {
    const id = document.getElementById('kpiEditId').value;
    const type = document.getElementById('kpiType').value;
    const name = document.getElementById('kpiName').value.trim();
    const code = document.getElementById('kpiCode').value.trim();
    const warehouse = document.getElementById('kpiWarehouse').value.trim(); //
    const safe_qty = document.getElementById('kpiSafeQty').value;
    const img = document.getElementById('kpiImg').value.trim();
    
    if(!name || !code || !safe_qty) return;
    
    const payload = { type, name, code, warehouse, safe_qty: Number(safe_qty), img };
    if(id) payload.id = Number(id); 
    
    await fetch('/api/kpi', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    
    document.getElementById('kpiEditId').value = '';
    document.getElementById('kpiType').value = 'main';
    document.getElementById('kpiName').value = '';
    document.getElementById('kpiCode').value = '';
    document.getElementById('kpiWarehouse').value = ''; //
    document.getElementById('kpiSafeQty').value = '';
    document.getElementById('kpiImg').value = '';
    
    await loadKpiSettings();
    refreshInventoryData(); 
    showToast(id ? "KPI 설정이 수정되었습니다." : "KPI가 등록되었습니다.");
}

async function deleteKpi(id) {
    const result = await customSwal.fire({ title: '삭제', text: '정말 삭제하시겠습니까?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' });
    if(result.isConfirmed) {
        await fetch(`/api/kpi?id=${id}`, { method: 'DELETE' });
        await loadKpiSettings();
        refreshInventoryData();
        showToast("삭제되었습니다.");
    }
}

function openKpiItemSearch() {
    document.getElementById('kpiItemSearchInput').value = '';
    document.getElementById('kpiItemSearchModal').style.display = 'flex';
    renderKpiItemSearch('');
    setTimeout(() => document.getElementById('kpiItemSearchInput').focus(), 100);
}

function renderKpiItemSearch(keyword) {
    const tbody = document.getElementById('kpiItemSearchBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const addedCodes = new Set();
    let allItems = [];
    
    const addToList = (items) => {
        if (!items) return;
        items.forEach(i => {
            const code = (i.PROD_CD || '').trim();
            if(code && !addedCodes.has(code)) {
                addedCodes.add(code);
                allItems.push({ code: code, name: (i.PROD_DES || '').trim() });
            }
        });
    };

    addToList(itemMasterCache);
    addToList(inventoryDataCache);

    const lowerKeyword = keyword.toLowerCase().trim();
    const filteredItems = lowerKeyword ? allItems.filter(i => i.code.toLowerCase().includes(lowerKeyword) || i.name.toLowerCase().includes(lowerKeyword)) : allItems;

    if (filteredItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding:20px; text-align:center; color:#888;">검색 결과가 없습니다.</td></tr>';
        return;
    }

    filteredItems.slice(0, 100).forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; font-weight: 600; color: var(--gray); border-bottom: 1px dashed #cbd5e1;">${i.code}</td>
            <td style="padding: 10px; font-weight: 700; color: var(--dark); border-bottom: 1px dashed #cbd5e1;">${i.name}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px dashed #cbd5e1;">
                <button class="btn-small" style="background: var(--primary); color: white; padding: 4px 10px; margin: 0; min-width: 50px;" onclick="selectKpiItem('${i.code}', '${i.name}')">선택</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterKpiItemSearch() {
    const keyword = document.getElementById('kpiItemSearchInput').value;
    renderKpiItemSearch(keyword);
}

function selectKpiItem(code, name) {
    document.getElementById('kpiCode').value = code;
    const nameInput = document.getElementById('kpiName');
    if (!nameInput.value.trim()) nameInput.value = name;
    document.getElementById('kpiItemSearchModal').style.display = 'none';
}

let ddayDataCache = [];
async function loadDDays() {
    try {
        const r = await fetch('/api/dday'); ddayDataCache = await r.json();
        const widget = document.getElementById('dDayWidget'); const list = document.getElementById('ddayList');
        if(widget) {
            let html = '<div class="d-day-title">📅 D-Day</div>';
            if(ddayDataCache.length===0) html += '<div style="font-size:11px;color:#888;">일정 없음</div>';
            [...ddayDataCache].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(d => {
                const diff = Math.ceil((new Date(d.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))/(1000*60*60*24));
                let t = diff===0?"D-Day":(diff>0?`D-${diff}`:`D+${Math.abs(diff)}`);
                let c = diff<=7 && diff>=0?'var(--danger)':(diff<0?'var(--gray)':'var(--primary)');
                html += `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;"><span>${d.name}</span><span style="font-weight:bold;color:${c};">${t}</span></div>`;
            });
            widget.innerHTML = html;
        }
        if(list) { list.innerHTML = ddayDataCache.map(d=>`<li style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;"><span>${d.name} (${d.date})</span><button class="btn-small admin-only" style="background:var(--danger);color:white;" onclick="deleteDDay(${d.id})">×</button></li>`).join(''); }
        updateUIForAdmin();
    } catch(e) { console.log('D-Day 에러'); }
}
function openDDayModal() { if(!isAdmin){openLoginModal();return;} document.getElementById('ddayName').value=''; document.getElementById('ddayDate').value=''; document.getElementById('ddayModal').style.display='flex'; }
async function addDDay() { const n=document.getElementById('ddayName').value.trim(), d=document.getElementById('ddayDate').value; if(!n||!d)return; await fetch('/api/dday',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,date:d})}); document.getElementById('ddayModal').style.display='none'; loadDDays(); showToast('등록됨'); }
async function deleteDDay(id) { await fetch(`/api/dday?id=${id}`,{method:'DELETE'}); loadDDays(); showToast('삭제됨'); }

let noticeDataCache = [];
async function loadNotices() {
    try {
        const r = await fetch('/api/notice'); noticeDataCache = await r.json();
        const ticker = document.getElementById('newsTickerText');
        if(ticker) ticker.innerHTML = noticeDataCache.length > 0 ? noticeDataCache.map(n=>`📢 ${n.content}`).join(' &nbsp;&nbsp;|&nbsp;&nbsp; ') : "📢 등록된 상단 공지사항이 없습니다.";
        const list = document.getElementById('noticeList');
        if(list) list.innerHTML = noticeDataCache.map(n=>`<li style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;"><span>${n.content}</span><button class="btn-small admin-only" style="background:var(--danger);color:white;" onclick="deleteNotice(${n.id})">×</button></li>`).join('');
        updateUIForAdmin();
    } catch(e) { const ticker = document.getElementById('newsTickerText'); if(ticker) ticker.innerHTML = "📢 공지사항 로딩 실패"; }
}
function openNoticeModal() { if(!isAdmin){openLoginModal();return;} document.getElementById('noticeContent').value=''; document.getElementById('noticeModal').style.display='flex'; }
async function addNotice() { const c=document.getElementById('noticeContent').value.trim(); if(!c)return; await fetch('/api/notice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c})}); document.getElementById('noticeModal').style.display='none'; loadNotices(); showToast('공지 등록됨'); }
async function deleteNotice(id) { await fetch(`/api/notice?id=${id}`,{method:'DELETE'}); loadNotices(); showToast('삭제됨'); }

async function loadLogs() {
    try {
        const r = await fetch('/api/log'); logDataCache = await r.json();
        const le = document.getElementById('logList'); if(!le) return;
        le.innerHTML = '';
        if(logDataCache.length === 0) { 
            le.innerHTML = '<li style="padding:20px; color:#888; text-align:center; list-style:none;">등록된 소통 게시글이 없습니다.</li>'; 
        } else {
            const bMap = { 'notice': {t:'공지', c:'var(--primary)'}, 'issue': {t:'이슈', c:'var(--danger)'}, 'in': {t:'입고', c:'var(--success)'}, 'out': {t:'출고', c:'var(--warning)'}, 'prod': {t:'생산', c:'#7209b7'} };
            logDataCache.forEach(log => {
                let b = bMap[log.type] || {t:'기타', c:'var(--gray)'};
                le.insertAdjacentHTML('beforeend', `
                    <li class="log-item" style="flex-direction:column; align-items:flex-start;">
                        <div style="width:100%; display:flex; justify-content:space-between; margin-bottom:8px;">
                            <div style="font-weight:700; color:var(--dark);">
                                <span style="background:${b.c}; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">${b.t}</span>${log.title||'제목 없음'}
                            </div>
                            <div style="color:var(--gray); font-size:12px;">${log.date}</div>
                        </div>
                        <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                            <div style="font-size:13px; color:var(--dark); flex:1; word-break:keep-all; line-height:1.4; white-space:pre-wrap;">${log.content}</div>
                            <div class="admin-only" style="display:flex; gap:5px; flex-shrink:0;">
                                <button class="btn-small" style="background:#4cc9f0; color:white; margin:0;" onclick="editLog(${log.id})"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn-small" style="background:var(--danger); color:white; margin:0;" onclick="deleteLog(${log.id})">×</button>
                            </div>
                        </div>
                    </li>
                `);
            });
        }
        updateUIForAdmin(); if(typeof renderCalendar === 'function') renderCalendar();
    } catch(e) { console.error('로그 로드 실패', e); }
}
function toggleLogIncomingFields() { 
    const type = document.getElementById('logType').value; 
    const inFields = document.getElementById('logIncomingFields'); 
    const prodFields = document.getElementById('logProdFields'); 
    const titleInput = document.getElementById('logTitle');
    
    if (type === 'in') { 
        if(inFields) inFields.style.display = 'flex'; if(prodFields) prodFields.style.display = 'none'; 
        if(titleInput) titleInput.placeholder = "입고 부품명 (예: 사탕 막대)";
    } else if (type === 'prod') { 
        if(inFields) inFields.style.display = 'none'; if(prodFields) prodFields.style.display = 'flex'; 
        if(titleInput) titleInput.placeholder = "생산 품목명 (BOM 연동됨, 예: 츄파춥스)";
    } else { 
        if(inFields) inFields.style.display = 'none'; if(prodFields) prodFields.style.display = 'none'; 
        if(titleInput) titleInput.placeholder = "게시글 제목";
    } 
}

function addLogDefectRow() { 
    const tbody = document.getElementById('logDefectBody'); 
    const tr = document.createElement('tr'); 
    tr.innerHTML = `<td style="padding:2px;"><input type="text" class="form-control log-def-name" placeholder="불량 종류" style="margin:0; font-size:12px; padding:4px 8px;"></td><td style="padding:2px; width:100px;"><input type="number" class="form-control log-def-qty" placeholder="수량" value="1" style="margin:0; font-size:12px; padding:4px 8px;"></td><td style="padding:2px; width:30px; text-align:center;"><button class="btn-small" style="color:var(--danger); background:transparent; padding:2px;" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash-can"></i></button></td>`; 
    tbody.appendChild(tr); 
}

function openLogModal(){ 
    if(!isAdmin){openLoginModal(); return;} 
    document.getElementById('logEditId').value = ''; 
    document.getElementById('logType').value = 'notice'; 
    document.getElementById('logDate').valueAsDate = new Date(); 
    document.getElementById('logTitle').value = ''; 
    document.getElementById('logContent').value = ''; 
    document.getElementById('logWriter').value = ''; 
    document.getElementById('logInQty').value = ''; 
    document.getElementById('logInTotalCost').value = ''; 
    if(document.getElementById('logProdQty')) document.getElementById('logProdQty').value = '';
    if(document.getElementById('logDefectBody')) document.getElementById('logDefectBody').innerHTML = ''; 
    toggleLogIncomingFields(); 
    document.getElementById('logModal').style.display='flex'; 
}

function closeLogModal() { document.getElementById('logModal').style.display='none'; }

function editLog(id) { 
    if(!isAdmin)return; const log=logDataCache.find(x=>x.id===id); if(!log)return; 
    document.getElementById('logEditId').value=log.id; document.getElementById('logType').value=log.type; document.getElementById('logDate').value=log.date; document.getElementById('logTitle').value=log.title; document.getElementById('logContent').value=log.content; document.getElementById('logWriter').value=log.writer||''; 
    toggleLogIncomingFields(); document.getElementById('logModal').style.display='flex'; 
}

async function saveLog(){ 
    const id=document.getElementById('logEditId').value, t=document.getElementById('logType').value, d=document.getElementById('logDate').value, title=document.getElementById('logTitle').value.trim(), w=document.getElementById('logWriter').value.trim(); 
    let c=document.getElementById('logContent').value.trim(); 
    let qty=0, totalCost=0, unitPrice=0; 
    let prodQty=0, defectQty=0, defects=[]; 

    if (t==='in') { 
        qty=Number(document.getElementById('logInQty').value)||0; totalCost=Number(document.getElementById('logInTotalCost').value)||0; 
        if(qty<=0||totalCost<=0){customSwal.fire({icon:'warning', text:'입고 정보를 입력해주세요.'});return;} 
        unitPrice=Math.round((totalCost/qty)*100)/100; 
        c=`[📦 입고: ${qty}개 / 총 ${totalCost.toLocaleString()}원]\n`+c; 
    } else if (t==='prod') {
        prodQty = Number(document.getElementById('logProdQty').value) || 0; 
        
        document.querySelectorAll('#logDefectBody tr').forEach(row => { 
            const dName = row.querySelector('.log-def-name').value.trim();
            const dQty = Number(row.querySelector('.log-def-qty').value) || 0; 
            if(dName && dQty > 0) { 
                defects.push({ name: dName, qty: dQty }); 
                defectQty += dQty; 
            } 
        });

        if(prodQty <= 0){customSwal.fire({icon:'warning', text:'생산 수량을 입력해주세요.'});return;}
        if(defectQty > prodQty){customSwal.fire({icon:'error', text:'불량 수량의 합이 총 생산량보다 많습니다.'});return;}
        
        let defectText = defectQty > 0 ? ` (불량 ${defectQty}대)` : '';
        let defectDetails = defects.length > 0 ? `\n- 불량 내역: ` + defects.map(d => `${d.name}(${d.qty}대)`).join(', ') : '';
        c = `[🏭 생산: ${prodQty.toLocaleString()}대${defectText}]${defectDetails}\n\n` + c;
    }

    if(!c||!title||!d) { customSwal.fire({icon:'warning', text:'필수 항목을 모두 입력해주세요.'}); return; }
    
    const payload={type:t, date:d, title:title, content:c, writer:w}; 
    if(id) payload.id=Number(id); 
    await fetch('/api/log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); 
    
    if(t==='in' && !id){ 
        await fetch('/api/part_price', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:d, name:title, qty:qty, totalCost:totalCost, price:unitPrice, note:`게시판 자동 연동`})}); 
        if (typeof loadPartPrices === 'function') loadPartPrices();
    } else if (t === 'prod' && !id) {
        let p = title; 
        const ecountItem = inventoryDataCache.find(i => (i.PROD_CD || '').trim().toLowerCase() === p.toLowerCase()) || itemMasterCache.find(i => (i.PROD_CD || '').trim().toLowerCase() === p.toLowerCase());
        if (ecountItem) p = (ecountItem.PROD_DES || '').trim();

        await fetch('/api/history',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date: d, product: p, qty: prodQty, note: `소통게시판 연동 (작성자: ${w})`, defects: defects, defectTotal: defectQty }) }); 

        try {
            const bomRes = await fetch('/api/bom'); bomDataCache = await bomRes.json(); 
            const searchKeyword = p.replace(/\s+/g, '').toLowerCase(); 
            let rootBom = bomDataCache.find(b => (!b.parentId || b.parentId === "null" || b.parentId === 0 || b.parentId === "") && ((b.name || '').replace(/\s+/g, '').toLowerCase() === searchKeyword || (b.code || '').replace(/\s+/g, '').toLowerCase() === searchKeyword));
            if (!rootBom) rootBom = bomDataCache.find(b => (b.name || '').replace(/\s+/g, '').toLowerCase().includes(searchKeyword) || (b.code || '').replace(/\s+/g, '').toLowerCase().includes(searchKeyword));
            
            if (rootBom) {
                let leaves = []; function getLeaves(pid, currentReqQty) { const children = bomDataCache.filter(b => b.parentId == pid); children.forEach(ch => { const totalReqQty = currentReqQty * ch.reqQty; const grandChildren = bomDataCache.filter(b => b.parentId == ch.id); if (grandChildren.length === 0) { leaves.push({ ...ch, calculatedReqQty: totalReqQty }); } else { getLeaves(ch.id, totalReqQty); } }); }
                getLeaves(rootBom.id, 1); if (leaves.length === 0) leaves.push({ ...rootBom, calculatedReqQty: 1 });

                const monthStr = d.substring(0, 7); let materials = [], totalCost = 0;
                leaves.forEach(leaf => {
                    let currentPrice = Number(leaf.unitPrice || 0); const keyword = (leaf.name || '').replace(/\s+/g, '').toLowerCase();
                    // 💡 여기서 단가 검색을 <= monthStr 로 변경
                    const history = partPriceCache.filter(pp => { 
                        const pName = (pp.name || '').replace(/\s+/g, '').toLowerCase(); 
                        return (pName === keyword || pName.includes(keyword) || keyword.includes(pName)) && (pp.date.substring(0, 7) <= monthStr); 
                    });
                    if (history.length > 0) { history.sort((a,b) => b.date.localeCompare(a.date)); currentPrice = Number(history[0].price); }
                    
                    const finalQty = leaf.calculatedReqQty * prodQty, matTotalCost = finalQty * currentPrice; 
                    materials.push({ name: leaf.name, date: d, qty: finalQty, price: currentPrice, sum: matTotalCost }); totalCost += matTotalCost;
                });
                
                let finalUnitPrice = 0, finalUnitVatPrice = 0; 
                if (totalCost > 0 && prodQty > 0) { finalUnitPrice = Math.round(totalCost / prodQty); finalUnitVatPrice = Math.round(finalUnitPrice * 1.1); }
                const defectRate = prodQty > 0 ? ((defectQty / prodQty) * 100).toFixed(1) : 0, defectCost = Math.round(defectQty * finalUnitPrice);
                
                await fetch('/api/production_record', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ date: d, name: rootBom.name, qty: prodQty, price: finalUnitPrice, priceVAT: finalUnitVatPrice, materials: materials, totalCost: totalCost, defectQty: defectQty, defectRate: defectRate, defectCost: defectCost }) });
                if (typeof loadProductionRecords === 'function') await loadProductionRecords(); 
            }
        } catch(e) { console.error("게시판 생산 연동 오류", e); }
        if (typeof loadHistory === 'function') loadHistory();
    }
    
    closeLogModal(); loadLogs(); 
    showToast(t === 'prod' && !id ? "다중 불량 등록 및 생산 내역 연동 완료!" : "저장 및 연동 완료!"); 
}

async function deleteLog(id) { 
    if(!isAdmin)return; const r=await customSwal.fire({title:'삭제', icon:'warning', showCancelButton:true, confirmButtonColor:'#e63946'}); 
    if(r.isConfirmed) { await fetch(`/api/log?id=${id}`,{method:'DELETE'}); loadLogs(); showToast('삭제됨'); } 
}

async function loadSystemLogs() { if (!isAdmin) return; try { const res = await fetch('/api/system_log'); const logs = await res.json(); const tbody = document.getElementById('systemLogBody'); if(!tbody) return; tbody.innerHTML = ''; if (logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="padding:30px; color:#888;">시스템 작업 기록이 없습니다.</td></tr>'; return; } logs.forEach(log => { let actionBadgeColor = '#e2e8f0'; let actionTextColor = '#475569'; if(log.title.includes('수정') || log.title.includes('변경')) { actionBadgeColor = '#fef3c7'; actionTextColor = '#b45309'; } else if(log.title.includes('삭제')) { actionBadgeColor = '#fee2e2'; actionTextColor = '#e63946'; } else if(log.title.includes('신규') || log.title.includes('등록') || log.title.includes('생산')) { actionBadgeColor = '#dcfce7'; actionTextColor = '#15803d'; } tbody.insertAdjacentHTML('beforeend', `<tr style="border-bottom:1px solid #f1f5f9;"><td style="color:var(--gray); font-size:13px; font-weight:600;">${log.date}</td><td><span style="background:${actionBadgeColor}; color:${actionTextColor}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">${log.title}</span></td><td style="font-weight:600; color:var(--primary);"><i class="fa-solid fa-user-gear" style="font-size:11px; margin-right:4px;"></i>${log.writer}</td><td style="text-align:left; color:var(--dark); font-size:14px;">${log.content}</td></tr>`); }); } catch(e) {} }
// 💡 디바운싱(Debouncing) 유틸리티 함수 추가
const debounce = (func, delay = 300) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, delay);
    };
};

function filterTableByKeyword(k){ const keys=k.toLowerCase().split(' ').filter(x=>x!==''); if (keys.length === 0) { renderTable([]); return; } const filtered = inventoryDataCache.filter(i => { const t = (i.PROD_DES + " " + i.PROD_CD).toLowerCase(); return keys.every(key => t.includes(key)); }); renderTable(filtered); }

function renderTable(items){
    const hRow=document.getElementById('tableHeaderRow'); const b=document.getElementById('inventoryBody'); 
    if (!items || items.length === 0) { hRow.innerHTML = '<th>안내</th>'; b.innerHTML = '<tr><td style="padding:40px; color:#888; text-align:center;">🔍 검색창에 원하시는 품목명이나 코드를 입력해주세요.</td></tr>'; return; }
    
    const set=new Set(); items.forEach(i=>{ if (parseFloat(i.BAL_QTY||0) > 0) { set.add((i.WH_DES||i.WH_CD||"미지정").trim()); } }); 
    const arr=Array.from(set).sort(); let disp=arr; 
    
    let hHtml=`<th style="width:40px;">선택</th><th onclick="sortTable(1)">코드</th><th onclick="sortTable(2)" style="text-align:left;">품목명</th><th onclick="sortTable(3)">구분</th><th onclick="sortTable(4)">합계 ▼</th>`; 
    disp.forEach((w,i)=>hHtml+=`<th onclick="sortTable(${5+i})">${w}</th>`); 
    hHtml+=`<th style="width:90px;">메모 / QR</th>`; 
    hRow.innerHTML=hHtml;
    
    const pData={}; items.forEach(i=>{ const c=i.PROD_CD; if(!pData[c])pData[c]={n:i.PROD_DES, t:i.ITEM_TYPE||'[제품]', tot:0, w:{}}; const q=parseFloat(i.BAL_QTY||0); pData[c].tot+=q; let wk=(i.WH_DES||i.WH_CD||"미지정").trim(); pData[c].w[wk]=(pData[c].w[wk]||0)+q; }); 
    let keys=Object.keys(pData).sort((a,b)=>{ let v1,v2; if(sortCol===1){v1=a;v2=b;}else if(sortCol===2){v1=pData[a].n;v2=pData[b].n;}else if(sortCol===4){v1=pData[a].tot;v2=pData[b].tot;}else return 0; return sortAsc?(v1>v2?1:-1):(v1<v2?1:-1); });
    
    let rowsHtml = '';
    keys.forEach(c=>{ 
        const i=pData[c]; 
        let safe = 50; 
        const matchedKpi = kpiSettingsCache.find(k => k.code === c);
        if (matchedKpi) safe = matchedKpi.safe_qty; 
        
        let col="background:#4cc9f0"; 
        if(i.tot<safe) col="background:#e63946"; 
        else if(i.tot<safe*2) col="background:#fca311"; 
        
        let w=Math.min((i.tot/500)*100,100); let isChecked = selectedItems.has(c) ? 'checked' : '';
        
        rowsHtml += `<tr><td><input type="checkbox" class="chk-select" onchange="toggleSelection('${c}')" ${isChecked}></td><td style="color:#8d99ae;font-size:13px;">${c}</td><td style="text-align:left;font-weight:600;">${i.n}</td><td><span style="background:rgba(0,0,0,0.05);padding:4px 8px;border-radius:6px;font-size:12px;">${i.t}</span></td><td style="font-weight:800;color:var(--primary);font-size:16px;">${i.tot.toLocaleString()}<div style="width:100%;height:5px;background:#e2e8f0;margin-top:5px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${w}%;${col};transition:width 0.5s;"></div></div></td>`; 
        disp.forEach(wk=>{ const q=i.w[wk]||0; rowsHtml += `<td style="${q>0?'font-weight:600;':''};color:${q>0?'inherit':'#cbd5e1'}">${q.toLocaleString()}</td>`; }); 
        
        rowsHtml += `<td>
            <div style="display:flex; gap:5px; justify-content:center;">
                <button onclick="processSearchKeyword('${c}')" style="cursor:pointer; border:1px solid #e2e8f0; border-radius:6px; background:#fffbf1; padding:5px 8px; color:#f59e0b;" title="메모 작성 및 상세">
                    <i class="fa-solid fa-note-sticky"></i>
                </button>
                <button onclick="showQr('${c}','${i.n}')" style="cursor:pointer; border:1px solid #e2e8f0; border-radius:6px; background:#fff; padding:5px 8px;" title="QR 코드 생성">
                    <i class="fa-solid fa-qrcode"></i>
                </button>
            </div>
        </td></tr>`; 
    });
    b.innerHTML = rowsHtml;
}

// 💡 렉 방지가 적용된 검색 이벤트 리스너
const mainSearchInput = document.getElementById('searchInput');
if (mainSearchInput) {
    mainSearchInput.addEventListener('keyup', debounce(function(e) { 
        filterTableByKeyword(e.target.value); 
        if (e.key === 'Enter') saveRecentSearch(e.target.value); 
    }, 300));
}
function sortTable(n) { if (sortCol === n) sortAsc = !sortAsc; else { sortCol = n; sortAsc = true; } filterTableByKeyword(document.getElementById('searchInput') ? document.getElementById('searchInput').value : ''); }

/* =================================================================
   재고 현황 조회 - 품목 목록 돋보기 검색 기능
================================================================= */
function openInventoryItemSearch() {
    document.getElementById('invItemSearchInput').value = '';
    document.getElementById('invItemSearchModal').style.display = 'flex';
    renderInvItemSearch('');
    setTimeout(() => document.getElementById('invItemSearchInput').focus(), 100);
}

function renderInvItemSearch(keyword) {
    const tbody = document.getElementById('invItemSearchBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const addedCodes = new Set();
    let allItems = [];
    
    const addToList = (items) => {
        if (!items) return;
        items.forEach(i => {
            const code = (i.PROD_CD || '').trim();
            if(code && !addedCodes.has(code)) {
                addedCodes.add(code);
                allItems.push({ code: code, name: (i.PROD_DES || '').trim() });
            }
        });
    };

    addToList(itemMasterCache);
    addToList(inventoryDataCache);

    const lowerKeyword = keyword.toLowerCase().trim();
    const filteredItems = lowerKeyword ? allItems.filter(i => i.code.toLowerCase().includes(lowerKeyword) || i.name.toLowerCase().includes(lowerKeyword)) : allItems;

    if (filteredItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding:20px; text-align:center; color:#888;">품목이 존재하지 않습니다.</td></tr>';
        return;
    }

    filteredItems.slice(0, 100).forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; font-weight: 600; color: var(--gray); border-bottom: 1px dashed #cbd5e1;">${i.code}</td>
            <td style="padding: 10px; font-weight: 700; color: var(--dark); border-bottom: 1px dashed #cbd5e1;">${i.name}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px dashed #cbd5e1;">
                <button class="btn-small" style="background: var(--success); color: white; padding: 4px 10px; margin: 0; min-width: 50px;" onclick="selectInvItem('${i.code}')">조회</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterInvItemSearch() {
    const keyword = document.getElementById('invItemSearchInput').value;
    renderInvItemSearch(keyword);
}

function selectInvItem(code) {
    document.getElementById('invItemSearchModal').style.display = 'none';
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.value = code;
        filterTableByKeyword(code);
        saveRecentSearch(code);
    }
}

let historyDataCache = [];
async function loadHistory() {
    try {
        const r = await fetch('/api/history'); historyDataCache = await r.json(); let d = historyDataCache; updateChart(d); 
        const f = document.getElementById('historyFilterDate').value; if (f) d = d.filter(i => i.date === f);
        const b = document.getElementById('historyBody'); b.innerHTML = '';
        
        if (d.length === 0) { 
            b.innerHTML = '<tr><td colspan="6" style="padding:20px; color:#888; text-align:center;">데이터가 없습니다.</td></tr>'; 
        } else { 
            let groupedData = {};
            d.forEach(i => { let prodName = (i.product || "미지정").trim(); if (!groupedData[prodName]) groupedData[prodName] = { totalQty: 0, items: [] }; groupedData[prodName].totalQty += Number(i.qty); groupedData[prodName].items.push(i); });
            
            Object.keys(groupedData).sort().forEach((prodName, index) => {
                const group = groupedData[prodName]; const groupId = `hist-group-${index}`;
                
                b.insertAdjacentHTML('beforeend', `<tr class="hist-parent-row" style="background:#f8fafc; cursor:pointer;" onclick="toggleHistoryGroup('${groupId}', this)"><td colspan="2" style="text-align:left; font-weight:700; padding-left:15px;"><i class="fa-solid fa-chevron-down" style="color:var(--primary); margin-right:8px;"></i>${prodName} <span style="font-size:12px; color:var(--gray);">(${group.items.length}건)</span></td><td style="font-weight:800; color:var(--primary); font-size:15px;">총 ${group.totalQty.toLocaleString()} 대</td><td colspan="3"></td></tr>`);
                
                group.items.forEach(i => { 
                    let defectCount = i.defectTotal || 0, defectRate = i.qty > 0 ? ((defectCount / i.qty) * 100).toFixed(1) : 0, defectHtml = '<span style="color:var(--gray); font-size:13px;">정상 (0%)</span>';
                    if (defectCount > 0) { defectHtml = `<div style="display:flex; align-items:center; gap:8px;"><span style="color:var(--danger); font-weight:800;">${defectCount}개</span> <span style="font-size:11px; background:#fee2e2; color:#9f1239; padding:2px 6px; border-radius:4px;">${defectRate}%</span><button class="btn-small" style="background:var(--white); border:1px solid #cbd5e1; color:var(--dark); padding:2px 6px;" onclick="viewHistoryDefects(${i.id}); event.stopPropagation();">상세</button></div>`; }
                    
                    b.insertAdjacentHTML('beforeend', `<tr class="hist-child-row hist-child-${groupId}">
                        <td style="color:var(--gray); text-align:center;">${i.date}</td>
                        <td style="text-align:left; font-weight:700; color:var(--dark); padding-left:20px;"><span style="color:#cbd5e1; font-weight:bold; margin-right:5px;">└</span>${i.product}</td>
                        <td style="font-weight:800; color:var(--primary); font-size:15px;">${Number(i.qty).toLocaleString()}</td>
                        <td>${defectHtml}</td>
                        <td style="text-align:left; color:var(--gray); font-size:13px;">${i.note || '-'}</td>
                        <td class="admin-only"><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteHistory(${i.id}); event.stopPropagation();">×</button></td>
                    </tr>`); 
                }); 
            });
        }
        updateUIForAdmin();
    } catch(e) { console.error(e); }
}
function toggleHistoryGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'); const isExpanded = icon.classList.contains('fa-chevron-down'); const children = document.querySelectorAll(`.hist-child-${groupId}`); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } }
function toggleAllHistory(expand) { const parents = document.querySelectorAll('.hist-parent-row'); parents.forEach(parent => { const icon = parent.querySelector('i.fa-solid'); const match = parent.getAttribute('onclick').match(/toggleHistoryGroup\('([^']+)'/); if (match) { const groupId = match[1]; const children = document.querySelectorAll(`.hist-child-${groupId}`); if (expand) { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } else { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } } }); }
function resetHistoryFilter() { document.getElementById('historyFilterDate').value = ''; loadHistory(); }
function updateChart(data) { if (myChart) myChart.destroy(); const mode = document.getElementById('historyChartMode') ? document.getElementById('historyChartMode').value : 'month'; const m = {}, p = new Set(); data.forEach(i => { const k = mode === 'year' ? i.date.substring(0, 4) : i.date.substring(0, 7); if (!m[k]) m[k] = {}; p.add(i.product); m[k][i.product] = (m[k][i.product] || 0) + Number(i.qty); }); const l = Object.keys(m).sort(), pl = Array.from(p), colors = ['#4361ee', '#f72585', '#4cc9f0', '#fca311', '#7209b7', '#ef476f', '#06d6a0']; const ds = pl.map((x, i) => ({ label: x, data: l.map(k => m[k][x] || 0), backgroundColor: colors[i % colors.length], borderRadius: 6 })); myChart = new Chart(document.getElementById('productionChart'), { type: 'bar', data: { labels: l, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12, family: "'Pretendard', sans-serif" } } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, border: { display: false } } } } }); }
function openHistoryModal(){ if(!isAdmin){ openLoginModal(); return; } const dateInput = document.getElementById('histDate'); if(dateInput) dateInput.valueAsDate = new Date(); const prodInput = document.getElementById('histProduct'); if(prodInput) prodInput.value = ''; const qtyInput = document.getElementById('histQty'); if(qtyInput) qtyInput.value = ''; const noteInput = document.getElementById('histNote'); if(noteInput) noteInput.value = ''; const defectBody = document.getElementById('histDefectBody'); if(defectBody) defectBody.innerHTML = ''; const modal = document.getElementById('historyModal'); if(modal) modal.style.display='flex'; }
function addHistDefectRow() { const tbody = document.getElementById('histDefectBody'); const tr = document.createElement('tr'); tr.innerHTML = `<td style="padding:4px 2px;"><input type="text" class="form-control def-name" placeholder="불량 종류 (예: 스크래치, 조립불량)" style="margin:0; font-size:13px;"></td><td style="padding:4px 2px; width:100px;"><input type="number" class="form-control def-qty" placeholder="수량" value="1" style="margin:0; font-size:13px;"></td><td style="padding:4px 2px; width:40px; text-align:center;"><button class="btn-small" style="color:var(--danger); background:transparent;" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash-can"></i></button></td>`; tbody.appendChild(tr); }
function viewHistoryDefects(id) { const item = historyDataCache.find(x => x.id === id); if(!item || !item.defects || item.defects.length === 0) return; let html = `<ul style="text-align:left; padding:15px; margin:0; list-style:none; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">`; item.defects.forEach(def => { html += `<li style="margin-bottom:8px; display:flex; justify-content:space-between; border-bottom:1px dashed #cbd5e1; padding-bottom:5px;"><span style="font-weight:600; color:var(--dark);">${def.name}</span><span style="color:var(--danger); font-weight:800;">${def.qty}개</span></li>`; }); let defectRate = ((item.defectTotal / item.qty) * 100).toFixed(1); html += `</ul><div style="margin-top:15px; font-weight:800; font-size:16px; text-align:right; color:var(--dark);">총 불량: <span style="color:var(--danger);">${item.defectTotal}개</span> (불량률: ${defectRate}%)</div>`; customSwal.fire({ title: `<span style="font-size:18px;">${item.date} [${item.product}] 불량 상세</span>`, html: html, confirmButtonColor: '#4361ee', confirmButtonText: '확인' }); }

async function saveHistory(){ 
    const d = document.getElementById('histDate').value; 
    let p = document.getElementById('histProduct').value.trim(); 
    const q = Number(document.getElementById('histQty').value); 
    const n = document.getElementById('histNote').value;
    
    if(!d || !p || q <= 0) { customSwal.fire({icon:'warning', text:'일자, 품목, 생산수량을 올바르게 입력해주세요.'}); return; }

    // 💡 중복 클릭 방지: 버튼 비활성화 및 로딩 UI 표시
    const btn = document.querySelector('#historyModal .btn-save');
    if(btn) { 
        btn.disabled = true; 
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 및 연동중...'; 
    }

    try {
        const ecountItem = inventoryDataCache.find(i => (i.PROD_CD || '').trim().toLowerCase() === p.toLowerCase()) 
                        || itemMasterCache.find(i => (i.PROD_CD || '').trim().toLowerCase() === p.toLowerCase());
        if (ecountItem) p = (ecountItem.PROD_DES || '').trim();

        let defects = [], defectTotal = 0; 
        document.querySelectorAll('#histDefectBody tr').forEach(row => { 
            const dName = row.querySelector('.def-name').value.trim(), dQty = Number(row.querySelector('.def-qty').value) || 0; 
            if(dName && dQty > 0) { defects.push({ name: dName, qty: dQty }); defectTotal += dQty; } 
        });
        
        if (defectTotal > q) { customSwal.fire({icon:'error', title:'수량 오류', text:'불량 수량이 총 생산수량보다 큽니다.'}); return; }

        await fetch('/api/history',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date: d, product: p, qty: q, note: n, defects: defects, defectTotal: defectTotal }) }); 

        const bomRes = await fetch('/api/bom'); 
        bomDataCache = await bomRes.json(); 
        const searchKeyword = p.replace(/\s+/g, '').toLowerCase(); 
        
        let rootBom = bomDataCache.find(b => (!b.parentId || b.parentId === "null" || b.parentId === 0 || b.parentId === "") && ((b.name || '').replace(/\s+/g, '').toLowerCase() === searchKeyword || (b.code || '').replace(/\s+/g, '').toLowerCase() === searchKeyword));
        if (!rootBom) rootBom = bomDataCache.find(b => (b.name || '').replace(/\s+/g, '').toLowerCase().includes(searchKeyword) || (b.code || '').replace(/\s+/g, '').toLowerCase().includes(searchKeyword));
        
        if (rootBom) {
            let leaves = []; 
            function getLeaves(pid, currentReqQty) { 
                const children = bomDataCache.filter(b => b.parentId == pid); 
                children.forEach(c => { 
                    const totalReqQty = currentReqQty * c.reqQty; 
                    const grandChildren = bomDataCache.filter(b => b.parentId == c.id); 
                    if (grandChildren.length === 0) { leaves.push({ ...c, calculatedReqQty: totalReqQty }); } 
                    else { getLeaves(c.id, totalReqQty); } 
                }); 
            }
            getLeaves(rootBom.id, 1); 
            if (leaves.length === 0) leaves.push({ ...rootBom, calculatedReqQty: 1 });

            const monthStr = d.substring(0, 7); 
            let materials = [], totalCost = 0;
            
            leaves.forEach(leaf => {
                let currentPrice = Number(leaf.unitPrice || 0); 
                const keyword = (leaf.name || '').replace(/\s+/g, '').toLowerCase();
                
                // 💡 여기서 단가 검색을 <= monthStr 로 변경 (가장 최근 이전 단가 가져오기)
                const history = partPriceCache.filter(pp => { 
                    const pName = (pp.name || '').replace(/\s+/g, '').toLowerCase(); 
                    return (pName === keyword || pName.includes(keyword) || keyword.includes(pName)) && (pp.date.substring(0, 7) <= monthStr); 
                });
                if (history.length > 0) { history.sort((a,b) => b.date.localeCompare(a.date)); currentPrice = Number(history[0].price); }
                
                const finalQty = leaf.calculatedReqQty * q, matTotalCost = finalQty * currentPrice; 
                materials.push({ name: leaf.name, date: d, qty: finalQty, price: currentPrice, sum: matTotalCost }); totalCost += matTotalCost;
            });
            
            let finalUnitPrice = 0, finalUnitVatPrice = 0; 
            if (totalCost > 0 && q > 0) { finalUnitPrice = Math.round(totalCost / q); finalUnitVatPrice = Math.round(finalUnitPrice * 1.1); }
            const defectRate = q > 0 ? ((defectTotal / q) * 100).toFixed(1) : 0, defectCost = Math.round(defectTotal * finalUnitPrice);
            
            await fetch('/api/production_record', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ date: d, name: rootBom.name, qty: q, price: finalUnitPrice, priceVAT: finalUnitVatPrice, materials: materials, totalCost: totalCost, defectQty: defectTotal, defectRate: defectRate, defectCost: defectCost }) });
            if (typeof loadProductionRecords === 'function') await loadProductionRecords(); 
            
            document.getElementById('historyModal').style.display='none'; loadHistory(); showToast(`생산 내역 저장 및 BOM 연동 완료!`); return;
        } else {
            const availableNames = [...new Set(bomDataCache.map(b => b.name))].slice(0, 7).join(', '); 
            document.getElementById('historyModal').style.display='none'; loadHistory(); 
            customSwal.fire({ icon: 'info', title: '생산 내역은 저장되었습니다.', html: `<b>BOM 단가 연동은 실패했습니다.</b><br>일치하는 품목이 없습니다. 오타를 확인해주세요.<br><br><span style="font-size:12px; color:#888;">(힌트: ${availableNames} 등)</span>` }); return;
        }
    } catch (err) { 
        console.error("저장 중 에러 발생:", err); 
        document.getElementById('historyModal').style.display='none'; loadHistory(); showToast("생산 내역이 저장되었습니다. (일부 연동 실패)"); 
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.innerHTML = '생산 내역 저장하기'; 
        }
    }
}
async function deleteHistory(id){ const r = await customSwal.fire({title:'삭제하시겠습니까?', icon:'warning', showCancelButton:true, confirmButtonColor:'#e63946'}); if(r.isConfirmed){ await fetch(`/api/history?id=${id}`,{method:'DELETE'}); loadHistory(); showToast("삭제되었습니다."); } }
let productionRecordsCache = [];
async function loadProductionRecords() { try { const r = await fetch('/api/production_record'); productionRecordsCache = await r.json(); renderProductionSummary(); renderProductionRecords(); } catch(e) {} }
function renderProductionSummary() {
    const summaryBody = document.getElementById('productionSummaryBody'); summaryBody.innerHTML = '';
    if (productionRecordsCache.length === 0) { summaryBody.innerHTML = '<tr><td colspan="6" style="padding:30px; color:#888; text-align:center;">기록된 데이터가 없습니다.</td></tr>'; return; }
    const grouped = {};
    productionRecordsCache.forEach(p => { const name = p.name.trim(), month = p.date.substring(0, 7); if (!grouped[name]) { grouped[name] = { totalQty: 0, totalCost: 0, months: {}, lastDate: p.date }; } if (p.date > grouped[name].lastDate) { grouped[name].lastDate = p.date; } grouped[name].totalQty += Number(p.qty); grouped[name].totalCost += Number(p.totalCost); if (!grouped[name].months[month]) { grouped[name].months[month] = { totalQty: 0, totalCost: 0 }; } grouped[name].months[month].totalQty += Number(p.qty); grouped[name].months[month].totalCost += Number(p.totalCost); });
    const parentKeys = Object.keys(grouped).sort((a, b) => new Date(grouped[b].lastDate) - new Date(grouped[a].lastDate)); let groupIndex = 0;
    parentKeys.forEach(name => {
        const group = grouped[name], groupId = `prod-summary-${groupIndex++}`; const avgPriceAll = group.totalQty > 0 ? Math.round(group.totalCost / group.totalQty) : 0, avgVatAll = Math.round(avgPriceAll * 1.1);
        summaryBody.insertAdjacentHTML('beforeend', `<tr class="prod-summary-parent" style="background:#f8fafc; cursor:pointer;" onclick="toggleProdSummaryGroup('${groupId}', this)"><td colspan="2" style="text-align:left; font-weight:800; padding-left:15px;"><i class="fa-solid fa-chevron-down" style="color:var(--primary); margin-right:8px;"></i>${name}</td><td style="font-weight:800;">${group.totalQty.toLocaleString()} 대</td><td style="color:var(--primary); font-weight:700;">평균 ${avgPriceAll.toLocaleString()}원</td><td style="color:var(--danger); font-weight:700;">${avgVatAll.toLocaleString()}원</td><td style="font-weight:800;">${group.totalCost.toLocaleString()}원</td></tr>`);
        const monthKeys = Object.keys(group.months).sort((a, b) => b.localeCompare(a)); const chronMonths = [...monthKeys].reverse(); let prevAvg = null, prevCost = null; const diffs = {};
        chronMonths.forEach(m => { const mData = group.months[m], avgP = Math.round(mData.totalCost / mData.totalQty); diffs[m] = { avgDiff: prevAvg !== null ? avgP - prevAvg : null, costDiff: prevCost !== null ? mData.totalCost - prevCost : null }; prevAvg = avgP; prevCost = mData.totalCost; });
        monthKeys.forEach(m => { const mData = group.months[m], avgP = Math.round(mData.totalCost / mData.totalQty), vatP = Math.round(avgP * 1.1), d = diffs[m]; let avgDiffHtml = d.avgDiff > 0 ? `<span style="font-size:12px; color:var(--danger); margin-left:8px;">▲ ${d.avgDiff.toLocaleString()}</span>` : (d.avgDiff < 0 ? `<span style="font-size:12px; color:var(--primary); margin-left:8px;">▼ ${Math.abs(d.avgDiff).toLocaleString()}</span>` : ''); let costDiffHtml = d.costDiff > 0 ? `<span style="font-size:11px; color:var(--danger);">전월비 +${d.costDiff.toLocaleString()}원</span>` : (d.costDiff < 0 ? `<span style="font-size:11px; color:var(--primary);">전월비 -${Math.abs(d.costDiff).toLocaleString()}원</span>` : ''); summaryBody.insertAdjacentHTML('beforeend', `<tr class="prod-summary-child prod-summary-${groupId}"> <td style="text-align:left; padding-left:40px; color:var(--gray);">└</td> <td><span style="background:#e2e8f0; padding:4px 8px; border-radius:6px; font-size:13px;">${m}</span></td> <td>${mData.totalQty.toLocaleString()} 대</td> <td style="color:var(--primary); font-weight:700;">${avgP.toLocaleString()} 원 ${avgDiffHtml}</td> <td style="color:var(--danger); font-weight:700;">${vatP.toLocaleString()} 원</td> <td>${mData.totalCost.toLocaleString()} 원<br>${costDiffHtml}</td> </tr>`); });
    });
}
function toggleProdSummaryGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'); const isExpanded = icon.classList.contains('fa-chevron-down'); const children = document.querySelectorAll(`.prod-summary-${groupId}`); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } }

function renderProductionRecords() {
    const tbody = document.getElementById('productionRecordBody'); tbody.innerHTML = '';
    if(productionRecordsCache.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="padding:30px; color:#888; text-align:center;">등록된 완제품 생산 내역이 없습니다.</td></tr>'; return; }
    let sortedRecords = [...productionRecordsCache].sort((a, b) => new Date(a.date) - new Date(b.date)); let prevPriceMap = {};
    sortedRecords.forEach(p => { let name = p.name.trim(); if (prevPriceMap[name] !== undefined) { p.priceDiff = Number(p.price) - prevPriceMap[name]; } else { p.priceDiff = null; } prevPriceMap[name] = Number(p.price); }); sortedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let groupedData = {};
    sortedRecords.forEach(p => { let name = p.name.trim(); if(!groupedData[name]) groupedData[name] = { items: [] }; groupedData[name].items.push(p); });

    let groupIndex = 0;
    Object.keys(groupedData).sort().forEach(name => {
        const group = groupedData[name]; const groupId = `prod-rec-group-${groupIndex++}`;
        tbody.insertAdjacentHTML('beforeend', `<tr class="prod-rec-parent-row" style="background:#f8fafc; cursor:pointer;" onclick="toggleProdRecGroup('${groupId}', this)"><td colspan="2" style="text-align:left; font-weight:700; padding-left:15px;"><i class="fa-solid fa-chevron-down" style="color:var(--primary); margin-right:8px;"></i>${name} <span style="font-size:12px; color:var(--gray);">(${group.items.length}건)</span></td><td colspan="5"></td></tr>`);

        group.items.forEach(p => {
            let matText = p.materials && p.materials.length > 0 ? `${p.materials[0].name} 등 ${p.materials.length}건` : '자재 없음'; let vatPrice = p.priceVAT ? Number(p.priceVAT) : Math.round(Number(p.price) * 1.1); let diffHtml = p.priceDiff > 0 ? `<span style="font-size:12px; color:var(--danger); margin-left:8px;">▲ ${p.priceDiff.toLocaleString()}</span>` : (p.priceDiff < 0 ? `<span style="font-size:12px; color:var(--primary); margin-left:8px;">▼ ${Math.abs(p.priceDiff).toLocaleString()}</span>` : '');
            let defectQtyHtml = p.defectQty > 0 ? `<div style="margin-top:4px;"><span style="color:var(--danger); font-size:11px; font-weight:bold; background:#fef2f2; padding:2px 4px; border-radius:4px;">불량 ${p.defectQty}대 (${p.defectRate || 0}%)</span></div>` : '';
            let defectCostHtml = p.defectCost > 0 ? `<div style="margin-top:4px;"><span style="color:#9f1239; font-size:11px; font-weight:bold;">손실 비용: ${Number(p.defectCost).toLocaleString()}원</span></div>` : '';
            tbody.insertAdjacentHTML('beforeend', `<tr class="prod-rec-child-row prod-rec-child-${groupId}"><td style="color:var(--gray); padding-left:40px;">└ ${p.date}</td><td style="text-align:left; font-weight:700; color:var(--primary);">${p.name}</td><td style="font-weight:600;">${Number(p.qty).toLocaleString()}대 ${defectQtyHtml}</td><td>${Number(p.price).toLocaleString()}원 ${diffHtml}</td><td style="font-weight:700; color:var(--danger);">${vatPrice.toLocaleString()}원</td><td style="font-size:13px; color:var(--dark); font-weight:600;">${Number(p.totalCost).toLocaleString()}원 <span style="font-size:11px; color:var(--gray);">(${matText})</span> ${defectCostHtml}</td><td class="admin-only"><button class="btn-small" onclick="editProductionRecord(${p.id}); event.stopPropagation();"><i class="fa-solid fa-pen"></i></button><button class="btn-small" onclick="viewProductionDetail(${p.id}); event.stopPropagation();">상세</button><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteProductionRecord(${p.id}); event.stopPropagation();">×</button></td></tr>`);
        });
    }); updateUIForAdmin();
}
function toggleProdRecGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'); const isExpanded = icon.classList.contains('fa-chevron-down'); const children = document.querySelectorAll(`.prod-rec-child-${groupId}`); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } }
function toggleAllProdRec(expand) { const parents = document.querySelectorAll('.prod-rec-parent-row'); parents.forEach(parent => { const icon = parent.querySelector('i.fa-solid'); const match = parent.getAttribute('onclick').match(/toggleProdRecGroup\('([^']+)'/); if (match) { const groupId = match[1]; const children = document.querySelectorAll(`.prod-rec-child-${groupId}`); if (expand) { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } else { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } } }); }

function openProductionModal() { if(!isAdmin) { openLoginModal(); return; } document.getElementById('prodRecId').value = ''; document.getElementById('prodRecDate').valueAsDate = new Date(); document.getElementById('prodRecName').value = ''; document.getElementById('prodRecQty').value = '1'; document.getElementById('prodRecPrice').value = ''; document.getElementById('prodRecPriceVAT').value = ''; document.getElementById('prodMaterialBody').innerHTML = ''; document.getElementById('prodComparisonArea').style.display = 'none'; const bomSelect = document.getElementById('prodBomSelect'); bomSelect.innerHTML = '<option value="">-- BOM 구조를 불러올 제품 선택 --</option>'; bomDataCache.filter(b => !b.parentId).forEach(r => { bomSelect.innerHTML += `<option value="${r.id}">[${r.code}] ${r.name}</option>`; }); addProdMaterialRow(); document.getElementById('productionModal').style.display = 'flex'; }
function applyBomToProduction() { const bomId = Number(document.getElementById('prodBomSelect').value); if(!bomId) { customSwal.fire({ icon: 'warning', text: 'BOM 제품을 선택해주세요.' }); return; } const monthStr = document.getElementById('prodBomMonth').value, rootBom = bomDataCache.find(b => b.id === bomId), qty = Number(document.getElementById('prodRecQty').value) || 1; let leaves = []; function getLeaves(pid, currentReqQty) { const children = bomDataCache.filter(b => b.parentId === pid); children.forEach(c => { const totalReqQty = currentReqQty * c.reqQty; const grandChildren = bomDataCache.filter(b => b.parentId === c.id); if (grandChildren.length === 0) { leaves.push({ ...c, calculatedReqQty: totalReqQty }); } else { getLeaves(c.id, totalReqQty); } }); } getLeaves(bomId, 1); if(leaves.length === 0) { customSwal.fire({ icon: 'error', text: '하위 부품이 없습니다.' }); return; } document.getElementById('prodRecName').value = rootBom.name; const tbody = document.getElementById('prodMaterialBody'); tbody.innerHTML = ''; const today = document.getElementById('prodRecDate').value; leaves.forEach(leaf => { let currentPrice = Number(leaf.unitPrice); if (monthStr) { const keyword = leaf.name.replace(/\s+/g, '').toLowerCase(); 
    // 💡 여기서 단가 검색을 <= monthStr 로 변경
    const history = partPriceCache.filter(p => { const pName = p.name.replace(/\s+/g, '').toLowerCase(); return (pName.includes(keyword) || keyword.includes(pName)) && (p.date.substring(0, 7) <= monthStr); }); 
    if (history.length > 0) { history.sort((a,b) => b.date.localeCompare(a.date)); currentPrice = Number(history[0].price); } } const tr = document.createElement('tr'); tr.dataset.baseQty = leaf.calculatedReqQty; tr.dataset.basePrice = currentPrice; const finalQty = leaf.calculatedReqQty * qty, finalCost = finalQty * currentPrice; tr.innerHTML = `<td><input type="text" class="form-control mat-name" value="${leaf.name}"></td><td><input type="date" class="form-control mat-date" value="${today}"></td><td><input type="number" class="form-control mat-qty" value="${finalQty}" oninput="updateMatCost(this); calcProdTotal();"></td><td><input type="number" class="form-control mat-total-cost" value="${finalCost}" oninput="calcProdTotal(this, 'cost')"></td><td><input type="number" class="form-control mat-total-cost-vat" value="${Math.round(finalCost * 1.1)}" oninput="calcProdTotal(this, 'vat')"></td><td class="mat-price">0</td><td class="mat-per-unit">0</td><td><button class="btn-small" style="color:var(--danger); background:none;" onclick="this.closest('tr').remove(); calcProdTotal();"><i class="fa-solid fa-trash-can"></i></button></td>`; tbody.appendChild(tr); }); calcProdTotal(); showToast("BOM 데이터가 불러와졌습니다."); }
function applyProdQty() { const qty = Number(document.getElementById('prodRecQty').value) || 1; document.querySelectorAll('#prodMaterialBody tr').forEach(tr => { if(tr.dataset.baseQty) { const newQty = Number(tr.dataset.baseQty) * qty; const qtyInput = tr.querySelector('.mat-qty'); qtyInput.value = newQty; updateMatCost(qtyInput); } }); calcProdTotal(); }
function updateMatCost(qtyInput) { const tr = qtyInput.closest('tr'); if(tr.dataset.basePrice) { const qty = Number(qtyInput.value) || 0, price = Number(tr.dataset.basePrice), cost = qty * price; tr.querySelector('.mat-total-cost').value = cost; tr.querySelector('.mat-total-cost-vat').value = Math.round(cost * 1.1); } }
function compareWithPreviousProduction(prodName, currentUnitPrice) { const records = productionRecordsCache.filter(p => p.name === prodName).sort((a,b) => new Date(b.date) - new Date(a.date)), area = document.getElementById('prodComparisonArea'); if(!prodName || currentUnitPrice === 0) { area.style.display = 'none'; return; } if(records.length > 0) { const last = records[0], diff = currentUnitPrice - last.price; area.innerHTML = `과거 단가(${last.price}원) 대비 ` + (diff > 0 ? `<span style="color:var(--danger);">▲ ${diff}원 증가</span>` : `<span style="color:var(--primary);">▼ ${Math.abs(diff)}원 감소</span>`); area.style.display = 'block'; } }
function editProductionRecord(id) { const p = productionRecordsCache.find(x => x.id === id); if(!p) return; document.getElementById('prodRecId').value = p.id; document.getElementById('prodRecDate').value = p.date; document.getElementById('prodRecName').value = p.name; document.getElementById('prodRecQty').value = p.qty; document.getElementById('prodRecPrice').value = p.price; document.getElementById('prodRecPriceVAT').value = p.priceVAT; document.getElementById('prodComparisonArea').style.display = 'none'; const tbody = document.getElementById('prodMaterialBody'); tbody.innerHTML = ''; if(p.materials && p.materials.length > 0) { p.materials.forEach(m => { const tr = document.createElement('tr'); tr.innerHTML = `<td><input type="text" class="form-control mat-name" value="${m.name}"></td><td><input type="date" class="form-control mat-date" value="${m.date}"></td><td><input type="number" class="form-control mat-qty" value="${m.qty}" oninput="calcProdTotal(this, 'qty')"></td><td><input type="number" class="form-control mat-total-cost" value="${m.sum}" oninput="calcProdTotal(this, 'cost')"></td><td><input type="number" class="form-control mat-total-cost-vat" value="${Math.round(m.sum * 1.1)}" oninput="calcProdTotal(this, 'vat')"></td><td class="mat-price">0</td><td class="mat-per-unit">0</td><td><button class="btn-small" style="color:var(--danger); background:none;" onclick="this.closest('tr').remove(); calcProdTotal();"><i class="fa-solid fa-trash-can"></i></button></td>`; tbody.appendChild(tr); }); } else { addProdMaterialRow(); } calcProdTotal(); document.getElementById('productionModal').style.display = 'flex'; }
function addProdMaterialRow() { const tbody = document.getElementById('prodMaterialBody'); const tr = document.createElement('tr'); tr.innerHTML = `<td><input type="text" class="form-control mat-name"></td><td><input type="date" class="form-control mat-date"></td><td><input type="number" class="form-control mat-qty" oninput="calcProdTotal(this, 'qty')"></td><td><input type="number" class="form-control mat-total-cost" oninput="calcProdTotal(this, 'cost')"></td><td><input type="number" class="form-control mat-total-cost-vat" oninput="calcProdTotal(this, 'vat')"></td><td class="mat-price">0</td><td class="mat-per-unit">0</td><td><button class="btn-small" style="color:var(--danger); background:none;" onclick="this.closest('tr').remove(); calcProdTotal();"><i class="fa-solid fa-trash-can"></i></button></td>`; tbody.appendChild(tr); }
function calcProdTotal(el, changedField) { let total = 0; const prodQty = Number(document.getElementById('prodRecQty').value) || 0; if (el && changedField) { const tr = el.closest('tr'); if (changedField === 'cost') { const cost = Number(tr.querySelector('.mat-total-cost').value) || 0; if (cost !== 0) tr.querySelector('.mat-total-cost-vat').value = Math.round(cost * 1.1); } else if (changedField === 'vat') { const vatCost = Number(tr.querySelector('.mat-total-cost-vat').value) || 0; if (vatCost !== 0) tr.querySelector('.mat-total-cost').value = Math.round(vatCost / 1.1); } } document.querySelectorAll('#prodMaterialBody tr').forEach(row => { const q = Number(row.querySelector('.mat-qty').value) || 0, totalCost = Number(row.querySelector('.mat-total-cost').value) || 0, unitPrice = q > 0 ? totalCost / q : 0, perUnit = prodQty > 0 ? totalCost / prodQty : 0; if(row.querySelector('.mat-price')) row.querySelector('.mat-price').innerText = Math.round(unitPrice).toLocaleString(); if(row.querySelector('.mat-per-unit')) row.querySelector('.mat-per-unit').innerText = Math.round(perUnit).toLocaleString(); total += totalCost; }); let finalUnitPrice = 0, finalUnitVatPrice = 0; if (total > 0 && prodQty > 0) { finalUnitPrice = Math.round(total / prodQty); finalUnitVatPrice = Math.round(finalUnitPrice * 1.1); } document.getElementById('prodRecPrice').value = finalUnitPrice; document.getElementById('prodRecPriceVAT').value = finalUnitVatPrice; document.getElementById('prodTotalCost').innerText = total.toLocaleString(); document.getElementById('summaryUnitPrice').innerText = finalUnitPrice.toLocaleString(); document.getElementById('summaryVatPrice').innerText = finalUnitVatPrice.toLocaleString(); compareWithPreviousProduction(document.getElementById('prodRecName').value.trim(), finalUnitPrice); }

async function saveProductionRecord() { 
    const id = document.getElementById('prodRecId').value, 
          date = document.getElementById('prodRecDate').value, 
          name = document.getElementById('prodRecName').value.trim(), 
          qty = document.getElementById('prodRecQty').value, 
          price = document.getElementById('prodRecPrice').value, 
          priceVAT = document.getElementById('prodRecPriceVAT').value; 
          
    if(!date || !name || !qty) return; 

    // 💡 중복 클릭 방지: 버튼 비활성화 및 로딩 UI 표시
    const btn = document.querySelector('#productionModal .btn-save');
    if(btn) { 
        btn.disabled = true; 
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장중...'; 
    }

    try {
        const materials = []; let totalCost = 0; 
        document.querySelectorAll('#prodMaterialBody tr').forEach(row => { 
            const mName = row.querySelector('.mat-name').value.trim(), 
                  mDate = row.querySelector('.mat-date').value, 
                  mQty = Number(row.querySelector('.mat-qty').value) || 0, 
                  mTotalCost = Number(row.querySelector('.mat-total-cost').value) || 0, 
                  mPrice = mQty > 0 ? mTotalCost / mQty : 0; 
            if(mName && mQty > 0) { 
                materials.push({ name: mName, date: mDate, qty: mQty, price: mPrice, sum: mTotalCost }); 
                totalCost += mTotalCost; 
            } 
        }); 
        
        const payload = { date, name, qty, price, priceVAT, materials, totalCost }; 
        if(id) payload.id = Number(id); 
        
        await fetch('/api/production_record', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); 
        
        document.getElementById('productionModal').style.display = 'none'; 
        loadProductionRecords(); 
        showToast("저장됨"); 
    } catch (err) {
        console.error(err);
        customSwal.fire({icon:'error', text:'저장 중 서버 오류가 발생했습니다.'});
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.innerHTML = '저장하기'; 
        }
    }
}

async function deleteProductionRecord(id) { if(!isAdmin) return; const r = await customSwal.fire({ title:'삭제', icon:'warning', showCancelButton:true, confirmButtonColor:'#e63946' }); if(r.isConfirmed) { await fetch(`/api/production_record?id=${id}`, { method: 'DELETE' }); loadProductionRecords(); showToast("삭제됨"); } }
function viewProductionDetail(id) { const p = productionRecordsCache.find(x => x.id === id); if(!p) return; document.getElementById('detailProdName').innerText = p.name; document.getElementById('detailProdDate').innerText = p.date; document.getElementById('detailProdQty').innerHTML = `${Number(p.qty).toLocaleString()} 대`; document.getElementById('detailProdPrice').innerText = `${Number(p.price).toLocaleString()} 원`; document.getElementById('detailProdPriceVAT').innerText = `${Number(p.priceVAT).toLocaleString()} 원`; document.getElementById('detailProdTotalCost').innerText = `${Number(p.totalCost).toLocaleString()} 원`; const matBody = document.getElementById('detailProdMaterials'); matBody.innerHTML = ''; p.materials.forEach(m => { matBody.insertAdjacentHTML('beforeend', `<tr><td>${m.name}</td><td>${m.date}</td><td>${m.qty}</td><td>${m.sum}</td><td style="color:var(--danger);">${Math.round(m.sum*1.1)}</td><td>${m.price}</td><td style="color:var(--primary);">${(m.sum/p.qty).toFixed(1)}</td></tr>`); }); document.getElementById('productionDetailModal').style.display = 'flex'; }

let partPriceCache = [];
async function loadPartPrices() { try { const r = await fetch('/api/part_price'); partPriceCache = await r.json(); renderPartPrices(); } catch(e) {} }
function renderPartPrices() {
    const tbody = document.getElementById('partPriceBody'); tbody.innerHTML = '';
    if(partPriceCache.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="padding:30px; color:#888; text-align:center;">등록된 부속품 내역이 없습니다.</td></tr>'; return; }
    let sortedParts = [...partPriceCache].sort((a, b) => new Date(a.date) - new Date(b.date)); let prevPriceMap = {};
    sortedParts.forEach(p => { let name = p.name.trim(); if (prevPriceMap[name] !== undefined) { p.priceDiff = Number(p.price) - prevPriceMap[name]; } else { p.priceDiff = null; } prevPriceMap[name] = Number(p.price); });
    sortedParts.sort((a, b) => new Date(b.date) - new Date(a.date));
    let groupedData = {}; sortedParts.forEach(p => { let name = p.name.trim(); if (!groupedData[name]) groupedData[name] = { totalPrice: 0, items: [] }; groupedData[name].totalPrice += Number(p.price); groupedData[name].items.push(p); });
    let groupIndex = 0;
    Object.keys(groupedData).sort().forEach(name => {
        const group = groupedData[name], groupId = `part-group-${groupIndex++}`, avgPrice = Math.round(group.totalPrice / group.items.length);
        let parentRow = `<tr class="part-parent-row" style="background:#f8fafc; cursor:pointer;" onclick="togglePartGroup('${groupId}', this)"><td colspan="4" style="text-align:left; font-weight:700; padding-left:15px;"><i class="fa-solid fa-chevron-down" style="color:var(--primary); margin-right:8px;"></i>${name} <span style="font-size:12px; color:var(--gray);">(${group.items.length}건)</span></td><td><div style="font-weight:800; color:var(--primary);">평균 ${avgPrice.toLocaleString()}원</div></td><td colspan="2"></td></tr>`;
        tbody.insertAdjacentHTML('beforeend', parentRow);
        group.items.forEach(p => {
            let diffHtml = p.priceDiff !== null ? (p.priceDiff > 0 ? `<span style="color:var(--danger); font-size:12px; margin-left:8px;">▲ ${p.priceDiff}원</span>` : (p.priceDiff < 0 ? `<span style="color:var(--primary); font-size:12px; margin-left:8px;">▼ ${Math.abs(p.priceDiff)}원</span>` : '')) : '';
            let childRow = `<tr class="part-child-row part-child-${groupId}"><td style="color:var(--gray); text-align:center;">${p.date}</td><td style="text-align:left; color:#64748b; padding-left:20px;">└ ${p.name}</td><td style="font-weight:600;">${Number(p.qty || 0).toLocaleString()}개</td><td style="font-weight:600;">${Number(p.totalCost || 0).toLocaleString()}원</td><td><div style="color:var(--primary); font-weight:600;">${Number(p.price).toLocaleString()}원 ${diffHtml}</div></td><td style="color:var(--gray);">${p.note || '-'}</td><td class="admin-only"><button class="btn-small" onclick="openPartPriceModal(${p.id}); event.stopPropagation();"><i class="fa-solid fa-pen"></i></button><button class="btn-small" style="background:var(--danger); color:white;" onclick="deletePartPrice(${p.id}); event.stopPropagation();">×</button></td></tr>`;
            tbody.insertAdjacentHTML('beforeend', childRow);
        }); 
    }); updateUIForAdmin();
}
function togglePartGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'), isExpanded = icon.classList.contains('fa-chevron-down'), children = document.querySelectorAll(`.part-child-${groupId}`); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } }
function toggleAllPartPrice(expand) { const parents = document.querySelectorAll('.part-parent-row'); parents.forEach(parent => { const icon = parent.querySelector('i.fa-solid'), onclickAttr = parent.getAttribute('onclick'), match = onclickAttr.match(/togglePartGroup\('([^']+)'/); if (match) { const groupId = match[1], children = document.querySelectorAll(`.part-child-${groupId}`); if (expand) { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.style.display = 'table-row'); } else { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.style.display = 'none'); } } }); }

/* 💡 1. 부속품 단가 자동 계산 및 VAT 역산 로직 교체 */
function calcPartUnitPrice(el, changedField) { 
    const qty = Number(document.getElementById('ppQty').value) || 0;
    const costInput = document.getElementById('ppTotalCost');
    const vatInput = document.getElementById('ppTotalCostVat');
    const priceInput = document.getElementById('ppPrice');
    
    // 입력한 칸에 따라 VAT 별도/포함 자동 상호 계산
    if (changedField === 'cost') {
        const cost = Number(costInput.value) || 0;
        if (cost !== 0) vatInput.value = Math.round(cost * 1.1);
        else vatInput.value = '';
    } else if (changedField === 'vat') {
        const vatCost = Number(vatInput.value) || 0;
        if (vatCost !== 0) costInput.value = Math.round(vatCost / 1.1);
        else costInput.value = '';
    }

    // 최종 산출된 VAT 별도 금액과 수량을 기반으로 1개당 단가 계산
    const finalCost = Number(costInput.value) || 0;
    if (qty > 0 && finalCost > 0) { 
        priceInput.value = Math.round((finalCost / qty) * 100) / 100; 
    } else if (finalCost === 0 || qty === 0) { 
        priceInput.value = ''; 
    } 
}

/* 💡 2. 부속품 모달창 열기 로직 교체 (VAT 포함액 데이터 세팅 추가) */
function openPartPriceModal(id = null) { 
    if(!isAdmin) { openLoginModal(); return; } 
    if(id) { 
        const part = partPriceCache.find(p => p.id === id); 
        if(part) { 
            document.getElementById('ppEditId').value = part.id; 
            document.getElementById('ppDate').value = part.date; 
            document.getElementById('ppName').value = part.name; 
            document.getElementById('ppQty').value = part.qty || ''; 
            document.getElementById('ppTotalCost').value = part.totalCost || ''; 
            document.getElementById('ppTotalCostVat').value = part.totalCost ? Math.round(part.totalCost * 1.1) : '';
            document.getElementById('ppPrice').value = part.price; 
            document.getElementById('ppNote').value = part.note || ''; 
        } 
    } else { 
        document.getElementById('ppEditId').value = ''; 
        document.getElementById('ppDate').value = new Date().toISOString().split('T')[0]; 
        document.getElementById('ppName').value = ''; 
        document.getElementById('ppQty').value = ''; 
        document.getElementById('ppTotalCost').value = ''; 
        document.getElementById('ppTotalCostVat').value = ''; 
        document.getElementById('ppPrice').value = ''; 
        document.getElementById('ppNote').value = ''; 
    } 
    document.getElementById('partPriceModal').style.display = 'flex'; 
}
async function savePartPrice() { const id = document.getElementById('ppEditId').value, name = document.getElementById('ppName').value.trim(); if(!name) return; const payload = { date: document.getElementById('ppDate').value, name: name, qty: Number(document.getElementById('ppQty').value) || 0, totalCost: Number(document.getElementById('ppTotalCost').value) || 0, price: Number(document.getElementById('ppPrice').value) || 0, note: document.getElementById('ppNote').value.trim() }; if(id) payload.id = Number(id); await fetch('/api/part_price', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); document.getElementById('partPriceModal').style.display = 'none'; loadPartPrices(); showToast("저장됨"); }
async function deletePartPrice(id) { if(!isAdmin) return; const r = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(r.isConfirmed) { await fetch(`/api/part_price?id=${id}`, { method: 'DELETE' }); loadPartPrices(); showToast("삭제됨"); } }
function toggleAllBom(expand) { const icons = document.querySelectorAll('#bomTreeBody .fa-chevron-down, #bomTreeBody .fa-chevron-right'); icons.forEach(i => { const tr = i.closest('tr'); const id = tr.id.replace('bom-row-', ''); if(expand) { i.classList.replace('fa-chevron-right', 'fa-chevron-down'); showBomChildren(id); } else { if(tr.dataset.parent === 'root') { i.classList.replace('fa-chevron-down', 'fa-chevron-right'); hideBomChildren(id); } } }); }
async function handleBomExcelUpload(e) { const file = e.target.files[0]; if(!file) return; if(!isAdmin) { openLoginModal(); e.target.value = ''; return; } const reader = new FileReader(); reader.onload = async function(evt) { try { document.getElementById('loadingOverlay').style.display = 'flex'; const data = new Uint8Array(evt.target.result); const workbook = XLSX.read(data, {type: 'array'}); const firstSheetName = workbook.SheetNames[0]; const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]); if(rows.length === 0) return; let successCount = 0; for(const row of rows) { const parentCode = row['상위품목코드'], code = row['품목코드'], name = row['품목명'], supplier = row['협력업체'] || '', reqQty = Number(row['소요량']) || 1, unitPrice = Number(row['단가']) || 0; if(!code || !name) continue; let parentId = null; if(parentCode) { await loadBomTree(); const parentItem = bomDataCache.find(b => b.code === String(parentCode).trim()); if(parentItem) parentId = parentItem.id; } const payload = { parentId: parentId, code: String(code).trim(), name: String(name).trim(), supplier: String(supplier).trim(), version: "엑셀 업로드", reqQty: reqQty, unitPrice: unitPrice }; await fetch('/api/bom', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); successCount++; } await loadBomTree(); e.target.value = ''; document.getElementById('loadingOverlay').style.display = 'none'; showToast(`${successCount}건 업로드됨`); } catch(err) { console.error(err); document.getElementById('loadingOverlay').style.display = 'none'; } }; reader.readAsArrayBuffer(file); }
async function loadBomTree() { try { const res = await fetch('/api/bom'); bomDataCache = await res.json(); renderBomTree(); } catch(e) {} }
/* =================================================================
   계층형 BOM 트리 렌더링 (프리미엄 폴더/부품 UI 적용)
================================================================= */
function renderBomTree() {
    const idToNode = {}; let bomList = JSON.parse(JSON.stringify(bomDataCache)); 
    bomList.forEach(item => { idToNode[item.id] = item; item.children = []; });
    let roots = []; bomList.forEach(item => { if (item.parentId && idToNode[item.parentId]) { idToNode[item.parentId].children.push(item); } else { roots.push(item); } });
    
    function traverse(node, currentLevel) { node.level = currentLevel; node.children.forEach(child => { traverse(child, currentLevel + 1); }); }
    roots.forEach(root => traverse(root, 1));
    
    function flattenTree(nodes) { let result = []; nodes.forEach(node => { result.push(node); result = result.concat(flattenTree(node.children)); }); return result; }
    const flatData = flattenTree(roots);
    
    const tbody = document.getElementById('bomTreeBody'); tbody.innerHTML = '';
    if (flatData.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="padding:30px; color:#888; text-align:center;">등록된 BOM 데이터가 없습니다.</td></tr>'; return; }
    
    flatData.forEach(item => {
        const indent = (item.level - 1) * 28; // 자식 노드 간격을 기존 20px에서 28px로 넓혀서 선명하게
        const isParent = item.children.length > 0;
        const isRoot = item.level === 1;
        
        // 💡 1. 층위별 레벨 배지 색상 (L1: 파랑, L2: 보라, L3: 하늘색, L4~: 회색)
        let lvlColor = isRoot ? 'var(--primary)' : (item.level === 2 ? '#8b5cf6' : (item.level === 3 ? '#0ea5e9' : '#94a3b8'));
        let levelBadge = `<span style="background:${lvlColor}; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:800; box-shadow:0 2px 4px rgba(0,0,0,0.1);">L${item.level}</span>`;

        // 💡 2. 아이콘 시각화 (조립품은 폴더, 단일 부품은 마이크로칩)
        let iconHtml = isParent 
            ? `<span onclick="toggleBomRow(${item.id}, this)" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; position:relative; z-index:2; padding:3px 6px; background:#fff; border-radius:6px; border:1px solid #e2e8f0; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='#e2e8f0'"><i class="fa-solid fa-chevron-down" style="color:var(--primary); font-size:11px; width:12px; text-align:center;"></i><i class="fa-solid fa-folder-open" style="color:#f59e0b; font-size:14px;"></i></span>`
            : `<span style="display:inline-flex; align-items:center; position:relative; z-index:2; padding-left:20px;"><i class="fa-solid fa-microchip" style="color:#94a3b8; font-size:15px; background:inherit; padding:2px; border-radius:4px;"></i></span>`;

        // 💡 3. 트리 연결선(L자)을 그리기 위해 자바스크립트에서 CSS로 --indent 변수 전송
        let tdStyle = `text-align:left; padding-left:${indent + 15}px; position:relative; --indent:${indent}px;`;

        // 💡 4. 행(Row) 자체의 디자인 (최상위 Root 품목일 경우 눈에 띄게 블록화)
        let rowClass = isRoot ? 'bom-root-row' : 'bom-sub-row';
        let rowBg = isRoot ? 'linear-gradient(90deg, #f8fafc, #ffffff)' : 'transparent';
        let rowBorder = isRoot ? 'border-top:2px solid #cbd5e1; border-bottom:1px solid #e2e8f0;' : 'border-bottom:1px dashed #f1f5f9;';
        let codeStyle = isRoot ? 'font-weight:800; color:var(--primary); font-size:14px;' : 'font-weight:600; color:var(--dark); font-size:13px;';
        let nameStyle = isRoot ? 'font-weight:700; color:#0f172a; font-size:14px;' : 'font-weight:500; color:#475569; font-size:13px;';

        let row = `<tr id="bom-row-${item.id}" data-parent="${item.parentId || 'root'}" class="bom-row ${rowClass}" style="${rowBorder} background:${rowBg};">
            <td style="text-align:center; width:60px;">${levelBadge}</td>
            <td class="bom-tree-cell" style="${tdStyle}">
                <div style="display:flex; align-items:center; gap:8px;">
                    ${iconHtml}
                    <span style="${codeStyle}">${item.code}</span>
                </div>
            </td>
            <td style="${nameStyle}">${item.name}</td>
            <td style="text-align:left; color:var(--gray); font-size:12px;">${item.supplier ? `<i class="fa-solid fa-building" style="margin-right:4px;"></i>${item.supplier}` : '<span style="opacity:0.3;">-</span>'}</td>
            <td style="text-align:center;"><span style="background:${isRoot ? '#dbeafe' : '#f1f5f9'}; color:${isRoot ? 'var(--primary)' : '#475569'}; padding:4px 12px; border-radius:8px; font-weight:800; font-size:13px; border:1px solid ${isRoot ? '#bfdbfe' : 'transparent'};">${item.reqQty}</span></td>
            <td class="admin-only" style="text-align:center;"><button class="btn-small" style="background:#4cc9f0; color:white; margin-right:5px;" onclick="openBomModal(${item.id})" title="수정"><i class="fa-solid fa-pen"></i></button><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteBom(${item.id})" title="삭제">×</button></td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    updateUIForAdmin();
}
function toggleBomRow(parentId, iconSpan) { const icon = iconSpan.querySelector('i'); const isExpanded = icon.classList.contains('fa-chevron-down'); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); hideBomChildren(parentId); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); showBomChildren(parentId); } }
function hideBomChildren(parentId) { const children = document.querySelectorAll(`tr[data-parent="${parentId}"]`); children.forEach(child => { child.classList.add('bom-child-hidden'); const childId = child.id.replace('bom-row-', ''); hideBomChildren(childId); }); }
function showBomChildren(parentId) { const children = document.querySelectorAll(`tr[data-parent="${parentId}"]`); children.forEach(child => { child.classList.remove('bom-child-hidden'); const icon = child.querySelector('.fa-chevron-down'); if (icon) { const childId = child.id.replace('bom-row-', ''); showBomChildren(childId); } }); }
function openBomModal(id = null) { if(!isAdmin) { openLoginModal(); return; } const parentSelect = document.getElementById('bomParentId'); parentSelect.innerHTML = '<option value="">-- 최상위 제품 --</option>'; bomDataCache.forEach(b => { if(b.id !== id) { parentSelect.innerHTML += `<option value="${b.id}">[${b.code}] ${b.name}</option>`; } }); if(id) { const item = bomDataCache.find(x => x.id === id); document.getElementById('bomEditId').value = item.id; document.getElementById('bomParentId').value = item.parentId || ''; document.getElementById('bomItemCode').value = item.code; document.getElementById('bomItemName').value = item.name; document.getElementById('bomSupplier').value = item.supplier || ''; document.getElementById('bomVersion').value = item.version || ''; document.getElementById('bomReqQty').value = item.reqQty; document.getElementById('bomUnitPrice').value = item.unitPrice; } else { document.getElementById('bomEditId').value = ''; document.getElementById('bomParentId').value = ''; document.getElementById('bomItemCode').value = ''; document.getElementById('bomItemName').value = ''; document.getElementById('bomSupplier').value = ''; document.getElementById('bomVersion').value = ''; document.getElementById('bomReqQty').value = '1'; document.getElementById('bomUnitPrice').value = '0'; } document.getElementById('pastPriceSelect').style.display = 'none'; document.getElementById('bomModal').style.display = 'flex'; }
function onBomCodeChange() { const code = document.getElementById('bomItemCode').value.trim(); const found = itemMasterCache.find(i => i.PROD_CD.trim() === code) || inventoryDataCache.find(i => i.PROD_CD.trim() === code); if(found) { document.getElementById('bomItemName').value = found.PROD_DES; } }
function fetchPastPrices() { const name = document.getElementById('bomItemName').value.trim(); if(!name) return; const keyword = name.replace(/\s+/g, '').toLowerCase(); const matches = partPriceCache.filter(p => { const pName = p.name.replace(/\s+/g, '').toLowerCase(); return pName.includes(keyword) || keyword.includes(pName); }); const select = document.getElementById('pastPriceSelect'); if(matches.length === 0) { select.style.display = 'none'; return; } matches.sort((a,b) => b.date.localeCompare(a.date)); select.innerHTML = '<option value="">-- 단가 선택 --</option>'; matches.forEach(m => { select.innerHTML += `<option value="${m.price}" data-date="${m.date}">${m.date} : ${Number(m.price)}원</option>`; }); select.style.display = 'block'; }
function applyPastPrice(val) { if(!val) return; document.getElementById('bomUnitPrice').value = val; const select = document.getElementById('pastPriceSelect'); const selectedOpt = select.options[select.selectedIndex]; const dateStr = selectedOpt.getAttribute('data-date'); if(dateStr) { const [y, m, d] = dateStr.split('-'); document.getElementById('bomVersion').value = `${y.substring(2)}년 ${m}월`; } }
async function saveBom() { const id = document.getElementById('bomEditId').value, parentId = document.getElementById('bomParentId').value, code = document.getElementById('bomItemCode').value.trim(), name = document.getElementById('bomItemName').value.trim(), supplier = document.getElementById('bomSupplier').value.trim(), version = document.getElementById('bomVersion').value.trim(), reqQty = document.getElementById('bomReqQty').value, unitPrice = document.getElementById('bomUnitPrice').value; if(!code || !name) return; const payload = { parentId: parentId ? Number(parentId) : null, code: code, name: name, supplier: supplier, version: version, reqQty: Number(reqQty), unitPrice: Number(unitPrice) }; if(id) payload.id = Number(id); await fetch('/api/bom', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); document.getElementById('bomModal').style.display = 'none'; loadBomTree(); showToast("저장됨"); }
async function deleteBom(id) { if(!isAdmin) return; const result = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(result.isConfirmed) { await fetch(`/api/bom?id=${id}`, { method: 'DELETE' }); loadBomTree(); showToast("삭제됨"); } }

function renderIncoming() {
    const tbody = document.getElementById('incomingBody'); tbody.innerHTML = '';
    if(incomingDataCache.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="padding:30px; color:#888; text-align:center;">내역 없음</td></tr>'; return; }
    let sortedData = [...incomingDataCache].sort((a, b) => new Date(b.date) - new Date(a.date)); let groupedData = {};
    sortedData.forEach(p => { let prodName = (p.product || "미지정").trim(); if (!groupedData[prodName]) groupedData[prodName] = { totalQty: 0, items: [] }; groupedData[prodName].totalQty += Number(p.qty); groupedData[prodName].items.push(p); });
    Object.keys(groupedData).sort().forEach((prodName, index) => {
        const group = groupedData[prodName]; const groupId = `inc-group-${index}`;
        let parentRow = `<tr class="inc-parent-row" style="background:#f8fafc; cursor:pointer;" onclick="toggleIncomingGroup('${groupId}', this)"><td colspan="3" style="text-align:left; font-weight:700; padding-left:15px;"><i class="fa-solid fa-chevron-down" style="color:var(--primary); margin-right:8px;"></i>${prodName}</td><td style="font-weight:800; color:var(--primary);">총 ${group.totalQty.toLocaleString()} 개</td><td colspan="2"></td></tr>`;
        tbody.insertAdjacentHTML('beforeend', parentRow);
        group.items.forEach(p => {
            let childRow = `<tr class="inc-child-row inc-child-${groupId}"><td style="color:var(--gray); padding-left:40px;">└ ${p.date}</td><td style="text-align:left;">${p.supplier}</td><td style="text-align:left;">${p.product}</td><td style="font-weight:700;">${Number(p.qty).toLocaleString()}</td><td style="text-align:left; color:var(--gray);">${p.note || '-'}</td><td class="admin-only"><button class="btn-small" onclick="openIncomingModal(${p.id}); event.stopPropagation();"><i class="fa-solid fa-pen"></i></button><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteIncoming(${p.id}); event.stopPropagation();">×</button></td></tr>`;
            tbody.insertAdjacentHTML('beforeend', childRow);
        });
    }); updateUIForAdmin();
}
function toggleIncomingGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'); const isExpanded = icon.classList.contains('fa-chevron-down'); const children = document.querySelectorAll(`.inc-child-${groupId}`); if (isExpanded) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.classList.add('inc-child-hidden')); } else { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.classList.remove('inc-child-hidden')); } }
function toggleAllIncoming(expand) { const parents = document.querySelectorAll('.inc-parent-row'); parents.forEach(parent => { const icon = parent.querySelector('i.fa-solid'); const match = parent.getAttribute('onclick').match(/toggleIncomingGroup\('([^']+)'/); if (match) { const groupId = match[1]; const children = document.querySelectorAll(`.inc-child-${groupId}`); if (expand) { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); children.forEach(c => c.classList.remove('inc-child-hidden')); } else { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); children.forEach(c => c.classList.add('inc-child-hidden')); } } }); }
function openIncomingModal(id = null) { if(!isAdmin) { openLoginModal(); return; } if(id) { const item = incomingDataCache.find(x => x.id === id); document.getElementById('incEditId').value = item.id; document.getElementById('incDate').value = item.date; document.getElementById('incSupplier').value = item.supplier; document.getElementById('incProduct').value = item.product; document.getElementById('incQty').value = item.qty; document.getElementById('incNote').value = item.note || ''; } else { document.getElementById('incEditId').value = ''; document.getElementById('incDate').valueAsDate = new Date(); document.getElementById('incSupplier').value = ''; document.getElementById('incProduct').value = ''; document.getElementById('incQty').value = ''; document.getElementById('incNote').value = ''; } document.getElementById('incomingModal').style.display = 'flex'; }
async function saveIncoming() { const id = document.getElementById('incEditId').value, date = document.getElementById('incDate').value, supplier = document.getElementById('incSupplier').value.trim(), product = document.getElementById('incProduct').value.trim(), qty = document.getElementById('incQty').value, note = document.getElementById('incNote').value.trim(); if(!date || !supplier || !product || !qty) return; const payload = { date, supplier, product, qty: Number(qty), note }; if(id) payload.id = Number(id); await fetch('/api/incoming', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); document.getElementById('incomingModal').style.display = 'none'; loadIncoming(); showToast("입고 저장됨"); }
async function deleteIncoming(id) { if(!isAdmin) return; const result = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(result.isConfirmed) { await fetch(`/api/incoming?id=${id}`, { method: 'DELETE' }); loadIncoming(); showToast("삭제됨"); } }

let boardDataCache = [];
async function loadBoard() { try { const r = await fetch('/api/board'); boardDataCache = await r.json(); renderBoard(); } catch(e) { console.error('게시판 에러'); } }
function renderBoard() {
    const b = document.getElementById('boardBody'); b.innerHTML = '';
    if(boardDataCache.length === 0) { b.innerHTML = '<tr><td colspan="5" style="padding:30px; color:#888;">등록된 게시글이 없습니다.</td></tr>'; return; }
    boardDataCache.forEach((post, index) => {
        let row = `<tr class="board-row" onclick="viewBoardPost(${post.id})"><td style="color:var(--gray);">${boardDataCache.length - index}</td><td style="text-align:left; font-weight:600; color:var(--primary);">${post.title}</td><td>${post.author}</td><td style="color:var(--gray); font-size:13px;">${post.date}</td><td class="admin-only" onclick="event.stopPropagation();"><button class="btn-small" onclick="editBoardPost(${post.id})"><i class="fa-solid fa-pen"></i></button><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteBoardPost(${post.id})">×</button></td></tr>`;
        b.insertAdjacentHTML('beforeend', row);
    }); updateUIForAdmin();
}
function openBoardWriteModal() { document.getElementById('boardWriteId').value = ''; document.getElementById('boardWriteTitle').value = ''; document.getElementById('boardWriteTeam').value = ''; document.getElementById('boardWriteAuthor').value = ''; document.getElementById('boardWriteContent').value = ''; document.getElementById('boardWriteModal').style.display = 'flex'; }
function editBoardPost(id) { if(!isAdmin) { openLoginModal(); return; } const post = boardDataCache.find(p => p.id === id); if(!post) return; document.getElementById('boardWriteId').value = post.id; document.getElementById('boardWriteTitle').value = post.title; document.getElementById('boardWriteTeam').value = post.team || ''; document.getElementById('boardWriteAuthor').value = post.author; document.getElementById('boardWriteContent').value = post.content; document.getElementById('boardWriteModal').style.display = 'flex'; }
async function saveBoardPost() { const id = document.getElementById('boardWriteId').value, title = document.getElementById('boardWriteTitle').value.trim(), author = document.getElementById('boardWriteAuthor').value.trim(), content = document.getElementById('boardWriteContent').value.trim(); if(!title || !author || !content) return; const payload = { title, team: "", author, content }; if(id) payload.id = Number(id); await fetch('/api/board', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); document.getElementById('boardWriteModal').style.display = 'none'; loadBoard(); showToast("저장됨"); }
function viewBoardPost(id) { const post = boardDataCache.find(p => p.id === id); if(!post) return; document.getElementById('viewBoardTitle').innerText = post.title; document.getElementById('viewBoardAuthor').innerText = post.author; document.getElementById('viewBoardDate').innerText = post.date; document.getElementById('viewBoardContent').innerText = post.content; document.getElementById('boardViewModal').style.display = 'flex'; }
async function deleteBoardPost(id) { if(!isAdmin) return; const result = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(result.isConfirmed) { await fetch(`/api/board?id=${id}`, { method: 'DELETE' }); loadBoard(); showToast("삭제됨"); } }

let archiveDataCache = [];
async function loadArchive() { try { const r = await fetch('/api/archive'); archiveDataCache = await r.json(); renderArchive(); } catch(e) { console.error('자료실 에러'); } }
function renderArchive() {
    const b = document.getElementById('archiveBody'); b.innerHTML = ''; const keyword = document.getElementById('archiveSearch') ? document.getElementById('archiveSearch').value.toLowerCase() : '';
    if(archiveDataCache.length === 0) { b.innerHTML = '<tr><td colspan="5" style="padding:30px; color:#888;">등록된 자료가 없습니다.</td></tr>'; return; }
    let groupedData = {}; archiveDataCache.forEach(f => { const title = f.title || '미분류'; if (!groupedData[title]) groupedData[title] = []; groupedData[title].push(f); });
    let groupIndex = 0;
    Object.keys(groupedData).sort().forEach(title => {
        const files = groupedData[title], folderMatch = title.toLowerCase().includes(keyword), matchedFiles = files.filter(f => { const searchStr = (f.original_name || f.filename).toLowerCase(); return searchStr.includes(keyword); });
        if (keyword && !folderMatch && matchedFiles.length === 0) return; const displayFiles = (keyword && !folderMatch) ? matchedFiles : files; const groupId = `archive-group-${groupIndex++}`;
        b.insertAdjacentHTML('beforeend', `<tr class="archive-parent-row" style="background:#f8fafc; cursor:pointer;" onclick="toggleArchiveGroup('${groupId}', this)"><td colspan="5" style="text-align:left; font-weight:700; padding-left:15px;"><i class="fa-solid fa-folder-open" style="color:var(--primary); margin-right:8px;"></i>${title} <span style="font-size:12px; color:var(--gray);">(${displayFiles.length}개)</span></td></tr>`);
        displayFiles.forEach(f => {
            b.insertAdjacentHTML('beforeend', `<tr class="archive-child-row archive-child-${groupId}"><td style="text-align:left; padding-left:45px; color:var(--gray);"><i class="fa-regular fa-file-lines" style="color:var(--primary); margin-right:8px;"></i>${f.original_name || f.filename}</td><td style="color:var(--gray); font-size:13px;">${f.size}</td><td style="color:var(--gray); font-size:13px;">${f.date}</td><td><button class="btn-small" onclick="viewArchiveFile('${f.filename}', '${f.original_name || f.filename}'); event.stopPropagation();"><i class="fa-solid fa-eye"></i> 보기</button><a href="/uploads/${encodeURIComponent(f.filename)}" download="${f.original_name || f.filename}" target="_blank" class="btn-small" style="text-decoration:none;" onclick="event.stopPropagation();"><i class="fa-solid fa-download"></i> 다운</a></td><td class="admin-only"><button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteArchiveFile(${f.id}, '${f.original_name || f.filename}'); event.stopPropagation();">×</button></td></tr>`);
        });
    }); updateUIForAdmin();
}
function toggleArchiveGroup(groupId, rowEl) { const icon = rowEl.querySelector('i.fa-solid'); const isExpanded = icon.classList.contains('fa-folder-open'); const children = document.querySelectorAll(`.archive-child-${groupId}`); if (isExpanded) { icon.classList.replace('fa-folder-open', 'fa-folder'); children.forEach(c => c.style.display = 'none'); } else { icon.classList.replace('fa-folder', 'fa-folder-open'); children.forEach(c => c.style.display = 'table-row'); } }
function toggleAllArchive(expand) { const parents = document.querySelectorAll('.archive-parent-row'); parents.forEach(parent => { const icon = parent.querySelector('i.fa-solid'); const match = parent.getAttribute('onclick').match(/toggleArchiveGroup\('([^']+)'/); if (match) { const groupId = match[1]; const children = document.querySelectorAll(`.archive-child-${groupId}`); if (expand) { icon.classList.replace('fa-folder', 'fa-folder-open'); children.forEach(c => c.style.display = 'table-row'); } else { icon.classList.replace('fa-folder-open', 'fa-folder'); children.forEach(c => c.style.display = 'none'); } } }); }
function filterArchive() { renderArchive(); }
function openArchiveModal() { if(!isAdmin) { openLoginModal(); return; } const dl = document.getElementById('archiveTitleList'); dl.innerHTML = ''; const uniqueTitles = [...new Set(archiveDataCache.map(f => f.title).filter(t => t && t !== '미분류'))].sort(); uniqueTitles.forEach(t => { dl.innerHTML += `<option value="${t}"></option>`; }); document.getElementById('archiveTitleInput').value = ''; const fileInput = document.getElementById('archiveFileInput'); fileInput.value = ''; fileInput.setAttribute('accept', 'image/*'); document.getElementById('archiveModal').style.display = 'flex'; }
async function submitArchiveFile() { 
    if(!isAdmin) { openLoginModal(); return; } const title = document.getElementById('archiveTitleInput').value.trim(); const fileInput = document.getElementById('archiveFileInput'); 
    if(!title || fileInput.files.length === 0) return; document.getElementById('loadingOverlay').style.display='flex'; 
    let file = fileInput.files[0]; const originalName = file.name.split('.').slice(0, -1).join('.'); 
    if (file.type.startsWith('image/')) { try { file = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); canvas.toBlob((blob) => { resolve(new File([blob], `${originalName}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.9); }; img.src = e.target.result; }; reader.readAsDataURL(file); }); } catch (e) {} } 
    const formData = new FormData(); formData.append('title', title); formData.append('file', file); 
    try { await fetch('/api/archive', { method: 'POST', body: formData }); document.getElementById('archiveModal').style.display='none'; loadArchive(); showToast('업로드 완료'); } finally { document.getElementById('loadingOverlay').style.display='none'; } 
}
async function deleteArchiveFile(id, filename) { if(!isAdmin) return; const result = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(result.isConfirmed) { await fetch(`/api/archive?id=${id}`, { method: 'DELETE' }); loadArchive(); showToast('삭제됨'); } }
/* =================================================================
   📂 파일 미리보기 렌더링 (엑셀 표 고급 디자인 적용)
================================================================= */
async function viewArchiveFile(filename, originalName) { 
    const ext = filename.split('.').pop().toLowerCase(); 
    const url = `/uploads/${encodeURIComponent(filename)}`; 
    const contentDiv = document.getElementById('fileViewerContent'); 
    document.getElementById('fileViewerTitle').innerText = originalName || filename; 
    document.getElementById('fileViewerModal').style.display = 'flex'; 
    contentDiv.innerHTML = '<div class="spinner" style="margin:auto;"></div>'; 
    
    try { 
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) { 
            contentDiv.innerHTML = `<img src="${url}" alt="${filename}">`; 
        } else if (['pdf', 'txt'].includes(ext)) { 
            contentDiv.innerHTML = `<iframe src="${url}"></iframe>`; 
        } else if (['xlsx', 'xls', 'csv'].includes(ext)) { 
            const response = await fetch(url); 
            const arrayBuffer = await response.arrayBuffer(); 
            const workbook = XLSX.read(arrayBuffer, {type: 'array'}); 
            const firstSheetName = workbook.SheetNames[0]; 
            const worksheet = workbook.Sheets[firstSheetName]; 
            
            // 💡 기존의 단순 HTML 변환 대신, 데이터를 배열로 뽑아서 고급 테이블로 직접 렌더링
            const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ''});
            if(rows.length === 0) {
                contentDiv.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">데이터가 없습니다.</div>';
                return;
            }
            
            let html = `<div style="width:100%; height:100%; overflow:auto; background:#fff;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; white-space:nowrap; font-size:13px;">
                                <thead>
                                    <tr>`;
            
            // 1. 첫 번째 줄을 헤더(제목)로 처리 (스크롤 시 상단 고정 적용)
            rows[0].forEach(col => {
                html += `<th style="position:sticky; top:0; background:#f8fafc; padding:15px; color:#475569; font-weight:700; border-bottom:2px solid #e2e8f0; z-index:10; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${col}</th>`;
            });
            html += `               </tr>
                                </thead>
                                <tbody>`;
            
            // 2. 두 번째 줄부터 데이터로 처리 (얼룩말 무늬 및 마우스 호버 효과)
            for (let i = 1; i < rows.length; i++) {
                // 데이터가 완전히 텅 빈 행은 깔끔하게 무시
                if(rows[i].every(val => val === '')) continue;
                
                let bgCol = i % 2 === 0 ? '#f8fafc' : '#ffffff'; // 짝수 줄은 아주 연한 회색 배경
                html += `<tr style="background-color:${bgCol}; transition:0.2s;" onmouseover="this.style.backgroundColor='#eff6ff'" onmouseout="this.style.backgroundColor='${bgCol}'">`;
                
                rows[i].forEach(cell => {
                    html += `<td style="padding:12px 15px; border-bottom:1px solid #f1f5f9; color:#334155;">${cell}</td>`;
                });
                html += `</tr>`;
            }
            
            html += `           </tbody>
                            </table>
                        </div>`;
            
            contentDiv.innerHTML = html;
        } else { 
            contentDiv.innerHTML = `<div style="text-align:center; padding:50px;"><p>미리보기를 지원하지 않는 포맷입니다.</p><a href="${url}" download="${originalName}" class="btn-setting primary">다운로드</a></div>`; 
        } 
    } catch (e) { 
        console.error(e);
        contentDiv.innerHTML = `<div style="text-align:center; padding:50px;"><h3 style="color:#e63946;">파일을 읽는 중 오류가 발생했습니다.</h3></div>`; 
    } 
}

async function loadCalendarEvents(){ try{ const r=await fetch('/api/calendar'); calendarEvents=await r.json(); renderCalendar(); }catch(e){console.error('캘린더 에러');} }
function renderCalendar(){ const g=document.getElementById('calendarGrid'), t=document.getElementById('calMonthTitle'); if(!g)return; g.innerHTML=''; const y=currentCalDate.getFullYear(), m=currentCalDate.getMonth(); t.innerText=`${y}.${String(m+1).padStart(2,'0')}`; const f=new Date(y,m,1).getDay(), l=new Date(y,m+1,0).getDate(); for(let i=0;i<f;i++) g.innerHTML+=`<div></div>`; for(let d=1;d<=l;d++){ const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const ev=calendarEvents.filter(e=>e.date===ds), logs=logDataCache.filter(e=>e.date && e.date.startsWith(ds)); const h=holidays2026[ds], dw=new Date(y,m,d).getDay(); let cls="cal-date-num"; if(dw===0||h)cls+=" text-red"; else if(dw===6)cls+=" text-blue"; const allItems = [...ev.map(e=>({type:'ev', text:e.content})), ...logs.map(e=>({type:'log', text:e.title||''}))]; let cellItemsHtml = ''; if(allItems.length > 0) { let firstText = allItems[0].text; if(firstText.length > 6) firstText = firstText.substring(0, 6) + '..'; let bg = allItems[0].type==='log' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(67, 97, 238, 0.1)'; let color = allItems[0].type==='log' ? '#b45309' : 'var(--primary)'; cellItemsHtml += `<div class="cal-event-item" style="background:${bg}; color:${color}; margin-top:4px;">${firstText}</div>`; if(allItems.length > 1) { cellItemsHtml += `<div class="cal-event-item" style="text-align:center; font-weight:800; background:#e2e8f0; color:#475569; margin-top:2px;">+${allItems.length - 1}</div>`; } } g.innerHTML+=`<div class="cal-day" onclick="openDailyModal('${ds}')"><div class="cal-date-top"><span class="${cls}">${d}</span>${h?`<span class="holiday-name">${h}</span>`:''}</div>${cellItemsHtml}</div>`; } }
function openDailyModal(dateStr) { document.getElementById('dailyDateObj').value = dateStr; document.getElementById('dailyModalTitle').innerText = dateStr + ' 일정 현황'; const ev = calendarEvents.filter(e => e.date === dateStr), lg = logDataCache.filter(e => e.date && e.date.startsWith(dateStr)); const evList = document.getElementById('dailyModalEvents'), lgList = document.getElementById('dailyModalLogs'); evList.innerHTML = ev.length > 0 ? ev.map(e => `<li style="padding:8px 0; border-bottom:1px dashed #eee; display:flex; justify-content:space-between; align-items:center;"><span>${e.content}</span><button class="btn-small admin-only" style="padding:4px 8px; color:var(--danger); background:none;" onclick="deleteCalendarEvent(${e.id}, event); setTimeout(()=>openDailyModal('${dateStr}'), 300);"><i class="fa-solid fa-trash-can"></i></button></li>`).join('') : '<li style="color:#aaa; font-size:13px;">등록된 일정이 없습니다.</li>'; lgList.innerHTML = lg.length > 0 ? lg.map(e => `<li style="padding:8px 0; border-bottom:1px dashed #eee;"><strong>${e.title || '제목 없음'}</strong><div style="color:var(--gray); font-size:12px; margin-top:3px;">${e.content}</div></li>`).join('') : '<li style="color:#aaa; font-size:13px;">등록된 소통 로그가 없습니다.</li>'; document.getElementById('dailyModal').style.display = 'flex'; updateUIForAdmin(); }
function changeMonth(d){ currentCalDate.setMonth(currentCalDate.getMonth()+d); renderCalendar(); }
function openCalModal(d){ if(!isAdmin) return; document.getElementById('calModal').style.display='flex'; document.getElementById('calDateInput').value=d; }
async function saveCalendarEvent(){ const d=document.getElementById('calDateInput').value, c=document.getElementById('calEventContent').value; if(!c)return; await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:d,content:c})}); document.getElementById('calModal').style.display='none'; loadCalendarEvents(); showToast("저장됨"); }
async function deleteCalendarEvent(id, e) { e.stopPropagation(); if(!isAdmin) return; const r=await customSwal.fire({title:'삭제', icon:'warning', showCancelButton:true, confirmButtonColor:'#e63946'}); if(r.isConfirmed) { await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' }); loadCalendarEvents(); showToast("삭제됨"); } }

function loadSettings(){ const d=localStorage.getItem('theme')==='dark'; document.getElementById('darkModeToggle').checked=d; toggleDarkMode(d); const s=localStorage.getItem('textScale')||'1.0'; document.getElementById('zoomRange').value=s; changeTextScale(s); }
function toggleDarkMode(isDark){ document.documentElement.setAttribute('data-theme',isDark?'dark':'light'); localStorage.setItem('theme',isDark?'dark':'light'); }
function changeTextScale(v){ document.documentElement.style.setProperty('--text-scale',v); localStorage.setItem('textScale',v); }
function downloadBackup(){ customSwal.fire({ title:'데이터 백업', text:'전체 데이터를 백업하시겠습니까?', icon:'info', showCancelButton:true, confirmButtonText:'다운로드' }).then(r => { if(r.isConfirmed) window.location.href="/api/backup"; }); }

let supplierDataCache = [];
async function loadSupplierData() { try { const r = await fetch('/api/supplier'); supplierDataCache = await r.json(); renderSupplierData(); } catch(e) {} }
function renderSupplierData() {
    const tbody = document.getElementById('supplierBody'); if(!tbody) return; tbody.innerHTML = '';
    if(supplierDataCache.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="padding:30px; color:#888; text-align:center;">등록된 협력업체가 없습니다.</td></tr>'; return; 
    }
    supplierDataCache.forEach(d => { 
        tbody.insertAdjacentHTML('beforeend', `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="text-align:left; font-weight:700; color:var(--primary);">${d.name}</td>
                <td style="font-weight:600;">${d.manager || '-'}</td>
                <td>${d.phone || '-'}</td>
                <td style="color:#f59e0b; font-weight:700;">${d.leadTime || '-'}</td>
                <td style="text-align:left; font-size:13px; color:var(--gray);">${d.memo || '-'}</td>
                <td class="admin-only" style="text-align:center;">
                    <button class="btn-small" style="background:#4cc9f0; color:white; margin-right:5px;" onclick="openSupplierModal(${d.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-small" style="background:var(--danger); color:white;" onclick="deleteSupplier(${d.id})">×</button>
                </td>
            </tr>
        `); 
    }); 
    updateUIForAdmin();
}
function openSupplierModal(id = null) { if(!isAdmin) { openLoginModal(); return; } if(id) { const item = supplierDataCache.find(x => x.id === id); document.getElementById('supEditId').value = item.id; document.getElementById('supName').value = item.name; document.getElementById('supManager').value = item.manager || ''; document.getElementById('supPhone').value = item.phone || ''; document.getElementById('supLeadTime').value = item.leadTime || ''; document.getElementById('supMemo').value = item.memo || ''; } else { document.getElementById('supEditId').value = ''; document.getElementById('supName').value = ''; document.getElementById('supManager').value = ''; document.getElementById('supPhone').value = ''; document.getElementById('supLeadTime').value = ''; document.getElementById('supMemo').value = ''; } document.getElementById('supplierModal').style.display = 'flex'; }
async function saveSupplier() { const id = document.getElementById('supEditId').value, name = document.getElementById('supName').value.trim(); if(!name) return; const payload = { name, manager: document.getElementById('supManager').value.trim(), phone: document.getElementById('supPhone').value.trim(), leadTime: document.getElementById('supLeadTime').value.trim(), memo: document.getElementById('supMemo').value.trim() }; if(id) payload.id = Number(id); await fetch('/api/supplier', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); document.getElementById('supplierModal').style.display = 'none'; loadSupplierData(); showToast("등록됨"); }
async function deleteSupplier(id) { if(!isAdmin) return; const result = await customSwal.fire({ title: '삭제', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946' }); if(result.isConfirmed) { await fetch(`/api/supplier?id=${id}`, { method: 'DELETE' }); loadSupplierData(); showToast("삭제됨"); } }

function showLoading(){} function hideLoading(){ document.getElementById('loadingOverlay').style.display='none'; } function showToast(msg){ Toast.fire({ icon: 'success', title: msg }); } function scrollFunction(){ document.getElementById("btnTop").style.display = document.querySelector('.main-content').scrollTop > 200 ? "block" : "none"; } function scrollToTop(){ document.querySelector('.main-content').scrollTop = 0; } function clickLogoEasterEgg(){ switchPage('dashboard', document.querySelector('.menu-item')); logoClickCount++; if(logoClickCount===5){ logoClickCount=0; confetti({particleCount:150,spread:70,origin:{y:0.6}}); showToast("🎉 모두 수고하셨습니다! 🎉"); } } function saveRecentSearch(k){ if(!k)return; let h=JSON.parse(localStorage.getItem('searchHistory')||'[]'); h=h.filter(x=>x!==k); h.unshift(k); if(h.length>5)h.pop(); localStorage.setItem('searchHistory',JSON.stringify(h)); renderRecentSearch(); } function renderRecentSearch(){ const h=JSON.parse(localStorage.getItem('searchHistory')||'[]'); let html='<span style="font-size:12px;color:#888;">최근: </span>'; h.forEach(k=>{ html+=`<span style="margin-left:5px;cursor:pointer;background:rgba(0,0,0,0.05);padding:3px 8px;border-radius:12px;font-size:12px;" onclick="clickRecent('${k}')">${k}</span>`; }); document.getElementById('recentSearchArea').innerHTML=html; } function clickRecent(k){ document.getElementById('searchInput').value=k; filterTableByKeyword(k); }

function processSearchKeyword(k) {
    if (!k || inventoryDataCache.length === 0) return;
    switchPage('inventory', document.querySelectorAll('.menu-item')[1]);
    const codes = k.split(',').map(c => c.trim().toLowerCase());
    const items = inventoryDataCache.filter(i => codes.includes(i.PROD_CD.trim().toLowerCase()) || codes.some(code => i.PROD_DES.toLowerCase().includes(code) || i.PROD_CD.toLowerCase().includes(code)));
    
    if (items.length > 0) {
        document.getElementById('featuredSection').classList.add('active'); currentMemoCode = items[0].PROD_CD.trim(); saveRecentSearch(k.replace(/,/g, ' '));
        fetch('/api/memo').then(r => r.json()).then(m => document.getElementById('featMemo').value = m[currentMemoCode] || "");
        if (items.length > 1) {
            document.getElementById('singleItemInfo').style.display = 'none'; document.getElementById('featListArea').style.display = 'block';
            document.getElementById('featName').innerText = "검색 결과"; document.getElementById('featCode').innerText = `${items.length}건 확인됨`;
            let h = '<table class="feat-list-table"><thead><tr><th>품목명</th><th>재고</th></tr></thead><tbody>'; items.forEach(i => h += `<tr><td>${i.PROD_DES}</td><td class="qty">${Number(i.BAL_QTY).toLocaleString()}</td></tr>`); h += '</table>'; document.getElementById('featListArea').innerHTML = h;
        } else {
            document.getElementById('singleItemInfo').style.display = 'block'; document.getElementById('featListArea').style.display = 'none'; let tot = 0; items.forEach(i => tot += parseFloat(i.BAL_QTY));
            document.getElementById('featName').innerText = items[0].PROD_DES; document.getElementById('featCode').innerText = items[0].PROD_CD; document.getElementById('featQty').innerText = tot.toLocaleString();
        }
    } else { closeFeatured(); }
    
    document.getElementById('searchInput').value = k.replace(/,/g, ' '); filterTableByKeyword(k.replace(/,/g, ' '));
    window.history.replaceState({}, document.title, window.location.pathname);
}
function checkUrlSearchParam(){ const u = new URLSearchParams(window.location.search); let k = u.get('search'); if (k) processSearchKeyword(k); }
async function saveItemMemo(){ 
    if(!isAdmin) return openLoginModal(); 
    const t=document.getElementById('featMemo').value; 
    if(!currentMemoCode)return; 
    await fetch('/api/memo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:currentMemoCode,text:t})}); 
    showToast("메모 저장됨"); 
    closeFeatured(); 
}
function closeFeatured(){ document.getElementById('featuredSection').classList.remove('active'); window.history.replaceState({},document.title,"/"); document.getElementById('searchInput').value=''; filterTableByKeyword(''); }
function resetMultiSelection(){ selectedItems.clear(); document.getElementById('selectionBar').classList.remove('show'); document.getElementById('selectedCount').innerText='0개'; document.querySelectorAll('.chk-select').forEach(c=>c.checked=false); }
function toggleSelection(c){ if(selectedItems.has(c))selectedItems.delete(c); else selectedItems.add(c); const b=document.getElementById('selectionBar'); if(selectedItems.size>0){b.classList.add('show'); document.getElementById('selectedCount').innerText=`${selectedItems.size}개`;}else b.classList.remove('show'); }
function generateMultiQr(){ if(selectedItems.size===0)return; showQr(Array.from(selectedItems).join(','),"선택 품목"); }
function showQr(c,n){ document.getElementById('qrModal').style.display='flex'; document.getElementById('qrcode').innerHTML=''; document.getElementById('qrDesc').innerText=`${n}\n${c}`; new QRCode(document.getElementById('qrcode'),{text:`${window.location.origin}/?search=${c}`,width:200,height:200}); }

document.addEventListener('contextmenu', function(e) { const tr = e.target.closest('tr'); if (!tr || !tr.closest('tbody')) return; const actionButtons = tr.querySelectorAll('button[onclick]'); if (actionButtons.length === 0) return; e.preventDefault(); const menuList = document.getElementById('contextMenuList'); menuList.innerHTML = ''; actionButtons.forEach(btn => { if ((btn.closest('.admin-only') || btn.classList.contains('admin-only')) && !isAdmin) return; const onclickStr = btn.getAttribute('onclick'), text = btn.innerText.trim() || '실행'; let menuText = '실행', liClass = '', customIcon = 'fa-solid fa-caret-right'; if (onclickStr.includes('edit') || onclickStr.includes('open') && !onclickStr.includes('delete')) { menuText = '수정 및 편집'; customIcon = 'fa-solid fa-pen'; } else if (onclickStr.includes('delete') || text.includes('×') || text.includes('삭제')) { menuText = '삭제'; liClass = 'danger'; customIcon = 'fa-solid fa-trash-can'; } else if (onclickStr.includes('view') || text.includes('보기') || text.includes('상세')) { menuText = '상세 내역 보기'; customIcon = 'fa-solid fa-eye'; } else if (onclickStr.includes('download') || onclickStr.includes('다운')) { menuText = '파일 다운로드'; customIcon = 'fa-solid fa-download'; } else if (onclickStr.includes('showQr')) { menuText = 'QR코드 생성'; customIcon = 'fa-solid fa-qrcode'; } const li = document.createElement('li'); if (liClass) li.className = liClass; li.innerHTML = `<i class="${customIcon}"></i> ${menuText}`; li.onclick = () => { document.getElementById('customContextMenu').style.display = 'none'; btn.click(); }; menuList.appendChild(li); }); if (menuList.children.length > 0) { const menu = document.getElementById('customContextMenu'); menu.style.display = 'block'; let x = e.pageX; let y = e.pageY; if (x + 150 > window.innerWidth) x = window.innerWidth - 160; if (y + menuList.children.length * 40 > window.innerHeight) y = window.innerHeight - (menuList.children.length * 40) - 20; menu.style.left = x + 'px'; menu.style.top = y + 'px'; } });
document.addEventListener('click', () => { const menu = document.getElementById('customContextMenu'); if (menu) menu.style.display = 'none'; });

document.addEventListener('keydown', function(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const modal = document.getElementById('globalSearchModal'); modal.style.display = 'flex'; const input = document.getElementById('globalSearchInput'); input.value = ''; document.getElementById('globalSearchResults').innerHTML = '<li style="padding:20px; text-align:center; color:var(--gray);">검색어를 입력해보세요.</li>'; setTimeout(() => input.focus(), 50); } });
document.getElementById('globalSearchInput')?.addEventListener('input', function(e) { const k = e.target.value.toLowerCase().trim(), resultsBox = document.getElementById('globalSearchResults'); resultsBox.innerHTML = ''; if (!k) return; let results = []; const menus = [ { name: '재고 현황 조회', icon: 'fa-boxes-stacked', action: () => switchPage('inventory', document.querySelectorAll('.menu-item')[1]) }, { name: '입고 내역', icon: 'fa-truck-ramp-box', action: () => switchPage('incoming', document.querySelectorAll('.menu-item')[2]) }, { name: '생산 내역 / 차트', icon: 'fa-clock-rotate-left', action: () => switchPage('history', document.querySelectorAll('.menu-item')[3]) }, { name: '완제품 단가 관리(BOM)', icon: 'fa-industry', action: () => clickProdMenu('production', document.querySelectorAll('.submenu-item')[1]) }, { name: '부속품 단가 관리', icon: 'fa-wrench', action: () => clickProdMenu('part_price', document.querySelectorAll('.submenu-item')[2]) }, { name: '계층형 BOM 트리', icon: 'fa-sitemap', action: () => clickProdMenu('bom_tree', document.querySelectorAll('.submenu-item')[3]) }, { name: '사내 자료실', icon: 'fa-folder-open', action: () => switchPage('archive', document.querySelectorAll('.menu-item')[5]) }, { name: '소통 게시판', icon: 'fa-comments', action: () => switchPage('board', document.querySelectorAll('.menu-item')[6]) } ]; menus.forEach(m => { if (m.name.toLowerCase().includes(k)) results.push({ type: '바로가기', title: m.name, icon: m.icon, action: m.action }); }); inventoryDataCache.forEach(i => { if (i.PROD_DES.toLowerCase().includes(k) || i.PROD_CD.toLowerCase().includes(k)) { results.push({ type: '재고 품목', title: i.PROD_DES, desc: `[${i.PROD_CD}] 현재고: ${Number(i.BAL_QTY).toLocaleString()}개`, icon: 'fa-box', action: () => { switchPage('inventory', document.querySelectorAll('.menu-item')[1]); processSearchKeyword(i.PROD_CD); } }); } }); boardDataCache.forEach(b => { if (b.title.toLowerCase().includes(k) || b.author.toLowerCase().includes(k)) { results.push({ type: '게시글', title: b.title, desc: `작성자: ${b.author} | ${b.date}`, icon: 'fa-file-lines', action: () => { switchPage('board', document.querySelectorAll('.menu-item')[6]); viewBoardPost(b.id); } }); } }); results.slice(0, 10).forEach(r => { const li = document.createElement('li'); li.className = 'global-search-result-item'; li.innerHTML = `<div class="icon"><i class="fa-solid ${r.icon}"></i></div><div style="flex:1; display:flex; flex-direction:column;"><span class="title">${r.title} <span style="font-size:10px; background:rgba(67, 97, 238, 0.1); color:var(--primary); padding:2px 6px; border-radius:4px; margin-left:5px;">${r.type}</span></span>${r.desc ? `<span class="desc">${r.desc}</span>` : ''}</div><i class="fa-solid fa-chevron-right" style="color:#cbd5e1; font-size:12px;"></i>`; li.onclick = () => { document.getElementById('globalSearchModal').style.display = 'none'; r.action(); }; resultsBox.appendChild(li); }); if(results.length === 0) { resultsBox.innerHTML = '<li style="padding:20px; text-align:center; color:var(--danger); font-weight:600;">결과가 없습니다.</li>'; } });

window.addEventListener('drop', async (e) => { e.preventDefault(); const dragOverlay = document.getElementById('dragDropOverlay'); if(dragOverlay) dragOverlay.style.display = 'none'; if (!isAdmin || !document.getElementById('page-archive')?.classList.contains('active-page')) return; const files = e.dataTransfer.files; if (files.length === 0) return; document.getElementById('loadingOverlay').style.display='flex'; let file = files[0]; const originalName = file.name.split('.').slice(0, -1).join('.'); if (file.type.startsWith('image/')) { try { file = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (ev) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); canvas.toBlob((blob) => { resolve(new File([blob], `${originalName}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.9); }; img.onerror = reject; img.src = ev.target.result; }; reader.onerror = reject; reader.readAsDataURL(file); }); } catch (err) {} } else { document.getElementById('loadingOverlay').style.display='none'; customSwal.fire({ icon: 'error', text: '이미지 파일만 드래그해서 업로드할 수 있습니다.' }); return; } const formData = new FormData(); formData.append('title', '📂 퀵 업로드 파일'); formData.append('file', file); try { await fetch('/api/archive', { method: 'POST', body: formData }); showToast('퀵 업로드 완료!'); loadArchive(); } finally { document.getElementById('loadingOverlay').style.display='none'; } });
window.addEventListener('dragover', (e) => { e.preventDefault(); if (isAdmin && document.getElementById('page-archive')?.classList.contains('active-page')) { const dragOverlay = document.getElementById('dragDropOverlay'); if(dragOverlay) dragOverlay.style.display = 'flex'; } });
window.addEventListener('dragleave', (e) => { e.preventDefault(); const dragOverlay = document.getElementById('dragDropOverlay'); if(dragOverlay && e.target === dragOverlay) dragOverlay.style.display = 'none'; });

async function showMorningBriefing() {
    const content = document.getElementById('briefingContent'); if (!content) return; document.getElementById('briefingUserName').innerText = typeof userName !== 'undefined' ? userName : '관리자'; content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--gray); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> 요약 중...</div>'; document.getElementById('briefingModal').style.display = 'flex'; const todayStr = new Date().toISOString().split('T')[0]; let todayBoard = [], todayArchive = []; try { const [boardRes, archiveRes] = await Promise.all([ fetch('/api/board'), fetch('/api/archive') ]); const boardData = await boardRes.json(); const archiveData = await archiveRes.json(); todayBoard = boardData.filter(b => b.date && b.date.startsWith(todayStr)); todayArchive = archiveData.filter(a => a.date && a.date.startsWith(todayStr)); } catch(e) { } const safeCalendarData = typeof calendarEvents !== 'undefined' ? calendarEvents : []; const todaysEvents = safeCalendarData.filter(e => e.date === todayStr); let eventHtml = todaysEvents.length > 0 ? `<span style="color:var(--primary); font-weight:700;">오늘 일정이 ${todaysEvents.length}건 있습니다.</span> (${todaysEvents[0].content} 등)` : `<span style="color:var(--gray);">오늘 등록된 특별한 캘린더 일정은 없습니다.</span>`; const lowStockBadges = document.querySelectorAll('.badge-danger[style="display: inline-block;"]'); let stockHtml = lowStockBadges.length > 0 ? `<span style="color:var(--danger); font-weight:700;">현재 안전재고 미달 품목이 ${lowStockBadges.length}건 있습니다!</span> 발주를 확인해주세요.` : `<span style="color:var(--success); font-weight:700;">현재 안전재고 미달 품목이 없습니다.</span> 창고 상황이 양호합니다.`; let boardHtml = todayBoard.length > 0 ? `<span style="color:#8b5cf6; font-weight:700;">오늘 등록된 새 게시글이 ${todayBoard.length}건 있습니다.</span> (${todayBoard[0].title})` : `<span style="color:var(--gray);">오늘 올라온 새 게시판 글은 없습니다.</span>`; let archiveHtml = todayArchive.length > 0 ? `<span style="color:#10b981; font-weight:700;">오늘 자료실에 새 파일이 ${todayArchive.length}건 등록되었습니다.</span> (${todayArchive[0].title})` : `<span style="color:var(--gray);">오늘 자료실에 등록된 새 파일은 없습니다.</span>`; let ddayHtml = ''; const safeDdayData = typeof ddayDataCache !== 'undefined' ? ddayDataCache : []; if(safeDdayData.length > 0) { let nearest = [...safeDdayData].sort((a,b) => new Date(a.date) - new Date(b.date))[0]; const diffDays = Math.ceil((new Date(nearest.date) - new Date()) / (1000 * 60 * 60 * 24)); if(diffDays >= 0 && diffDays <= 30) { ddayHtml = `<div style="padding:12px; background:#fff7ed; border-radius:8px; border-left:4px solid #f97316; font-size:14px; margin-top:10px;">💡 <b>다가오는 D-Day:</b> ${nearest.name} (D-${diffDays}일)</div>`; } } content.innerHTML = `<div style="padding:12px; background:#eff6ff; border-radius:8px; border-left:4px solid var(--primary); font-size:14px; margin-bottom:10px;">📅 ${eventHtml}</div><div style="padding:12px; background:#fef2f2; border-radius:8px; border-left:4px solid var(--danger); font-size:14px; margin-bottom:10px;">📦 ${stockHtml}</div><div style="padding:12px; background:#f5f3ff; border-radius:8px; border-left:4px solid #8b5cf6; font-size:14px; margin-bottom:10px;">💬 ${boardHtml}</div><div style="padding:12px; background:#ecfdf5; border-radius:8px; border-left:4px solid #10b981; font-size:14px;">📁 ${archiveHtml}</div>${ddayHtml}`;
}
/* =================================================================
   🔧 부속품 단가 엑셀 일괄 업로드 (VAT 별도/포함 두 칸 완벽 지원)
================================================================= */
async function handlePartPriceExcelUpload(e) { 
    const file = e.target.files[0]; 
    if(!file) return; 
    
    if(!isAdmin) { 
        openLoginModal(); 
        e.target.value = ''; 
        return; 
    } 
    
    const reader = new FileReader(); 
    reader.onload = async function(evt) { 
        try { 
            document.getElementById('loadingOverlay').style.display = 'flex'; 
            const data = new Uint8Array(evt.target.result); 
            const workbook = XLSX.read(data, {type: 'array'}); 
            const firstSheetName = workbook.SheetNames[0]; 
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]); 
            
            if(rows.length === 0) {
                document.getElementById('loadingOverlay').style.display = 'none';
                customSwal.fire({icon: 'info', text: '엑셀 파일에 데이터가 없습니다.'});
                return; 
            }
            
            let successCount = 0; 
            for(const row of rows) { 
                let dateRaw = row['입고일자'] || row['날짜'] || row['입고일'] || new Date().toISOString().split('T')[0];
                const name = row['부품명'] || row['자재명'] || row['품목명']; 
                const qty = Number(row['구매수량'] || row['수량']) || 0; 
                
                // 💡 엑셀의 두 칸을 모두 읽어옵니다.
                let costExcVat = Number(row['VAT(별도)'] || row['공급가액'] || row['총구매액'] || row['총금액']);
                let costIncVat = Number(row['VAT(포함)'] || row['결제금액'] || row['합계금액']);
                
                // 💡 어느 칸에 입력했는지 판단하여 '공급가액(VAT 별도)' 기준으로 금액 통일
                let totalCost = 0;
                if (costExcVat > 0) {
                    totalCost = costExcVat; // 별도 칸에 입력한 경우 그대로 사용
                } else if (costIncVat > 0) {
                    totalCost = Math.round(costIncVat / 1.1); // 포함 칸에 입력한 경우 별도 금액으로 역산
                }
                
                let price = Number(row['단가']); 
                const note = row['비고'] || '엑셀 일괄 업로드'; 
                
                if(!name) continue; 
                
                // 💡 단가 칸을 비워뒀다면 총 금액과 수량을 바탕으로 1개당 단가 자동 계산
                if (!price && qty > 0 && totalCost > 0) {
                    price = Math.round((totalCost / qty) * 100) / 100;
                } else if (!price) {
                    price = 0;
                }
                
                let formattedDate = dateRaw;
                if (typeof dateRaw === 'number') {
                    const dateObj = new Date((dateRaw - (25567 + 2)) * 86400 * 1000);
                    formattedDate = dateObj.toISOString().split('T')[0];
                } else if (typeof dateRaw === 'string') {
                    formattedDate = dateRaw.replace(/\./g, '-').replace(/\//g, '-').substring(0, 10);
                }
                
                const payload = { 
                    date: formattedDate, 
                    name: String(name).trim(), 
                    qty: qty, 
                    totalCost: totalCost, 
                    price: price, 
                    note: String(note).trim() 
                }; 
                
                await fetch('/api/part_price', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify(payload) 
                }); 
                successCount++; 
            } 
            
            await loadPartPrices(); 
            e.target.value = ''; 
            document.getElementById('loadingOverlay').style.display = 'none'; 
            showToast(`${successCount}건의 부속품 단가가 성공적으로 업로드되었습니다!`); 
            
        } catch(err) { 
            console.error(err); 
            document.getElementById('loadingOverlay').style.display = 'none'; 
            customSwal.fire({icon: 'error', text: '엑셀 파일 양식이 맞지 않거나 업로드 중 서버 오류가 발생했습니다.'});
        } 
    }; 
    reader.readAsArrayBuffer(file); 
}
/* =================================================================
   🔄 AS 내역(iframe) 강제 새로고침 및 알림 기능
================================================================= */