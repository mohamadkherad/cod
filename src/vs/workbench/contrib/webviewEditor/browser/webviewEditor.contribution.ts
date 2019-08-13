/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { ICustomEditorService } from 'vs/workbench/contrib/webviewEditor/common/customEditor';
import { CustomEditorService, CustomFileEditorInput, CustomWebviewEditor } from '../../webviewEditor/browser/customEditors';
import './commands';

registerSingleton(ICustomEditorService, CustomEditorService, true);

Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	new EditorDescriptor(
		CustomWebviewEditor,
		CustomWebviewEditor.ID,
		'Custom Editor',
	), [
		new SyncDescriptor(CustomFileEditorInput)
	]);
