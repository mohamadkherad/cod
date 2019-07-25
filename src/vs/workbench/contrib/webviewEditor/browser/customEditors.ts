/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { UnownedDisposable } from 'vs/base/common/lifecycle';
import { endsWith } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { EditorInput, EditorOptions, IEditorInput } from 'vs/workbench/common/editor';
import { WebviewEditor } from 'vs/workbench/contrib/webview/browser/webviewEditor';
import { WebviewEditorInput } from 'vs/workbench/contrib/webview/browser/webviewEditorInput';
import { contributionPoint, WebviewEditorOverlay } from 'vs/workbench/contrib/webview/common/webview';
import { CustomEditorInfo, ICustomEditorService } from 'vs/workbench/contrib/webviewEditor/common/customEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IWebviewEditorService } from 'vs/workbench/contrib/webview/browser/webviewEditorService';

export class CustomFileEditorInput extends WebviewEditorInput {
	constructor(
		resource: URI,
		viewType: string,
		id: string,
		name: string,
		extension: undefined | {
			readonly location: URI;
			readonly id: ExtensionIdentifier;
		},
		webview: UnownedDisposable<WebviewEditorOverlay>,
	) {
		super(id, viewType, name, extension, webview, resource);
	}

	matches(other: IEditorInput): boolean {
		return super.matches(other)
			&& other instanceof CustomFileEditorInput
			&& this.viewType === other.viewType;
	}
}


export class CustomEditorService implements ICustomEditorService {
	_serviceBrand: any;

	public readonly _customEditors: Array<CustomEditorInfo & { extensions: readonly string[] }> = [];

	constructor() {
		contributionPoint.setHandler(extensions => {
			for (const extension of extensions) {
				for (const webviewEditorContribution of extension.value) {
					this._customEditors.push({
						id: webviewEditorContribution.viewType,
						displayName: webviewEditorContribution.displayName,
						extensions: webviewEditorContribution.extensions || []
					});
				}
			}
		});
	}

	async getCustomEditorsForResource(resource: URI): Promise<readonly CustomEditorInfo[]> {
		const out: CustomEditorInfo[] = [];
		for (const customEditor of this._customEditors) {
			if (customEditor.extensions.some(extension => endsWith(resource.toString(), extension))) {
				out.push(customEditor);
			}
		}

		return out;
	}
}

class CustomWebviewEditor extends WebviewEditor {

	public static readonly ID = 'CustomWebviewEditor';

	// private static readonly webviewInputs = new Map<FileEditorInput, WebviewEditorInput>();

	constructor(
		@IWebviewEditorService private readonly _webviewEditorService: IWebviewEditorService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IEditorService editorService: IEditorService,
		@IWindowService windowService: IWindowService,
		@IStorageService storageService: IStorageService,
	) {
		super(telemetryService, themeService, contextKeyService, editorService, windowService, storageService);
	}

	async setInput(
		input: EditorInput,
		options: EditorOptions,
		token: CancellationToken
	): Promise<void> {
		if (!(input instanceof CustomFileEditorInput)) {
			super.setInput(input, options, token);
			return;
		}

		const viewType = input.viewType;
		if (!viewType) {
			return;
		}

		this._extensionService.activateByEvent(`onWebviewEditor:${viewType}`);
		await this._webviewEditorService.resolveWebview(input);
		await super.setInput(input, options, token);
	}
}

Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	new EditorDescriptor(
		CustomWebviewEditor,
		CustomWebviewEditor.ID,
		'Custom Editor',
	), [
		new SyncDescriptor(CustomFileEditorInput)
	]);



