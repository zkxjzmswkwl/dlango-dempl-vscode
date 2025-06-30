import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId !== "dempl") {
      return;
    }

    const demplInPath = process.env.PATH?.split(path.delimiter).some((dir) => {
      const toolPath = path.join(dir, "dempl");
      return (
        require("fs").existsSync(toolPath) ||
        require("fs").existsSync(toolPath + ".exe")
      );
    });

    const config = vscode.workspace.getConfiguration("dempl");
    let toolPath = config.get<string>("compiler.path");
    const templatesRoot = config.get<string>("compiler.templatesRoot");

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return;
    }

    if (!toolPath) {
      toolPath = path.join(workspaceFolder.uri.fsPath, "dempl");
    }

    if (process.platform === "win32") {
      toolPath += ".exe";
    }

    const templateDirToScan = path.join(
      workspaceFolder.uri.fsPath,
      templatesRoot || "templates"
    );

    const command = `"dempl" "${templateDirToScan}"`;

    console.log(`Executing command: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error.message}`);
        vscode.window.showErrorMessage(
          `DEMPL compilation failed. Is the path correct in your settings? ${error.message}`
        );
        return;
      }
      if (stderr) {
        console.error(`Compiler stderr: ${stderr}`);
        vscode.window.showErrorMessage(
          `BOOM: ${stderr}`
        );
      }
      console.log(`Compiler stdout: ${stdout}`);
      vscode.window.showInformationMessage(
        "DEMPL templates compiled successfully."
      );
    });
  });
}
