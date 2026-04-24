/**
 * ==========================================
 * Elegant Search Interaction Logic
 * ==========================================
 */

// Global Variables
let currentResults = [];
let displayedCount = 0;
const CHUNK_SIZE = 15;

// DOM Elements
const landingPage = document.getElementById('landing-page');
const resultsPage = document.getElementById('results-page');

const mainSearchInput = document.getElementById('main-search-input');
const mainSearchBtn = document.getElementById('main-search-btn');
const navBrand = document.getElementById('nav-brand');
const topSearchInput = document.getElementById('top-search-input');
const sortSelect = document.getElementById('sort-select');
const partyFilterSelect = document.getElementById('party-filter-select');
const cityFilterSelect = document.getElementById('city-filter-select');
const homeCitySelect = document.getElementById('home-city-filter');
const homePartySelect = document.getElementById('home-party-filter');
const profilePage = document.getElementById('profile-page');

let currentSearchTerm = '';

const resultsList = document.getElementById('results-list');
const quickSummary = document.getElementById('quick-summary');
const loadingMore = document.getElementById('loading-more');

const picksGrid = document.getElementById('picks-grid');
const chips = document.querySelectorAll('.chip');

// -- Initialization --
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initEditorsPicks();
    setupEventListeners();
});

function initFilters() {
    if (typeof rawData === 'undefined' || rawData.length === 0) return;
    const parties = [...new Set(rawData.map(item => item['推薦政黨']))].filter(Boolean).sort();
    const cities = [...new Set(rawData.map(item => item['地區'] ? item['地區'].substring(0, 3) : ''))].filter(Boolean).sort();
    
    parties.forEach(party => {
        const optionHTML = `<option value="${party}">${party}</option>`;
        partyFilterSelect.insertAdjacentHTML('beforeend', optionHTML);
        homePartySelect.insertAdjacentHTML('beforeend', optionHTML);
    });
    
    cities.forEach(city => {
        const optionHTML = `<option value="${city}">${city}</option>`;
        cityFilterSelect.insertAdjacentHTML('beforeend', optionHTML);
        homeCitySelect.insertAdjacentHTML('beforeend', optionHTML);
    });
}

// -- Utility: Formatting --
const formatMoney = (valStr) => {
    if (!valStr) return '0';
    return '$' + parseInt(valStr.replace(/,/g, '') || 0).toLocaleString('en-US');
};

const parseNum = (valStr) => {
    if (!valStr) return 0;
    return parseInt(valStr.replace(/,/g, '') || 0);
};

// -- Editor's Picks Logic --
function initEditorsPicks() {
    // Check if rawData exists from data.js
    if (typeof rawData === 'undefined' || rawData.length === 0) return;

    // Pick 1: Top Earner
    const topEarner = [...rawData].sort((a, b) => parseNum(b['總收入']) - parseNum(a['總收入']))[0];
    
    // Pick 2: Top Corporate reliance (highest %)
    const topCorp = [...rawData]
        .filter(x => parseFloat(x['營利事業捐贈比例'] || 0) > 0)
        .sort((a, b) => parseFloat(b['營利事業捐贈比例'].replace('%','')) - parseFloat(a['營利事業捐贈比例'].replace('%','')))[0];

    // Pick 3: Most individual donors (highest %)
    const topIndiv = [...rawData]
        .filter(x => parseFloat(x['個人捐贈比例'] || 0) > 0)
        .sort((a, b) => parseFloat(b['個人捐贈比例'].replace('%','')) - parseFloat(a['個人捐贈比例'].replace('%','')))[0];

    const generateCardHTML = (label, name, stat, substat, query) => `
        <div class="pick-card glass-panel" onclick="triggerSearch('${query}')">
            <span class="pick-label">${label}</span>
            <span class="pick-name">${name}</span>
            <span class="pick-stat">${stat}</span>
            <span class="pick-substat">${substat}</span>
        </div>
    `;

    picksGrid.innerHTML = '';
    if (topEarner) {
        picksGrid.innerHTML += generateCardHTML(
            '吸金之冠', topEarner['姓名'], 
            formatMoney(topEarner['總收入']), 
            `${topEarner['推薦政黨']} · ${topEarner['地區']}`,
            topEarner['姓名']
        );
    }
    if (topCorp) {
        picksGrid.innerHTML += generateCardHTML(
            '財團偏愛', topCorp['姓名'], 
            topCorp['營利事業捐贈比例'], 
            `營利事業捐贈占比 · ${formatMoney(topCorp['營利事業捐贈收入'])}`,
            topCorp['姓名']
        );
    }
    if (topIndiv) {
        picksGrid.innerHTML += generateCardHTML(
            '草根力量', topIndiv['姓名'], 
            topIndiv['個人捐贈比例'], 
            `個人真實相挺 · ${formatMoney(topIndiv['個人捐贈收入'])}`,
            topIndiv['姓名']
        );
    }
}

// -- Event Listeners --
function setupEventListeners() {
    mainSearchBtn.addEventListener('click', () => {
        const q = mainSearchInput.value;
        partyFilterSelect.value = homePartySelect.value;
        cityFilterSelect.value = homeCitySelect.value;
        triggerSearch(q, true);
    });

    mainSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            partyFilterSelect.value = homePartySelect.value;
            cityFilterSelect.value = homeCitySelect.value;
            triggerSearch(mainSearchInput.value, true);
        }
    });

    topSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') triggerSearch(topSearchInput.value);
    });

    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            triggerSearch(e.target.dataset.query);
        });
    });

    navBrand.addEventListener('click', goHome);

    sortSelect.addEventListener('change', () => {
        sortResults();
        renderResults(true); // reset display
    });

    partyFilterSelect.addEventListener('change', () => {
        performSearch(currentSearchTerm);
    });

    cityFilterSelect.addEventListener('change', () => {
        performSearch(currentSearchTerm);
    });

    // Infinite Scroll
    window.addEventListener('scroll', () => {
        if (!resultsPage.classList.contains('hidden') && displayedCount < currentResults.length) {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                loadMoreResults();
            }
        }
    });
}

// -- Page Transition --
window.triggerSearch = function(query, keepFilters = false) {
    const isAll = (!query || query.trim() === '' || query === '[ALL]');

    if (isAll) {
        mainSearchInput.value = '';
        topSearchInput.value = '';
        query = '';
    } else {
        mainSearchInput.value = query;
        topSearchInput.value = query;
    }

    if (!keepFilters) {
        // Reset party and city filters to ALL on new text search
        partyFilterSelect.value = 'ALL';
        cityFilterSelect.value = 'ALL';
    }

    // Execute Search
    performSearch(query);

    // Transition UI
    landingPage.style.animation = 'none';
    landingPage.style.opacity = '0';
    setTimeout(() => {
        landingPage.classList.add('hidden');
        resultsPage.classList.remove('hidden');
        resultsPage.style.opacity = '0';
        resultsPage.style.transform = 'translateY(10px)';
        
        // trigger reflow
        void resultsPage.offsetWidth; 
        
        resultsPage.style.transition = 'all 0.6s ease';
        resultsPage.style.opacity = '1';
        resultsPage.style.transform = 'translateY(0)';
    }, 300);
}

function goHome() {
    mainSearchInput.value = '';
    topSearchInput.value = '';
    
    resultsPage.style.opacity = '0';
    setTimeout(() => {
        resultsPage.classList.add('hidden');
        landingPage.classList.remove('hidden');
        landingPage.style.animation = 'fadeIn 0.8s forwards';
    }, 300);
}

// -- Search Engine --
function performSearch(query) {
    currentSearchTerm = query || '';
    const partyFilter = partyFilterSelect.value;
    const cityFilter = cityFilterSelect.value;
    
    let results = rawData;
    
    // Text filter
    if (currentSearchTerm !== '') {
        const term = currentSearchTerm.toLowerCase();
        results = results.filter(item => {
            return Object.values(item).some(val => 
                String(val).toLowerCase().includes(term)
            );
        });
    }

    // Party filter
    if (partyFilter !== 'ALL') {
        results = results.filter(item => item['推薦政黨'] === partyFilter);
    }

    // City filter
    if (cityFilter !== 'ALL') {
        results = results.filter(item => String(item['地區']).startsWith(cityFilter));
    }
    
    currentResults = results;

    // Update Summary
    if (currentSearchTerm === '' && partyFilter === 'ALL' && cityFilter === 'ALL') {
        quickSummary.innerHTML = `顯示全體庫存共 <strong>${currentResults.length}</strong> 筆紀錄`;
    } else {
        const filters = [];
        if (currentSearchTerm) filters.push(`關鍵字「<strong>${currentSearchTerm}</strong>」`);
        if (cityFilter !== 'ALL') filters.push(`縣市「<strong>${cityFilter}</strong>」`);
        if (partyFilter !== 'ALL') filters.push(`政黨「<strong>${partyFilter}</strong>」`);
        
        quickSummary.innerHTML = `找到 <strong>${currentResults.length}</strong> 筆符合 ${filters.join(' 且 ')} 的紀錄`;
    }

    sortResults();
    renderResults(true);
}

function sortResults() {
    const sortMethod = sortSelect.value;
    currentResults.sort((a, b) => {
        if (sortMethod === 'income-desc') {
            return parseNum(b['總收入']) - parseNum(a['總收入']);
        } else if (sortMethod === 'income-asc') {
            return parseNum(a['總收入']) - parseNum(b['總收入']);
        } else if (sortMethod === 'votes-desc') {
            return parseNum(b['得票數']) - parseNum(a['得票數']);
        } else if (sortMethod === 'expense-desc') {
            return parseNum(b['總支出']) - parseNum(a['總支出']);
        }
        return 0;
    });
}

function renderResults(reset = false) {
    if (reset) {
        resultsList.innerHTML = '';
        displayedCount = 0;
    }

    if (currentResults.length === 0) {
        resultsList.innerHTML = `<div class="empty-state">沒有找到相關紀錄，請嘗試其他關鍵字。</div>`;
        loadingMore.style.display = 'none';
        return;
    }

    const fragment = document.createDocumentFragment();
    const limit = Math.min(displayedCount + CHUNK_SIZE, currentResults.length);

    for (let i = displayedCount; i < limit; i++) {
        const item = currentResults[i];
        
        const el = document.createElement('div');
        el.className = 'result-item glass-panel fade-in';
        el.style.animationDelay = `${(i - displayedCount) * 0.05}s`;
        el.setAttribute('onclick', `showProfile('${item['姓名']}')`);
        
        el.innerHTML = `
            <div class="col-main">
                <span class="cand-name">${item['姓名']}</span>
                <span class="cand-meta">${item['地區']} ${item['當選註記'] === '*' ? '🌟(當選)' : ''}</span>
                <div><span class="cand-party">${item['推薦政黨']}</span></div>
            </div>
            <div class="col-stat">
                <span class="stat-label">總收入</span>
                <span class="stat-val" style="color: var(--clr-gold);">${formatMoney(item['總收入'])}</span>
            </div>
            <div class="col-stat">
                <span class="stat-label">營利事業捐贈 (${item['營利事業捐贈比例'] || '0%'})</span>
                <span class="stat-val">${formatMoney(item['營利事業捐贈收入'])}</span>
            </div>
        `;
        fragment.appendChild(el);
    }

    resultsList.appendChild(fragment);
    displayedCount = limit;

    // Handle Loader
    if (displayedCount >= currentResults.length) {
        loadingMore.style.display = 'none';
    } else {
        loadingMore.style.display = 'flex';
        loadingMore.classList.remove('active');
    }
}

function loadMoreResults() {
    if (loadingMore.classList.contains('active')) return;
    
    loadingMore.classList.add('active');
    setTimeout(() => {
        renderResults();
    }, 600); // UI feel delay
}

// -- Profile Page Rendering --
window.showProfile = function(name) {
    const cand = rawData.find(c => c['姓名'] === name);
    if (!cand) return;

    document.getElementById('prof-name').innerText = cand['姓名'];
    document.getElementById('prof-party').innerText = cand['推薦政黨'];
    document.getElementById('prof-region').innerText = cand['地區'];
    document.getElementById('prof-elected').innerText = cand['當選註記'] === '*' ? '當選' : '落選';
    document.getElementById('prof-committee').innerText = cand['委員會'] || '無所屬委員會';
    document.getElementById('prof-total-income').innerText = formatMoney(cand['總收入']);
    document.getElementById('prof-total-expense').innerText = formatMoney(cand['總支出']);

    // Build charts
    const incomeTypes = [
        { label: '個人捐贈', val: parseNum(cand['個人捐贈收入']), pct: cand['個人捐贈比例'] },
        { label: '營利事業捐贈', val: parseNum(cand['營利事業捐贈收入']), pct: cand['營利事業捐贈比例'] },
        { label: '政黨捐贈', val: parseNum(cand['政黨捐贈收入']), pct: cand['政黨捐贈收入比例'] },
        { label: '人民團體捐贈', val: parseNum(cand['人民團體捐贈收入']), pct: cand['人民團體收入比例'] },
        { label: '匿名捐贈', val: parseNum(cand['匿名捐贈收入']), pct: cand['匿名捐贈比例'] },
        { label: '其他收入', val: parseNum(cand['其他收入']), pct: cand['其他收入比例'] },
    ].filter(t => t.val > 0).sort((a,b) => b.val - a.val);

    let html = '';
    incomeTypes.forEach(t => {
        let widthStr = t.pct || '0%';
        html += `
            <div class="bar-row">
                <div class="bar-labels">
                    <span>${t.label} <strong>${widthStr}</strong></span>
                    <span>${formatMoney(t.val.toString())}</span>
                </div>
                <div class="bar-bg">
                    <div class="bar-fill" style="width: 0%" data-target="${widthStr}"></div>
                </div>
            </div>
        `;
    });
    document.getElementById('prof-charts').innerHTML = html || '無細部獻金資料';

    // Transition Results -> Profile
    resultsPage.classList.add('hidden');
    landingPage.classList.add('hidden');
    profilePage.classList.remove('hidden');
    profilePage.style.animation = 'fadeIn 0.6s forwards';

    // Trigger bar fill animation
    setTimeout(() => {
        document.querySelectorAll('.bar-fill').forEach(el => {
            el.style.width = el.getAttribute('data-target');
        });
    }, 150);
}

window.goBackToResults = function() {
    profilePage.style.animation = 'none';
    profilePage.classList.add('hidden');
    resultsPage.classList.remove('hidden');
    resultsPage.style.animation = 'fadeIn 0.4s forwards';
}
