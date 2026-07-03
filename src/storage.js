import { cloneResume } from './state.js';
import { sampleResume } from './data.js';

export const STORAGE_KEY = 'resume-builder-state';
export const WORKSPACE_KEY = 'resume-builder-workspace';
export const WORKSPACE_V2_KEY = 'resume-builder-workspace-v2';
export const AI_USE_PRICE_YUAN = '2.98';

export const applicationStatuses = ['想投', '已生成', '已投递', '面试中', '已结束'];

function isValidResume(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.profile &&
      Array.isArray(value.sections) &&
      value.style,
  );
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProfile(name, resume) {
  return {
    id: createId('profile'),
    name,
    updatedAt: new Date().toISOString(),
    resume: cloneResume(resume),
  };
}

function cloneMatchReport(report) {
  if (!report) return null;
  return {
    hardScore: Number(report.hardScore) || 0,
    contentScore: Number(report.contentScore) || 0,
    suggestion: report.suggestion || '可以试',
    gaps: Array.isArray(report.gaps) ? [...report.gaps] : [],
    strengths: Array.isArray(report.strengths) ? [...report.strengths] : [],
    nextSteps: Array.isArray(report.nextSteps) ? [...report.nextSteps] : [],
  };
}

function cloneArtifacts(artifacts = {}) {
  return {
    resume: artifacts.resume && isValidResume(artifacts.resume) ? cloneResume(artifacts.resume) : null,
    coverLetter: artifacts.coverLetter || '',
    email: artifacts.email || '',
    dm: artifacts.dm || '',
    referral: artifacts.referral || '',
    interviewPrep: Array.isArray(artifacts.interviewPrep)
      ? artifacts.interviewPrep.map((item) => ({ ...item }))
      : [],
  };
}

function isValidJob(value) {
  return Boolean(value && value.id && value.jobInfo && typeof value.jobInfo === 'object');
}

function normalizeBilling(billing = {}) {
  return {
    freeTrialUsed: Boolean(billing.freeTrialUsed),
    paidCredits: Math.max(0, Number(billing.paidCredits) || 0),
    priceYuan: billing.priceYuan || AI_USE_PRICE_YUAN,
  };
}

export function createJob({
  company = '',
  title = '新岗位',
  location = '',
  jd = '',
  status = '想投',
} = {}) {
  return {
    id: createId('job'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobInfo: {
      company,
      title,
      location,
      jd,
    },
    matchReport: null,
    artifacts: cloneArtifacts(),
    applicationStatus: applicationStatuses.includes(status) ? status : '想投',
    notes: '',
  };
}

export function cloneJob(job) {
  return {
    ...job,
    jobInfo: { ...job.jobInfo },
    matchReport: cloneMatchReport(job.matchReport),
    artifacts: cloneArtifacts(job.artifacts),
  };
}

export function createDefaultWorkspaceV2(sourceResume = sampleResume) {
  const defaultJob = createJob({
    company: '目标公司',
    title: sourceResume.profile.title || '目标岗位',
    jd: '',
  });

  return {
    version: 2,
    activeJobId: defaultJob.id,
    masterProfile: cloneResume(sourceResume),
    jobs: [defaultJob],
    settings: {
      apiKey: '',
      backendUrl: '',
      customerId: createId('customer'),
      defaultMode: 'targeted',
      style: { ...sourceResume.style },
      billing: normalizeBilling(),
    },
  };
}

function normalizeWorkspaceV2(value) {
  if (
    !value ||
    value.version !== 2 ||
    !isValidResume(value.masterProfile) ||
    !Array.isArray(value.jobs) ||
    !value.jobs.some(isValidJob)
  ) {
    return null;
  }

  const jobs = value.jobs.filter(isValidJob).map(cloneJob);
  const activeJobId = jobs.some((job) => job.id === value.activeJobId) ? value.activeJobId : jobs[0].id;

  return {
    version: 2,
    activeJobId,
    masterProfile: cloneResume(value.masterProfile),
    jobs,
    settings: {
      apiKey: value.settings?.apiKey || '',
      backendUrl: value.settings?.backendUrl || '',
      customerId: value.settings?.customerId || createId('customer'),
      defaultMode: value.settings?.defaultMode || 'targeted',
      style: { ...(value.settings?.style || value.masterProfile.style || sampleResume.style) },
      billing: normalizeBilling(value.settings?.billing),
    },
  };
}

export function loadResume(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneResume(sampleResume);
    }

    const parsed = JSON.parse(raw);
    return isValidResume(parsed) ? parsed : cloneResume(sampleResume);
  } catch {
    return cloneResume(sampleResume);
  }
}

export function saveResume(resume, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(resume));
}

function createDefaultWorkspace() {
  const profile = createProfile('默认简历', sampleResume);
  return {
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

export function loadCareerWorkspace(storage = window.localStorage) {
  try {
    const raw = storage.getItem(WORKSPACE_V2_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeWorkspaceV2(parsed);
      if (normalized) return normalized;
    }

    const legacyWorkspace = loadResumeWorkspace(storage);
    const legacyResume = getActiveProfile(legacyWorkspace)?.resume || sampleResume;
    return createDefaultWorkspaceV2(legacyResume);
  } catch {
    return createDefaultWorkspaceV2();
  }
}

export function saveCareerWorkspace(workspace, storage = window.localStorage) {
  storage.setItem(WORKSPACE_V2_KEY, JSON.stringify(workspace));
}

export function getActiveJob(workspace) {
  return workspace.jobs.find((job) => job.id === workspace.activeJobId) || workspace.jobs[0];
}

export function upsertJob(workspace, job) {
  const nextJob = { ...cloneJob(job), updatedAt: new Date().toISOString() };
  const exists = workspace.jobs.some((item) => item.id === nextJob.id);
  return {
    ...workspace,
    activeJobId: nextJob.id,
    jobs: exists
      ? workspace.jobs.map((item) => (item.id === nextJob.id ? nextJob : item))
      : [...workspace.jobs, nextJob],
  };
}

export function deleteJob(workspace, jobId) {
  if (workspace.jobs.length <= 1) return workspace;
  const jobs = workspace.jobs.filter((job) => job.id !== jobId);
  return {
    ...workspace,
    activeJobId: workspace.activeJobId === jobId ? jobs[0].id : workspace.activeJobId,
    jobs,
  };
}

export function updateCareerWorkspace(workspace, updates) {
  return {
    ...workspace,
    ...updates,
  };
}

export function getBillingState(workspace) {
  const billing = normalizeBilling(workspace.settings?.billing);
  const freeCredits = billing.freeTrialUsed ? 0 : 1;
  return {
    ...billing,
    freeCredits,
    totalAvailable: freeCredits + billing.paidCredits,
    nextUseLabel: freeCredits > 0 ? '免费试用' : `${billing.priceYuan} 元/次`,
  };
}

export function addPaidCredit(workspace, count = 1) {
  const billing = getBillingState(workspace);
  return {
    ...workspace,
    settings: {
      ...workspace.settings,
      billing: {
        freeTrialUsed: billing.freeTrialUsed,
        paidCredits: billing.paidCredits + Math.max(1, Number(count) || 1),
        priceYuan: billing.priceYuan,
      },
    },
  };
}

export function consumeAiCredit(workspace) {
  const billing = getBillingState(workspace);
  if (billing.freeCredits > 0) {
    return {
      allowed: true,
      reason: 'free',
      workspace: {
        ...workspace,
        settings: {
          ...workspace.settings,
          billing: {
            freeTrialUsed: true,
            paidCredits: billing.paidCredits,
            priceYuan: billing.priceYuan,
          },
        },
      },
    };
  }

  if (billing.paidCredits > 0) {
    return {
      allowed: true,
      reason: 'paid',
      workspace: {
        ...workspace,
        settings: {
          ...workspace.settings,
          billing: {
            freeTrialUsed: true,
            paidCredits: billing.paidCredits - 1,
            priceYuan: billing.priceYuan,
          },
        },
      },
    };
  }

  return {
    allowed: false,
    reason: 'payment-required',
    workspace,
  };
}

function isValidWorkspace(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.activeProfileId &&
      Array.isArray(value.profiles) &&
      value.profiles.some((profile) => profile.id === value.activeProfileId && isValidResume(profile.resume)),
  );
}

export function loadResumeWorkspace(storage = window.localStorage) {
  try {
    const rawWorkspace = storage.getItem(WORKSPACE_KEY);
    if (rawWorkspace) {
      const parsed = JSON.parse(rawWorkspace);
      if (isValidWorkspace(parsed)) {
        return parsed;
      }
    }

    const legacyResume = loadResume(storage);
    const profile = createProfile('默认简历', legacyResume);
    return {
      activeProfileId: profile.id,
      profiles: [profile],
    };
  } catch {
    return createDefaultWorkspace();
  }
}

export function saveResumeWorkspace(workspace, storage = window.localStorage) {
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}

export function getActiveProfile(workspace) {
  return (
    workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ||
    workspace.profiles[0]
  );
}

export function createResumeProfile(workspace, name, sourceResume = getActiveProfile(workspace)?.resume || sampleResume) {
  const profile = createProfile(name || '新岗位简历', sourceResume);

  return {
    activeProfileId: profile.id,
    profiles: [...workspace.profiles, profile],
  };
}

export function saveActiveResume(resume, workspace) {
  return {
    ...workspace,
    profiles: workspace.profiles.map((profile) =>
      profile.id === workspace.activeProfileId
        ? {
            ...profile,
            updatedAt: new Date().toISOString(),
            resume: cloneResume(resume),
          }
        : profile,
    ),
  };
}

export function switchResumeProfile(workspace, profileId) {
  if (!workspace.profiles.some((profile) => profile.id === profileId)) {
    return workspace;
  }

  return {
    ...workspace,
    activeProfileId: profileId,
  };
}

export function renameResumeProfile(workspace, profileId, name) {
  return {
    ...workspace,
    profiles: workspace.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, name: name || profile.name } : profile,
    ),
  };
}

export function deleteResumeProfile(workspace, profileId) {
  if (workspace.profiles.length <= 1) {
    return workspace;
  }

  const profiles = workspace.profiles.filter((profile) => profile.id !== profileId);
  return {
    activeProfileId:
      workspace.activeProfileId === profileId ? profiles[0].id : workspace.activeProfileId,
    profiles,
  };
}
