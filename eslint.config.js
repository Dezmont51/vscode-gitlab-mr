/* eslint-env node */

const js = require('@eslint/js');

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**']
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                require: 'readonly',
                module: 'readonly',
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly'
            }
        },
        rules: {
            quotes: ['error', 'single'],
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': 'error',
            'arrow-parens': ['error', 'as-needed'],
            'no-param-reassign': 'error',
            'prefer-arrow-callback': 'error',
            'no-duplicate-imports': 'error',
            semi: 'error',
            'no-extra-semi': 'error',
            'comma-dangle': 'error',
            'prefer-template': 'error',
            'eol-last': 'error',
            indent: ['error', 4, { SwitchCase: 1 }],
            'prefer-const': 'error',
            'no-debugger': 'error',
            'no-case-declarations': 'off'
        }
    }
]; 
