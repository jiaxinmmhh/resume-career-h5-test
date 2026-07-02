export const defaultStyle = {
  template: 'classic',
  accentColor: '#1d4ed8',
  fontScale: 1,
  spacingScale: 1,
  sectionStyle: 'line',
  density: 'comfortable',
  showAvatar: true,
};

export const templates = [
  {
    id: 'classic',
    name: '商务正式',
    description: '清晰稳重，适合大多数岗位',
  },
  {
    id: 'sidebar',
    name: '左栏重点',
    description: '突出联系方式和技能',
  },
  {
    id: 'minimal',
    name: '极简留白',
    description: '干净克制，适合内容扎实的简历',
  },
  {
    id: 'compact',
    name: '紧凑一页',
    description: '信息量较大时优先选择',
  },
];

export const sampleResume = {
  profile: {
    name: '张小真',
    title: '产品经理',
    location: '北京',
    phone: '138-0000-8888',
    email: 'zhen@example.com',
    website: 'portfolio.example.com',
    summary:
      '5 年互联网产品经验，擅长从用户洞察、数据分析到跨团队落地，曾负责增长、商业化和内部效率工具方向。',
  },
  style: defaultStyle,
  sections: [
    {
      id: 'section-summary',
      type: 'text',
      title: '个人优势',
      items: [
        {
          id: 'summary-1',
          summary:
            '具备从 0 到 1 搭建产品工作流的经验，能够把模糊需求拆解为可交付方案，并通过数据指标持续迭代。',
        },
      ],
    },
    {
      id: 'section-experience',
      type: 'experience',
      title: '工作经历',
      items: [
        {
          id: 'experience-1',
          role: '高级产品经理',
          organization: '云杉科技',
          period: '2022.04 - 至今',
          summary:
            '负责企业协作产品增长模块，重构新用户激活路径，将关键行为完成率从 34% 提升至 51%。',
        },
        {
          id: 'experience-2',
          role: '产品经理',
          organization: '星河数据',
          period: '2019.07 - 2022.03',
          summary:
            '搭建数据看板与实验平台，支持运营团队每周复盘转化漏斗，推动核心转化率提升 18%。',
        },
      ],
    },
    {
      id: 'section-projects',
      type: 'projects',
      title: '项目经历',
      items: [
        {
          id: 'project-1',
          role: '简历优化工具',
          organization: '个人项目',
          period: '2026',
          summary:
            '设计并实现本地化简历编辑器，支持结构化内容编辑、模板切换、A4 预览和浏览器导出。',
        },
      ],
    },
    {
      id: 'section-education',
      type: 'education',
      title: '教育背景',
      items: [
        {
          id: 'education-1',
          role: '信息管理与信息系统',
          organization: '某某大学',
          period: '2015.09 - 2019.06',
          summary: '本科，主修产品设计、数据分析、管理信息系统。',
        },
      ],
    },
    {
      id: 'section-skills',
      type: 'skills',
      title: '技能标签',
      items: [
        {
          id: 'skills-1',
          summary: '产品策略, 用户研究, 数据分析, A/B Test, Figma, SQL, 项目管理',
        },
      ],
    },
  ],
};
