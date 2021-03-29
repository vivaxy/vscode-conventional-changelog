/**
 * @since 2020-10-09 16:59
 * @author vivaxy
 */
import * as vscode from 'vscode';
import createConventionalCommits from './lib/conventional-commits';
import * as output from './lib/output';
import * as localize from './lib/localize';
import CommitProvider from './lib/editor/provider';

export function activate(context: vscode.ExtensionContext) {
  output.initialize();
  output.info('Extension Activated');
  localize.initialize();
  const disposable = vscode.commands.registerCommand(
    'extension.conventionalCommits',
    createConventionalCommits(),
  );

  context.subscriptions.push(disposable);
  vscode.workspace.registerFileSystemProvider('commit-message', CommitProvider);
}

export function deactivate() {}
