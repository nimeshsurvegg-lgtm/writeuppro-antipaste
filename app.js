// --- HELPER FUNCTIONS ---
function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3200);
}

function fireConfetti() {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    for(let i=0; i<60; i++) {
        let div = document.createElement('div');
        div.style.position = 'fixed'; div.style.zIndex = '9999';
        div.style.width = '8px'; div.style.height = '8px'; div.style.borderRadius = '2px';
        div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        div.style.left = Math.random() * 100 + 'vw'; div.style.top = '-10px';
        div.style.transition = 'top 2.2s ease-in, transform 2.2s linear, opacity 2.2s';
        document.body.appendChild(div);
        setTimeout(() => { 
            div.style.top = '100vh'; 
            div.style.transform = `rotate(${Math.random()*720}deg) translateX(${Math.random()*120-60}px)`; 
            div.style.opacity = '0';
        }, 10);
        setTimeout(() => div.remove(), 2200);
    }
}

const groupBy = (array, keyFn) => array.reduce((acc, item) => { const key = keyFn(item); (acc[key] = acc[key] || []).push(item); return acc; }, {});

// --- DATABASE MAPS ---
const subjectCodeMap = {
    "Engineering Mathematics -I": "FE-MTH101", "Engineering Chemistry -I": "FE-CHM101", "Engineering Physics -I": "FE-PHY101", 
    "Basic Electrical Electronics": "FE-BEE101", "Engineering Mechanics": "FE-EME101", "E.V.S": "FE-EVS101", 
    "Engineering Mathematics Tutorial Lab - I": "FE-MTH101L", "Engineering Chemistry Lab -I": "FE-CHM101L",
    "Engineering Physics Lab -I": "FE-PHY101L", "Basic Electrical Electronics Lab": "FE-BEE101L", 
    "Engineering Mechanics Lab": "FE-EME101L", "Tutorial Lab - I": "FE-TUT101L", "Physics Lab - I": "FE-PHY101L", 
    "Engineering Mathematics -II": "FE-MTH102", "Engineering Chemistry -II": "FE-CHM102", "Engineering Physics -II": "FE-PHY102", 
    "Digital Electronics": "FE-DEL102", "Engineering Graphics": "FE-EGR102", "I.K.S": "FE-IKS102", 
    "Engineering Mathematics Tutorial Lab - II": "FE-MTH102L", "Engineering Chemistry Lab -II": "FE-CHM102L",
    "Engineering Physics Lab -II": "FE-PHY102L", "Digital Electronics Lab": "FE-DEL102L", "Engineering Graphics Lab": "FE-EGR102L",
    "Tutorial Lab - II": "FE-TUT102L", "Graphics Lab": "FE-EGR102L",
    "Computer Organisation": "CE-CO201", "Computer Organisation Lab": "CE-CO201L",
    "Data structure": "CE-DS201", "Data structure Lab": "CE-DS201L", 
    "Database management system": "CE-DB201", "Database management system Lab": "CE-DB201L",
    "Entrepreneurship development": "CE-ED201", 
    "Discrete Computational Mathematics": "IT-DCM201", "Computer Networks": "IT-CN201", "Computer Networks Lab": "IT-CN201L",
    "Java Programming lab": "IT-JAV201L", "Python Programming lab": "IT-PYT201L", 
    "Professional Communication": "IT-PRC201", "Design Thinking": "IT-DST201", "Universal Humal Values": "IT-UHV201", 
    "Beginner French": "OE-FRN1", "Beginner Germany": "OE-GER1", "Digital Video Recording": "OE-DVR1", 
    "TE Subject 1": "TE-SUB301", "BE Subject 1": "BE-SUB401"
};

const curriculum = {
    "FE": { branches: ["ASH"], semesters: { "1": { subjects: ["Engineering Mathematics -I", "Engineering Chemistry -I", "Engineering Physics -I", "Basic Electrical Electronics", "Engineering Mechanics", "E.V.S", "Tutorial Lab - I", "Physics Lab - I"], electives: [] }, "2": { subjects: ["Engineering Mathematics -II", "Engineering Chemistry -II", "Engineering Physics -II", "Digital Electronics", "Engineering Graphics", "I.K.S", "Tutorial Lab - II", "Graphics Lab"], electives: [] } } },
    "SE": { branches: ["CE", "IT"], semesters: { "3": { subjects: ["Engineering Mathematics -II", "Computer Organisation", "Data structure", "Database management system", "Entrepreneurship development"], electives: ["Beginner French", "Beginner Germany", "Digital Video Recording"] }, "4": { subjects: ["Discrete Computational Mathematics", "Computer Networks", "Java Programming lab", "Python Programming lab", "Professional Communication", "Design Thinking", "Universal Humal Values"], electives: ["Beginner French", "Beginner Germany", "Digital Video Recording"] } } },
    "TE": { branches: ["CE", "IT"], semesters: { "5": { subjects: ["TE Subject 1"], electives: [] }, "6": { subjects: ["TE Subject 2"], electives: []} } },
    "BE": { branches: ["CE", "IT"], semesters: { "7": { subjects: ["BE Subject 1"], electives: [] }, "8": { subjects: ["BE Subject 2"], electives: []} } }
};

// --- CORE APPLICATION LOGIC ---
const app = {
    state: { user: null, docs: [], profiles: [], cheatLogs: 0 },
    currentEditId: null, currentGradeId: null,
    autoSaveTimer: null, currentZoom: 1, isFullscreen: false,
    canvasCtx: null, isDrawing: false, hasUnsavedChanges: false, lastKeystroke: 0, keystrokeBurst: 0,

    init() {
        if(!localStorage.getItem('writeup_docs')) {
            localStorage.setItem('writeup_docs', JSON.stringify([])); 
            localStorage.setItem('writeup_profiles', JSON.stringify([])); 
            localStorage.setItem('writeup_cheats', '0');
        }
        this.state.docs = JSON.parse(localStorage.getItem('writeup_docs'));
        this.state.profiles = JSON.parse(localStorage.getItem('writeup_profiles'));
        this.state.cheatLogs = parseInt(localStorage.getItem('writeup_cheats')) || 0;
        
        if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

        const session = sessionStorage.getItem('writeup_user');
        if(session) { this.state.user = JSON.parse(session); this.route(); }

        this.setupSecurity();
        this.setupCanvas();

        if(!sessionStorage.getItem('jury_guided')) {
            this.openJuryGuide();
            sessionStorage.setItem('jury_guided', 'true');
        }
    },

    openJuryGuide() { document.getElementById('jury-modal').classList.remove('hidden'); },
    closeJuryGuide() { document.getElementById('jury-modal').classList.add('hidden'); },

    quickLogin(role) {
        this.closeJuryGuide();
        document.getElementById('username').value = role;
        document.getElementById('password').value = 'password';
        this.login();
    },

    setupSecurity() {
        const editor = document.getElementById('rich-editor');
        const blockEvent = (e) => { e.preventDefault(); this.logCheat(); showToast("Security Violation: Pasting text is disabled.", "error"); };
        editor.addEventListener('paste', blockEvent); editor.addEventListener('drop', blockEvent);
        
        window.addEventListener('blur', () => {
            if (this.state.user?.role === 'student' && !document.getElementById('editor-view').classList.contains('hidden') && editor.getAttribute('contenteditable') === 'true') {
                this.logCheat(); showToast("Security Flag: Window/Tab switch detected.", "error");
            }
        });

        editor.addEventListener('input', () => { this.hasUnsavedChanges = true; this.updateWordCount(); });
        
        editor.addEventListener('keydown', () => {
            let now = Date.now();
            if (now - this.lastKeystroke < 30) this.keystrokeBurst++; else this.keystrokeBurst = 0;
            if(this.keystrokeBurst > 15) { this.logCheat(); showToast("Security Alert: Unnatural typing burst logged.", "error"); this.keystrokeBurst = 0; }
            this.lastKeystroke = now;
        });

        window.addEventListener('keydown', (e) => {
            if(e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if(!document.getElementById('editor-view').classList.contains('hidden') && editor.getAttribute('contenteditable') === 'true') {
                    this.saveDocument('draft', true); showToast("Draft auto-saved via shortcut.");
                }
            }
        });

        window.addEventListener('beforeunload', (e) => { if(this.hasUnsavedChanges) e.returnValue = 'You have unsaved document changes.'; });
    },

    saveData() {
        localStorage.setItem('writeup_docs', JSON.stringify(this.state.docs));
        localStorage.setItem('writeup_profiles', JSON.stringify(this.state.profiles));
        localStorage.setItem('writeup_cheats', this.state.cheatLogs.toString());
    },
    
    logCheat() { this.state.cheatLogs++; this.saveData(); },

    toggleDarkMode() { 
        document.body.classList.toggle('dark-mode'); 
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
    },

    login() {
        const u = document.getElementById('username').value.toLowerCase();
        const p = document.getElementById('password').value;
        if (p !== 'password') return showToast("Use 'password' as password", "error");
        
        if (u === 'admin') this.state.user = { role: 'admin', id: 'admin', name: 'Administrator' };
        else if (u === 'faculty') this.state.user = { role: 'faculty', id: 'faculty', name: 'Prof. Smith' };
        else if (u === 'student') this.state.user = { role: 'student', id: 'student1', name: 'Demo Student' };
        else return showToast("Use admin, faculty, or student", "error");
        
        sessionStorage.setItem('writeup_user', JSON.stringify(this.state.user)); 
        showToast(`Authenticated as ${this.state.user.name}`);
        this.route();
    },
    
    logout() { 
        sessionStorage.removeItem('writeup_user'); this.state.user = null; this.route(); 
        ['username', 'password'].forEach(id => document.getElementById(id).value = ''); 
    },

    route() {
        ['login-view', 'admin-view', 'student-view', 'faculty-view', 'editor-view', 'user-info'].forEach(id => document.getElementById(id).classList.add('hidden'));
        if (!this.state.user) return document.getElementById('login-view').classList.remove('hidden');
        
        document.getElementById('user-info').classList.remove('hidden');
        document.getElementById('welcome-text').innerText = this.state.user.name;
        document.getElementById('role-text').innerText = this.state.user.role.toUpperCase();
        document.getElementById('user-avatar').innerText = this.state.user.name.charAt(0).toUpperCase();

        if (this.state.user.role === 'admin') { document.getElementById('admin-view').classList.remove('hidden'); this.renderAdmin(); } 
        else if (this.state.user.role === 'student') { document.getElementById('student-view').classList.remove('hidden'); this.renderStudent(); } 
        else if (this.state.user.role === 'faculty') { document.getElementById('faculty-view').classList.remove('hidden'); this.renderFaculty(); }
    },

    // --- ADMIN LOGIC ---
    renderAdmin() {
        document.getElementById('stat-stu').innerText = this.state.profiles.length;
        document.getElementById('stat-sub').innerText = this.state.docs.filter(d=>d.status==='submitted').length;
        document.getElementById('stat-grad').innerText = this.state.docs.filter(d=>d.status==='graded').length;
        document.getElementById('stat-cheat').innerText = this.state.cheatLogs;

        const sortType = document.getElementById('admin-sort').value;
        let sortedProfiles = [...this.state.profiles].sort((a, b) => {
            if(sortType === 'name') return a.name.localeCompare(b.name);
            if(sortType === 'status') return a.status.localeCompare(b.status);
            if(sortType === 'roll') return parseInt(a.roll) - parseInt(b.roll);
            return 0;
        });

        const classGroups = groupBy(sortedProfiles, p => `${p.year} - ${p.branch} (Div ${p.div})`);
        const container = document.getElementById('admin-folders-container');
        container.innerHTML = '';

        if(Object.keys(classGroups).length === 0) {
            container.innerHTML = '<div class="card"><p style="margin:0; color:var(--text-light);">No student profiles registered yet.</p></div>'; return;
        }

        for (let className in classGroups) {
            const students = classGroups[className];
            const pendingCount = students.filter(s => s.status === 'pending').length;
            
            let tableHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Roll No</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
            
            students.forEach(p => {
                let badgeColor = p.status === 'approved' ? 'var(--success)' : (p.status === 'blocked' || p.status === 'rejected' ? 'var(--danger)' : 'var(--warning)');
                let actions = '';
                if(p.status === 'pending' || p.status === 'rejected') actions += `<button class="success" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="app.setProfileStatus('${p.id}', 'approved')">Approve</button> `;
                if(p.status === 'pending') actions += `<button class="outline" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="app.rejectProfile('${p.id}')">Revert/Reject</button> `;
                if(p.status === 'approved') actions += `<button class="danger" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="app.setProfileStatus('${p.id}', 'blocked')">Block Access</button> `;
                if(p.status === 'blocked') actions += `<button class="outline" style="padding:0.35rem 0.75rem; font-size:0.8rem; color:var(--text);" onclick="app.setProfileStatus('${p.id}', 'approved')">Unblock</button> `;

                tableHTML += `<tr>
                    <td><strong>${p.name}</strong></td><td>${p.roll}</td>
                    <td><span class="status-badge" style="background:${badgeColor}; color:${(p.status==='pending')?'#000':'#fff'}">${p.status.toUpperCase()}</span></td>
                    <td>${actions}</td>
                </tr>`;
            });
            tableHTML += `</tbody></table>`;

            container.innerHTML += `
                <details class="folder" ${pendingCount > 0 ? 'open' : ''}>
                    <summary>📁 ${className} 
                        ${pendingCount > 0 ? `<span class="badge" style="background:var(--warning); color:#000;">${pendingCount} Pending</span>` : ''}
                        <span class="badge">${students.length} Students</span>
                    </summary>
                    <div class="folder-content">${tableHTML}</div>
                </details>
            `;
        }
    },
    
    setProfileStatus(id, status) {
        let p = this.state.profiles.find(x => x.id === id);
        if(p) { p.status = status; this.saveData(); this.renderAdmin(); showToast(`Student profile marked as ${status}`); }
    },

    rejectProfile(id) {
        let p = this.state.profiles.find(x => x.id === id);
        if(p) { 
            let reason = prompt("Enter discrepancy/remarks for reverting this profile:", "Incomplete or incorrect details provided.");
            if(reason !== null) {
                p.status = 'rejected'; 
                p.remark = reason;
                this.saveData(); 
                this.renderAdmin(); 
                showToast(`Student application reverted with remarks.`); 
            }
        }
    },

    exportCSV() {
        const graded = this.state.docs.filter(d => d.status === 'graded');
        if(!graded.length) return showToast("No graded documents available to export", "error");
        
        let csv = "Roll No,Student Name,Subject,Document Type,Marks Scored,Max Marks\n";
        graded.forEach(d => {
            const stu = this.state.profiles.find(p => p.id === d.studentId);
            const max = d.type === 'Assignment' ? 10 : 15;
            csv += `${stu ? stu.roll : '-'},${stu ? stu.name : 'Unknown'},${d.subject},${d.type},${d.marks},${max}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'WriteUp_Grading_Ledger.csv';
        a.click(); window.URL.revokeObjectURL(url);
        showToast("Grading Ledger CSV Exported");
    },

    // --- STUDENT LOGIC ---
    renderStudent() {
        document.getElementById('student-setup').classList.add('hidden');
        document.getElementById('student-blocked').classList.add('hidden');
        document.getElementById('student-dashboard').classList.add('hidden');
        document.getElementById('rejection-alert').classList.add('hidden');
        let pmsg = document.getElementById('pending-msg'); if(pmsg) pmsg.remove();

        const profile = this.state.profiles.find(p => p.id === this.state.user.id);
        
        if (!profile || profile.status === 'rejected') { 
            document.getElementById('student-setup').classList.remove('hidden'); 
            
            if (profile && profile.status === 'rejected') {
                document.getElementById('rejection-alert').classList.remove('hidden');
                document.getElementById('rejection-reason').innerText = "Remarks: " + (profile.remark || "Please review your details and reapply.");
                
                // Prefill data for easy correction
                document.getElementById('stu-name').value = profile.name;
                document.getElementById('stu-roll').value = profile.roll;
                document.getElementById('stu-year').value = profile.year;
                document.getElementById('stu-branch').value = profile.branch;
                document.getElementById('stu-sem').value = profile.sem;
                document.getElementById('stu-div').value = profile.div;
                this.loadCurriculumDropdowns();
                setTimeout(() => {
                    if(profile.elective) document.getElementById('stu-elective').value = profile.elective;
                }, 50);
            }
        }
        else if (profile.status === 'pending') { 
            document.getElementById('student-view').insertAdjacentHTML('beforeend', '<div class="card" id="pending-msg"><h3>Pending Verification</h3><p style="color:var(--text-light);">Your academic profile is awaiting administrator approval. You will gain access to your workspace once verified.</p></div>'); 
        }
        else if (profile.status === 'blocked') {
            document.getElementById('student-blocked').classList.remove('hidden');
        }
        else { 
            document.getElementById('student-dashboard').classList.remove('hidden'); 
            this.renderStudentDashboard(profile); 
        }
    },
    
    loadCurriculumDropdowns() {
        const y = document.getElementById('stu-year').value, b = document.getElementById('stu-branch').value, s = document.getElementById('stu-sem').value;
        if(!y || !b || !s) return;
        const data = curriculum[y];
        if(data && data.semesters[s] && data.semesters[s].electives.length > 0) {
            document.getElementById('open-elective-container').classList.remove('hidden');
            document.getElementById('stu-elective').innerHTML = '<option value="">Select Open Elective</option>' + data.semesters[s].electives.map(e => `<option value="${e}">${e}</option>`).join('');
        } else document.getElementById('open-elective-container').classList.add('hidden');
    },
    
    submitStudentProfile() {
        const p = { id: this.state.user.id, name: document.getElementById('stu-name').value, roll: document.getElementById('stu-roll').value, year: document.getElementById('stu-year').value, branch: document.getElementById('stu-branch').value, sem: document.getElementById('stu-sem').value, div: document.getElementById('stu-div').value, elective: document.getElementById('stu-elective').value || null, status: 'pending', remark: '' };
        if(!p.name || !p.roll || !p.year || !p.branch || !p.sem || !p.div) return showToast("Please fill all profile fields", "error");
        this.state.profiles = this.state.profiles.filter(x => x.id !== p.id); this.state.profiles.push(p); this.saveData(); this.renderStudent(); showToast("Profile submitted for verification.");
    },
    
    renderStudentDashboard(profile) {
        if(!profile) profile = this.state.profiles.find(p => p.id === this.state.user.id);
        
        // Show profile summary
        document.getElementById('stu-profile-summary').innerText = `${profile.name} • Roll: ${profile.roll} • ${profile.year} ${profile.branch} (Div ${profile.div}) • Sem ${profile.sem}`;

        const search = document.getElementById('stu-search').value.toLowerCase();
        const sortType = document.getElementById('student-sort').value;
        
        // Subject-wise Averages separated by Assignment & Experiment
        const gradedDocs = this.state.docs.filter(d => d.studentId === profile.id && d.status === 'graded');
        const subjectGroups = groupBy(gradedDocs, d => d.subject);
        
        let avgHTML = '<h4 style="margin-top:0; margin-bottom:12px; color:var(--secondary); border-bottom:1px solid var(--border); padding-bottom:8px; font-size:1rem;">Subject Score Breakdown</h4>';
        
        if (Object.keys(subjectGroups).length === 0) {
            avgHTML += '<p style="color:var(--text-light); text-align:center; font-size:0.85rem; margin-top:15px;">No graded documents available yet to calculate average performance.</p>';
        } else {
            avgHTML += '<div style="display:flex; flex-direction:column; gap:8px;">';
            for(let sub in subjectGroups) {
                let docs = subjectGroups[sub];
                let assigns = docs.filter(d => d.type === 'Assignment');
                let exps = docs.filter(d => d.type === 'Experiment');
                
                let aAvg = assigns.length ? (assigns.reduce((s, d) => s + parseInt(d.marks), 0) / assigns.length).toFixed(1) : '--';
                let eAvg = exps.length ? (exps.reduce((s, d) => s + parseInt(d.marks), 0) / exps.length).toFixed(1) : '--';
                
                avgHTML += `
                    <div style="background:var(--bg); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border);">
                        <strong style="font-size:0.85rem; flex:1; color:var(--secondary);">${sub}</strong>
                        <div style="display:flex; gap:1.5rem; justify-content:flex-end; flex:1;">
                            <div style="text-align:right;">
                                <span style="font-size:0.7rem; color:var(--text-light); display:block; text-transform:uppercase; font-weight:700;">Assign</span>
                                <b style="color:var(--primary); font-size:1.05rem;">${aAvg !== '--' ? aAvg+'/10' : '--'}</b>
                            </div>
                            <div style="text-align:right;">
                                <span style="font-size:0.7rem; color:var(--text-light); display:block; text-transform:uppercase; font-weight:700;">Expt</span>
                                <b style="color:var(--primary); font-size:1.05rem;">${eAvg !== '--' ? eAvg+'/15' : '--'}</b>
                            </div>
                        </div>
                    </div>`;
            }
            avgHTML += '</div>';
        }
        document.getElementById('stu-avg-container').innerHTML = avgHTML;

        const data = curriculum[profile.year].semesters[profile.sem];
        let subjects = [...data.subjects]; if(profile.elective) subjects.push(profile.elective);
        document.getElementById('doc-subject').innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join('');

        let myDocs = this.state.docs.filter(d => d.studentId === profile.id);
        if(search) myDocs = myDocs.filter(d => d.title.toLowerCase().includes(search) || d.subject.toLowerCase().includes(search));

        // Sort logic
        myDocs.sort((a, b) => {
            if(sortType === 'status') return a.status.localeCompare(b.status);
            if(sortType === 'subject') return a.subject.localeCompare(b.subject);
            let timeA = parseInt(a.id.split('_')[1] || 0); let timeB = parseInt(b.id.split('_')[1] || 0);
            return sortType === 'date_asc' ? timeA - timeB : timeB - timeA; 
        });

        const list = document.getElementById('student-docs-list');
        if(myDocs.length === 0) { list.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-light);"><h3>No documents authored yet</h3><p>Click "+ Create Document" to start drafting.</p></div>'; return; }

        list.innerHTML = `<table class="data-table"><thead><tr><th>Title</th><th>Subject</th><th>Status</th><th>Marks Scored</th><th>Action</th></tr></thead><tbody>` + 
            myDocs.map(d => `<tr><td><strong>${d.title}</strong></td><td>${d.subject}</td>
                <td><span class="status-badge" style="background:${d.status==='graded'?'#d1fae5':d.status==='submitted'?'#e0e7ff':'#f1f5f9'}; color:${d.status==='graded'?'#065f46':d.status==='submitted'?'#3730a3':'#475569'}">${d.status}</span></td>
                <td>${d.marks !== null ? `<b style="color:var(--primary); font-size:1.1rem;">${d.marks}</b>` : '-'}</td>
                <td><button style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="app.openEditor('${d.id}')">Open Workspace</button>
                <button class="outline" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="app.duplicateDoc('${d.id}')">Duplicate</button></td></tr>`).join('') + `</tbody></table>`;
    },

    autoFillSubjectCode() {
        const sub = document.getElementById('doc-subject').value;
        let mappedCode = subjectCodeMap[sub];
        if(!mappedCode) {
            let acronym = sub.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('').substring(0, 3);
            let isLab = sub.toLowerCase().includes('lab') ? 'L' : '';
            mappedCode = `SYS-${acronym}20X${isLab}`;
        }
        document.getElementById('doc-subject-code').value = mappedCode;
        this.updateCoverPageUI();
    },

    // --- EDITOR LOGIC ---
    openEditor(docId) {
        document.getElementById('student-view').classList.add('hidden'); 
        document.getElementById('editor-view').classList.remove('hidden');
        const editor = document.getElementById('rich-editor');
        this.hasUnsavedChanges = false;

        if(docId) {
            this.currentEditId = docId; const doc = this.state.docs.find(d => d.id === docId);
            document.getElementById('doc-title').value = doc.title; document.getElementById('doc-subject').value = doc.subject;
            document.getElementById('doc-type').value = doc.type; document.getElementById('doc-subject-code').value = doc.subCode || '';
            document.getElementById('doc-number').value = doc.docNum || ''; 
            document.getElementById('doc-date').value = doc.submissionDate ? "Submitted: " + doc.submissionDate : "Draft (Unsubmitted)";
            
            editor.innerHTML = doc.content;
            
            if(doc.status === 'graded' || doc.status === 'submitted') {
                editor.setAttribute('contenteditable', 'false');
                document.getElementById('editor-toolbar').classList.add('hidden'); 
                document.getElementById('editor-meta').classList.add('hidden');
                document.getElementById('btn-save-draft').classList.add('hidden'); 
                document.getElementById('btn-submit-final').classList.add('hidden');
            } else {
                this.unlockEditor();
            }
        } else {
            this.currentEditId = null; 
            ['doc-title', 'doc-number', 'doc-date'].forEach(id => document.getElementById(id).value = '');
            this.autoFillSubjectCode(); 
            editor.innerHTML = ''; this.unlockEditor();
        }
        
        const profile = this.state.profiles.find(p => p.id === this.state.user.id);
        document.getElementById('pdf-watermark').innerText = `${profile.name}\nRoll: ${profile.roll}\n${new Date().toLocaleDateString()}`;
        
        this.updateCoverPageUI(); this.updateWordCount();
        
        clearInterval(this.autoSaveTimer);
        if(!docId || this.state.docs.find(d => d.id === docId).status === 'draft') {
            this.autoSaveTimer = setInterval(() => { if(document.getElementById('doc-title').value) this.saveDocument('draft', true); }, 30000);
        }
    },
    
    unlockEditor() {
        document.getElementById('rich-editor').setAttribute('contenteditable', 'true');
        ['editor-toolbar', 'editor-meta', 'btn-save-draft', 'btn-submit-final'].forEach(id => document.getElementById(id).classList.remove('hidden'));
        document.getElementById('auto-save-status').innerText = "Status: Editing...";
    },

    updateCoverPageUI() {
        let doc = null; if(this.currentEditId) doc = this.state.docs.find(d => d.id === this.currentEditId);
        const profile = this.state.profiles.find(p => p.id === (doc ? doc.studentId : this.state.user.id));
        const type = document.getElementById('doc-type').value, title = document.getElementById('doc-title').value;
        const sub = document.getElementById('doc-subject').value, subCode = document.getElementById('doc-subject-code').value;
        const docNum = document.getElementById('doc-number').value;
        
        let isGrading = (this.currentGradeId && doc && doc.status !== 'graded');
        
        let valK = doc && doc.scoreK !== undefined ? doc.scoreK : '';
        let valC = doc && doc.scoreC !== undefined ? doc.scoreC : '';
        let valP = doc && doc.scoreP !== undefined ? doc.scoreP : '';
        let valPerf = doc && doc.scorePerf !== undefined ? doc.scorePerf : '';

        let cellK = isGrading ? `<input type="number" id="rub-k" class="rubric-input" max="4" min="0" oninput="app.calcRubricTotal()">` : valK;
        let cellC = isGrading ? `<input type="number" id="rub-c" class="rubric-input" max="3" min="0" oninput="app.calcRubricTotal()">` : valC;
        let cellP = isGrading ? `<input type="number" id="rub-p" class="rubric-input" max="3" min="0" oninput="app.calcRubricTotal()">` : valP;
        let cellPerf = isGrading ? `<input type="number" id="rub-perf" class="rubric-input" max="5" min="0" oninput="app.calcRubricTotal()">` : valPerf;

        let dateStr = (doc && doc.submissionDate) ? doc.submissionDate : "Pending Submission...";
        let marksStr = (doc && doc.marks !== null) ? doc.marks : ""; 
        
        let signStr = "____________________";
        if(doc && doc.status === 'graded') {
            signStr = `<div class="digital-stamp">
                        Digitally evaluated by: <b>${doc.facultyName}</b><br>
                        Date: ${doc.evaluatedDate}<br>
                        Time: ${doc.evaluatedTime}
                       </div>`;
        }

        let html = `<h2>Academic Year: 2026-27</h2><p>Class: ${profile.year} - Div ${profile.div}</p><p>Subject: ${sub}</p><p>Subject Code: ${subCode}</p>`;
        if(type === 'Assignment') {
            html += `<table><tr><td style="width:30%"><strong>Assignment No.</strong></td><td>${docNum}</td></tr><tr><td><strong>Date of submission</strong></td><td>${dateStr}</td></tr><tr><td><strong>Roll No.</strong></td><td>${profile.roll}</td></tr><tr><td><strong>Name of the Student</strong></td><td>${profile.name}</td></tr></table>
                <p>Rubrics used for <u>Assignment Evaluation:</u></p>
                <table><tr><th></th><th>Below Expectations</th><th>Average</th><th>Good</th><th style="width:60px">Score</th></tr>
                <tr><td><strong>Knowledge (4)</strong></td><td align="center">2</td><td align="center">3</td><td align="center">4</td><td align="center">${cellK}</td></tr>
                <tr><td><strong>Content & Neatness (3)</strong></td><td align="center">1</td><td align="center">2</td><td align="center">3</td><td align="center">${cellC}</td></tr>
                <tr><td><strong>Punctuality (3)</strong></td><td align="center">1</td><td align="center">2</td><td align="center">3</td><td align="center">${cellP}</td></tr>
                <tr><td><strong>Total (10)</strong></td><td></td><td></td><td></td><td align="center"><strong id="rubric-total-display">${marksStr}</strong></td></tr></table>
                <table><tr><th></th><th>Below Exp</th><th>Average</th><th>Good</th></tr>
                <tr><td><strong>Know (4)</strong></td><td>Major points not clear. <strong>(2)</strong></td><td>Adequate. <strong>(3)</strong></td><td>Meaningful effort. <strong>(4)</strong></td></tr>
                <tr><td><strong>Content (3)</strong></td><td>Incomplete. <strong>(1)</strong></td><td>Accurate. <strong>(2)</strong></td><td>Comprehensive. <strong>(3)</strong></td></tr>
                <tr><td><strong>Time (3)</strong></td><td>Late. <strong>(1)</strong></td><td>Slight delay. <strong>(2)</strong></td><td>On time. <strong>(3)</strong></td></tr></table>`;
        } else {
            html += `<table><tr><td style="width:30%"><strong>Experiment No.</strong></td><td>${docNum}</td></tr><tr><td><strong>Title</strong></td><td>${title}</td></tr><tr><td><strong>Date of Performance</strong></td><td>${dateStr}</td></tr><tr><td><strong>Roll No.</strong></td><td>${profile.roll}</td></tr><tr><td><strong>Name of the Student</strong></td><td>${profile.name}</td></tr></table>
                <p>Rubrics used for <u>Laboratory Evaluation:</u></p>
                <table><tr><th></th><th>Below Expectations</th><th>Average</th><th>Good</th><th style="width:60px">Score</th></tr>
                <tr><td><strong>Knowledge (4)</strong></td><td align="center">2</td><td align="center">3</td><td align="center">4</td><td align="center">${cellK}</td></tr>
                <tr><td><strong>Performance (5)</strong></td><td align="center">2</td><td align="center">3</td><td align="center">5</td><td align="center">${cellPerf}</td></tr>
                <tr><td><strong>Content (3)</strong></td><td align="center">1</td><td align="center">2</td><td align="center">3</td><td align="center">${cellC}</td></tr>
                <tr><td><strong>Time (3)</strong></td><td align="center">1</td><td align="center">2</td><td align="center">3</td><td align="center">${cellP}</td></tr>
                <tr><td><strong>Total (15)</strong></td><td></td><td></td><td></td><td align="center"><strong id="rubric-total-display">${marksStr}</strong></td></tr></table>`;
        }
        html += `<div class="signature-block">Signature of Faculty: <div style="display:inline-block; min-width: 250px; text-align:center;">${signStr}</div></div>`;
        document.getElementById('cover-page-render').innerHTML = html;

        if(isGrading) this.calcRubricTotal(); 
    },

    calcRubricTotal() {
        let doc = this.state.docs.find(d => d.id === this.currentGradeId);
        if(!doc) return;
        
        let maxTotal = doc.type === 'Assignment' ? 10 : 15;
        
        let k = parseInt(document.getElementById('rub-k')?.value) || 0;
        let c = parseInt(document.getElementById('rub-c')?.value) || 0;
        let p = parseInt(document.getElementById('rub-p')?.value) || 0;
        let perf = parseInt(document.getElementById('rub-perf')?.value) || 0;
        
        let total = k + c + p + perf;
        
        let display = document.getElementById('rubric-total-display');
        let sideInput = document.getElementById('grade-marks');
        let btn = document.getElementById('btn-approve-grade');
        
        display.innerText = total;
        sideInput.value = total;
        
        let isInvalid = (total > maxTotal) || (k > 4) || (c > 3) || (p > 3) || (doc.type === 'Experiment' && perf > 5);
        
        if(isInvalid) {
            display.classList.add('invalid-total');
            btn.disabled = true;
            btn.innerText = "Invalid Rubric Scores";
        } else {
            display.classList.remove('invalid-total');
            btn.disabled = false;
            btn.innerText = "Digitally Sign & Approve";
        }
    },

    updateWordCount() {
        const text = document.getElementById('rich-editor').innerText || "";
        const words = text.trim().split(/\s+/).filter(x => x.length > 0).length;
        const goal = document.getElementById('word-goal').value || 500;
        let color = words >= goal ? 'var(--success)' : 'inherit';
        document.getElementById('word-count').innerHTML = `Words: <span style="color:${color};font-weight:bold;">${words}</span> / Goal: <input type="number" id="word-goal" value="${goal}" onchange="app.updateWordCount()" style="width:65px; padding:2px 6px; margin:0; display:inline;">`;
    },

    saveDocument(status, isAutoSave) {
        const title = document.getElementById('doc-title').value;
        if(!title && !isAutoSave) return showToast("Document Title is required.", "error"); 
        if(!title) return; 

        let subDate = document.getElementById('doc-date').value.replace("Submitted: ", "");
        if (status === 'submitted') subDate = new Date().toLocaleString('en-GB');
        else if (subDate === "Draft (Unsubmitted)" || subDate === "") subDate = null;

        const doc = {
            id: this.currentEditId || 'doc_' + Date.now(), studentId: this.state.user.id, 
            title: title, subject: document.getElementById('doc-subject').value, 
            type: document.getElementById('doc-type').value, docNum: document.getElementById('doc-number').value,
            subCode: document.getElementById('doc-subject-code').value, submissionDate: subDate,
            content: document.getElementById('rich-editor').innerHTML, status: status, marks: null, remarks: ''
        };
        
        if(this.currentEditId) {
            const idx = this.state.docs.findIndex(d => d.id === this.currentEditId);
            this.state.docs[idx] = Object.assign(this.state.docs[idx], doc);
        } else { this.state.docs.push(doc); this.currentEditId = doc.id; }
        
        this.saveData();
        this.hasUnsavedChanges = false;
        
        if(isAutoSave) {
            let d = new Date(); document.getElementById('auto-save-status').innerText = `Auto-saved at ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        } else {
            if(status === 'submitted') fireConfetti();
            showToast(`Document successfully ${status === 'draft' ? 'saved to drafts' : 'submitted'}.`);
            if(status === 'submitted') this.closeEditor();
        }
    },

    duplicateDoc(docId) {
        const original = this.state.docs.find(d => d.id === docId);
        const duplicate = JSON.parse(JSON.stringify(original));
        duplicate.id = 'doc_' + Date.now(); duplicate.title = duplicate.title + " (Copy)";
        duplicate.status = 'draft'; duplicate.marks = null; duplicate.submissionDate = null; 
        this.state.docs.push(duplicate); this.saveData(); this.renderStudent();
        showToast("Document duplicated successfully");
    },
    
    closeEditor() { 
        clearInterval(this.autoSaveTimer); 
        document.getElementById('editor-view').classList.add('hidden'); 
        document.getElementById('student-view').classList.remove('hidden'); 
        this.renderStudent(); 
    },

    // --- EDITOR ENHANCEMENTS ---
    zoomPage(val) {
        this.currentZoom = Math.max(0.5, Math.min(1.5, this.currentZoom + val));
        document.getElementById('a4-paper').style.transform = `scale(${this.currentZoom})`;
    },

    toggleFullscreen() {
        const header = document.getElementById('main-header');
        const meta = document.getElementById('editor-meta');
        this.isFullscreen = !this.isFullscreen;
        if(this.isFullscreen) { header.style.display = 'none'; meta.style.display = 'none'; }
        else { header.style.display = 'flex'; meta.style.display = 'grid'; }
    },

    insertTable() {
        const html = `<table style="width:100%; border-collapse:collapse; margin:15px 0;"><tbody><tr><td style="border:1px solid #000; padding:8px;">Header 1</td><td style="border:1px solid #000; padding:8px;">Header 2</td></tr><tr><td style="border:1px solid #000; padding:8px;">Data</td><td style="border:1px solid #000; padding:8px;">Data</td></tr></tbody></table><p><br></p>`;
        document.getElementById('rich-editor').focus();
        document.execCommand('insertHTML', false, html);
    },
    
    insertCodeBlock() {
        const editor = document.getElementById('rich-editor');
        editor.focus();
        const codeHTML = `<pre class="code-block" contenteditable="true"><code>// Type your code here
public class ApplicationCore {
    public static void main(String[] args) {
        System.out.println("Executing module...");
    }
}</code></pre><p><br></p>`;
        document.execCommand('insertHTML', false, codeHTML);
    },

    // --- CANVAS DRAWING TOOL ---
    setupCanvas() {
        const canvas = document.getElementById('drawing-canvas');
        this.canvasCtx = canvas.getContext('2d');
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.lineCap = 'round';
        this.canvasCtx.strokeStyle = '#000';

        canvas.addEventListener('mousedown', (e) => { this.isDrawing = true; this.canvasCtx.beginPath(); this.canvasCtx.moveTo(e.offsetX, e.offsetY); });
        canvas.addEventListener('mousemove', (e) => { if(this.isDrawing) { this.canvasCtx.lineTo(e.offsetX, e.offsetY); this.canvasCtx.stroke(); }});
        canvas.addEventListener('mouseup', () => { this.isDrawing = false; });
        canvas.addEventListener('mouseleave', () => { this.isDrawing = false; });
    },

    openCanvas() { document.getElementById('canvas-modal').classList.remove('hidden'); },
    closeCanvas() { document.getElementById('canvas-modal').classList.add('hidden'); },
    clearCanvas() { this.canvasCtx.clearRect(0, 0, 730, 400); },
    saveCanvas() {
        const dataURL = document.getElementById('drawing-canvas').toDataURL('image/png');
        document.getElementById('rich-editor').focus();
        document.execCommand('insertImage', false, dataURL);
        this.closeCanvas(); this.clearCanvas();
        showToast("Diagram inserted.");
    },

    // --- FACULTY LOGIC ---
    renderFaculty() {
        const search = document.getElementById('fac-search').value.toLowerCase();
        const container = document.getElementById('faculty-folders-container');
        let submissions = this.state.docs.filter(d => d.status === 'submitted' || d.status === 'graded');
        
        if(submissions.length === 0) {
            container.innerHTML = '<div class="card"><p style="margin:0; color:var(--text-light);">No student submissions available for evaluation.</p></div>'; return;
        }

        let enrichedDocs = submissions.map(d => {
            const stu = this.state.profiles.find(p => p.id === d.studentId);
            return { ...d, stuName: stu ? stu.name : 'Unknown', stuRoll: stu ? stu.roll : '-', className: stu ? `${stu.year} - ${stu.branch} (Div ${stu.div})` : 'Unknown Class' };
        });

        if(search) enrichedDocs = enrichedDocs.filter(d => d.stuName.toLowerCase().includes(search));

        const sortType = document.getElementById('faculty-sort').value;
        enrichedDocs.sort((a, b) => {
            if(sortType === 'name') return a.stuName.localeCompare(b.stuName);
            if(sortType === 'pending_first') return a.status === 'submitted' ? -1 : 1;
            if(sortType === 'graded_first') return a.status === 'graded' ? -1 : 1;
            return 0;
        });

        const classGroups = groupBy(enrichedDocs, d => d.className);
        container.innerHTML = '';

        for (let className in classGroups) {
            const docs = classGroups[className];
            const pendingCount = docs.filter(d => d.status === 'submitted').length;
            
            let tableHTML = `<table class="data-table"><thead><tr><th>Student</th><th>Roll No</th><th>Subject</th><th>Title</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
            
            docs.forEach(d => {
                tableHTML += `<tr>
                    <td><strong>${d.stuName}</strong></td><td>${d.stuRoll}</td>
                    <td>${d.subject}</td><td>${d.title}</td>
                    <td>${d.status === 'graded' ? `<span style="color:var(--success);font-weight:700;">Graded (${d.marks})</span>` : '<span class="status-badge" style="background:#e0e7ff; color:#3730a3">Pending</span>'}</td>
                    <td><button style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="app.openGradeView('${d.id}')">${d.status === 'graded' ? 'View Evaluation' : 'Evaluate'}</button></td>
                </tr>`;
            });
            tableHTML += `</tbody></table>`;

            container.innerHTML += `
                <details class="folder" ${pendingCount > 0 || search ? 'open' : ''}>
                    <summary>📁 ${className} 
                        ${pendingCount > 0 ? `<span class="badge" style="background:var(--warning); color:#000;">${pendingCount} Requires Evaluation</span>` : ''}
                        <span class="badge">${docs.length} Submissions</span>
                    </summary>
                    <div class="folder-content">${tableHTML}</div>
                </details>
            `;
        }
    },

    openGradeView(docId) {
        this.currentGradeId = docId; 
        document.getElementById('faculty-dashboard').classList.add('hidden'); 
        document.getElementById('faculty-grade-view').classList.remove('hidden');
        
        const doc = this.state.docs.find(d => d.id === docId); 
        const stu = this.state.profiles.find(p => p.id === doc.studentId);
        
        const tempId = this.currentEditId; this.currentEditId = docId;
        
        ['doc-type', 'doc-title', 'doc-subject', 'doc-subject-code', 'doc-number'].forEach(id => {
            if(document.getElementById(id)) {
                let prop = id.replace('doc-', '');
                if(prop === 'subject-code') prop = 'subCode'; if(prop === 'number') prop = 'docNum';
                document.getElementById(id).value = doc[prop] || '';
            }
        });
        
        this.updateCoverPageUI(); 
        const generatedCoverHTML = document.getElementById('cover-page-render').innerHTML; 
        this.currentEditId = tempId; 
        
        document.getElementById('read-only-doc').innerHTML = `<div class="cover-page">${generatedCoverHTML}</div> <div id="rich-editor" style="border-top: 2px dashed #cbd5e1; padding-top:20px;">${doc.content}</div>`;
        
        document.getElementById('grade-stu-name').innerText = stu.name; 
        document.getElementById('grade-type').innerText = doc.type;
        document.getElementById('grade-max').innerText = doc.type === 'Assignment' ? 10 : 15;
        
        // Plagiarism Simulator
        const plagBadge = document.getElementById('plag-badge');
        if(doc.status !== 'graded') {
            let score = Math.random() > 0.95 ? Math.floor(Math.random()*40)+60 : Math.floor(Math.random()*15);
            if(score > 50) { plagBadge.style.background = 'var(--danger)'; plagBadge.innerText = `⚠️ Plagiarism Warning: ${score}% Match`; }
            else { plagBadge.style.background = 'var(--success)'; plagBadge.innerText = `✓ Authenticity Verified: ${score}% match`; }
        } else {
            plagBadge.style.background = 'var(--text-light)'; plagBadge.innerText = "Evaluation Completed";
        }

        if(doc.status === 'graded') {
            document.getElementById('grade-marks').value = doc.marks;
            document.getElementById('btn-approve-grade').classList.add('hidden');
        } else {
            document.getElementById('grade-marks').value = "";
            document.getElementById('btn-approve-grade').classList.remove('hidden');
        }
    },
    
    closeFacultyEditor() { document.getElementById('faculty-grade-view').classList.add('hidden'); document.getElementById('faculty-dashboard').classList.remove('hidden'); this.renderFaculty(); this.currentGradeId = null; },
    
    submitGrade() {
        const doc = this.state.docs.find(d => d.id === this.currentGradeId);
        const mks = document.getElementById('grade-marks').value;
        const rem = document.getElementById('grade-remarks').value;
        const max = doc.type === 'Assignment' ? 10 : 15;
        
        if(mks === "" || mks < 0 || mks > max) return showToast("Enter valid scores in the cover page rubric table.", "error");
        
        doc.marks = mks; 
        doc.scoreK = document.getElementById('rub-k')?.value || 0;
        doc.scoreC = document.getElementById('rub-c')?.value || 0;
        doc.scoreP = document.getElementById('rub-p')?.value || 0;
        if(doc.type === 'Experiment') doc.scorePerf = document.getElementById('rub-perf')?.value || 0;
        
        doc.remarks = rem; 
        doc.status = 'graded';
        doc.facultyName = this.state.user.name;
        
        let now = new Date();
        doc.evaluatedDate = now.toLocaleDateString('en-GB');
        doc.evaluatedTime = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        this.saveData(); 
        showToast("Evaluation recorded. Digital stamp applied."); 
        this.closeFacultyEditor();
    }
};

window.onload = () => app.init();
