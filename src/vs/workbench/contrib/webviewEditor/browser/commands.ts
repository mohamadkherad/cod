/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UnownedDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IListService } from 'vs/platform/list/browser/listService';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { ResourceContextKey } from 'vs/workbench/common/resources';
import { getMultiSelectedResources } from 'vs/workbench/contrib/files/browser/files';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { TEXT_FILE_EDITOR_ID } from 'vs/workbench/contrib/files/common/files';
import { IWebviewService } from 'vs/workbench/contrib/webview/common/webview';
import { ICustomEditorService } from 'vs/workbench/contrib/webviewEditor/common/customEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CustomFileEditorInput } from './customEditors';

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
		const pick = await quickInputService.pick([
			{
				label: 'Text',
				id: TEXT_FILE_EDITOR_ID,
			},
			...preferredEditors.map((editorDescriptor): IQuickPickItem => ({
				label: editorDescriptor.displayName,
				id: editorDescriptor.id
			}))
		], {});
		if (pick) {
			if (pick.id === TEXT_FILE_EDITOR_ID) {
				const editor = instantiationService.createInstance(FileEditorInput, targetResource, undefined, undefined);
				editor.setPreferredEditorId(TEXT_FILE_EDITOR_ID);
				editorService.openEditor(editor);
			} else {
				const id = generateUuid();
				const webview = _webviewService.createWebviewEditorOverlay(id, {}, {});
				const editor = instantiationService.createInstance(CustomFileEditorInput, targetResource, pick.id, id, new UnownedDisposable(webview));
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
