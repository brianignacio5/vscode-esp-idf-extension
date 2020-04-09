// Copyright 2019 Espressif Systems (Shanghai) CO LTD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { join } from "path";
import * as vscode from "vscode";
import { createNewProjectHtml } from "./createNewProjectHtml";
import { LocDictionary } from "../localizationDictionary";
import { INewProjectArgs } from "./newProjectInit";
import { getExamplesList } from "../examples/Examples";

const locDictionary = new LocDictionary("NewProjectPanel");

export class NewProjectPanel {
  public static currentPanel: NewProjectPanel | undefined;

  public static createOrShow(
    extensionPath: string,
    newProjectArgs: INewProjectArgs
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;
    if (NewProjectPanel.currentPanel) {
      NewProjectPanel.currentPanel.panel.reveal(column);
    } else {
      NewProjectPanel.currentPanel = new NewProjectPanel(
        extensionPath,
        newProjectArgs,
        column
      );
    }
  }

  private static readonly viewType = "newProjectWizard";
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    extensionPath: string,
    newProjectArgs: INewProjectArgs,
    column: vscode.ViewColumn
  ) {
    const newProjectTitle = locDictionary.localize(
      "newProject.panelName",
      "New Project Wizard"
    );
    this.panel = vscode.window.createWebviewPanel(
      NewProjectPanel.viewType,
      newProjectTitle,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(join(extensionPath, "dist", "views")),
        ],
      }
    );
    this.panel.webview.html = createNewProjectHtml(extensionPath);

    this.panel.onDidDispose(() => this.dispose(), null);

    this.panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "command":
          if (message.value) {
            this.panel.webview.postMessage({
              command: "command",
              value: "newValue",
            });
          }
          break;
        case "requestInitialValues":
          this.panel.webview.postMessage({
            command: "load_metadata",
            metadata: newProjectArgs.metadata,
          });
          break;
        case "loadExamples":
          if (message.idf_path) {
            const examplesList = getExamplesList(message.idf_path);
            this.panel.webview.postMessage({
              command: "load_examples",
              examples: examplesList,
            });
          }
          break;
        case "loadComponent":
          vscode.window
            .showOpenDialog({
              canSelectFolders: true,
              canSelectFiles: false,
              canSelectMany: false,
            })
            .then((selectedFolder) => {
              if (selectedFolder) {
                this.panel.webview.postMessage({
                  command: "component_list_add_path",
                  selected_folder: selectedFolder[0].fsPath,
                });
              }
            });
        default:
          break;
      }
    });
  }

  public dispose() {
    NewProjectPanel.currentPanel = undefined;
    this.panel.dispose();
  }
}
