const translations = {
    en: {
        mrCreated: 'MR !{iid} created successfully.',
        openMr: 'Open MR',
        copyLink: 'Copy link',
        linkCopied: 'Link copied to clipboard',
        createMergeRequest: 'Create Merge Request',
        sourceBranch: 'Source Branch:',
        sourceBranchPlaceholder: 'Select or enter source branch',
        targetBranch: 'Target Branch:',
        targetBranchPlaceholder: 'Select or enter target branch',
        mrTitle: 'MR Title:',
        description: 'Description:',
        descriptionPlaceholder: 'Enter the description for the MR...',
        deleteSourceBranch: 'Delete source branch',
        squashCommits: 'Squash commits',
        assignees: 'Assignees:',
        assigneesPlaceholder: 'Enter username and select',
        labels: 'Labels:',
        refresh: 'Refresh',
        submit: 'Submit',
        cancel: 'Cancel'
    },
    ru: {
        mrCreated: 'MR !{iid} успешно создан.',
        openMr: 'Открыть MR',
        copyLink: 'Скопировать ссылку',
        linkCopied: 'Ссылка скопирована в буфер обмена',
        createMergeRequest: 'Создать Merge Request',
        sourceBranch: 'Исходная ветка:',
        sourceBranchPlaceholder: 'Выберите или введите исходную ветку',
        targetBranch: 'Целевая ветка:',
        targetBranchPlaceholder: 'Выберите или введите целевую ветку',
        mrTitle: 'Заголовок MR:',
        description: 'Описание:',
        descriptionPlaceholder: 'Введите описание для MR...',
        deleteSourceBranch: 'Удалить исходную ветку',
        squashCommits: 'Объединить коммиты',
        assignees: 'Исполнители:',
        assigneesPlaceholder: 'Введите имя пользователя и выберите',
        labels: 'Метки:',
        refresh: 'Обновить',
        submit: 'Создать',
        cancel: 'Отмена'
    },
    zh: {
        mrCreated: 'MR !{iid} 创建成功。',
        openMr: '打开 MR',
        copyLink: '复制链接',
        linkCopied: '链接已复制到剪贴板',
        createMergeRequest: '创建 Merge Request',
        sourceBranch: '源分支：',
        sourceBranchPlaceholder: '选择或输入源分支',
        targetBranch: '目标分支：',
        targetBranchPlaceholder: '选择或输入目标分支',
        mrTitle: 'MR 标题：',
        description: '描述：',
        descriptionPlaceholder: '输入 MR 描述...',
        deleteSourceBranch: '删除源分支',
        squashCommits: '压缩提交',
        assignees: '负责人：',
        assigneesPlaceholder: '输入用户名并选择',
        labels: '标签：',
        refresh: '刷新',
        submit: '提交',
        cancel: '取消'
    }
};

const resolveLocale = language => {
    const normalizedLanguage = (language || '').toLowerCase();

    if (normalizedLanguage.startsWith('ru')) {
        return 'ru';
    }

    if (normalizedLanguage.startsWith('zh')) {
        return 'zh';
    }

    return 'en';
};

const createTranslator = language => {
    const locale = resolveLocale(language);
    const messages = translations[locale];

    return (key, params = {}) => {
        const template = messages[key] || translations.en[key] || key;

        return template.replace(/\{(\w+)\}/g, (match, paramName) => {
            return params && Object.prototype.hasOwnProperty.call(params, paramName) ? params[paramName] : match;
        });
    };
};

module.exports = {
    createTranslator,
    resolveLocale
};
