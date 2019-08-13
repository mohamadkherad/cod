/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { memoize } from 'vs/base/common/decorators';
import { UnownedDisposable } from 'vs/base/common/lifecycle';
import { basename } from 'vs/base/common/path';
import { endsWith } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILabelService } from 'vs/platform/label/common/label';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { EditorInput, EditorOptions, IEditorInput, Verbosity } from 'vs/workbench/common/editor';
import { WebviewEditor } from 'vs/workbench/contrib/webview/browser/webviewEditor';
import { WebviewEditorInput } from 'vs/workbench/contrib/webview/browser/webviewEditorInput';
import { IWebviewEditorService } from 'vs/workbench/contrib/webview/browser/webviewEditorService';
import { contributionPoint, WebviewEditorOverlay } from 'vs/workbench/contrib/webview/common/webview';
import { CustomEditorInfo, ICustomEditorService } from 'vs/workbench/contrib/webviewEditor/common/customEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

export class CustomFileEditorInput extends WebviewEditorInput {
	private name?: string;

	constructor(
		resource: URI,
		viewType: string,
		id: string,
		webview: UnownedDisposable<WebviewEditorOverlay>,
		@ILabelService private readonly labelService: ILabelService,
	) {
		super(id, viewType, '', undefined, webview, resource);
	}

	getName(): string {
		if (!this.name) {
			this.name = basename(this.labelService.getUriLabel(this.editorResource));
		}
		return this.name;
	}

	matches(other: IEditorInput): boolean {
		return super.matches(other)
			&& other instanceof CustomFileEditorInput
			&& this.viewType === other.viewType;
	}

	@memoize
	private get shortTitle(): string {
		return this.getName();
	}

	@memoize
	private get mediumTitle(): string {
		return this.labelService.getUriLabel(this.editorResource, { relative: true });
	}

	@memoize
	private get longTitle(): string {
		return this.labelService.getUriLabel(this.editorResource);
	}

	getTitle(verbosity: Verbosity): string {
		switch (verbosity) {
			case Verbosity.SHORT:
				return this.shortTitle;
			default:
			case Verbosity.MEDIUM:
				return this.mediumTitle;
			case Verbosity.LONG:
				return this.longTitle;
		}
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

export class CustomWebviewEditor extends WebviewEditor {

	public static readonly ID = 'CustomWebviewEditor';

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
		this._extensionService.activateByEvent(`onWebviewEditor:${viewType}`);

		await this._webviewEditorService.resolveWebview(input);
		await super.setInput(input, options, token);
	}
}
