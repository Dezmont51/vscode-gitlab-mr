/* global describe, it */
const expect = require('chai').expect;
const { createTranslator } = require('../src/i18n');

describe('i18n', () => {
    describe('createTranslator', () => {
        it('leaves placeholders intact when params is null', () => {
            const t = createTranslator('en');

            expect(t('mrCreated', null)).to.equal('MR !{iid} created successfully.');
        });

        it('leaves placeholders intact when params is undefined', () => {
            const t = createTranslator('en');

            expect(t('mrCreated', undefined)).to.equal('MR !{iid} created successfully.');
        });
    });
});
