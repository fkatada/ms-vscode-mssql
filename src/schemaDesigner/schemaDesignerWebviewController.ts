/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ReactWebviewPanelController } from "../controllers/reactWebviewPanelController";
import { SchemaDesigner } from "../sharedInterfaces/schemaDesigner";
import VscodeWrapper from "../controllers/vscodeWrapper";
import * as LocConstants from "../constants/locConstants";
import { TreeNodeInfo } from "../objectExplorer/treeNodeInfo";
import MainController from "../controllers/mainController";

export class SchemaDesignerWebviewController extends ReactWebviewPanelController<
    SchemaDesigner.SchemaDesignerWebviewState,
    SchemaDesigner.SchemaDesignerReducers
> {
    private _sessionId: string = "";

    constructor(
        context: vscode.ExtensionContext,
        vscodeWrapper: VscodeWrapper,
        private mainController: MainController,
        private schemaDesignerService: SchemaDesigner.ISchemaDesignerService,
        private connectionString: string,
        private accessToken: string | undefined,
        private databaseName: string,
        private treeNode: TreeNodeInfo,
    ) {
        super(
            context,
            vscodeWrapper,
            "schemaDesigner",
            "schemaDesigner",
            {},
            {
                title: databaseName,
                viewColumn: vscode.ViewColumn.One,
                iconPath: {
                    light: vscode.Uri.joinPath(
                        context.extensionUri,
                        "media",
                        "designSchema_light.svg",
                    ),
                    dark: vscode.Uri.joinPath(
                        context.extensionUri,
                        "media",
                        "designSchema_dark.svg",
                    ),
                },
                showRestorePromptAfterClose: false,
            },
        );

        this.registerReducers();
    }

    private registerReducers() {
        this.registerRequestHandler("exportToFile", async (payload) => {
            const outputPath = await vscode.window.showSaveDialog({
                filters: {
                    [payload.format]: [payload.format],
                },
                defaultUri: vscode.Uri.file(`${this.databaseName}.${payload.format}`),
                saveLabel: LocConstants.SchemaDesigner.Save,
                title: LocConstants.SchemaDesigner.SaveAs,
            });
            if (payload.format === "svg") {
                let fileContents = decodeURIComponent(payload.fileContents.split(",")[1]);
                await vscode.workspace.fs.writeFile(outputPath, Buffer.from(fileContents, "utf8"));
            } else {
                let fileContents = Buffer.from(payload.fileContents.split(",")[1], "base64");
                vscode.workspace.fs.writeFile(outputPath, fileContents);
            }
        });

        this.registerRequestHandler("initializeSchemaDesigner", async () => {
            const sessionResponse = await this.schemaDesignerService.createSession({
                connectionString: this.connectionString,
                accessToken: this.accessToken,
                databaseName: this.databaseName,
            });
            this._sessionId = sessionResponse.sessionId;
            return sessionResponse;
        });

        this.registerRequestHandler("getScript", async (payload) => {
            const script = await this.schemaDesignerService.generateScript({
                updatedSchema: payload.updatedSchema,
                sessionId: this._sessionId,
            });
            return script;
        });

        this.registerRequestHandler("getReport", async (payload) => {
            try {
                const report = await this.schemaDesignerService.getReport({
                    updatedSchema: payload.updatedSchema,
                    sessionId: this._sessionId,
                });
                return {
                    report,
                };
            } catch (error) {
                return {
                    error: error.toString(),
                };
            }
        });

        this.registerRequestHandler("publishSession", async (payload) => {
            try {
                await this.schemaDesignerService.publishSession({
                    sessionId: this._sessionId,
                });
                return {
                    success: true,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.toString(),
                };
            }
        });

        this.registerRequestHandler("copyToClipboard", async (payload) => {
            await vscode.env.clipboard.writeText(payload.text);
        });

        this.registerRequestHandler("openInEditor", async (payload) => {
            const document = await this.vscodeWrapper.openMsSqlTextDocument(payload.text);
            // Open the document in the editor
            await this.vscodeWrapper.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.Active,
                preserveFocus: true,
            });
        });

        this.registerRequestHandler("openInEditorWithConnection", async (payload) => {
            void this.mainController.onNewQuery(this.treeNode, payload.text);
        });

        this.registerRequestHandler("closeDesigner", async () => {
            this.panel.dispose();
        });
    }

    override dispose(): void {
        super.dispose();
        this.schemaDesignerService.disposeSession({
            sessionId: this._sessionId,
        });
    }
}
