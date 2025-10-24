// Lógica cliente para o prontuário de triagem (localStorage)
const STORAGE_KEY = 'consultas_v1';
const DOCTORS_KEY = 'doctors_v1';
const MODERATOR_ID_KEY = 'moderator_id_v1';
const MODERATOR_PASS_KEY = 'moderator_pass_v1';
const COMMS_KEY = 'comms_v1';
// default moderator credentials (can be changed later in settings)
const DEFAULT_MOD_ID = 'phm00';
const DEFAULT_MOD_PASS = '1804';

// ensure moderator default credentials exist (for first-run convenience)
if(!localStorage.getItem(MODERATOR_ID_KEY)) localStorage.setItem(MODERATOR_ID_KEY, DEFAULT_MOD_ID);
if(!localStorage.getItem(MODERATOR_PASS_KEY)) localStorage.setItem(MODERATOR_PASS_KEY, DEFAULT_MOD_PASS);
if(!localStorage.getItem('moderator_display_v1')) localStorage.setItem('moderator_display_v1', 'Moderador');

let consultations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let doctors = JSON.parse(localStorage.getItem(DOCTORS_KEY) || '[]');
let comms = JSON.parse(localStorage.getItem(COMMS_KEY) || '[]');
let currentRole = 'paciente';
let currentUser = '';
let editingDoctorId = null;
let currentUserId = null; // stores id_doctor when a doctor is logged, or mod id when moderator
let moderatorAvatarDataUrl = null; // temporary holder when selecting a new moderator avatar

const elsAll = {
	roleSelect: document.getElementById('roleSelect'),
	switchRole: document.getElementById('switchRole'),
	userEmail: document.getElementById('userEmail'),
	userPass: document.getElementById('userPass'),
	editModerator: document.getElementById('editModerator'),
	moderatorModal: document.getElementById('moderatorModal'),
	moderatorClose: document.getElementById('moderatorClose'),
	moderatorCancel: document.getElementById('moderatorCancel'),
	mod_avatar_input: document.getElementById('mod_avatar_input'),
	mod_avatar_preview: document.getElementById('mod_avatar_preview'),
	moderatorInfo: document.getElementById('moderatorInfo'),
	moderatorInfoAvatar: document.getElementById('moderatorInfoAvatar'),
	moderatorInfoName: document.getElementById('moderatorInfoName'),
	commsBtn: document.getElementById('commsBtn'),
	commsModal: document.getElementById('commsModal'),
	commsClose: document.getElementById('commsClose'),
	commsMessages: document.getElementById('commsMessages'),
	commsTo: document.getElementById('commsTo'),
	commsInput: document.getElementById('commsInput'),
	commsSend: document.getElementById('commsSend'),
	commsBadge: document.getElementById('commsBadge'),
	editDoctorBtn: document.getElementById('editDoctorBtn'),
	toggleAvailBtn: document.getElementById('toggleAvailBtn'),
	doctorModal: document.getElementById('doctorModal'),
	doctorModalClose: document.getElementById('doctorModalClose'),
	doctorModalCancel: document.getElementById('doctorModalCancel'),
	patientSection: document.getElementById('patientSection'),
	doctorSection: document.getElementById('doctorSection'),
	moderatorSection: document.getElementById('moderatorSection'),
	patientForm: document.getElementById('patientForm'),
	queueList: document.getElementById('queueList'),
	moderatorList: document.getElementById('moderatorList'),
	cardTpl: document.getElementById('cardTpl'),
	doctorList: document.getElementById('doctorList'),
	doctorTpl: document.getElementById('doctorTpl'),
	doctorForm: document.getElementById('doctorForm'),
	doctorFormCancel: document.getElementById('doctorFormCancel'),
	moderatorDoctorsList: document.getElementById('moderatorDoctorsList'),
	moderatorSettings: document.getElementById('moderatorProfile'),
	mod_new_pass: document.getElementById('mod_new_pass'),
	mod_display_name: document.getElementById('mod_display_name'),
	mod_id: document.getElementById('mod_id'),
	// doctor profile / avatar
	doctorProfileSection: document.getElementById('doctorProfileSection'),
	doctorAvatarInput: document.getElementById('doctorAvatarInput'),
	doctorAvatarPreview: document.getElementById('doctorAvatarPreview'),
	saveAvatar: document.getElementById('saveAvatar'),
	d_id: document.getElementById('d_id'),
	d_password: document.getElementById('d_password'),
	p_specialty: document.getElementById('p_specialty'),
	doctorSearch: document.getElementById('doctorSearch')
};

// entry overlay elements
elsAll.entryOverlay = document.getElementById('entryOverlay');
elsAll.entryForm = document.getElementById('entryForm');
elsAll.entryRole = document.getElementById('entryRole');
elsAll.entryId = document.getElementById('entryId');
elsAll.entryPass = document.getElementById('entryPass');
elsAll.entryName = document.getElementById('entryName');
elsAll.switchUser = document.getElementById('switchUser');

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(consultations)); }
function saveDoctors(){ localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors)); }

function saveComms(){ localStorage.setItem(COMMS_KEY, JSON.stringify(comms)); }

// helper: current viewer identifier for read tracking
function currentViewerId(){
	if(currentRole === 'moderador') return 'moderador';
	if(currentRole === 'medico') return currentUserId || currentUser || 'medico_unknown';
	return 'anon';
}

// handle avatar file input for doctor profile
function handleDoctorAvatarInput(fileInput, previewImg, targetDoctorId){
	const file = fileInput.files && fileInput.files[0];
	if(!file){ return; }
	const reader = new FileReader();
	reader.onload = function(e){
		const dataUrl = e.target.result;
		// update preview
		if(previewImg) previewImg.src = dataUrl;
		// persist to doctor record if id provided
		if(targetDoctorId){
			const doc = doctors.find(d => d.id === targetDoctorId || d.id_doctor === targetDoctorId);
			if(doc){ doc.avatar = dataUrl; saveDoctors(); render(); }
		}
	};
	reader.readAsDataURL(file);
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function fmtDate(ts){ return new Date(ts).toLocaleString(); }
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function setRole(role, name){ currentRole = role; currentUser = name ? name.trim() : ''; render(); }

// helper: attempt login for given role + credentials/name; returns true on success
function tryLogin(role, nameOrId, pass){
	if(role === 'moderador'){
		const providedId = (nameOrId||'').trim();
		const storedId = localStorage.getItem(MODERATOR_ID_KEY);
		const storedPass = localStorage.getItem(MODERATOR_PASS_KEY);
		const display = localStorage.getItem('moderator_display_v1') || 'Moderador';
		// primeiro uso: se não há id definido, criar com as credenciais fornecidas
		if(!storedId){
			if(!providedId || !pass){ alert('Primeiro acesso do moderador: informe id_admin e senha.'); return false; }
			localStorage.setItem(MODERATOR_ID_KEY, providedId);
			localStorage.setItem(MODERATOR_PASS_KEY, pass);
			localStorage.setItem('moderator_display_v1', display);
			currentUserId = providedId;
			setRole('moderador', display);
			return true;
		}
		// já existe: verificar id e senha
		if(providedId === storedId && pass === storedPass){ currentUserId = providedId; setRole('moderador', display); return true; }
		alert('Credenciais do moderador incorretas.'); return false;
	}

	if(role === 'medico'){
		if(!nameOrId || !pass){ alert('Informe id_doctor e senha do médico'); return false; }
		const doc = doctors.find(d => ((d.id_doctor||'').toString().toLowerCase() === nameOrId.toLowerCase()) && d.password === pass);
		if(!doc){ alert('Credenciais inválidas para médico.'); return false; }
		currentUserId = doc.id_doctor;
		setRole('medico', doc.name);
		return true;
	}

	// paciente: nameOrId is actually name
	if(role === 'paciente'){
		const name = (nameOrId || '').trim();
		if(!name){ alert('Informe o nome do paciente'); return false; }
		setRole('paciente', name);
		// auto-fill patient form name
		const pn = document.getElementById('p_name'); if(pn) pn.value = name;
		return true;
	}

	return false;
}

// entry form submit: use the overlay fields and only hide overlay on success
if(elsAll.entryForm){
	elsAll.entryForm.addEventListener('submit', (ev)=>{
		ev.preventDefault();
		const role = (elsAll.entryRole && elsAll.entryRole.value) || 'paciente';
		const name = (elsAll.entryName && elsAll.entryName.value || '').trim();
		const id = (elsAll.entryId && elsAll.entryId.value || '').trim();
		const pass = (elsAll.entryPass && elsAll.entryPass.value || '');

		const cred = (role === 'paciente') ? name : id;
		const ok = tryLogin(role, cred, pass);
		if(ok){ if(elsAll.entryOverlay) elsAll.entryOverlay.style.display = 'none'; }
	});
}

// clicking 'Trocar usuário' opens the overlay and clears previous inputs
if(elsAll.switchUser){
	elsAll.switchUser.addEventListener('click', (e)=>{
		e.preventDefault();
		if(elsAll.entryOverlay) elsAll.entryOverlay.style.display = 'flex';
		if(elsAll.entryName) elsAll.entryName.value = '';
		if(elsAll.entryId) elsAll.entryId.value = '';
		if(elsAll.entryPass) elsAll.entryPass.value = '';
		if(elsAll.entryRole) elsAll.entryRole.value = 'paciente';
		// show appropriate fields
		toggleEntryFields('paciente');
	});
}

// Edit moderator button: visible only for moderator; focus moderator profile form when clicked
if(elsAll.editModerator){
    elsAll.editModerator.addEventListener('click', (e)=>{
        e.preventDefault();
        if(currentRole !== 'moderador'){ alert('Apenas o moderador pode editar o perfil.'); return; }
		// populate current values
		const display = localStorage.getItem('moderator_display_v1') || 'Moderador';
		const avatar = localStorage.getItem('moderator_avatar_v1') || '';
		if(elsAll.mod_display_name) elsAll.mod_display_name.value = display;
		if(elsAll.mod_avatar_preview) elsAll.mod_avatar_preview.src = avatar;
		moderatorAvatarDataUrl = null; // reset temp value until user selects new
		// show modal
		if(elsAll.moderatorModal){ elsAll.moderatorModal.style.display = 'flex'; }
		const inp = document.getElementById('mod_display_name'); if(inp) inp.focus();
    });
}

// Edit doctor profile button: visible only for logged doctor; opens doctor modal
if(elsAll.editDoctorBtn){
	elsAll.editDoctorBtn.addEventListener('click', (e)=>{
		e.preventDefault();
		if(currentRole !== 'medico'){ alert('Apenas médicos podem editar seu perfil.'); return; }
		// populate preview from current doctor's record
		const doc = doctors.find(d => d.id_doctor === currentUserId || d.id === currentUserId);
		if(doc && elsAll.doctorAvatarPreview) elsAll.doctorAvatarPreview.src = doc.avatar || '';
		if(elsAll.doctorModal) elsAll.doctorModal.style.display = 'flex';
		if(elsAll.doctorAvatarInput) try{ elsAll.doctorAvatarInput.value = ''; }catch(e){}
	});
}

// doctor availability toggle (self)
if(elsAll.toggleAvailBtn){
	elsAll.toggleAvailBtn.addEventListener('click', (e)=>{
		e.preventDefault();
		if(currentRole !== 'medico'){ alert('Apenas médicos podem alterar sua disponibilidade.'); return; }
		const doc = doctors.find(d => d.id_doctor === currentUserId || d.id === currentUserId);
		if(!doc){ alert('Registro do médico não encontrado.'); return; }
		doc.available = !doc.available;
		saveDoctors(); render();
		alert('Disponibilidade atualizada: ' + (doc.available ? 'Disponível' : 'Indisponível'));
	});
}

if(elsAll.doctorModalClose) elsAll.doctorModalClose.addEventListener('click', ()=>{ if(elsAll.doctorModal) elsAll.doctorModal.style.display = 'none'; });
if(elsAll.doctorModalCancel) elsAll.doctorModalCancel.addEventListener('click', ()=>{ if(elsAll.doctorModal) elsAll.doctorModal.style.display = 'none'; });

// Communications button: open comms modal (visible to médicos and moderador)
if(elsAll.commsBtn){
	elsAll.commsBtn.addEventListener('click', (e)=>{
		e.preventDefault();
		if(!(currentRole === 'medico' || currentRole === 'moderador')){ alert('Comunicação disponível apenas para médicos e moderador.'); return; }
		if(elsAll.commsModal) elsAll.commsModal.style.display = 'flex';
		// populate recipient options depending on role
		populateCommsRecipients();
		renderComms();
		// mark visible messages as read for current viewer
		markCommsReadForCurrentViewer();
		if(elsAll.commsInput) elsAll.commsInput.focus();
	});
}

if(elsAll.commsClose) elsAll.commsClose.addEventListener('click', ()=>{ if(elsAll.commsModal) elsAll.commsModal.style.display = 'none'; });

// when user changes the selected recipient, re-render the visible conversation and mark reads
if(elsAll.commsTo){
	elsAll.commsTo.addEventListener('change', ()=>{
		renderComms();
		markCommsReadForCurrentViewer();
	});
}

// send message
if(elsAll.commsSend){
	elsAll.commsSend.addEventListener('click', ()=>{
		const text = (elsAll.commsInput && elsAll.commsInput.value || '').trim();
		const to = (elsAll.commsTo && elsAll.commsTo.value) || '';
		if(!text){ alert('Digite uma mensagem'); return; }
		const msg = { id: uid(), ts: Date.now(), senderRole: currentRole, senderName: currentUser || '', senderId: currentUserId || '', to, text, readBy: [] };
		// mark as read by sender
		const viewer = currentViewerId(); if(!msg.readBy) msg.readBy = []; if(msg.readBy.indexOf(viewer) === -1) msg.readBy.push(viewer);
		comms.push(msg); saveComms(); if(elsAll.commsInput) elsAll.commsInput.value = ''; renderComms(); updateCommsBadge();
	});
}

// render messages inside comms modal according to simple visibility rules
function renderComms(){
	if(!elsAll.commsMessages) return;
	const selectedTo = (elsAll.commsTo && elsAll.commsTo.value) || '';
	elsAll.commsMessages.innerHTML = '';

	// helper: determine if message belongs to the currently selected conversation AND is visible to viewer
	function messageMatchesSelection(m){
		// when no special selection, fall through to private/moderator handling below
		if(selectedTo === 'moderator'){
			if(m.to !== 'moderator') return false;
			if(currentRole === 'moderador') return true;
			// medicos see their own messages to moderator and any replies addressed to them
			if(currentRole === 'medico'){
				if(m.senderId === currentUserId) return true;
				return false;
			}
			return false;
		}
		// private:<id> selected
		if(selectedTo && selectedTo.indexOf('private:') === 0){
			const target = selectedTo.split(':')[1];
			// when a medico selects a private recipient, show the two-way thread between currentUser and target
			if(currentRole === 'medico'){
				if(!currentUserId) return false;
				// include messages either sent-to target or sent-to currentUser, but only those exchanged between these two doctors
				const isToTarget = (m.to === ('private:' + target));
				const isToMe = (m.to === ('private:' + currentUserId));
				const involvement = (m.senderId === currentUserId || m.senderId === target);
				return ( (isToTarget || isToMe) && involvement );
			}
			// moderator: show messages sent to target or sent by target (so moderator can inspect conversation involving that doctor)
			if(currentRole === 'moderador'){
				if(m.to && m.to.indexOf('private:') === 0){
					const t = m.to.split(':')[1];
					if(t === target) return true;
				}
				if(m.senderId === target) return true;
				return false;
			}
			return false;
		}
		return false;
	}

	comms.slice().sort((a,b)=> a.ts - b.ts).forEach(m=>{
		if(!messageMatchesSelection(m)) return;
		const el = document.createElement('div');
		el.style.padding = '6px 8px'; el.style.marginBottom = '6px'; el.style.borderRadius = '6px';
		el.style.background = (m.senderRole === 'moderador') ? '#eef6ff' : '#fff';
	const targetLabel = (m.to === 'moderator' ? 'Para Moderador' : (m.to && m.to.indexOf('private:')===0 ? ('Privado: ' + (m.to.split(':')[1])) : m.to));
		el.innerHTML = `<small style="color:#666">${new Date(m.ts).toLocaleString()} • ${escapeHtml(m.senderName || m.senderRole)} • ${escapeHtml(targetLabel)}</small><div style="margin-top:4px">${escapeHtml(m.text)}</div>`;
		elsAll.commsMessages.appendChild(el);
	});
	// scroll to bottom
	elsAll.commsMessages.scrollTop = elsAll.commsMessages.scrollHeight;
}

// mark visible comms as read for the current viewer
function markCommsReadForCurrentViewer(){
	const viewer = currentViewerId();
	const selectedTo = (elsAll.commsTo && elsAll.commsTo.value) || null;
	let changed = false;

	function isRelevantForMark(m){
		if(!selectedTo) return false;
		// reuse selection rules used in renderComms
		if(selectedTo === 'moderator'){
			if(m.to !== 'moderator') return false;
			if(currentRole === 'moderador') return true;
			if(currentRole === 'medico') return m.senderId === currentUserId;
			return false;
		}
		if(selectedTo.indexOf('private:') === 0){
			const target = selectedTo.split(':')[1];
			if(currentRole === 'medico'){
				if(!currentUserId) return false;
				const isToTarget = (m.to === ('private:' + target));
				const isToMe = (m.to === ('private:' + currentUserId));
				const involvement = (m.senderId === currentUserId || m.senderId === target);
				return ( (isToTarget || isToMe) && involvement );
			}
			if(currentRole === 'moderador'){
				if(m.to && m.to.indexOf('private:') === 0){ if(m.to.split(':')[1] === target) return true; }
				if(m.senderId === target) return true;
				return false;
			}
		}
		return false;
	}


	comms.forEach(m=>{
		if(isRelevantForMark(m)){
			m.readBy = m.readBy || [];
			if(m.readBy.indexOf(viewer) === -1){ m.readBy.push(viewer); changed = true; }
		}
	});
	if(changed) saveComms();
	updateCommsBadge();
}

// compute and show unread badge for current viewer
function updateCommsBadge(){
	if(!elsAll.commsBadge) return;
	if(!(currentRole === 'medico' || currentRole === 'moderador')){ elsAll.commsBadge.style.display = 'none'; return; }
	const viewer = currentViewerId();
	let cnt = 0;
	comms.forEach(m=>{
		// check if m is relevant to viewer
		const relevant = (function(m){
			if(m.to === 'moderator'){
				if(currentRole === 'moderador') return true;
				if(currentRole === 'medico' && m.senderId === currentUserId) return true;
				return false;
			}
			if(m.to && m.to.indexOf('private:')===0){
				const target = m.to.split(':')[1];
				if(currentRole === 'moderador') return true; // moderator sees all private messages
				// médicos are interested in private messages where they are the recipient or the sender
				if(currentRole === 'medico' && currentUserId && (currentUserId === target || m.senderId === currentUserId)) return true;
				return false;
			}
			return false;
		})(m);
		if(!relevant) return;
		m.readBy = m.readBy || [];
		if(m.readBy.indexOf(viewer) === -1) cnt++;
	});
	if(cnt > 0){ elsAll.commsBadge.textContent = String(cnt); elsAll.commsBadge.style.display = 'inline-block'; } else { elsAll.commsBadge.style.display = 'none'; }
}

// modal close / cancel handlers
if(elsAll.moderatorClose) elsAll.moderatorClose.addEventListener('click', ()=>{ if(elsAll.moderatorModal) elsAll.moderatorModal.style.display = 'none'; });
if(elsAll.moderatorCancel) elsAll.moderatorCancel.addEventListener('click', ()=>{ if(elsAll.moderatorModal) elsAll.moderatorModal.style.display = 'none'; });

// moderator avatar input preview (temp store in moderatorAvatarDataUrl)
if(elsAll.mod_avatar_input && elsAll.mod_avatar_preview){
	elsAll.mod_avatar_input.addEventListener('change', ()=>{
		const f = elsAll.mod_avatar_input.files && elsAll.mod_avatar_input.files[0];
		if(!f) return;
		const r = new FileReader();
		r.onload = function(ev){ moderatorAvatarDataUrl = ev.target.result; if(elsAll.mod_avatar_preview) elsAll.mod_avatar_preview.src = moderatorAvatarDataUrl; };
		r.readAsDataURL(f);
	});
}

// toggle visible input groups in the entry overlay depending on role
function toggleEntryFields(role){
	const nameGroup = document.querySelector('.entry-field-name');
	const credsGroup = document.querySelector('.entry-field-creds');
	if(role === 'paciente'){
		if(nameGroup) nameGroup.style.display = 'block';
		if(credsGroup) credsGroup.style.display = 'none';
	} else {
		if(nameGroup) nameGroup.style.display = 'none';
		if(credsGroup) credsGroup.style.display = 'block';
	}
}

if(elsAll.entryRole) elsAll.entryRole.addEventListener('change', ()=> toggleEntryFields(elsAll.entryRole.value));

function updateSpecialtyOptions(){
	if(!elsAll.p_specialty) return;
	const set = new Set();
	doctors.forEach(d=>{ if(d.specialty) set.add(d.specialty); });
	elsAll.p_specialty.innerHTML = '<option value="Qualquer"></option>';
	Array.from(set).sort().forEach(s=>{ const opt = document.createElement('option'); opt.value = s; opt.textContent = s; elsAll.p_specialty.appendChild(opt); });
}

function findBestDoctorForSpecialty(specialty){
	if(!specialty) return null;
	const candidates = doctors.filter(d => d.specialty && d.specialty.toLowerCase() === specialty.toLowerCase());
	if(candidates.length === 0) return null;
	const counts = candidates.map(d => ({ d, count: consultations.filter(c => (c.assignedTo === d.name) && (c.status === 'waiting' || c.status === 'in-progress')).length }));
	counts.sort((a,b)=> a.count - b.count);
	return counts[0].d;
}

if(elsAll.patientForm) elsAll.patientForm.addEventListener('submit', (e)=>{
	e.preventDefault();
	const requestedSpecialty = (elsAll.p_specialty && elsAll.p_specialty.value) || '';
	const c = {
		id: uid(), createdAt: Date.now(),
		name: document.getElementById('p_name').value.trim(),
		contact: document.getElementById('p_contact').value.trim(),
		what: document.getElementById('p_what').value.trim(),
		symptoms: document.getElementById('p_symptoms').value.trim(),
		duration: document.getElementById('p_duration').value.trim(),
		severity: document.getElementById('p_severity').value,
		status: 'waiting', assignedTo: null, notes: '', requestedSpecialty: requestedSpecialty
	};
	if(requestedSpecialty){ const doc = findBestDoctorForSpecialty(requestedSpecialty); if(doc) c.assignedTo = doc.name; }
	consultations.push(c); save(); alert('Consulta criada.' + (c.assignedTo ? (' Atribuída a: ' + c.assignedTo) : ' Aguarde o atendimento.')); elsAll.patientForm.reset(); render();
});

if(elsAll.doctorForm) elsAll.doctorForm.addEventListener('submit', (e)=>{
	e.preventDefault();
	const name = (document.getElementById('d_name').value || '').trim();
	const specialty = (document.getElementById('d_specialty').value || '').trim();
	const contact = (document.getElementById('d_contact').value || '').trim();
	const bio = (document.getElementById('d_bio').value || '').trim();
	const idDoctor = (elsAll.d_id && elsAll.d_id.value || '').trim();
	const password = (elsAll.d_password && elsAll.d_password.value) || '';

	if(!name){ alert('Informe o nome do médico.'); return; }

	// editing existing doctor
	if(editingDoctorId){
		const doc = doctors.find(x => x.id === editingDoctorId);
		if(!doc){ alert('Médico não encontrado.'); editingDoctorId = null; return; }
		// if idDoctor changed, ensure no duplicate with other doctors
		if(idDoctor && idDoctor !== (doc.id_doctor||'') && doctors.some(x => (x.id_doctor||'') === idDoctor)){
			alert('Já existe um médico cadastrado com este ID.');
			return;
		}
		doc.name = name; doc.specialty = specialty; doc.contact = contact; doc.bio = bio;
		if(idDoctor) doc.id_doctor = idDoctor;
		if(password) doc.password = password; // only update if provided
		saveDoctors();
		editingDoctorId = null;
		// restore submit button text
		const f = document.getElementById('doctorForm'); if(f){ const btn = f.querySelector('button[type=submit]'); if(btn) btn.textContent = 'Adicionar Médico'; }
		elsAll.doctorForm.reset(); render(); updateSpecialtyOptions();
		if(specialty){ const sel = document.getElementById('p_specialty'); if(sel) sel.value = specialty; }
		return;
	}

	// creating new doctor
	if(!idDoctor || !password){ alert('Informe ID do médico e senha para login.'); return; }
	// evitar ids duplicados
	if(idDoctor && doctors.some(x => ((x.id_doctor||'') === idDoctor))){ alert('Já existe um médico cadastrado com este ID.'); return; }
	const d = { id: uid(), id_doctor: idDoctor, name, specialty, contact, bio, password };
	doctors.push(d);
	saveDoctors();
	elsAll.doctorForm.reset(); render();
	// atualizar opções de especialidade e selecionar automaticamente a nova criada
	updateSpecialtyOptions(); if(specialty){ const sel = document.getElementById('p_specialty'); if(sel){ sel.value = specialty; } }
});
// cancel editing a doctor (visible as ✕ button next to the submit when editing)
if(elsAll.doctorFormCancel){
	elsAll.doctorFormCancel.addEventListener('click', ()=>{
		if(!editingDoctorId) return; // nothing to cancel
		if(!confirm('Cancelar edição do médico? As alterações não salvas serão descartadas.')) return;
		// reset editing state and form
		editingDoctorId = null;
		const f = document.getElementById('doctorForm');
		if(f){ f.reset(); const btn = f.querySelector('button[type=submit]'); if(btn) btn.textContent = 'Adicionar Médico'; }
		render();
	});
}
if(elsAll.doctorSearch) elsAll.doctorSearch.addEventListener('input', ()=> renderDoctors());

function createDoctorCard(doc, actions = []){
	const tpl = elsAll.doctorTpl.content.cloneNode(true);
	const img = tpl.querySelector('.d-avatar');
	if(img) img.src = doc.avatar || '';
	tpl.querySelector('.d-name').textContent = doc.name;
	tpl.querySelector('.d-specialty').textContent = doc.specialty || '';
	tpl.querySelector('.d-contact').textContent = doc.contact || '';
	tpl.querySelector('.d-bio').textContent = doc.bio || '';
	// availability badge: default to available unless explicitly false
	const availEl = tpl.querySelector('.d-available');
	const isAvailable = (typeof doc.available === 'undefined') ? true : Boolean(doc.available);
	if(availEl){
		availEl.textContent = isAvailable ? 'Disponível' : 'Indisponível';
		if(!isAvailable) availEl.classList.add('off'); else availEl.classList.remove('off');
	}
	const actionsContainer = tpl.querySelector('.d-actions');
	actions.forEach(a=>{
		const btn = document.createElement('button');
		btn.textContent = a.label;
		btn.className = a.class || '';
		btn.dataset.id = doc.id;
		btn.dataset.action = a.action;
		if(a.confirm) btn.dataset.confirm = '1';
		actionsContainer.appendChild(btn);
	});
	return tpl;
}

function renderDoctors(){ const list = elsAll.doctorList; if(!list) return; list.innerHTML = ''; if(doctors.length === 0){ list.innerHTML = '<p>Nenhum médico cadastrado.</p>'; return; } const q = (elsAll.doctorSearch && elsAll.doctorSearch.value || '').trim().toLowerCase(); doctors.filter(d=>{ if(!q) return true; return (d.name||'').toLowerCase().includes(q) || (d.specialty||'').toLowerCase().includes(q); }).forEach(d=>{ const node = createDoctorCard(d, []); list.appendChild(node); }); }

function renderModeratorDoctors(){
	const container = elsAll.moderatorDoctorsList; if(!container) return; container.innerHTML = '';
	if(doctors.length === 0){ container.innerHTML = '<p>Nenhum médico cadastrado.</p>'; return; }
	doctors.forEach(d=>{
		// moderator can also toggle availability for any doctor
		const actions = [
			{ label: (d.available === false) ? 'Marcar Disponível' : 'Marcar Indisponível', action: 'doc_toggle_avail', class: '', confirm: false },
			{ label: 'Editar', action: 'doc_edit', class: '', confirm: false },
			{ label: 'Excluir', action: 'doc_delete', class: 'danger', confirm: true }
		];
		const node = createDoctorCard(d, actions);
		container.appendChild(node);
	});
	container.querySelectorAll('button').forEach(b=> b.addEventListener('click', onDoctorAction));
}

function onDoctorAction(e){
	const btn = e.currentTarget; const id = btn.dataset.id; const action = btn.dataset.action;
	if(btn.dataset.confirm && !confirm('Confirma?')) return;
	if(action === 'doc_delete') return deleteDoctor(id);
	if(action === 'doc_edit') return editDoctor(id);
	if(action === 'doc_toggle_avail'){
		const doc = doctors.find(d => d.id === id);
		if(!doc) return alert('Médico não encontrado.');
		doc.available = !(typeof doc.available === 'undefined' ? true : Boolean(doc.available));
		saveDoctors(); render();
		alert('Disponibilidade do médico "' + (doc.name||'') + '" atualizada: ' + (doc.available ? 'Disponível' : 'Indisponível'));
		return;
	}
}
function editDoctor(id){
	const d = doctors.find(x => x.id === id);
	if(!d) return;
	editingDoctorId = d.id;
	// populate form
	const f = document.getElementById('doctorForm');
	if(!f) return;
	if(document.getElementById('d_name')) document.getElementById('d_name').value = d.name || '';
	if(document.getElementById('d_specialty')) document.getElementById('d_specialty').value = d.specialty || '';
	if(document.getElementById('d_contact')) document.getElementById('d_contact').value = d.contact || '';
	if(document.getElementById('d_bio')) document.getElementById('d_bio').value = d.bio || '';
	if(document.getElementById('d_id')) document.getElementById('d_id').value = d.id_doctor || '';
	// password left blank intentionally; if user fills it, we'll update it
	if(document.getElementById('d_password')) document.getElementById('d_password').value = '';
	// update submit button text
	const btn = f.querySelector('button[type=submit]'); if(btn) btn.textContent = 'Salvar alterações';
}
function deleteDoctor(id){ doctors = doctors.filter(d=> d.id !== id); saveDoctors(); render(); }

function createCard(consultation, actions = []){
	const tpl = elsAll.cardTpl.content.cloneNode(true);
	tpl.querySelector('.c-name').textContent = consultation.name || 'Sem nome';
	tpl.querySelector('.c-status').textContent = consultation.status + (consultation.assignedTo ? ' • ' + consultation.assignedTo : '');
	tpl.querySelector('.c-meta').innerHTML = `<small>Criação: ${fmtDate(consultation.createdAt)} | Contato: ${consultation.contact || '-'} | Duração: ${consultation.duration || '-'}</small>`;
	tpl.querySelector('.c-answers').innerHTML = `<p><strong>O que:</strong> ${escapeHtml(consultation.what)}</p><p><strong>Sintomas:</strong> ${escapeHtml(consultation.symptoms || '-')}</p><p><strong>Gravidade:</strong> ${consultation.severity}</p>`;

	// mostrar info de encerramento para médicos e moderadores
	if(consultation.status === 'closed' && (currentRole === 'medico' || currentRole === 'moderador')){
		const closedBy = consultation.closedBy || '—';
		const closedAt = consultation.closedAt ? fmtDate(consultation.closedAt) : fmtDate(consultation.createdAt);
		const extra = document.createElement('div');
		extra.className = 'c-closed';
		extra.innerHTML = `<small>Encerrada por: ${escapeHtml(closedBy)} em ${closedAt}</small>`;
		tpl.querySelector('.c-meta').appendChild(extra);
	}

	const actionsContainer = tpl.querySelector('.c-actions');
	actions.forEach(a=>{
		const btn = document.createElement('button');
		btn.textContent = a.label;
		btn.className = a.class || '';
		btn.dataset.id = consultation.id;
		btn.dataset.action = a.action;
		if(a.confirm) btn.dataset.confirm = '1';
		actionsContainer.appendChild(btn);
	});

	return tpl;
}

function renderQueue(){
	const listEl = elsAll.queueList; if(!listEl) return; listEl.innerHTML = '';
	const severityRank = s => ({'grave':3,'moderado':2,'leve':1}[s] || 0);
	const sorted = consultations.slice().sort((a,b)=>{ const ra = severityRank(b.severity) - severityRank(a.severity); if(ra !== 0) return ra; return a.createdAt - b.createdAt; });
	const toShow = sorted.filter(c=> c.status === 'waiting' || c.status === 'in-progress');
	if(toShow.length === 0){ listEl.innerHTML = '<p>Nenhuma consulta na fila.</p>'; return; }

	toShow.forEach(c=>{
		const actions = [];

		// médicos só podem atender se não estiver atribuído a outro, e só podem finalizar se forem o atribuído
		if(currentRole === 'medico'){
			if(c.status === 'waiting'){
				if(!c.assignedTo || c.assignedTo === currentUser) actions.push({ label: 'Atender', action: 'attend', class: 'primary' });
				if(c.assignedTo === currentUser) actions.push({ label: 'Finalizar', action: 'finalize', class: 'success', confirm: true });
			}
			if(c.status === 'in-progress'){
				if(c.assignedTo === currentUser) actions.push({ label: 'Finalizar', action: 'finalize', class: 'success', confirm: true });
			}
			actions.push({ label: 'Ver', action: 'view', class: '' });
		}

		// moderador pode ver, excluir, reabrir e atribuir — mas não finalizar
		if(currentRole === 'moderador'){
			actions.push({ label: 'Excluir', action: 'delete', class: 'danger', confirm: true });
			actions.push({ label: 'Reabrir', action: 'reopen', class: '' });
			actions.push({ label: 'Atribuir a mim', action: 'assign', class: '' });
			actions.push({ label: 'Ver', action: 'view', class: '' });
		}

		const node = createCard(c, actions);
		listEl.appendChild(node);
	});

	listEl.querySelectorAll('button').forEach(b=> b.addEventListener('click', onAction));
}

function renderModeratorList(){ const el = elsAll.moderatorList; if(!el) return; el.innerHTML = ''; const sorted = consultations.slice().sort((a,b)=> b.createdAt - a.createdAt); if(sorted.length === 0){ el.innerHTML = '<p>Nenhuma consulta registrada.</p>'; return; } sorted.forEach(c=>{ const actions = [ { label: 'Excluir', action: 'delete', class: 'danger', confirm: true }, { label: 'Reabrir', action: 'reopen', class: '' }, { label: 'Atribuir a mim', action: 'assign', class: '' } ]; const node = createCard(c, actions); el.appendChild(node); }); el.querySelectorAll('button').forEach(b=> b.addEventListener('click', onAction)); }

function onAction(e){ const btn = e.currentTarget; const id = btn.dataset.id; const action = btn.dataset.action; if(btn.dataset.confirm && !confirm('Confirma?')) return; if(action === 'attend') return attend(id); if(action === 'finalize') return finalize(id); if(action === 'delete') return removeConsult(id); if(action === 'reopen') return reopen(id); if(action === 'assign') return assignToMe(id); if(action === 'view') return viewDetail(id); }

function attend(id){ const c = consultations.find(x=> x.id === id); if(!c) return; if(c.assignedTo && c.assignedTo !== currentUser){ alert('Esta consulta já está atribuída a outro médico: ' + c.assignedTo); return; } c.status = 'in-progress'; c.assignedTo = currentUser || 'Médico'; save(); render(); }

function finalize(id){
	const c = consultations.find(x=> x.id === id);
	if(!c) return;
	// permitir finalizar apenas se for o médico atribuído
	if(currentRole === 'medico' && c.assignedTo === currentUser){
		c.status = 'closed';
		c.closedBy = currentUser;
		c.closedAt = Date.now();
		save();
		render();
	} else {
		alert('Apenas o médico que atendeu (médico atribuído) pode encerrar esta consulta.');
	}
}

function removeConsult(id){ consultations = consultations.filter(x=> x.id !== id); save(); render(); }
function reopen(id){
	const c = consultations.find(x=> x.id === id);
	if(!c) return;
	c.status = 'waiting';
	c.assignedTo = null;
	// limpar dados de encerramento
	delete c.closedBy;
	delete c.closedAt;
	save();
	render();
}
function assignToMe(id){ const c = consultations.find(x=> x.id === id); if(!c) return; c.assignedTo = currentUser || 'Moderador'; c.status = 'in-progress'; save(); render(); }

function viewDetail(id){ const c = consultations.find(x=> x.id === id); if(!c) return; alert('Consulta de: ' + (c.name || '-') + '\n\nO que: ' + c.what + '\nSintomas: ' + c.symptoms + '\nGravidade: ' + c.severity + '\nContato: ' + c.contact + (c.requestedSpecialty ? ('\nEspecialidade solicitada: ' + c.requestedSpecialty) : '')); }

function render(){ if(elsAll.patientSection) elsAll.patientSection.classList.toggle('hidden', currentRole !== 'paciente'); if(elsAll.doctorSection) elsAll.doctorSection.classList.toggle('hidden', currentRole !== 'medico'); if(elsAll.moderatorSection) elsAll.moderatorSection.classList.toggle('hidden', currentRole !== 'moderador'); renderQueue(); renderModeratorList(); renderDoctors(); renderModeratorDoctors(); updateSpecialtyOptions(); }

function render(){
	if(elsAll.patientSection) elsAll.patientSection.classList.toggle('hidden', currentRole !== 'paciente');
	if(elsAll.doctorSection) elsAll.doctorSection.classList.toggle('hidden', currentRole !== 'medico');
	if(elsAll.moderatorSection) elsAll.moderatorSection.classList.toggle('hidden', currentRole !== 'moderador');
	// doctor modal opener visible only for logged doctor
	if(elsAll.editDoctorBtn) elsAll.editDoctorBtn.style.display = (currentRole === 'medico') ? 'inline-block' : 'none';

	// ensure doctor modal hidden when not doctor
	if(elsAll.doctorModal && currentRole !== 'medico') elsAll.doctorModal.style.display = 'none';

	// edit moderator button visible only for moderator
	if(elsAll.editModerator) elsAll.editModerator.style.display = (currentRole === 'moderador') ? 'inline-block' : 'none';

	// comms button visible to médicos and moderador
	if(elsAll.commsBtn) elsAll.commsBtn.style.display = (currentRole === 'medico' || currentRole === 'moderador') ? 'inline-block' : 'none';
	// update unread badge
	updateCommsBadge();

	// ensure modal hidden when not moderator
	if(elsAll.moderatorModal && currentRole !== 'moderador') elsAll.moderatorModal.style.display = 'none';

	// set avatar preview for logged doctor
	if(currentRole === 'medico' && currentUserId && elsAll.doctorAvatarPreview){
		const doc = doctors.find(d => d.id_doctor === currentUserId || d.id === currentUserId);
		elsAll.doctorAvatarPreview.src = (doc && doc.avatar) ? doc.avatar : '';
	} else if(elsAll.doctorAvatarPreview){
		elsAll.doctorAvatarPreview.src = '';
	}

	// show moderator info (avatar + name) only to médicos
	if(currentRole === 'medico' && elsAll.moderatorInfo){
		const mName = localStorage.getItem('moderator_display_v1') || 'Moderador';
		const mAvatar = localStorage.getItem('moderator_avatar_v1') || '';
		if(elsAll.moderatorInfoAvatar) elsAll.moderatorInfoAvatar.src = mAvatar;
		if(elsAll.moderatorInfoName) elsAll.moderatorInfoName.textContent = mName;
		elsAll.moderatorInfo.style.display = (mAvatar || mName) ? 'flex' : 'none';
	} else if(elsAll.moderatorInfo){
		elsAll.moderatorInfo.style.display = 'none';
	}

	renderQueue(); renderModeratorList(); renderDoctors(); renderModeratorDoctors(); updateSpecialtyOptions();
}

// populate recipients select dynamically: general, moderator, and private doctor entries (visible when moderator)
function populateCommsRecipients(){
	if(!elsAll.commsTo) return;
	elsAll.commsTo.innerHTML = '';
	// add "moderator" option for médicos (so they can message the moderator). Moderator shouldn't message themself.
	if(currentRole !== 'moderador'){
		const optMod = document.createElement('option'); optMod.value = 'moderator'; optMod.textContent = 'Moderador (privado)'; elsAll.commsTo.appendChild(optMod);
	}
	// list doctors so moderator and médicos can message specific doctors; médicos won't see themselves in the list
	if(doctors && doctors.length){
		const sep = document.createElement('option'); sep.disabled = true; sep.textContent = '--- Médicos (privado) ---'; elsAll.commsTo.appendChild(sep);
		doctors.forEach(d=>{
			if(currentRole === 'medico' && currentUserId && d.id_doctor === currentUserId) return;
			const o = document.createElement('option'); o.value = 'private:' + d.id_doctor; o.textContent = 'Privado: ' + d.name; elsAll.commsTo.appendChild(o);
		});
	}
}

// handler para atualizar senha do moderador (disponível apenas quando logado como moderador)
if(elsAll.moderatorSettings) elsAll.moderatorSettings.addEventListener('submit', (e)=>{
	e.preventDefault();
	if(currentRole !== 'moderador'){ alert('Você precisa estar logado como moderador para alterar a senha.'); return; }
	const np = (elsAll.mod_new_pass && elsAll.mod_new_pass.value) || '';
	const nid = (elsAll.mod_id && elsAll.mod_id.value || '').trim();
	const nd = (elsAll.mod_display_name && elsAll.mod_display_name.value || '').trim();
	if(!np && !nid && !nd && !moderatorAvatarDataUrl){ alert('Informe nova senha, novo id, novo nome ou selecione uma nova foto para atualizar.'); return; }
	if(np){ localStorage.setItem(MODERATOR_PASS_KEY, np); elsAll.mod_new_pass.value = ''; }
	if(nid){ localStorage.setItem(MODERATOR_ID_KEY, nid); if(elsAll.mod_id) elsAll.mod_id.value = ''; }
	if(nd){ localStorage.setItem('moderator_display_v1', nd); if(elsAll.mod_display_name) elsAll.mod_display_name.value = ''; if(currentRole === 'moderador') setRole('moderador', nd); }
	if(moderatorAvatarDataUrl){ localStorage.setItem('moderator_avatar_v1', moderatorAvatarDataUrl); moderatorAvatarDataUrl = null; if(elsAll.mod_avatar_input) try{ elsAll.mod_avatar_input.value = ''; }catch(e){} }
	// hide modal after save
	if(elsAll.moderatorModal) elsAll.moderatorModal.style.display = 'none';
	alert('Configurações do moderador atualizadas.');
});

// doctor avatar preview on file select (preview only)
if(elsAll.doctorAvatarInput && elsAll.doctorAvatarPreview){
	elsAll.doctorAvatarInput.addEventListener('change', ()=>{
		handleDoctorAvatarInput(elsAll.doctorAvatarInput, elsAll.doctorAvatarPreview, null);
	});
}

// save avatar to the logged doctor profile
if(elsAll.saveAvatar){
	elsAll.saveAvatar.addEventListener('click', ()=>{
		if(currentRole !== 'medico' || !currentUserId){ alert('Você precisa estar logado como médico para alterar sua foto.'); return; }
		if(!elsAll.doctorAvatarInput || !elsAll.doctorAvatarInput.files || !elsAll.doctorAvatarInput.files[0]){ alert('Selecione um arquivo de imagem primeiro.'); return; }
		handleDoctorAvatarInput(elsAll.doctorAvatarInput, elsAll.doctorAvatarPreview, currentUserId);
		// clear file input
		try{ elsAll.doctorAvatarInput.value = ''; }catch(e){}
	});
}

// inicializa
updateSpecialtyOptions(); render();
