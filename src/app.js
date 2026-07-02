import { sampleResume, templates } from './data.js';
import {
  analyzeJobMatch,
  generateInterviewPrep,
  generateJobMaterials,
  generateResumeForJob,
} from './ai.js';
import { createImportDraft, readTextFile } from './import.js';
import {
  addItem,
  addSection,
  cloneResume,
  moveSection,
  removeItem,
  removeSection,
  updateItemField,
  updateProfileField,
  updateSectionTitle,
  updateStyle,
} from './state.js';
import {
  applicationStatuses,
  createJob,
  deleteJob,
  getActiveJob,
  loadCareerWorkspace,
  saveCareerWorkspace,
  upsertJob,
} from './storage.js';

const app = document.querySelector('#app');
let workspace = loadCareerWorkspace();
let activeView = 'dashboard';
let importState = { status: 'idle', message: '', draft: null };
let aiState = { status: 'idle', message: '' };
let jobDraft = { company: '', title: '', location: '', jd: '' };

function commit(nextWorkspace) {
  workspace = nextWorkspace;
  saveCareerWorkspace(workspace);
  render();
}

function persist(nextWorkspace) {
  workspace = nextWorkspace;
  saveCareerWorkspace(workspace);
}

function updateMasterProfile(resume) {
  commit({ ...workspace, masterProfile: resume });
}

function updateActiveJob(updates) {
  const job = getActiveJob(workspace);
  commit(upsertJob(workspace, { ...job, ...updates }));
}

function updateActiveJobInfo(updates) {
  const job = getActiveJob(workspace);
  updateActiveJob({ jobInfo: { ...job.jobInfo, ...updates } });
}

function updateActiveArtifacts(updates) {
  const job = getActiveJob(workspace);
  updateActiveJob({ artifacts: { ...job.artifacts, ...updates } });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function field(label, value, path, multiline = false) {
  const safeValue = escapeHtml(value);
  const input = multiline
    ? `<textarea data-path="${path}" rows="4">${safeValue}</textarea>`
    : `<input data-path="${path}" value="${safeValue}" />`;

  return `<label><span>${label}</span>${input}</label>`;
}

function getPreviewResume() {
  const job = getActiveJob(workspace);
  return job?.artifacts?.resume || workspace.masterProfile || sampleResume;
}

function getJobLabel(job) {
  return [job.jobInfo.company, job.jobInfo.title].filter(Boolean).join(' · ') || '未命名岗位';
}

function renderTopMenu() {
  const items = [
    ['dashboard', '总览'],
    ['profile', '我的素材'],
    ['jobs', '岗位库'],
    ['materials', '生成材料'],
    ['interview', '面试准备'],
  ];

  return `
    <header class="top-menu">
      <div>
        <p class="eyebrow">职场跳槽求职系统</p>
        <strong>${escapeHtml(getJobLabel(getActiveJob(workspace)))}</strong>
      </div>
      <nav aria-label="顶部菜单">
        ${items
          .map(
            ([view, label]) => `
              <button class="menu-button ${activeView === view ? 'active' : ''}" data-action="switch-view" data-view="${view}">
                ${label}
              </button>
            `,
          )
          .join('')}
      </nav>
    </header>
  `;
}

function renderDashboard() {
  const jobCount = workspace.jobs.length;
  const sentCount = workspace.jobs.filter((job) => ['已投递', '面试中', '已结束'].includes(job.applicationStatus)).length;
  const generatedCount = workspace.jobs.filter((job) => job.artifacts.resume).length;
  const activeJob = getActiveJob(workspace);

  return `
    <section class="view dashboard-view">
      <div class="hero-panel">
        <p class="eyebrow">核心路径</p>
        <h1>用海投的速度，投出精修过的简历</h1>
        <p>先沉淀自己的主素材，再为每个岗位看匹配、生成定制简历、追踪投递和准备面试。</p>
        <div class="quick-actions">
          <button class="primary-button" data-action="switch-view" data-view="profile">整理我的素材</button>
          <button class="secondary-button" data-action="switch-view" data-view="jobs">添加目标岗位</button>
        </div>
      </div>

      <div class="metric-grid">
        <article><strong>${jobCount}</strong><span>岗位</span></article>
        <article><strong>${generatedCount}</strong><span>已生成材料</span></article>
        <article><strong>${sentCount}</strong><span>已投递/推进</span></article>
      </div>

      <section class="panel block-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">当前岗位</p>
            <h2>${escapeHtml(getJobLabel(activeJob))}</h2>
          </div>
          <span class="status-pill">${escapeHtml(activeJob.applicationStatus)}</span>
        </div>
        ${renderMatchReport(activeJob)}
        <div class="quick-actions">
          <button class="secondary-button" data-action="switch-view" data-view="materials">生成投递材料</button>
          <button class="secondary-button" data-action="switch-view" data-view="interview">准备面试</button>
        </div>
      </section>
    </section>
  `;
}

function renderProfileView() {
  const resume = workspace.masterProfile;
  return `
    <section class="view split-view">
      <aside class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">主 Profile</p>
            <h2>我的素材库</h2>
          </div>
          <button class="icon-button" data-action="reset-profile" title="恢复示例">↺</button>
        </div>
        <p class="hint">这里保存最完整的个人素材。生成岗位简历时，AI 会从这里挑选和 JD 最相关的内容。</p>
        ${renderImportBox()}
        <section class="editor-group">
          <h3>基本信息</h3>
          ${field('姓名', resume.profile.name, 'master.profile.name')}
          ${field('目标方向', resume.profile.title, 'master.profile.title')}
          ${field('城市', resume.profile.location, 'master.profile.location')}
          ${field('电话', resume.profile.phone, 'master.profile.phone')}
          ${field('邮箱', resume.profile.email, 'master.profile.email')}
          ${field('链接', resume.profile.website, 'master.profile.website')}
          ${field('个人优势', resume.profile.summary, 'master.profile.summary', true)}
        </section>
        <details class="editor-group advanced-editor" open>
          <summary>经历与项目素材</summary>
          <div class="section-title-row">
            <h3>模块</h3>
            <button class="secondary-button" data-action="add-section" data-target="master">添加模块</button>
          </div>
          ${resume.sections.map((section, index) => renderSectionEditor(section, index, 'master')).join('')}
        </details>
      </aside>
      ${renderPreviewPanel(resume)}
    </section>
  `;
}

function renderImportBox() {
  return `
    <details class="import-box step-card" ${importState.message || importState.draft ? 'open' : ''}>
      <summary><span class="step-number">1</span>导入旧简历/补充材料</summary>
      <p class="hint">支持 TXT / Markdown / DOCX。确认应用后，会成为你的主素材。</p>
      <label>
        <span>选择文件</span>
        <input type="file" data-action="file-import" accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
      </label>
      ${renderImportDraft()}
      <textarea id="paste-box" rows="5" placeholder="也可以直接粘贴旧简历内容"></textarea>
      <button class="secondary-button full" data-action="import-text">解析并预览</button>
    </details>
  `;
}

function renderImportDraft() {
  if (!importState.message && !importState.draft) return '';
  return `
    <div class="import-draft ${importState.status === 'error' ? 'error' : ''}">
      ${importState.message ? `<p>${escapeHtml(importState.message)}</p>` : ''}
      ${
        importState.draft
          ? `
            <p class="eyebrow">解析预览：${escapeHtml(importState.draft.fileName)}</p>
            <div class="import-summary">
              <strong>${escapeHtml(importState.draft.resume.profile.name)}</strong>
              <span>${escapeHtml(importState.draft.resume.profile.title)}</span>
              <small>识别到 ${importState.draft.sectionCount} 个模块：${escapeHtml(importState.draft.sectionTitlesText || '导入内容')}</small>
            </div>
            <pre>${escapeHtml(importState.draft.preview)}</pre>
            <button class="secondary-button full" data-action="apply-import">应用到我的素材</button>
          `
          : ''
      }
    </div>
  `;
}

function renderJobsView() {
  const activeJob = getActiveJob(workspace);
  return `
    <section class="view split-view">
      <aside class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Job Application</p>
            <h2>岗位库</h2>
          </div>
        </div>
        <p class="hint">每个岗位单独保存 JD、匹配分、材料和投递状态。</p>
        <section class="step-card">
          <h3>新增岗位</h3>
          ${field('公司', jobDraft.company, 'jobDraft.company')}
          ${field('岗位名', jobDraft.title, 'jobDraft.title')}
          ${field('地点', jobDraft.location, 'jobDraft.location')}
          ${field('岗位 JD', jobDraft.jd, 'jobDraft.jd', true)}
          <button class="primary-button full" data-action="create-job">保存岗位</button>
        </section>
        <div class="job-list">
          ${workspace.jobs.map(renderJobCard).join('')}
        </div>
      </aside>

      <main class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">当前岗位</p>
            <h2>${escapeHtml(getJobLabel(activeJob))}</h2>
          </div>
          <button class="secondary-button danger" data-action="delete-active-job" ${workspace.jobs.length <= 1 ? 'disabled' : ''}>删除岗位</button>
        </div>
        ${renderJobEditor(activeJob)}
      </main>
    </section>
  `;
}

function renderJobCard(job) {
  const report = job.matchReport;
  return `
    <button class="job-card ${job.id === workspace.activeJobId ? 'active' : ''}" data-action="select-job" data-job-id="${job.id}">
      <strong>${escapeHtml(getJobLabel(job))}</strong>
      <span>${escapeHtml(job.applicationStatus)}</span>
      ${report ? `<small>硬性 ${report.hardScore} / 内容 ${report.contentScore}</small>` : '<small>未评分</small>'}
    </button>
  `;
}

function renderJobEditor(job) {
  return `
    <div class="job-editor">
      <label>
        <span>投递状态</span>
        <select data-job-field="applicationStatus">
          ${applicationStatuses
            .map((status) => `<option value="${status}" ${status === job.applicationStatus ? 'selected' : ''}>${status}</option>`)
            .join('')}
        </select>
      </label>
      ${field('公司', job.jobInfo.company, 'activeJob.company')}
      ${field('岗位名', job.jobInfo.title, 'activeJob.title')}
      ${field('地点', job.jobInfo.location, 'activeJob.location')}
      ${field('岗位 JD', job.jobInfo.jd, 'activeJob.jd', true)}
      <button class="primary-button full" data-action="analyze-job" ${aiState.status === 'loading' ? 'disabled' : ''}>AI 看匹配度</button>
      ${renderAiMessage()}
      ${renderMatchReport(job)}
    </div>
  `;
}

function renderMatchReport(job) {
  const report = job.matchReport;
  if (!report) {
    return `<div class="empty-state">还没有匹配报告。粘贴 JD 后点“AI 看匹配度”，先判断这个岗位值不值得精修。</div>`;
  }

  return `
    <div class="match-report">
      <div class="score-row">
        <span>硬性要求 <strong>${report.hardScore}</strong></span>
        <span>内容匹配 <strong>${report.contentScore}</strong></span>
        <b>${escapeHtml(report.suggestion)}</b>
      </div>
      <div class="report-grid">
        <div><h3>优势</h3>${renderList(report.strengths)}</div>
        <div><h3>缺口</h3>${renderList(report.gaps)}</div>
        <div><h3>下一步</h3>${renderList(report.nextSteps)}</div>
      </div>
    </div>
  `;
}

function renderMaterialsView() {
  const job = getActiveJob(workspace);
  const resume = job.artifacts.resume || workspace.masterProfile;
  return `
    <section class="view split-view">
      <aside class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">生成材料</p>
            <h2>${escapeHtml(getJobLabel(job))}</h2>
          </div>
        </div>
        ${renderSettings()}
        <section class="step-card">
          <h3>1. 生成定制简历</h3>
          <p class="hint">不会覆盖主素材，只保存到当前岗位。</p>
          <button class="primary-button full" data-action="generate-resume" ${aiState.status === 'loading' ? 'disabled' : ''}>生成岗位简历</button>
        </section>
        <section class="step-card">
          <h3>2. 生成沟通材料</h3>
          <p class="hint">包含 Cover Letter、HR 邮件、私信和 Referral 请求。</p>
          <button class="secondary-button full" data-action="generate-materials" ${aiState.status === 'loading' ? 'disabled' : ''}>生成求职话术</button>
        </section>
        ${renderAiMessage()}
        ${renderMaterials(job)}
      </aside>
      ${renderPreviewPanel(resume, true)}
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="settings-box">
      <label>
        <span>DeepSeek API Key</span>
        <input type="password" data-setting="apiKey" value="${escapeHtml(workspace.settings.apiKey)}" placeholder="sk-..." autocomplete="off" />
      </label>
      <label>
        <span>生成偏好</span>
        <select data-setting="defaultMode">
          <option value="preserve" ${workspace.settings.defaultMode === 'preserve' ? 'selected' : ''}>保持原意</option>
          <option value="targeted" ${workspace.settings.defaultMode === 'targeted' ? 'selected' : ''}>针对岗位</option>
          <option value="concise" ${workspace.settings.defaultMode === 'concise' ? 'selected' : ''}>压缩一页</option>
        </select>
      </label>
    </section>
  `;
}

function renderMaterials(job) {
  const materials = [
    ['coverLetter', 'Cover Letter'],
    ['email', 'HR 邮件'],
    ['dm', 'LinkedIn / 脉脉私信'],
    ['referral', 'Referral 请求'],
  ];

  return `
    <section class="material-list">
      ${materials
        .map(
          ([key, title]) => `
            <label>
              <span>${title}</span>
              <textarea data-material="${key}" rows="5" placeholder="生成后会出现在这里">${escapeHtml(job.artifacts[key] || '')}</textarea>
            </label>
          `,
        )
        .join('')}
    </section>
  `;
}

function renderInterviewView() {
  const job = getActiveJob(workspace);
  const questions = job.artifacts.interviewPrep || [];
  return `
    <section class="view panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Interview Prep</p>
          <h2>${escapeHtml(getJobLabel(job))}</h2>
        </div>
        <button class="primary-button" data-action="generate-interview" ${aiState.status === 'loading' ? 'disabled' : ''}>生成面试准备</button>
      </div>
      ${renderAiMessage()}
      ${
        questions.length
          ? `<div class="question-grid">${questions.map(renderQuestionCard).join('')}</div>`
          : '<div class="empty-state">生成后会看到可能被问的问题、回答要点、追问和反问面试官的问题。</div>'
      }
    </section>
  `;
}

function renderQuestionCard(item, index) {
  return `
    <article class="question-card">
      <p class="eyebrow">问题 ${index + 1}</p>
      <h3>${escapeHtml(item.question || '面试问题')}</h3>
      <strong>回答要点</strong>
      ${renderList(item.answerPoints)}
      <strong>可能追问</strong>
      ${renderList(item.followUps)}
      <strong>反问面试官</strong>
      <p>${escapeHtml(item.askInterviewer || '')}</p>
    </article>
  `;
}

function renderSectionEditor(section, index, target) {
  return `
    <article class="section-editor">
      <div class="section-editor-header">
        <input class="section-title-input" data-section-title="${section.id}" data-target="${target}" value="${escapeHtml(section.title)}" />
        <div class="row-actions">
          <button class="icon-button" data-action="move-section" data-target="${target}" data-section-id="${section.id}" data-direction="-1" title="上移" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-button" data-action="move-section" data-target="${target}" data-section-id="${section.id}" data-direction="1" title="下移" ${index === workspace.masterProfile.sections.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-button danger" data-action="remove-section" data-target="${target}" data-section-id="${section.id}" title="删除模块">×</button>
        </div>
      </div>
      ${section.items.map((item) => renderItemEditor(section, item, target)).join('')}
      <button class="secondary-button full" data-action="add-item" data-target="${target}" data-section-id="${section.id}">添加一条</button>
    </article>
  `;
}

function renderItemEditor(section, item, target) {
  const fields =
    section.type === 'skills' || section.type === 'text' || section.type === 'custom'
      ? [['内容', 'summary', true]]
      : [
          ['角色/专业', 'role', false],
          ['组织/学校', 'organization', false],
          ['时间', 'period', false],
          ['描述', 'summary', true],
        ];

  return `
    <div class="item-editor">
      <div class="item-fields">
        ${fields
          .map(([label, key, multiline]) =>
            field(label, item[key] ?? '', `${target}.item.${section.id}.${item.id}.${key}`, multiline),
          )
          .join('')}
      </div>
      <button class="text-danger" data-action="remove-item" data-target="${target}" data-section-id="${section.id}" data-item-id="${item.id}">删除这一条</button>
    </div>
  `;
}

function renderPreviewPanel(resume, withStyle = false) {
  return `
    <main class="preview-shell">
      <div class="topbar">
        <div>
          <p class="eyebrow">A4 预览</p>
          <h1>投递版简历</h1>
          <p class="preview-subtitle">当前显示的是${getActiveJob(workspace).artifacts.resume ? '岗位定制简历' : '主素材简历'}。</p>
        </div>
        <button class="primary-button" data-action="print">导出 PDF</button>
      </div>
      ${withStyle ? renderStyleControls(resume) : ''}
      <article
        id="resume-page"
        class="resume-page template-${resume.style.template} section-${resume.style.sectionStyle} density-${resume.style.density}"
        style="--accent:${resume.style.accentColor};--font-scale:${resume.style.fontScale};--spacing-scale:${resume.style.spacingScale};"
      >
        ${renderResumeContent(resume)}
      </article>
    </main>
  `;
}

function renderStyleControls(resume) {
  return `
    <details class="style-inline">
      <summary>排版与模板</summary>
      <div class="template-grid">
        ${templates
          .map(
            (template) => `
              <button class="template-card ${resume.style.template === template.id ? 'active' : ''}" data-action="template" data-template="${template.id}">
                <strong>${template.name}</strong>
                <span>${template.description}</span>
              </button>
            `,
          )
          .join('')}
      </div>
      <label><span>强调色</span><input type="color" data-style="accentColor" value="${resume.style.accentColor}" /></label>
      <label><span>字号</span><input type="range" data-style="fontScale" min="0.88" max="1.14" step="0.02" value="${resume.style.fontScale}" /></label>
      <label><span>间距</span><input type="range" data-style="spacingScale" min="0.82" max="1.2" step="0.02" value="${resume.style.spacingScale}" /></label>
    </details>
  `;
}

function renderResumeContent(resume) {
  const profile = resume.profile;
  const contacts = [profile.location, profile.phone, profile.email, profile.website].filter(Boolean);

  return `
    <header class="resume-header">
      <div>
        <h2>${escapeHtml(profile.name)}</h2>
        <p class="resume-title">${escapeHtml(profile.title)}</p>
        <p class="contacts">${contacts.map(escapeHtml).join(' · ')}</p>
      </div>
      ${resume.style.showAvatar ? `<div class="avatar">${escapeHtml(profile.name.slice(0, 1))}</div>` : ''}
    </header>
    ${profile.summary ? `<p class="profile-summary">${escapeHtml(profile.summary)}</p>` : ''}
    <div class="resume-sections">
      ${resume.sections.map(renderResumeSection).join('')}
    </div>
  `;
}

function renderResumeSection(section) {
  return `
    <section class="resume-section">
      <h3>${escapeHtml(section.title)}</h3>
      <div class="resume-items">
        ${section.items.map((item) => renderResumeItem(section, item)).join('')}
      </div>
    </section>
  `;
}

function renderResumeItem(section, item) {
  if (section.type === 'skills') {
    return `
      <div class="skill-list">
        ${(item.summary || '')
          .split(/[,，、]/)
          .map((skill) => skill.trim())
          .filter(Boolean)
          .map((skill) => `<span>${escapeHtml(skill)}</span>`)
          .join('')}
      </div>
    `;
  }

  if (!item.role && !item.organization && !item.period) {
    return `<p class="text-item">${escapeHtml(item.summary || '')}</p>`;
  }

  return `
    <div class="resume-item">
      <div class="item-head">
        <strong>${escapeHtml(item.role || '')}</strong>
        <span>${escapeHtml(item.period || '')}</span>
      </div>
      <p class="organization">${escapeHtml(item.organization || '')}</p>
      <p>${escapeHtml(item.summary || '')}</p>
    </div>
  `;
}

function renderAiMessage() {
  return aiState.message
    ? `<p class="ai-message ${aiState.status === 'error' ? 'error' : ''}">${escapeHtml(aiState.message)}</p>`
    : '';
}

function renderList(items = []) {
  if (!items.length) return '<p class="hint">暂无</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function render() {
  const views = {
    dashboard: renderDashboard,
    profile: renderProfileView,
    jobs: renderJobsView,
    materials: renderMaterialsView,
    interview: renderInterviewView,
  };

  app.innerHTML = `
    <div class="app-shell active-view-${activeView}">
      ${renderTopMenu()}
      <div class="workspace career-workspace">
        ${views[activeView]?.() || renderDashboard()}
      </div>
    </div>
  `;
}

function readInputValue(target) {
  return target.type === 'checkbox' ? target.checked : target.value;
}

function updateCurrentResumeStyle(updates) {
  const job = getActiveJob(workspace);
  if (job.artifacts.resume) {
    updateActiveArtifacts({ resume: updateStyle(job.artifacts.resume, updates) });
    return;
  }
  updateMasterProfile(updateStyle(workspace.masterProfile, updates));
}

app.addEventListener('input', (event) => {
  const target = event.target;

  if (target.dataset.setting) {
    persist({
      ...workspace,
      settings: {
        ...workspace.settings,
        [target.dataset.setting]: readInputValue(target),
      },
    });
    return;
  }

  if (target.dataset.material) {
    const job = getActiveJob(workspace);
    persist(upsertJob(workspace, {
      ...job,
      artifacts: { ...job.artifacts, [target.dataset.material]: target.value },
    }));
    return;
  }

  if (target.dataset.path?.startsWith('jobDraft.')) {
    jobDraft = {
      ...jobDraft,
      [target.dataset.path.split('.')[1]]: target.value,
    };
    return;
  }

  if (target.dataset.path?.startsWith('activeJob.')) {
    const job = getActiveJob(workspace);
    persist(upsertJob(workspace, {
      ...job,
      jobInfo: { ...job.jobInfo, [target.dataset.path.split('.')[1]]: target.value },
    }));
    return;
  }

  if (target.dataset.path?.startsWith('master.profile.')) {
    persist({ ...workspace, masterProfile: updateProfileField(workspace.masterProfile, target.dataset.path.split('.')[2], target.value) });
    return;
  }

  if (target.dataset.path?.startsWith('master.item.')) {
    const [, , sectionId, itemId, fieldName] = target.dataset.path.split('.');
    persist({ ...workspace, masterProfile: updateItemField(workspace.masterProfile, sectionId, itemId, fieldName, target.value) });
    return;
  }

  if (target.dataset.sectionTitle) {
    persist({ ...workspace, masterProfile: updateSectionTitle(workspace.masterProfile, target.dataset.sectionTitle, target.value) });
    return;
  }

  if (target.dataset.style) {
    updateCurrentResumeStyle({ [target.dataset.style]: readInputValue(target) });
  }
});

app.addEventListener('change', async (event) => {
  const target = event.target;

  if (target.dataset.jobField === 'applicationStatus') {
    updateActiveJob({ applicationStatus: target.value });
    return;
  }

  if (target.dataset.action !== 'file-import') return;
  const file = target.files?.[0];
  if (!file) return;

  importState = { status: 'loading', message: `正在读取 ${file.name}...`, draft: null };
  render();

  try {
    const text = await readTextFile(file);
    importState = {
      status: 'ready',
      message: '文件已解析。确认后会更新我的素材。',
      draft: createImportDraft(text, file.name),
    };
  } catch (error) {
    importState = { status: 'error', message: error.message || '文件导入失败。', draft: null };
  }

  render();
});

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'switch-view') {
    activeView = button.dataset.view;
    render();
  }

  if (action === 'print') window.print();

  if (action === 'reset-profile') updateMasterProfile(cloneResume(sampleResume));

  if (action === 'template') updateCurrentResumeStyle({ template: button.dataset.template });

  if (action === 'select-job') commit({ ...workspace, activeJobId: button.dataset.jobId });

  if (action === 'create-job') {
    const job = createJob(jobDraft);
    jobDraft = { company: '', title: '', location: '', jd: '' };
    activeView = 'jobs';
    commit(upsertJob(workspace, job));
  }

  if (action === 'delete-active-job') commit(deleteJob(workspace, workspace.activeJobId));

  if (action === 'import-text') {
    const text = document.querySelector('#paste-box')?.value || '';
    if (text.trim()) {
      importState = {
        status: 'ready',
        message: '粘贴内容已解析。确认后会更新我的素材。',
        draft: createImportDraft(text, '粘贴文本'),
      };
      render();
    }
  }

  if (action === 'apply-import' && importState.draft) {
    updateMasterProfile(importState.draft.resume);
    importState = { status: 'idle', message: '已应用到我的素材。', draft: null };
    render();
  }

  if (action === 'add-section') updateMasterProfile(addSection(workspace.masterProfile));
  if (action === 'remove-section') updateMasterProfile(removeSection(workspace.masterProfile, button.dataset.sectionId));
  if (action === 'move-section') updateMasterProfile(moveSection(workspace.masterProfile, button.dataset.sectionId, Number(button.dataset.direction)));
  if (action === 'add-item') updateMasterProfile(addItem(workspace.masterProfile, button.dataset.sectionId));
  if (action === 'remove-item') updateMasterProfile(removeItem(workspace.masterProfile, button.dataset.sectionId, button.dataset.itemId));

  if (['analyze-job', 'generate-resume', 'generate-materials', 'generate-interview'].includes(action)) {
    await runAiAction(action);
  }
});

async function runAiAction(action) {
  const job = getActiveJob(workspace);
  aiState = { status: 'loading', message: 'AI 正在处理...' };
  render();

  try {
    if (action === 'analyze-job') {
      const matchReport = await analyzeJobMatch({
        apiKey: workspace.settings.apiKey,
        profile: workspace.masterProfile,
        job,
      });
      updateActiveJob({ matchReport });
      aiState = { status: 'ready', message: '匹配报告已生成。' };
    }

    if (action === 'generate-resume') {
      const resume = await generateResumeForJob({
        apiKey: workspace.settings.apiKey,
        profile: workspace.masterProfile,
        job,
        mode: workspace.settings.defaultMode,
      });
      updateActiveJob({
        artifacts: { ...job.artifacts, resume },
        applicationStatus: job.applicationStatus === '想投' ? '已生成' : job.applicationStatus,
      });
      aiState = { status: 'ready', message: '岗位定制简历已生成。' };
    }

    if (action === 'generate-materials') {
      const materials = await generateJobMaterials({
        apiKey: workspace.settings.apiKey,
        profile: workspace.masterProfile,
        job,
        resume: job.artifacts.resume,
      });
      updateActiveArtifacts(materials);
      aiState = { status: 'ready', message: '求职沟通材料已生成。' };
    }

    if (action === 'generate-interview') {
      const interviewPrep = await generateInterviewPrep({
        apiKey: workspace.settings.apiKey,
        job,
        resume: job.artifacts.resume,
      });
      updateActiveArtifacts({ interviewPrep });
      aiState = { status: 'ready', message: '面试准备卡片已生成。' };
    }
  } catch (error) {
    aiState = { status: 'error', message: error.message || 'AI 请求失败，请检查 API Key 或网络。' };
  }

  render();
}

render();
