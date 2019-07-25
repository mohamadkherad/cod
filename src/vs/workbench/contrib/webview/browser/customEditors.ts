/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { UnownedDisposable, } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { endsWith } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IListService } from 'vs/platform/list/browser/listService';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { Registry } from 'vs/platform/registry/common/platform';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { EditorInput, EditorOptions, IEditorInput } from 'vs/workbench/common/editor';
import { ResourceContextKey } from 'vs/workbench/common/resources';
import { getMultiSelectedResources } from 'vs/workbench/contrib/files/browser/files';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { TEXT_FILE_EDITOR_ID } from 'vs/workbench/contrib/files/common/files';
import { WebviewEditor } from 'vs/workbench/contrib/webview/browser/webviewEditor';
import { WebviewEditorInput } from 'vs/workbench/contrib/webview/browser/webviewEditorInput';
import { IWebviewEditorService } from 'vs/workbench/contrib/webview/browser/webviewEditorService';
import { CustomEditorInfo, ICustomEditorService } from 'vs/workbench/contrib/webview/common/customEditor';
import { contributionPoint, IWebviewService, WebviewEditorOverlay } from 'vs/workbench/contrib/webview/common/webview';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

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
		@IWebviewService private readonly _webviewService: IWebviewService,
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

		// const existingWebviewInput = CustomWebviewEditor.webviewInputs.get(input);
		// if (existingWebviewInput) {
		// 	return super.setInput(existingWebviewInput, options, token);
		// }

		const viewType = input.viewType;
		if (!viewType) {
			return;
		}

		this._extensionService.activateByEvent(`onWebviewEditor:${viewType}`);

		const id = generateUuid();
		const webview = this._webviewService.createWebviewEditorOverlay(id, {}, {});
		const webviewInput = new WebviewEditorInput(id, viewType, input.getName()!, undefined, new UnownedDisposable(webview), input.getResource());
		await this._webviewEditorService.resolveWebview(webviewInput);

		// CustomWebviewEditor.webviewInputs.set(input, webviewInput);
		// webviewInput.onDispose(() => {
		// 	CustomWebviewEditor.webviewInputs.delete(input);
		// });
		return super.setInput(webviewInput, options, token);
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


const OPEN_WITH_COMMAND_ID = 'openWith';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: OPEN_WITH_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: EditorContextKeys.focus.toNegated(),
	handler: async (accessor: ServicesAccessor, resource: URI | object) => {
		const editorService = accessor.get(IEditorService);
		const customEditorService = accessor.get(ICustomEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const instantiationService = accessor.get(IInstantiationService);
		const _webviewService = accessor.get(IWebviewService);


		const resources = getMultiSelectedResources(resource, accessor.get(IListService), editorService);
		const targetResource = resources[0];
		if (!targetResource) {
			return;
		}

		const resourceInput: IResourceInput = { resource: targetResource };
		const bigInput = editorService.createInput(resourceInput);
		if (!(bigInput instanceof FileEditorInput)) {
			return;
		}

		const preferredEditors = await customEditorService.getCustomEditorsForResource(targetResource);
		const pick = await quickInputService.pick(
			[
				{
					label: 'Text',
					id: TEXT_FILE_EDITOR_ID,
				},
				...preferredEditors.map((editorDescriptor): IQuickPickItem => ({
					label: editorDescriptor.displayName,
					id: editorDescriptor.id
				}))
			],
			{});

		if (pick) {
			if (pick.id === TEXT_FILE_EDITOR_ID) {
				const editor = instantiationService.createInstance(FileEditorInput, targetResource, undefined, undefined);
				editor.setPreferredEditorId(TEXT_FILE_EDITOR_ID);
				editorService.openEditor(editor);
			} else {
				const id = generateUuid();
				const webview = _webviewService.createWebviewEditorOverlay(id, {}, {});

				const editor = instantiationService.createInstance(CustomFileEditorInput, targetResource, pick.id, id, 'name', {} as any, new UnownedDisposable(webview));
				// editor.setPreferredEditorId(CustomWebviewEditor.ID);
				editorService.openEditor(editor);
			}
		}
	}
});

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	group: 'navigation',
	order: 20,
	command: {
		id: OPEN_WITH_COMMAND_ID,
		title: 'Open With'
	},
	when: ResourceContextKey.Scheme.isEqualTo(Schemas.file)
});
