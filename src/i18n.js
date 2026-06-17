const translations = {
    en: {
        mrCreated: 'MR !{iid} created successfully.',
        openMr: 'Open MR',
        copyLink: 'Copy link',
        linkCopied: 'Link copied to clipboard'
    },
    ru: {
        mrCreated: 'MR !{iid} успешно создан.',
        openMr: 'Открыть MR',
        copyLink: 'Скопировать ссылку',
        linkCopied: 'Ссылка скопирована в буфер обмена'
    },
    zh: {
        mrCreated: 'MR !{iid} 创建成功。',
        openMr: '打开 MR',
        copyLink: '复制链接',
        linkCopied: '链接已复制到剪贴板'
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
            return Object.prototype.hasOwnProperty.call(params, paramName) ? params[paramName] : match;
        });
    };
};

module.exports = {
    createTranslator,
    resolveLocale
};
