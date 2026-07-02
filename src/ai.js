const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4-flash';

const modeLabels = {
  preserve: '保持原意，整理表达',
  targeted: '针对岗位 JD 强化匹配度',
  concise: '压缩内容，优先适配一页简历',
};

function extractJson(content) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonObject(content, validate, fallbackMessage) {
  const parsed = JSON.parse(extractJson(content));
  if (!validate(parsed)) {
    throw new Error(fallbackMessage);
  }
  return parsed;
}

export function buildResumeOptimizationMessages({ resume, jobDescription, mode }) {
  return [
    {
      role: 'system',
      content:
        '你是严格的中文简历优化助手。只返回 JSON，不要返回 Markdown、解释、寒暄或代码块。返回对象必须包含 profile、sections、style 三个字段，并尽量保留原始 id 和字段结构。',
    },
    {
      role: 'user',
      content: [
        `优化模式: ${mode} - ${modeLabels[mode] || modeLabels.preserve}`,
        `岗位 JD: ${jobDescription || '未提供，请按通用求职简历优化。'}`,
        '要求:',
        '1. 不编造学校、公司、时间、证书、成绩或具体数字。',
        '2. 可以让表达更结构化、更有结果导向，但未知事实保持模糊。',
        '3. 技能标签用逗号分隔。',
        '4. 输出必须是可被 JSON.parse 解析的 JSON。',
        `当前简历 JSON: ${JSON.stringify(resume)}`,
      ].join('\n'),
    },
  ];
}

export function parseOptimizedResume(content) {
  return parseJsonObject(
    content,
    (parsed) => parsed.profile && Array.isArray(parsed.sections) && parsed.style,
    'AI 返回内容缺少 profile、sections 或 style。',
  );
}

async function callDeepSeekJson({
  apiKey,
  messages,
  model = DEFAULT_MODEL,
  fetcher = fetch,
}) {
  if (!apiKey?.trim()) {
    throw new Error('请先填写 DeepSeek API Key。');
  }

  const response = await fetcher(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status || 'unknown'}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek 没有返回可用内容。');
  }

  return parseOptimizedResume(content);
}

export async function callDeepSeekOptimizer({
  apiKey,
  resume,
  jobDescription,
  mode,
  model = DEFAULT_MODEL,
  fetcher = fetch,
}) {
  return callDeepSeekJson({
    apiKey,
    messages: buildResumeOptimizationMessages({ resume, jobDescription, mode }),
    model,
    fetcher,
  });
}

async function requestJson({ apiKey, messages, validate, errorMessage, fetcher = fetch }) {
  if (!apiKey?.trim()) {
    throw new Error('请先填写 DeepSeek API Key。');
  }

  const response = await fetcher(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status || 'unknown'}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek 没有返回可用内容。');
  }

  return parseJsonObject(content, validate, errorMessage);
}

export function buildJobMatchMessages({ profile, job }) {
  return [
    {
      role: 'system',
      content:
        '你是职场跳槽顾问。只返回 JSON，不要 Markdown。评分要保守，不能夸大匹配度。',
    },
    {
      role: 'user',
      content: [
        '请根据用户主 Profile 和岗位 JD 生成匹配报告。',
        '返回 JSON 字段：hardScore 数字 0-100，contentScore 数字 0-100，suggestion 只能是不建议投/可以试/值得精修，gaps 数组，strengths 数组，nextSteps 数组。',
        `主 Profile JSON: ${JSON.stringify(profile)}`,
        `岗位信息 JSON: ${JSON.stringify(job.jobInfo)}`,
      ].join('\n'),
    },
  ];
}

export function buildJobResumeMessages({ profile, job, mode = 'targeted' }) {
  return [
    {
      role: 'system',
      content:
        '你是严格的中文简历精修助手。只返回 JSON，不要 Markdown。不得编造经历、公司、学校、时间、证书或具体数字。',
    },
    {
      role: 'user',
      content: [
        `生成模式: ${mode} - ${modeLabels[mode] || modeLabels.targeted}`,
        '请基于主 Profile 为该岗位生成一份定制简历 JSON，必须包含 profile、sections、style。',
        'summary 要逐点回应 JD；经历 bullet 要突出和岗位最相关的能力；未知事实保持模糊。',
        `主 Profile JSON: ${JSON.stringify(profile)}`,
        `岗位信息 JSON: ${JSON.stringify(job.jobInfo)}`,
      ].join('\n'),
    },
  ];
}

export function buildJobMaterialsMessages({ profile, job, resume }) {
  return [
    {
      role: 'system',
      content:
        '你是中文求职沟通助手。只返回 JSON，不要 Markdown。语气专业、自然、不过度吹嘘。',
    },
    {
      role: 'user',
      content: [
        '请为当前岗位生成求职沟通材料。',
        '返回 JSON 字段：coverLetter、email、dm、referral，均为字符串。',
        `主 Profile JSON: ${JSON.stringify(profile)}`,
        `岗位信息 JSON: ${JSON.stringify(job.jobInfo)}`,
        `定制简历 JSON: ${JSON.stringify(resume || job.artifacts?.resume || profile)}`,
      ].join('\n'),
    },
  ];
}

export function buildInterviewPrepMessages({ job, resume }) {
  return [
    {
      role: 'system',
      content:
        '你是面试准备教练。只返回 JSON，不要 Markdown。问题必须结合岗位 JD 和投递简历。',
    },
    {
      role: 'user',
      content: [
        '请生成面试准备卡片。',
        '返回 JSON 字段：questions。questions 是数组，每项包含 question、answerPoints、followUps、askInterviewer。',
        `岗位信息 JSON: ${JSON.stringify(job.jobInfo)}`,
        `投递简历 JSON: ${JSON.stringify(resume || job.artifacts?.resume || {})}`,
      ].join('\n'),
    },
  ];
}

export async function analyzeJobMatch({ apiKey, profile, job, fetcher = fetch }) {
  return requestJson({
    apiKey,
    fetcher,
    messages: buildJobMatchMessages({ profile, job }),
    validate: (parsed) =>
      typeof parsed.hardScore === 'number' &&
      typeof parsed.contentScore === 'number' &&
      Array.isArray(parsed.gaps) &&
      Array.isArray(parsed.strengths),
    errorMessage: 'AI 返回的岗位匹配报告格式不正确。',
  });
}

export async function generateResumeForJob({ apiKey, profile, job, mode, fetcher = fetch }) {
  return requestJson({
    apiKey,
    fetcher,
    messages: buildJobResumeMessages({ profile, job, mode }),
    validate: (parsed) => parsed.profile && Array.isArray(parsed.sections) && parsed.style,
    errorMessage: 'AI 返回的定制简历格式不正确。',
  });
}

export async function generateJobMaterials({ apiKey, profile, job, resume, fetcher = fetch }) {
  return requestJson({
    apiKey,
    fetcher,
    messages: buildJobMaterialsMessages({ profile, job, resume }),
    validate: (parsed) =>
      typeof parsed.coverLetter === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.dm === 'string' &&
      typeof parsed.referral === 'string',
    errorMessage: 'AI 返回的求职材料格式不正确。',
  });
}

export async function generateInterviewPrep({ apiKey, job, resume, fetcher = fetch }) {
  const parsed = await requestJson({
    apiKey,
    fetcher,
    messages: buildInterviewPrepMessages({ job, resume }),
    validate: (value) => Array.isArray(value.questions),
    errorMessage: 'AI 返回的面试准备格式不正确。',
  });

  return parsed.questions;
}
