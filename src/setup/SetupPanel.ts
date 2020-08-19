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

import { LocDictionary } from "../localizationDictionary";
import { ISetupInitArgs } from "./setupInit";
import { IEspIdfLink } from "../views/setup/types";
import { downloadInstallIdfVersion } from "./espIdfDownload";
import * as idfConf from "../idfConfiguration";
import path from "path";
import vscode from "vscode";
import * as utils from "../utils";
import { downloadEspIdfTools } from "./toolInstall";
import { PlatformInformation } from "../PlatformInformation";
import { IdfToolsManager } from "../idfToolsManager";
import { OutputChannel } from "../logger/outputChannel";
import { Logger } from "../logger/logger";
import { installPyReqs } from "./installPyReqs";

const locDic = new LocDictionary("SetupPanel");

export class SetupPanel {
  public static currentPanel: SetupPanel | undefined;

  public static createOrShow(
    extensionPath: string,
    setupArgs?: ISetupInitArgs
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;
    if (SetupPanel.currentPanel) {
      SetupPanel.currentPanel.panel.reveal(column);
    } else {
      SetupPanel.currentPanel = new SetupPanel(
        extensionPath,
        column,
        setupArgs
      );
    }
  }

  public static isCreatedAndHidden(): boolean {
    return (
      SetupPanel.currentPanel && SetupPanel.currentPanel.panel.visible === false
    );
  }

  public static postMessage(content: any) {
    if (SetupPanel.currentPanel) {
      SetupPanel.currentPanel.panel.webview.postMessage(content);
    }
  }

  private static readonly viewType = "setupPanel";
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private extesionPath: string;
  private confTarget: vscode.ConfigurationTarget =
    vscode.ConfigurationTarget.Global;

  constructor(
    private extensionPath: string,
    column: vscode.ViewColumn,
    setupArgs: ISetupInitArgs
  ) {
    const setupPanelTitle = locDic.localize(
      "setupPanel.panelName",
      "ESP-IDF Setup"
    );

    this.panel = vscode.window.createWebviewPanel(
      SetupPanel.viewType,
      setupPanelTitle,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, "dist", "views")),
        ],
      }
    );

    const scriptPath = this.panel.webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionPath, "dist", "views", "setup-bundle.js")
      )
    );
    this.panel.webview.html = this.createSetupHtml(scriptPath);

    const espIdfPath = idfConf.readParameter("idf.espIdfPath") as string;

    this.panel.webview.onDidReceiveMessage(async (message) => {
      console.log(message);
      switch (message.command) {
        case "installEspIdf":
          if (
            message.selectedEspIdfVersion &&
            message.selectedPyPath &&
            message.manualEspIdfPath
          ) {
            this.autoInstall(
              message.selectedEspIdfVersion,
              message.selectedPyPath,
              message.manualEspIdfPath
            );
          }
          break;
        case "openEspIdfFolder":
          const selectedFolder = await this.openFolder();
          this.panel.webview.postMessage({
            command: "updateEspIdfFolder",
            selectedFolder,
          });
          break;
        case "openPythonPath":
          const selectedPyPath = await this.openFile();
          this.panel.webview.postMessage({
            command: "updatePythonPath",
            selectedPyPath,
          });
          break;
        case "requestInitialValues":
          this.panel.webview.postMessage({
            command: "initialLoad",
            idfVersions: setupArgs.espIdfVersionsList,
            pyVersionList: setupArgs.pythonVersions,
            gitVersion: setupArgs.gitVersion,
            espIdf: setupArgs.espIdfPath || espIdfPath,
            pyBinPath: setupArgs.pyBinPath,
            toolsResults: setupArgs.toolsResults,
          });
          break;
        case "usePreviousSettings":
          if (
            setupArgs.espIdfPath &&
            setupArgs.pyBinPath &&
            setupArgs.exportedPaths &&
            setupArgs.exportedVars
          ) {
            this.saveSettings(
              setupArgs.espIdfPath,
              setupArgs.pyBinPath,
              setupArgs.exportedPaths,
              setupArgs.exportedVars
            );
          }
          break;
        default:
          break;
      }
    });

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async autoInstall(
    selectedIdfVersion: IEspIdfLink,
    pyPath: string,
    espIdfPath: string
  ) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "ESP-IDF",
      },
      async (
        progress: vscode.Progress<{ message: string; increment?: number }>
      ) => {
        try {
          const idfContainerPath =
            process.platform === "win32"
              ? process.env.USERPROFILE
              : process.env.HOME;
          let idfPath: string;
          if (selectedIdfVersion.filename === "manual") {
            idfPath = espIdfPath;
          } else {
            idfPath = await downloadInstallIdfVersion(
              selectedIdfVersion,
              idfContainerPath
            );
          }
          const idfVersion = await utils.getEspIdfVersion(idfPath);
          const toolsPath = path.join(idfContainerPath, ".espressif");
          const idfToolsManager = await this.createIdfToolsManager(idfPath);
          await downloadEspIdfTools(toolsPath, idfToolsManager, progress);
          const exportPaths = await idfToolsManager.exportPaths(
            path.join(toolsPath, "tools")
          );
          const exportVars = await idfToolsManager.exportVars(
            path.join(toolsPath, "tools")
          );
          const virtualEnvPath = await installPyReqs(
            espIdfPath,
            toolsPath,
            pyPath
          );
          await this.saveSettings(
            idfPath,
            virtualEnvPath,
            exportPaths,
            exportVars
          );
        } catch (error) {
          const errMsg = error.message
            ? error.message
            : "Error during auto install";
          OutputChannel.appendLine(errMsg);
          Logger.errorNotify(errMsg, error);
        }
      }
    );
  }

  private async createIdfToolsManager(newIdfPath: string) {
    const platformInfo = await PlatformInformation.GetPlatformInformation();
    const toolsJsonPath = await utils.getToolsJsonPath(newIdfPath);
    const toolsJson = JSON.parse(utils.readFileSync(toolsJsonPath));
    const idfToolsManager = new IdfToolsManager(
      toolsJson,
      platformInfo,
      OutputChannel.init()
    );
    return idfToolsManager;
  }

  private async openFolder() {
    const selectedFolder = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
    });
    if (selectedFolder && selectedFolder.length > 0) {
      return selectedFolder[0].fsPath;
    } else {
      vscode.window.showInformationMessage("No folder selected");
    }
  }

  private async openFile() {
    const selectedFolder = await vscode.window.showOpenDialog({
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
    });
    if (selectedFolder && selectedFolder.length > 0) {
      return selectedFolder[0].fsPath;
    } else {
      vscode.window.showInformationMessage("No folder selected");
    }
  }

  private async saveSettings(
    espIdfPath: string,
    pythonBinPath: string,
    exportedPaths: string,
    exportedVars: string
  ) {
    await idfConf.writeParameter("idf.espIdfPath", espIdfPath, this.confTarget);
    await idfConf.writeParameter(
      "idf.pythonBinPath",
      pythonBinPath,
      this.confTarget
    );
    await idfConf.writeParameter(
      "idf.customExtraPaths",
      exportedPaths,
      this.confTarget
    );
    await idfConf.writeParameter(
      "idf.customExtraVars",
      exportedVars,
      this.confTarget
    );
    vscode.window.showInformationMessage("ESP-IDF has been configured");
  }

  private createSetupHtml(scriptPath: vscode.Uri): string {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ESP-IDF Setup</title>
          </head>
          <body>
              <div id="app"></div>
          </body>
          <script src="${scriptPath}"></script>
      </html>`;
  }

  public dispose() {
    SetupPanel.currentPanel = undefined;
    this.panel.dispose();
  }
}