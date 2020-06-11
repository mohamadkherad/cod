/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// @ts-check

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const Terser = require('terser');

const root = path.join(__dirname, 'node_modules', 'typescript');

const toOptimize = new Set([
	'tsserver.js',
	'typescript.js',
	'typingsInstaller.js',
]);

const toDelete = new Set([
	'tsc.js',
	'tsserverlibrary.js',
	'typescriptServices.js',
]);

function processRoot() {
	const toKeep = new Set([
		'lib',
		'package.json',
	]);
	for (const name of fs.readdirSync(root)) {
		if (!toKeep.has(name)) {
			const filePath = path.join(root, name);
			console.log(`Removed ${filePath}`);
			rimraf.sync(filePath);
		}

		for (const name of fs.readdirSync(root)) {
			if (name === 'lib.d.ts' || name.match(/^lib\..*\.d\.ts$/) || name === 'protocol.d.ts' || name === 'typescript.d.ts') {
				continue;
			}
		}
	}
}

function processLib() {
	const libRoot = path.join(root, 'lib');

	// Only run optimize if we have not already done so
	const needsOptimize = fs.existsSync(path.join(libRoot, 'tsc.js'));

	for (const name of fs.readdirSync(libRoot)) {
		if (name === 'lib.d.ts' || name.match(/.*\.d\.ts$/) || name === 'protocol.d.ts') {
			continue;
		}

		const filePath = path.join(libRoot, name);
		if (toDelete.has(name) || name.match(/\.d\.ts$/)) {
			try {
				fs.unlinkSync(filePath);
				console.log(`Removed '${filePath}'`);
			} catch (e) {
				console.warn(e);
			}
			continue;
		}

		if (needsOptimize && toOptimize.has(name)) {
			const result = Terser.minify(fs.readFileSync(filePath).toString('utf-8'), {
				sourceMap: {
					url: name + '.map',
				}
			});
			console.log(`Optimized '${filePath}'`);

			fs.writeFileSync(filePath, result.code);
			if (result.map) {
				fs.writeFileSync(filePath + '.map', result.map);
			}
			continue;
		}
	}
}

processRoot();
processLib();
