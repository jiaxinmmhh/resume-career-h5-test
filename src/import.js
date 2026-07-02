import { parsePastedResume } from './state.js';
import { defaultStyle } from './data.js';
import { extractDocxText, isSupportedDocxFile } from './docx.js';

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown'];
const SUPPORTED_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
const SECTION_HEADINGS = new Map([
  ['个人优势', { title: '个人优势', type: 'text' }],
  ['自我评价', { title: '个人优势', type: 'text' }],
  ['个人简介', { title: '个人优势', type: 'text' }],
  ['工作经历', { title: '工作经历', type: 'experience' }],
  ['工作经验', { title: '工作经历', type: 'experience' }],
  ['实习经历', { title: '实习经历', type: 'experience' }],
  ['项目经历', { title: '项目经历', type: 'projects' }],
  ['项目经验', { title: '项目经历', type: 'projects' }],
  ['教育背景', { title: '教育背景', type: 'education' }],
  ['教育经历', { title: '教育背景', type: 'education' }],
  ['技能', { title: '技能标签', type: 'skills' }],
  ['专业技能', { title: '技能标签', type: 'skills' }],
  ['技能标签', { title: '技能标签', type: 'skills' }],
  ['证书', { title: '证书荣誉', type: 'custom' }],
  ['荣誉', { title: '证书荣誉', type: 'custom' }],
  ['证书荣誉', { title: '证书荣誉', type: 'custom' }],
]);

export function isSupportedTextFile(file) {
  const name = file?.name?.toLowerCase() || '';
  const type = file?.type || '';

  return SUPPORTED_TYPES.includes(type) || SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function normalizeHeading(line) {
  return line.replace(/^#+\s*/, '').replace(/[：:]\s*$/, '').trim();
}

function findHeading(line) {
  return SECTION_HEADINGS.get(normalizeHeading(line));
}

function createStructuredItem(section, content, index) {
  const [firstLine = '', ...rest] = content;
  const parts = firstLine.split(/\s*[|｜]\s*/).filter(Boolean);

  if (section.type === 'experience' || section.type === 'projects' || section.type === 'education') {
    return {
      id: `${section.id}-item-${index + 1}`,
      role: parts[0] || firstLine,
      organization: parts[1] || '',
      period: parts[2] || '',
      summary: rest.join('\n') || (parts.length > 1 ? '' : firstLine),
    };
  }

  return {
    id: `${section.id}-item-${index + 1}`,
    summary: content.join('\n'),
  };
}

function buildSection(sectionMeta, lines, index) {
  const section = {
    id: `section-import-${index + 1}`,
    type: sectionMeta.type,
    title: sectionMeta.title,
    items: [],
  };

  if (section.type === 'skills') {
    section.items.push({
      id: `${section.id}-item-1`,
      summary: lines.join(', '),
    });
    return section;
  }

  const chunks = [];
  let current = [];
  for (const line of lines) {
    if (/^\s*[-*•]\s+/.test(line) && current.length) {
      chunks.push(current);
      current = [line.replace(/^\s*[-*•]\s+/, '')];
    } else {
      current.push(line.replace(/^\s*[-*•]\s+/, ''));
    }
  }
  if (current.length) chunks.push(current);

  section.items = chunks.map((chunk, itemIndex) => createStructuredItem(section, chunk, itemIndex));
  return section;
}

function parseStructuredResume(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [name = '未命名候选人', title = '目标岗位', ...body] = lines;
  const sectionBuckets = [];
  let current = null;
  const unknownLines = [];

  for (const line of body) {
    const heading = findHeading(line);
    if (heading) {
      current = { meta: heading, lines: [] };
      sectionBuckets.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      unknownLines.push(line);
    }
  }

  const sections = sectionBuckets
    .filter((bucket) => bucket.lines.length)
    .map((bucket, index) => buildSection(bucket.meta, bucket.lines, index));

  if (!sections.length) {
    return null;
  }

  if (unknownLines.length) {
    sections.unshift({
      id: 'section-import-unmatched',
      type: 'custom',
      title: '导入内容',
      items: [
        {
          id: 'section-import-unmatched-item-1',
          summary: unknownLines.join('\n'),
        },
      ],
    });
  }

  return {
    profile: {
      name,
      title,
      location: '',
      phone: '',
      email: '',
      website: '',
      summary: unknownLines.join('\n') || sections[0]?.items[0]?.summary || '',
    },
    style: { ...defaultStyle },
    sections,
  };
}

export function createImportDraft(text, fileName) {
  const resume = parseStructuredResume(text) || parsePastedResume(text);
  const preview = text.trim().slice(0, 360);
  const sectionTitles = resume.sections.map((section) => section.title);

  return {
    fileName,
    preview,
    resume,
    sectionCount: resume.sections.length,
    sectionTitles,
    sectionTitlesText: sectionTitles.join('、'),
  };
}

export async function readTextFile(file) {
  if (isSupportedDocxFile(file)) {
    return extractDocxText(await file.arrayBuffer());
  }

  if (!isSupportedTextFile(file)) {
    throw new Error('当前仅支持 TXT、Markdown、DOCX 文件导入。');
  }

  return file.text();
}
