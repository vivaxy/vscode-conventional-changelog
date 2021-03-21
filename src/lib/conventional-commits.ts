/**
 * @since 2020-03-25 09:08
 * @author vivaxy
 */
import * as path from 'path';
import * as vscode from 'vscode';
import * as VSCodeGit from '../vendors/git';
import prompts from './prompts';
import * as configuration from './configuration';
import * as output from './output';
import commitlint from './commitlint';
import createSimpleQuickPick from './prompts/quick-pick';
import { serialize } from './commit-message';
import localize from './localize';
import openMessageInTab from './editor';

function getGitAPI(): VSCodeGit.API | void {
  const vscodeGit = vscode.extensions.getExtension<VSCodeGit.GitExtension>(
    'vscode.git',
  );
  if (vscodeGit) {
    return vscodeGit.exports.getAPI(1);
  }
}

function outputExtensionVersion(name: string, key: string) {
  output.appendLine(
    `${name} version: ${
      vscode.extensions.getExtension(key)?.packageJSON.version
    }`,
  );
}

function outputConfiguration(key: keyof configuration.Configuration) {
  output.appendLine(`${key}: ${configuration.get(key)}`);
}

function outputRelatedExtensionConfiguration(key: string) {
  output.appendLine(`${key}: ${configuration.getConfiguration().get(key)}`);
}

type Arg = {
  _rootUri: vscode.Uri;
};

function hasChanges(repo: VSCodeGit.Repository) {
  return (
    repo.state.workingTreeChanges.length ||
    repo.state.mergeChanges.length ||
    repo.state.indexChanges.length
  );
}

async function getRepository({
  git,
  arg,
  workspaceFolders,
}: {
  git: VSCodeGit.API;
  arg?: Arg;
  workspaceFolders?: readonly vscode.WorkspaceFolder[];
}) {
  output.appendLine(`arg: ${arg?._rootUri.fsPath}`);
  output.appendLine(
    `git.repositories: ${git.repositories
      .map(function (repo) {
        return repo.rootUri.fsPath;
      })
      .join(', ')}`,
  );
  output.appendLine(
    `workspaceFolders: ${workspaceFolders
      ?.map(function (folder) {
        return folder.uri.fsPath;
      })
      .join(', ')}`,
  );

  if (arg && arg._rootUri.fsPath) {
    const repo = git.repositories.find(function (r) {
      return r.rootUri.fsPath === arg._rootUri.fsPath;
    });
    if (repo) {
      return repo;
    }
    throw new Error(
      localize('extension.sources.repositoryNotFoundInPath') +
        arg._rootUri.fsPath,
    );
  }

  if (git.repositories.length === 0) {
    throw new Error(localize('extension.sources.repositoriesEmpty'));
  }

  if (git.repositories.length === 1) {
    return git.repositories[0];
  }

  const items = git.repositories.map(function (repo, index) {
    const folder = workspaceFolders?.find(function (f) {
      return f.uri.fsPath === repo.rootUri.fsPath;
    });
    return {
      index,
      label: folder?.name || path.basename(repo.rootUri.fsPath),
      description:
        `${
          repo.state.HEAD?.name || repo.state.HEAD?.commit?.slice(0, 8) || ''
        }${hasChanges(repo) ? '*' : ''}` || '',
    };
  });

  const [{ index }] = await createSimpleQuickPick({
    placeholder: localize('extension.sources.promptRepositoryPlaceholder'),
    items,
  });

  return git.repositories[index];
}

export default function createConventionalCommits() {
  return async function conventionalCommits(arg?: Arg) {
    try {
      output.appendLine('Started');

      // 1. output basic information
      output.appendLine(`VSCode version: ${vscode.version}`);

      outputExtensionVersion(
        'VSCode Conventional Commits',
        'vivaxy.vscode-conventional-commits',
      );
      outputExtensionVersion('Git', 'vscode.git');

      outputConfiguration('autoCommit');
      outputConfiguration('gitmoji');
      outputConfiguration('emojiFormat');
      outputConfiguration('scopes');
      outputConfiguration('lineBreak');
      outputConfiguration('promptScopes');

      outputRelatedExtensionConfiguration('git.enableSmartCommit');
      outputRelatedExtensionConfiguration('git.smartCommitChanges');
      outputRelatedExtensionConfiguration('git.postCommitCommand');

      // 2. check git
      const git = getGitAPI();
      if (!git) {
        throw new Error(localize('extension.sources.vscodeGitNotFound'));
      }

      // 3. get repository
      const repository = await getRepository({
        arg,
        git,
        workspaceFolders: vscode.workspace.workspaceFolders,
      });

      // 4. get commitlint rules
      const commitlintRuleConfigs = await commitlint.loadRuleConfigs(
        repository.rootUri.fsPath,
      );
      output.appendLine(
        `commitlintRuleConfigs: ${JSON.stringify(
          commitlintRuleConfigs,
          null,
          2,
        )}`,
      );

      // 5. get message
      const commitMessage = await prompts({
        gitmoji: configuration.get<boolean>('gitmoji'),
        showEditor: configuration.get<boolean>('showEditor'),
        emojiFormat: configuration.get<configuration.EMOJI_FORMAT>(
          'emojiFormat',
        ),
        lineBreak: configuration.get<string>('lineBreak'),
        promptScopes: configuration.get<boolean>('promptScopes'),
      });
      output.appendLine(
        `commitMessage: ${JSON.stringify(commitMessage, null, 2)}`,
      );
      const message = serialize(commitMessage);
      output.appendLine(`message: ${message}`);

      // 6. switch to scm and put message into message box or show the entire commit message in a separate tab
      const showEditor = configuration.get<boolean>('showEditor');

      if (showEditor) {
        repository.inputBox.value = message;
        openMessageInTab(repository);
        output.appendLine(`show full commit message in a separate tab`);
      } else {
        vscode.commands.executeCommand('workbench.view.scm');
        repository.inputBox.value = message;
        output.appendLine(`inputBox.value: ${repository.inputBox.value}`);
      }

      // 7. auto commit
      const autoCommit = configuration.get<boolean>('autoCommit');
      if (autoCommit && !showEditor) {
        await vscode.commands.executeCommand('git.commit', repository);
        output.appendLine('Finished successfully.');
      }
    } catch (e) {
      output.appendLine(`Finished with an error: ${e.stack}`);
      vscode.window.showErrorMessage(
        `${localize('extension.name')}: ${e.message}`,
      );
    }
  };
}
