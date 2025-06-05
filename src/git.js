const gitUtils = require('./git-utils');
const { simpleGit } = require('simple-git');
const assert = require('assert');

/**
 * @param {string} workspaceFolderPath
 */
module.exports = workspaceFolderPath => {
    const gitContext = simpleGit(workspaceFolderPath);

    /**
     * @param {string} originBranch
     */
    const checkStatus = async originBranch => {
        const status = await gitContext.status();

        const currentBranch = status.current;
        const onMaster = currentBranch === originBranch;
        const isConflicted = status.conflicted.length > 0;
        const cleanBranch = status.created.length === 0 &&
                            status.deleted.length === 0 &&
                            status.modified.length === 0 &&
                            status.not_added.length === 0 &&
                            status.renamed.length === 0;

        assert(!isConflicted, 'Unresolved conflicts, please resolve before opening MR.');

        return {
            onMaster,
            cleanBranch
        };
    };

    const getCurrentBranch = async () => {
        const status = await gitContext.status();

        return status.current;
    };

    const lastCommitMessage = async () => {
        const log = await gitContext.log();

        const message = log.latest ? log.latest.message : '';

        // Commit messages are suffixed with message starting with '(HEAD -> )'
        return message.split('(HEAD')[0].trim();
    };

    /**
     * @param {string} targetRemote
     */
    const parseRemotes = async targetRemote => {
        const remotes = await gitContext.getRemotes(true);

        assert(remotes && remotes.length, 'No remotes configured.');

        // Determine which Gitlab server this repo uses
        /**
         * @param {{ name: string; }} remote
         */
        const remote = remotes.find(remote => remote.name === targetRemote);

        assert(remote, `Target remote ${targetRemote} does not exist.`);

        // Parse repo host and tokens
        const repoUrl = remote.refs.push;

        const parsedRemote = gitUtils.parseRepoUrl(repoUrl);

        return parsedRemote;
    };

    /**
     * @param {string} branchName
     */
    const createBranch = branchName => gitContext.checkout(['-b', branchName]);

    /**
     * @param {string[]} args
     */
    const checkoutBranch = args => gitContext.checkout(args);

    /**
     * @param {string | string[]} files
     */
    const addFiles = files => gitContext.add(files);

    /**
     * @param {string} commitMessage
     */
    const commitFiles = commitMessage => gitContext.commit(commitMessage);

    /**
     * @param {string} targetRemote
     * @param {string} branchName
     */
    const pushBranch = (targetRemote, branchName) => gitContext.push(['-u', targetRemote, branchName]);

    /**
     * @param {string} targetRemote
     * @param {string} branchName
     */
    const fetchRemote = (targetRemote, branchName) => gitContext.fetch(targetRemote, branchName);

    const listBranches = async (targetRemote) => {
        if (targetRemote) {
            const remoteBranchSummary = await gitContext.branch(['-r']); // Gets all remote branches
            const filteredBranchesObj = {};
            const filteredBranchesList = [];

            for (const branchKey in remoteBranchSummary.branches) {
                const branchDetail = remoteBranchSummary.branches[branchKey];
                // branchDetail.name is like 'remotes/origin/master' or 'origin/master'
                // We need to check if it belongs to the targetRemote
                const prefixWithRemotes = `remotes/${targetRemote}/`;
                const prefixWithoutRemotes = `${targetRemote}/`;

                if (branchDetail.name.startsWith(prefixWithRemotes) || branchDetail.name.startsWith(prefixWithoutRemotes)) {
                    filteredBranchesObj[branchKey] = branchDetail;
                    filteredBranchesList.push(branchDetail.name);
                }
            }
            // Reconstruct a BranchSummary-like object, preserving some original properties
            return {
                detached: remoteBranchSummary.detached,
                current: remoteBranchSummary.current, // This will be the local current branch or null
                all: filteredBranchesList,
                branches: filteredBranchesObj,
            };
        } else {
            // Original behavior: list local branches
            return gitContext.branch();
        }
    };

    return {
        checkStatus,
        lastCommitMessage,
        parseRemotes,
        createBranch,
        checkoutBranch,
        listBranches,
        fetchRemote,
        addFiles,
        commitFiles,
        pushBranch,
        getCurrentBranch
    };
};
