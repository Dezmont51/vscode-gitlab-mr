# VS Code - Gitlab MR UI

forked from https://marketplace.visualstudio.com/items?itemName=jasonn-porch.gitlab-mr

Add UI interface for creating merge requests.

Quickly search and select target branches, assignees, and automatically read tag lists in the UI interface.

Only support old version of Gitlab (about 10.x to 14.x).

Install from marketplace https://marketplace.visualstudio.com/items?itemName=JustLookAtNow.gitlab-mr-ui

## Features

* Supports both Gitlab.com and Gitlab CE/EE servers.
* Configurable default remote (e.g. `origin`) and branch (e.g. `master`).

### Create MR(UI)

Create an MR from VS Code by providing a branch name and commit message.
**Workflow**

1. Open the command palette and select **Gitlab MR: Create MR**.
2. Enjoy the UI！
   ![image](https://github.com/user-attachments/assets/1a1460a3-7945-45c9-b4f5-d7d56e8ffaa3)

## Extension Settings

* `gitlab-mr.accessToken`: Access token to use to connect to the Gitlab.com API. Create one by going to Profile Settings -> Access Tokens.
* `gitlab-mr.accessTokens`: Access token to use to connect to Gitlab CE/EE APIs. Create one by going to Profile Settings -> Access Tokens.
* `gitlab-mr.apiVersion`: Gitlab API version. Note, `v4` is the only supported API version, but this setting can be used as an escape hatch in case your Gitlab instance is still on `v3`.
* `gitlab-mr.targetBranch`: Default target branch for MRs (defaults to `master`).
* `gitlab-mr.targetRemote`: Default target remote for MRs (defaults to `origin`).
* `gitlab-mr.useDefaultBranch`: When creating MRs, use `default_branch` set in repository as target branch.;
* `gitlab-mr.autoOpenMr`: Open newly created MRs in your browser.
* `gitlab-mr.openToEdit`: Open and edit newly created MRs in your browser.
* `gitlab-mr.removeSourceBranch`: When creating MRs, enable the option to remove the source branch after merging.

### Access Tokens Example

```json
"gitlab-mr.accessTokens": {
    "https://gitlab.domain.com": "ACCESS_TOKEN_FOR_GITLAB.DOMAIN.COM"
}
```

## more usage
just go to https://marketplace.visualstudio.com/items?itemName=jasonn-porch.gitlab-mr
