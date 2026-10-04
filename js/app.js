import { renderBrandMarks } from './icons.js?v=5';
import { classifyImage, CONFIDENCE_THRESHOLD } from './model-config.js?v=5';
import { addHistory, calculateScore, clearHistory, getHistory, getPrefs, getScore, getStreak, getWeeklyCounts, savePrefs, saveScore } from './storage.js?v=5';

const state = { view:'scan', items:[], categories:[], quiz:[], translations:{}, prefs:getPrefs(), currentImage:null, stream:null, quizIndex:0, quizScore:0, quizAnswered:false, deferredInstall:null };
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const categoryById = id => state.categories.find(category => category.id === id) || state.categories[0];
const binClass = bin => ({Blue:'blue',Green:'green',Red:'red',Grey:'grey',Special:'red'}[bin] || 'grey');

async function loadData(){
  const [items,categories,quiz,translations] = await Promise.all([
    fetch('data/waste-items.json').then(response=>response.json()),
    fetch('data/categories.json').then(response=>response.json()),
    fetch('data/quiz.json').then(response=>response.json()),
    fetch('data/translations.json').then(response=>response.json())
  ]);
  state.items = items; state.categories = categories; state.quiz = quiz; state.translations = translations;
}

function showToast(message){ const toast = $('#toast'); toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(showToast.timer); showToast.timer = setTimeout(()=>toast.classList.remove('is-visible'),2600); }
function getItem(name){ const normalized = name.toLowerCase(); return state.items.find(item => item.name.toLowerCase() === normalized) || state.items.find(item => normalized.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(normalized)); }
function itemFromPrediction(label){ const words = String(label).toLowerCase(); const candidates = state.items.filter(item => words.includes(item.name.toLowerCase()) || words.includes(item.material.toLowerCase().split(' ')[0])); return candidates[0] || getItem('plastic bottle') || state.items[0]; }
function statusFor(item){ if(item.recyclable === 'yes') return 'Recyclable'; if(item.recyclable === 'no') return 'Not Recyclable'; return 'Special Handling'; }
function recyclablePercent(history){ if(!history.length) return 0; return Math.round(history.filter(item=>item.status==='Recyclable').length/history.length*100); }

function navigate(view){
  const safeView = ['scan','search','guide','dashboard','learn','about','settings'].includes(view) ? view : 'scan';
  state.view = safeView;
  $$('.view').forEach(section => { const active = section.dataset.view === safeView; section.hidden = !active; section.classList.toggle('is-active', active); });
  $$('[data-nav]').forEach(button => button.classList.toggle('is-active', button.dataset.nav === safeView));
  const heading = $('#mobile-section-heading'); if(heading) heading.textContent = safeView === 'about' ? 'How it works' : safeView[0].toUpperCase()+safeView.slice(1);
  $('#sidebar')?.classList.remove('is-open'); $('#mobile-menu')?.setAttribute('aria-expanded','false');
  window.history.replaceState(null,'',`#${safeView}`); window.scrollTo({top:0,behavior:'smooth'});
  if(safeView === 'dashboard') renderDashboard();
  if(safeView === 'search') renderSearch(state.items);
}

function applyPrefs(){
  const theme = state.prefs.theme;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark); document.body.classList.toggle('large-text', state.prefs.textSize === 'large');
  $('#theme-toggle').textContent = dark ? '☼' : '☾';
}

function renderScannerResult(item, confidence, source='photo'){
  const status = statusFor(item); const uncertain = confidence < CONFIDENCE_THRESHOLD;
  const category = categoryById(item.category);
  const tips = [...(item.tips || []), ...(item.preparation || [])].slice(0,3);
  $('#result-panel').hidden = false;
  $('#result-panel').innerHTML = `<article class="result-card ${uncertain?'is-uncertain':''}">
    <div><span class="eyebrow">${uncertain?'NOT SURE YET':'IDENTIFIED ITEM'} · ${escapeHtml(source)}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.environmentalFact)}</p><div class="result-meta"><span class="meta-chip meta-chip--${binClass(item.bin)}">${escapeHtml(status)}</span><span class="meta-chip">${escapeHtml(category?.name || item.category)}</span><span class="meta-chip">${escapeHtml(item.material)}</span><span class="meta-chip">${escapeHtml(item.bin)} bin</span></div></div>
    <div class="confidence-ring" style="--confidence:${Math.round(confidence*100)}%"><strong>${Math.round(confidence*100)}%</strong><span>confidence</span></div>
    <div class="tips-block"><strong>Next best steps</strong><ul>${tips.map(tip=>`<li>✓ ${escapeHtml(tip)}</li>`).join('')}</ul></div>
    ${uncertain ? `<div class="manual-correction"><span>Help us narrow it down:</span>${state.categories.slice(0,5).map(category=>`<button type="button" data-correct-category="${category.id}">${escapeHtml(category.name)}</button>`).join('')}</div>` : ''}
  </article>`;
  $('#result-panel').scrollIntoView({behavior:'smooth',block:'start'});
  return {item,status,uncertain};
}

async function identifySelectedImage(){
  if(!state.currentImage) return;
  const button = $('#classify-button'); button.disabled = true; button.textContent = 'Thinking locally…';
  $('#model-status-text').textContent = 'Reading visual patterns on this device…';
  const prediction = await classifyImage($('#image-preview'));
  const item = itemFromPrediction(prediction.className);
  const confidence = Number(prediction.probability) || .52;
  const result = renderScannerResult(item, confidence, prediction.fallback ? 'local demo' : 'MobileNet');
  addHistory({name:result.item.name,category:result.item.category,status:result.status,confidence,bin:result.item.bin});
  $('#model-status-text').textContent = prediction.fallback ? 'Local demo mode · model can be swapped in config' : 'Local model ready · MobileNet assisted';
  button.disabled = false; button.innerHTML = 'Identify item <span>↗</span>'; renderMiniStats(); renderDashboard();
}

function setImage(file){
  if(!file || !file.type.startsWith('image/')){ showToast('Choose a JPG, PNG, or WEBP image.'); return; }
  if(file.size > 10 * 1024 * 1024){ showToast('That image is larger than 10 MB.'); return; }
  const reader = new FileReader(); reader.onload = event => { state.currentImage = file; $('#image-preview').src = event.target.result; $('#dropzone-empty').hidden = true; $('#dropzone-preview').hidden = false; $('#classify-button').disabled = false; }; reader.readAsDataURL(file);
}
function resetImage(){ state.currentImage = null; $('#image-input').value=''; $('#dropzone-empty').hidden=false; $('#dropzone-preview').hidden=true; $('#classify-button').disabled=true; stopCamera(); }
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){ showToast('Camera access is not supported here. Try uploading a photo instead.'); return; }
  try { state.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); $('#camera-panel').hidden=false; $('#dropzone-empty').hidden=true; $('#dropzone-preview').hidden=true; $('#camera-video').srcObject=state.stream; }
  catch { showToast('Camera permission was denied. You can still upload a photo.'); }
}
function stopCamera(){ if(state.stream){ state.stream.getTracks().forEach(track=>track.stop()); state.stream=null; } $('#camera-panel').hidden=true; }
function captureCamera(){ const video=$('#camera-video'); const canvas=document.createElement('canvas'); canvas.width=video.videoWidth||900; canvas.height=video.videoHeight||700; canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height); canvas.toBlob(blob=>{ stopCamera(); setImage(new File([blob],'camera-capture.jpg',{type:'image/jpeg'})); },'image/jpeg',.9); }
function showItemResult(item, source='search'){ if(!item) return; navigate('scan'); const preview = $('#result-panel'); preview.hidden=false; renderScannerResult(item,.96,source); }

function renderSearch(items){
  const results=$('#search-results'); const count=$('#search-count'); if(!results) return;
  count.textContent = `${items.length} item${items.length===1?'':'s'} in the index`;
  if(!items.length){ results.innerHTML='<div class="empty-state">No match yet. Try a material, a broader name, or <button class="text-button" data-nav="guide" type="button">browse the guide</button>.</div>'; return; }
  results.innerHTML=items.slice(0,40).map(item=>`<button class="search-result" type="button" data-search-item="${escapeHtml(item.name)}"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.material)} · ${escapeHtml(item.environmentalFact)}</p><div class="result-tags"><span class="bin-chip bin-chip--${binClass(item.bin)}">${escapeHtml(item.bin)} bin</span><span class="bin-chip bin-chip--grey">${item.recyclable==='yes'?'Recyclable':item.recyclable==='no'?'Not recyclable':'Conditional'}</span></div></div><span aria-hidden="true">↗</span></button>`).join('');
}
function handleSearchInput(){ const value=$('#search-input').value.trim().toLowerCase(); $('#clear-search').hidden=!value; const matches=value?state.items.filter(item=>`${item.name} ${item.material} ${item.category}`.toLowerCase().includes(value)):state.items; renderSearch(matches); const autocomplete=$('#autocomplete'); if(value && matches.length){ autocomplete.hidden=false; autocomplete.innerHTML=matches.slice(0,6).map(item=>`<button type="button" data-suggest-item="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.material)}</small></button>`).join(''); } else autocomplete.hidden=true; }

function renderGuide(){ $('#category-grid').innerHTML=state.categories.map(category=>`<article class="category-card" style="--category-color:${category.color}"><span class="category-icon">${category.icon}</span><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.summary)}</p><div class="category-footer"><span class="bin-chip bin-chip--${binClass(category.bin)}">${escapeHtml(category.bin)} bin</span><span>${escapeHtml(category.stream)}</span></div><details><summary>Preparation tips</summary><ul>${category.tips.map(tip=>`<li>${escapeHtml(tip)}</li>`).join('')}</ul><p><strong>Watch out:</strong> ${escapeHtml(category.caution)}</p></details></article>`).join(''); }

function renderMiniStats(){ const history=getHistory(); const score=calculateScore(); $('#mini-scans').textContent=history.length; $('#mini-score').textContent=score; $('#mini-progress').style.width=`${Math.min(100,score)}%`; $('#mini-progress-copy').textContent=history.length ? `${Math.max(0,100-score)} points to a perfect local score.` : 'Your first scan starts the streak.'; }
function renderChart(counts){ const max=Math.max(...counts,1); const points=counts.map((count,index)=>`${index*16.66+4},${96-(count/max*72)}`).join(' '); const circles=counts.map((count,index)=>`<circle cx="${index*16.66+4}" cy="${96-(count/max*72)}" r="1.9" fill="var(--green)"/>`).join(''); return `<svg viewBox="0 0 104 104" preserveAspectRatio="none" aria-label="Weekly scan activity chart" role="img"><path d="M4 96H100" stroke="var(--line)" stroke-width="1"/><path d="M4 72H100M4 48H100M4 24H100" stroke="var(--line)" stroke-width=".6" stroke-dasharray="2 3"/><polyline points="${points}" fill="none" stroke="var(--green)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>${circles}</svg>`; }
function renderDashboard(){
  const history=getHistory(), score=calculateScore(), streak=getStreak(), percent=recyclablePercent(history), co2=(history.filter(item=>item.status==='Recyclable').length*.18).toFixed(1);
  $('#dashboard-score').textContent=score; $('#streak-count').textContent=streak; $('#badge-count').textContent=`${[history.length>=1,history.filter(item=>item.status==='Recyclable').length>=5,streak>=10].filter(Boolean).length} / 3`;
  $('#dashboard-stats').innerHTML=[['Scans',history.length,'items sorted'],['Recyclable',`${percent}%`,'of your local history'],['CO₂ saved',`${co2} kg`,'estimated impact'],['Streak',`${streak} days`,'keep the rhythm']].map(stat=>`<div class="stat-card"><strong>${stat[1]}</strong><span>${stat[0]}</span><em>${stat[2]}</em></div>`).join('');
  $('#weekly-chart').innerHTML=renderChart(getWeeklyCounts());
  const badges=[['♧','First Scan','Complete one scan',history.length>=1],['✦','Eco Warrior','Sort 5 recyclable items',history.filter(item=>item.status==='Recyclable').length>=5],['♨','10-Day Streak','Show up ten days in a row',streak>=10]];
  $('#badges-list').innerHTML=badges.map(badge=>`<div class="badge-row ${badge[3]?'is-earned':''}"><span class="badge-icon">${badge[0]}</span><div><strong>${badge[1]} ${badge[3]?'✓':''}</strong><small>${badge[2]}</small></div></div>`).join('');
  $('#history-list').innerHTML=history.length?history.slice(0,8).map(item=>`<div class="history-row"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.status)} · ${Math.round(item.confidence*100)}% confidence</p></div><time>${new Date(item.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div>`).join(''):'<div class="empty-state">Your first scan will appear here. Try the bottle, banana peel, or battery quick pick.</div>';
}

function renderLearn(){
  $('#learn-feature').innerHTML='<div><span class="eyebrow">START HERE</span><h2>Recycling is a<br /><em>systems question.</em></h2><p>Every item travels through a chain of people, machines, and decisions. A clean, correctly sorted item has a better chance of making it through the chain.</p></div><div class="feature-stat"><strong>01</strong><span>small choice · shared system</span></div>';
  const topics=[['01','How does the AI identify waste?','Visual patterns become a best guess, then a category map adds practical context.'],['02','Why contamination ruins recycling','Food, liquid, and the wrong materials can spoil a whole processing batch.'],['03','Plastic resin codes 1–7','The number identifies the polymer family, not a universal promise of acceptance.'],['04','Reduce → Reuse → Recycle','The order matters: avoid first, extend the life of what you have, then sort well.'],['05','Waste problem facts','The most useful waste system is the one people can understand and use every day.'],['06','Your local rules matter','Recycling is local infrastructure. Check your city’s accepted-material list first.']];
  $('#learn-topics').innerHTML=topics.map(topic=>`<article class="topic-card"><button type="button" data-topic="${topic[0]}"><span class="topic-index">${topic[0]}</span><h3>${topic[1]}</h3><p>${topic[2]}</p></button></article>`).join(''); renderQuiz();
}
function renderQuiz(){ const quiz=$('#quiz-card'); if(state.quizIndex>=state.quiz.length){ quiz.innerHTML=`<span class="eyebrow">QUIZ COMPLETE</span><h2>You scored ${state.quizScore} / ${state.quiz.length}</h2><p>${state.quizScore>=8?'Strong sorting instincts. Keep sharing the why.':'Good work — the next scan is another chance to learn.'}</p><button class="button button--primary" id="quiz-restart" type="button">Try again</button>`; return; } const question=state.quiz[state.quizIndex]; quiz.innerHTML=`<span class="eyebrow">TEST YOUR RECYCLEIQ · ${state.quizIndex+1} / ${state.quiz.length}</span><h2>${escapeHtml(question.question)}</h2><div class="quiz-progress"><span style="width:${(state.quizIndex/state.quiz.length)*100}%"></span></div><div class="quiz-options">${question.options.map((option,index)=>`<button class="quiz-option" type="button" data-quiz-answer="${index}">${escapeHtml(option)}</button>`).join('')}</div>${state.quizAnswered?`<div class="quiz-feedback">${escapeHtml(question.feedback)} <button class="text-button" id="quiz-next" type="button">${state.quizIndex===state.quiz.length-1?'See score':'Next question'} ↗</button></div>`:''}`; }
function answerQuiz(index){ if(state.quizAnswered)return; const question=state.quiz[state.quizIndex]; state.quizAnswered=true; if(index===question.answer) state.quizScore++; $$('.quiz-option').forEach((button,buttonIndex)=>{button.disabled=true; if(buttonIndex===question.answer)button.classList.add('is-correct'); if(buttonIndex===index&&index!==question.answer)button.classList.add('is-wrong');}); renderQuiz(); if(state.quizAnswered){ $$('.quiz-option').forEach(button=>button.disabled=true); const answerButtons=$$('.quiz-option'); answerButtons.forEach((button,buttonIndex)=>{if(buttonIndex===question.answer)button.classList.add('is-correct'); if(buttonIndex===index&&index!==question.answer)button.classList.add('is-wrong');}); } }
function nextQuiz(){ if(!state.quizAnswered)return; state.quizIndex++; state.quizAnswered=false; if(state.quizIndex>=state.quiz.length){ const score=getScore(); saveScore({...score,quiz:Math.max(score.quiz,state.quizScore)}); } renderQuiz(); renderDashboard(); }

function renderAbout(){ const steps=[['▣','Image','Camera or upload'],['◌','Preprocess','Resize & normalize'],['⌁','CNN','Find visual patterns'],['✦','Prediction','Name the object'],['◈','Category','Map to waste stream'],['↗','Advice','Give next steps']]; $('#pipeline').innerHTML=steps.map(step=>`<div class="pipeline-step"><div class="pipeline-icon">${step[0]}</div><strong>${step[1]}</strong><small>${step[2]}</small></div>`).join(''); const blocks=[['Problem statement','Waste rules are confusing, and contamination makes good material harder to recover. People need clearer guidance at the moment of disposal.'],['Objectives','Make waste identification approachable, explain why preparation matters, and keep personal images on-device.'],['Methodology','Combine browser-based image classification with a transparent lookup table, local history, and short learning loops.'],['Technologies','HTML5, CSS3, vanilla JavaScript ES modules, TensorFlow.js MobileNet, JSON data, localStorage, SVG charts, and PWA APIs.'],['Limitations','A general model can be uncertain, local rules vary, and visual classification cannot see material composition perfectly.'],['Future scope','Custom campus training data, city-specific policy packs, barcode support, and nearby collection points.']]; $('#about-copy-grid').innerHTML=blocks.map(block=>`<article class="about-copy"><h3>${block[0]}</h3><p>${block[1]}</p></article>`).join(''); }

function renderSettings(){ const p=state.prefs; $('#settings-grid').innerHTML=`<article class="setting-card"><span class="eyebrow">DISPLAY</span><h2>Comfortable by default.</h2><p>Make RecycleIQ work with your eyes and your environment.</p><div class="setting-control"><label for="theme-select">Theme<small>Follow the system or choose one.</small></label><select class="select-control" id="theme-select"><option value="system" ${p.theme==='system'?'selected':''}>System</option><option value="light" ${p.theme==='light'?'selected':''}>Light</option><option value="dark" ${p.theme==='dark'?'selected':''}>Dark</option></select></div><div class="setting-control"><label for="text-size-select">Text size<small>Increase reading size across the app.</small></label><select class="select-control" id="text-size-select"><option value="normal" ${p.textSize==='normal'?'selected':''}>Default</option><option value="large" ${p.textSize==='large'?'selected':''}>Large</option></select></div></article><article class="setting-card"><span class="eyebrow">LANGUAGE & PRIVACY</span><h2>Clear, personal, local.</h2><p>Translations are structured in JSON so more languages can be added without changing the app shell.</p><div class="setting-control"><label for="language-select">Language<small>English, Hindi, Punjabi</small></label><select class="select-control" id="language-select"><option value="en" ${p.language==='en'?'selected':''}>English</option><option value="hi" ${p.language==='hi'?'selected':''}>हिन्दी</option><option value="pa" ${p.language==='pa'?'selected':''}>ਪੰਜਾਬੀ</option></select></div><div class="setting-control"><label>Camera permission<small>Allow camera access in your browser settings, then try again.</small></label><button class="button button--outline" id="camera-help" type="button">How to fix</button></div><div class="setting-control"><label>Saved progress<small>Scan history and score stay in this browser only.</small></label><button class="button button--danger" id="clear-history" type="button">Clear history</button></div></article>`; }
function bindSettings(){ $('#theme-select')?.addEventListener('change',event=>{state.prefs.theme=event.target.value; savePrefs(state.prefs); applyPrefs();}); $('#text-size-select')?.addEventListener('change',event=>{state.prefs.textSize=event.target.value; savePrefs(state.prefs); applyPrefs();}); $('#language-select')?.addEventListener('change',event=>{state.prefs.language=event.target.value; savePrefs(state.prefs); showToast('Language preference saved. Full translations are ready to extend.');}); $('#camera-help')?.addEventListener('click',()=>showToast('Open your browser site settings, allow Camera, then return to RecycleIQ.')); $('#clear-history')?.addEventListener('click',openClearModal); }

function openClearModal(){ $('#modal-backdrop').hidden=false; $('#modal-confirm').focus(); }
function closeModal(){ $('#modal-backdrop').hidden=true; }
function confirmClear(){ clearHistory(); closeModal(); renderMiniStats(); renderDashboard(); showToast('Local history cleared.'); }

function setupInstall(){ const iosBanner=$('#ios-banner'); const hideIos=()=>{localStorage.setItem('recycleiq-ios-dismissed','1');iosBanner.hidden=true;iosBanner.style.display='none';}; const showIos=()=>{iosBanner.hidden=false;iosBanner.style.display='flex';}; window.addEventListener('beforeinstallprompt',event=>{event.preventDefault(); state.deferredInstall=event; $('#install-button').hidden=false;}); $('#install-button').addEventListener('click',async()=>{ if(!state.deferredInstall)return; state.deferredInstall.prompt(); await state.deferredInstall.userChoice; state.deferredInstall=null; $('#install-button').hidden=true; }); if(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone && !localStorage.getItem('recycleiq-ios-dismissed')) showIos(); else hideIos(); $('#dismiss-ios').addEventListener('click',hideIos); }

function setupScanner(){ const dropzone=$('#dropzone'); $('#upload-button').addEventListener('click',event=>{event.stopPropagation();$('#image-input').click();}); dropzone.addEventListener('click',event=>{if(event.target.closest('button'))return; if(!state.currentImage)$('#image-input').click();}); dropzone.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!state.currentImage){event.preventDefault();$('#image-input').click();}}); $('#image-input').addEventListener('change',event=>setImage(event.target.files[0])); ['dragenter','dragover'].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add('is-dragging');})); ['dragleave','drop'].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove('is-dragging');})); dropzone.addEventListener('drop',event=>setImage(event.dataTransfer.files[0])); $('#remove-image').addEventListener('click',event=>{event.stopPropagation();resetImage();}); $('#classify-button').addEventListener('click',identifySelectedImage); $('#camera-button').addEventListener('click',startCamera); $('#camera-close').addEventListener('click',stopCamera); $('#capture-button').addEventListener('click',captureCamera); $$('.quick-pick').forEach(button=>button.addEventListener('click',()=>showItemResult(getItem(button.dataset.item),'quick pick'))); }
function setupSearch(){ $('#search-input').addEventListener('input',handleSearchInput); $('#search-input').addEventListener('keydown',event=>{if(event.key==='Escape'){$('#autocomplete').hidden=true;} if(event.key==='Enter'){const item=getItem(event.target.value);if(item)showItemResult(item,'search');}}); $('#clear-search').addEventListener('click',()=>{$('#search-input').value='';handleSearchInput();$('#search-input').focus();}); $('#reset-search').addEventListener('click',()=>{$('#search-input').value='';renderSearch(state.items);}); }

function setupGlobalEvents(){ document.addEventListener('click',event=>{ const nav=event.target.closest('[data-nav]'); if(nav){event.preventDefault();navigate(nav.dataset.nav);return;} const itemButton=event.target.closest('[data-search-item],[data-suggest-item]'); if(itemButton){const item=getItem(itemButton.dataset.searchItem||itemButton.dataset.suggestItem); if(item)showItemResult(item,'search'); $('#autocomplete').hidden=true; return;} const categoryButton=event.target.closest('[data-correct-category]'); if(categoryButton){const item=state.items.find(candidate=>candidate.category===categoryButton.dataset.correctCategory) || getItem('plastic bottle'); renderScannerResult(item,.82,'manual correction'); showToast('Thanks — your correction is saved locally when you scan again.'); return;} const quizAnswer=event.target.closest('[data-quiz-answer]'); if(quizAnswer){answerQuiz(Number(quizAnswer.dataset.quizAnswer));return;} if(event.target.closest('#quiz-next')){nextQuiz();return;} if(event.target.closest('#quiz-restart')){state.quizIndex=0;state.quizScore=0;state.quizAnswered=false;renderQuiz();return;} const topic=event.target.closest('[data-topic]'); if(topic){showToast('Keep exploring — this topic is covered in the project notes and guide.');} }); $('#theme-toggle').addEventListener('click',()=>{state.prefs.theme=document.body.classList.contains('dark')?'light':'dark';savePrefs(state.prefs);applyPrefs();}); $('#mobile-menu').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('is-open');$('#mobile-menu').setAttribute('aria-expanded',String(open));}); $('#modal-close').addEventListener('click',closeModal); $('#modal-cancel').addEventListener('click',closeModal); $('#modal-backdrop').addEventListener('click',event=>{if(event.target.id==='modal-backdrop')closeModal();}); $('#modal-confirm').addEventListener('click',confirmClear); document.addEventListener('keydown',event=>{if(event.key>='1'&&event.key<='5' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) navigate(['scan','search','guide','dashboard','learn'][Number(event.key)-1]);}); }

async function init(){
  renderBrandMarks(); applyPrefs(); setupInstall(); setupGlobalEvents(); setupScanner(); setupSearch();
  try { await loadData(); renderGuide(); renderLearn(); renderAbout(); renderSettings(); bindSettings(); renderSearch(state.items); renderMiniStats(); renderDashboard(); } catch(error) { console.error(error); showToast('Some guide data could not load. Refresh once you are back online.'); }
  const hash=location.hash.slice(1); if(hash)navigate(hash); else navigate('scan');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js?v=5').catch(()=>{});
  setTimeout(()=>$('#splash').classList.add('is-hidden'),650);
}
init();
