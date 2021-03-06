/*
 * Project: ESP-IDF VSCode Extension
 * File Created: Friday, 27th September 2019 9:59:57 pm
 * Copyright 2019 Espressif Systems (Shanghai) CO LTD
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ensureDir, pathExists } from "fs-extra";
import { join } from "path";
import { Logger } from "../logger/logger";
import * as vscode from "vscode";
import * as idfConf from "../idfConfiguration";
import { appendIdfAndToolsToPath, isBinInPath } from "../utils";
import { TaskManager } from "../taskManager";

export class BuildTask {
  public static isBuilding: boolean;
  private curWorkspace: string;

  constructor(workspace: string) {
    this.curWorkspace = join(workspace, "build");
  }

  public building(flag: boolean) {
    BuildTask.isBuilding = flag;
  }

  private async saveBeforeBuild() {
    const shallSaveBeforeBuild = idfConf.readParameter("idf.saveBeforeBuild");
    if (shallSaveBeforeBuild) {
      await vscode.workspace.saveAll();
    }
  }

  public getShellExecution(
    args: string[],
    options?: vscode.ShellExecutionOptions
  ) {
    return new vscode.ShellExecution(`cmake ${args.join(" ")}`, options);
  }

  public async build() {
    try {
      await this.saveBeforeBuild();
    } catch (error) {
      const errorMessage =
        "Failed to save unsaved files, ignoring and continuing with the build";
      Logger.error(errorMessage, error);
      Logger.warnNotify(errorMessage);
    }
    if (BuildTask.isBuilding) {
      throw new Error("ALREADY_BUILDING");
    }
    this.building(true);
    const modifiedEnv = appendIdfAndToolsToPath();
    await ensureDir(this.curWorkspace);
    const canAccessCMake = await isBinInPath(
      "cmake",
      this.curWorkspace,
      modifiedEnv
    );
    const canAccessNinja = await isBinInPath(
      "ninja",
      this.curWorkspace,
      modifiedEnv
    );

    const cmakeCachePath = join(this.curWorkspace, "CMakeCache.txt");
    const cmakeCacheExists = await pathExists(cmakeCachePath);

    if (canAccessCMake === "" || canAccessNinja === "") {
      throw new Error("CMake or Ninja executables not found");
    }

    const options: vscode.ShellExecutionOptions = {
      cwd: this.curWorkspace,
      env: modifiedEnv,
    };
    const isSilentMode = idfConf.readParameter("idf.notificationSilentMode");
    const showTaskOutput = isSilentMode
      ? vscode.TaskRevealKind.Silent
      : vscode.TaskRevealKind.Always;

    if (!cmakeCacheExists) {
      const compilerArgs = (idfConf.readParameter(
        "idf.cmakeCompilerArgs"
      ) as Array<string>) || ["-G", "Ninja", ".."];
      const compileExecution = this.getShellExecution(compilerArgs, options);
      TaskManager.addTask(
        { type: "esp-idf", command: "ESP-IDF Compile" },
        vscode.TaskScope.Workspace,
        "ESP-IDF Compile",
        compileExecution,
        ["idfRelative", "idfAbsolute"],
        showTaskOutput
      );
    }

    const buildArgs = (idfConf.readParameter("idf.cmakeBuildArgs") as Array<
      string
    >) || ["--build", "."];
    const buildExecution = this.getShellExecution(buildArgs, options);
    TaskManager.addTask(
      { type: "esp-idf", command: "ESP-IDF Build" },
      vscode.TaskScope.Workspace,
      "ESP-IDF Build",
      buildExecution,
      ["idfRelative", "idfAbsolute"],
      showTaskOutput
    );
  }
}
