/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ICustomEditorService } from 'vs/workbench/contrib/webviewEditor/common/customEditor';
import { CustomEditorService } from '../../webviewEditor/browser/customEditors';
import './commands';

registerSingleton(ICustomEditorService, CustomEditorService, true);
