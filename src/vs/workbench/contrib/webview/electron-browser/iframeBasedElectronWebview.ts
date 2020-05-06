/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcRenderer } from 'electron';
import { Schemas } from 'vs/base/common/network';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { ITunnelService } from 'vs/platform/remote/common/tunnel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { WebviewContentOptions, WebviewExtensionDescription, WebviewOptions } from 'vs/workbench/contrib/webview/browser/webview';
import { IFrameWebview } from 'vs/workbench/contrib/webview/browser/webviewElement';
import { WebviewThemeDataProvider } from 'vs/workbench/contrib/webview/common/themeing';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';

export class IframeBasedElectronWebview extends IFrameWebview {

	constructor(
		id: string,
		options: WebviewOptions,
		contentOptions: WebviewContentOptions,
		extension: WebviewExtensionDescription | undefined,
		webviewThemeDataProvider: WebviewThemeDataProvider,
		@ITunnelService tunnelService: ITunnelService,
		@IFileService fileService: IFileService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@IWorkbenchEnvironmentService workbenchEnvironmentService: IWorkbenchEnvironmentService,
	) {
		super(id, options, contentOptions, extension, webviewThemeDataProvider, tunnelService, fileService, configurationService, telemetryService, environmentService, workbenchEnvironmentService);
	}

	protected createElement(options: WebviewOptions, contentOptions: WebviewContentOptions) {
		ipcRenderer.send('vscode:registerWebview', this.id, {
			extensionLocation: this.extension?.location.toJSON(),
			localResourceRoots: (contentOptions.localResourceRoots || []).map(x => x.toJSON()),
		});

		const element = document.createElement('iframe');
		element.className = `webview ${options.customClasses || ''}`;
		element.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms');
		element.setAttribute('src', `${this.endpoint}/index.html?id=${this.id}&noServiceWorker`);
		element.style.border = 'none';
		element.style.width = '100%';
		element.style.height = '100%';
		return element;
	}

	private get endpoint() { return `${Schemas.vscodeWebview}://${this.id}.webview`; }

	protected preprocessHtml(value: string): string {
		return value;
	}
}
