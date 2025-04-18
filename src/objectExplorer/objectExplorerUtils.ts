/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { TreeNodeInfo } from "./treeNodeInfo";
import { IConnectionProfile } from "../models/interfaces";
import * as Constants from "../constants/constants";
import * as LocalizedConstants from "../constants/locConstants";
import * as vscodeMssql from "vscode-mssql";
import { TreeNodeType } from "./connectTreeNode";
import * as vscode from "vscode";

export class ObjectExplorerUtils {
    public static readonly rootPath: string = path.join(__dirname, "objectTypes");

    public static iconPath(label: string): string {
        if (label) {
            if (label === Constants.disconnectedServerNodeType) {
                // if disconnected
                label = `${Constants.serverLabel}_red`;
            } else if (label === Constants.serverLabel) {
                // if connected
                label += "_green";
            }
            return path.join(ObjectExplorerUtils.rootPath, `${label}.svg`);
        }
    }

    public static createNoItemsTreeItem(): vscode.TreeItem {
        return {
            label: LocalizedConstants.ObjectExplorer.NoItems,
            accessibilityInformation: {
                label: LocalizedConstants.ObjectExplorer.NoItems,
            },
            tooltip: LocalizedConstants.ObjectExplorer.NoItems,
            iconPath: {
                light: ObjectExplorerUtils.iconPath("NoItems_light"),
                dark: ObjectExplorerUtils.iconPath("NoItems_dark"),
            },
        };
    }

    public static createErrorTreeItem(errorMessage: string): vscode.TreeItem {
        return {
            label: LocalizedConstants.ObjectExplorer.ErrorLoadingRefreshToTryAgain,
            accessibilityInformation: {
                label: errorMessage,
            },
            tooltip: errorMessage,
            iconPath: {
                light: ObjectExplorerUtils.iconPath("Error_light"),
                dark: ObjectExplorerUtils.iconPath("Error_dark"),
            },
        };
    }

    public static getNodeUri(node: TreeNodeType): string {
        let profile: IConnectionProfile;
        if (node instanceof TreeNodeInfo) {
            profile = <IConnectionProfile>node.connectionInfo;
        } else {
            profile = <IConnectionProfile>node.parentNode.connectionInfo;
        }
        return ObjectExplorerUtils.getNodeUriFromProfile(profile);
    }

    // TODO: this function emulates one in STS; replace with call to STS to avoid mixups
    public static getNodeUriFromProfile(profile: IConnectionProfile): string {
        let uri: string;
        if (profile.connectionString) {
            let fields = profile.connectionString
                .split(";")
                .filter((s) => !s.toLowerCase().includes("password"));
            uri = fields.join(";");
            return uri;
        }
        if (profile.authenticationType === Constants.sqlAuthentication) {
            uri = `${profile.server}_${profile.database}_${profile.user}_${profile.profileName}`;
        } else {
            uri = `${profile.server}_${profile.database}_${profile.profileName}`;
        }
        return uri;
    }

    /**
     * Gets the database name for the node - which is the database name of the connection for a server node, the database name
     * for nodes at or under a database node or a default value if it's neither of those.
     * @param node The node to get the database name of
     * @returns The database name
     */
    public static getDatabaseName(node: vscodeMssql.ITreeNodeInfo): string {
        // We're on a server node so just use the database directly from the connection string
        if (
            node.nodeType === Constants.serverLabel ||
            node.nodeType === Constants.disconnectedServerNodeType
        ) {
            return node.connectionInfo.database;
        }
        // Otherwise find the name from the node metadata - going up through the parents of the node
        // until we find the database node (so anything under a database node will get the name of
        // the database it's nested in)
        while (node) {
            if (node.metadata) {
                if (node.metadata.metadataTypeName === Constants.databaseString) {
                    return node.metadata.name;
                }
            }
            node = node.parentNode;
        }
        return LocalizedConstants.defaultDatabaseLabel;
    }

    public static isFirewallError(errorCode: number): boolean {
        return errorCode === Constants.errorFirewallRule;
    }
}
