import { defaultStyle } from './data.js';

export function cloneResume(resume) {
  return {
    ...resume,
    profile: { ...resume.profile },
    style: { ...resume.style },
    sections: resume.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item })),
    })),
  };
}

export function updateProfileField(resume, field, value) {
  return {
    ...resume,
    profile: {
      ...resume.profile,
      [field]: value,
    },
  };
}

export function updateStyle(resume, updates) {
  return {
    ...resume,
    style: {
      ...resume.style,
      ...updates,
    },
  };
}

export function updateSectionTitle(resume, sectionId, title) {
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      section.id === sectionId ? { ...section, title } : section,
    ),
  };
}

export function updateItemField(resume, sectionId, itemId, field, value) {
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            items: section.items.map((item) =>
              item.id === itemId ? { ...item, [field]: value } : item,
            ),
          }
        : section,
    ),
  };
}

export function addItem(resume, sectionId) {
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            items: [
              ...section.items,
              {
                id: `${sectionId}-item-${Date.now()}`,
                role: '',
                organization: '',
                period: '',
                summary: '',
              },
            ],
          }
        : section,
    ),
  };
}

export function removeItem(resume, sectionId, itemId) {
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            items: section.items.filter((item) => item.id !== itemId),
          }
        : section,
    ),
  };
}

export function moveSection(resume, sectionId, direction) {
  const sections = [...resume.sections];
  const index = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) {
    return resume;
  }

  const [section] = sections.splice(index, 1);
  sections.splice(nextIndex, 0, section);

  return {
    ...resume,
    sections,
  };
}

export function removeSection(resume, sectionId) {
  return {
    ...resume,
    sections: resume.sections.filter((section) => section.id !== sectionId),
  };
}

export function addSection(resume) {
  return {
    ...resume,
    sections: [
      ...resume.sections,
      {
        id: `section-${Date.now()}`,
        type: 'custom',
        title: '自定义模块',
        items: [
          {
            id: `custom-${Date.now()}`,
            summary: '在这里填写新的简历内容。',
          },
        ],
      },
    ],
  };
}

export function parsePastedResume(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [name = '未命名候选人', title = '目标岗位', ...body] = lines;
  const summary = body.join('\n') || '请在这里补充简历内容。';

  return {
    profile: {
      name,
      title,
      location: '',
      phone: '',
      email: '',
      website: '',
      summary,
    },
    style: { ...defaultStyle },
    sections: [
      {
        id: 'section-imported',
        type: 'custom',
        title: '导入内容',
        items: [
          {
            id: 'imported-1',
            summary,
          },
        ],
      },
    ],
  };
}
