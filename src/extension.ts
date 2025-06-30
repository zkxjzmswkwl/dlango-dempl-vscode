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
    });
  });

  // Register a formatter for .dempl files
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('dempl', {
      provideDocumentFormattingEdits(document) {
        const edits = [];
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        const formatted = formatDempl(document.getText());
        edits.push(vscode.TextEdit.replace(fullRange, formatted));
        return edits;
      }
    })
  );
}

// Formatter implementation for .dempl files
function formatDempl(text: string): string {
  const lines = text.split(/\r?\n/);
  const formatted: string[] = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed === '') {
      formatted.push('');
      continue;
    }

    // Check if this is an HTML tag
    if (trimmed.startsWith('<')) {
      // Self-closing tag or opening tag
      if (trimmed.includes('/>') || trimmed.match(/<[^>]+\/>/)) {
        // Self-closing tag
        formatted.push('    '.repeat(indentLevel) + trimmed);
      } else if (trimmed.startsWith('</')) {
        // Closing tag - decrease indent first
        indentLevel = Math.max(0, indentLevel - 1);
        formatted.push('    '.repeat(indentLevel) + trimmed);
      } else {
        // Opening tag
        formatted.push('    '.repeat(indentLevel) + trimmed);
        // Check if it's not a single-line tag (has content on same line)
        const tagMatch = trimmed.match(/<([a-zA-Z0-9\-]+)[^>]*>(.*)$/);
        if (tagMatch && tagMatch[2].trim() === '') {
          // Multi-line tag, increase indent for content
          indentLevel++;
        }
      }
    } else {
      // Regular content or D code
      let formattedLine = trimmed;
      
      // Format D code: same-line braces, spaces inside { }
      formattedLine = formattedLine.replace(/\{\s*/g, '{ ').replace(/\s*\}/g, ' }');
      // Ensure { ... } has spaces inside
      formattedLine = formattedLine.replace(/\{([^\s].*?[^\s])\}/g, '{ $1 }');
      
      formatted.push('    '.repeat(indentLevel) + formattedLine);
    }
  }
  
  return formatted.join('\n');
}
