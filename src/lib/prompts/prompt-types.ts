/**
 * @since 2020-03-25 09:12
 * @author vivaxy
 */
import * as vscode from 'vscode';

export enum PROMPT_TYPES {
  QUICK_PICK,
  INPUT_BOX,
}

export type Prompt = {
  type: PROMPT_TYPES;
  name: string;
  placeholder: string;
  items?: { label: string; detail: string; description: string }[];
  format?: (input: string) => string;
};

function createQuickPick({
  placeholder,
  items = [],
  format = (i) => i,
}: Prompt): Promise<string> {
  return new Promise(function (resolve, reject) {
    const picker = vscode.window.createQuickPick();
    picker.placeholder = placeholder;
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;
    picker.items = items;
    picker.show();
    picker.onDidAccept(function () {
      const result = format(picker.selectedItems[0].label);
      picker.dispose();
      resolve(result);
    });
  });
}

function createInputBox({
  placeholder,
  format = (i) => i,
}: Prompt): Promise<string> {
  return new Promise(function (resolve, reject) {
    const input = vscode.window.createInputBox();
    input.placeholder = placeholder;
    input.onDidAccept(function () {
      const result = format(input.value);
      input.dispose();
      resolve(result);
    });
    input.prompt = placeholder;
    input.show();
  });
}

export default {
  [PROMPT_TYPES.QUICK_PICK]: createQuickPick,
  [PROMPT_TYPES.INPUT_BOX]: createInputBox,
};
