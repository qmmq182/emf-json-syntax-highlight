import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function() {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'json' }, new DocumentSemanticTokensProvider(), legend));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document.getText());
		
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
	}

	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
			return tokenTypes.size + 2;
		}
		return 0;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			console.log(`=============== Start line-${i}:`);
			const line = lines[i].trim();
			if (line.length === 0) 
				continue;
			let currentOffset = 0;

			// order_id
			const orderIdMatch = /"order_id":\s*"([^"]+)"/.exec(line);
			if (orderIdMatch != null) {
				const orderId = orderIdMatch![1];
				console.log(`order_id: ${orderId}`);
				const orderIdStart = line.search(orderId);
				const orderIdLength = orderId.length;
				r.push({
					line: i,
					startCharacter: orderIdStart,
					length: orderIdLength,
					tokenType: "class",
					tokenModifiers: ["static"]
				});
				currentOffset = orderIdStart + orderIdLength;
			}


			// command
			let command = "";
			const commandMatch = /"command":\s*"([^"]+)"/.exec(line);
			if (commandMatch !== null) {
				command = commandMatch![1];
				console.log(`command: ${command}`);
				const commandStart = line.search(command);
				const commandLength = command.length;
				r.push({
					line: i,
					startCharacter: commandStart,
					length: commandLength,
					tokenType: "function",
					tokenModifiers: ["static"]
				});
				currentOffset = commandStart + commandLength;
			}

			// Parameters, find start, end of inner keys, inner values.
			const parametersKeyword = "\"parameters\"";
			const parametersStart = line.indexOf(parametersKeyword);
			currentOffset = parametersStart + parametersKeyword.length;
			// After "parameters", find the first '{'
			currentOffset = line.indexOf('{', currentOffset) + 1;
			// Then loop, the first \"something\" is key, then ':', then \"some_value\"

			do {
				// key
				
				const openKeyOffset = line.indexOf('\\"', currentOffset);
				if (openKeyOffset === -1) {
					break;
				}
				const closeKeyOffset = line.indexOf('\\"', openKeyOffset+2);
				if (closeKeyOffset === -1) {
					break;
				}
				const currentKey = line.substring(openKeyOffset + 2, openKeyOffset + 2 + closeKeyOffset - openKeyOffset - 2);
				console.log(`openKeyOffset: ${openKeyOffset}, currentKey: ${currentKey}`);
				r.push({
					line: i,
					// Because \" is a two characters symbol, so +2 and -2
					startCharacter: openKeyOffset + 2,
					length: closeKeyOffset - openKeyOffset - 2,
					tokenType: "property",
					tokenModifiers: ["readonly"]
				});
				currentOffset = closeKeyOffset + 2;
				console.log(`currentOffset after found key '${currentKey}': ${currentOffset}`);
				
				// ':' the delimiter
				const colonOffset = line.indexOf(":", currentOffset);
				if (colonOffset === -1) {
					// Found the key but never found the corresponding value
					break;
				}
				const colon = line.substring(colonOffset, colonOffset + 1);
				console.log(`Found ':' the delimiter at ${colonOffset}, test colon - '${colon}'`);
				currentOffset = colonOffset + 1;
				
				// If next '{' index is smaller than next '\"', then ignore the whole "{   }""
				const nextOpenBraceOffset = line.indexOf('{', currentOffset);
				console.log(`nextOpenBraceOffset: ${nextOpenBraceOffset}`);
				const nextKeyOrValueOffset = line.indexOf('\\"', currentOffset);
				if (nextOpenBraceOffset !== -1 && nextOpenBraceOffset < nextKeyOrValueOffset) {
					console.log(`Brace comes first. nextKeyOrValueOffset: ${nextKeyOrValueOffset}. Skip the whole braces content.`);
					const closeBraceOffset = line.indexOf('}', nextOpenBraceOffset + 1);
					console.log(`closeBraceOffset: ${closeBraceOffset}`);
					currentOffset = closeBraceOffset + 1;
					console.log(`After skip braces, current offset: ${currentOffset}`);
					const skippedContents = line.substring(nextOpenBraceOffset, nextOpenBraceOffset + 1 + closeBraceOffset - nextOpenBraceOffset);
					console.log(`Skipped contents: ${skippedContents}`);
				}  else {

					// value
					const openValueOffset = line.indexOf('\\"', currentOffset);
					if (openValueOffset === -1) {
						break;
					}
					const closeValueOffset = line.indexOf('\\"', openValueOffset+2);
					if (closeValueOffset === -1) {
						break;
					}
					// r.push({
					// 	line: i,
					// 	startCharacter: openValueOffset + 1,
					// 	length: closeValueOffset - openValueOffset - 1,
					// 	tokenType: "property",
					// 	tokenModifiers: ["readonly"]
					// });
					currentOffset = closeValueOffset + 2;
	
				} 
	
			} while (true);

			// Special paramter: workflow
			if (command === "OE-RUN") {
				const oerunWorkflowMatch = /\\"workflow\\":\s*\\"([^\\"]+)\\"/.exec(line);
				if (oerunWorkflowMatch !== null) {
					const oerunWorkflow = oerunWorkflowMatch![1];
					console.log(`oerunWorkflow: ${oerunWorkflow}`);
					const oerunWorkflowStart = line.search(oerunWorkflow);
					const oerunWorkflowLength = oerunWorkflow.length;
					r.push({
						line: i,
						startCharacter: oerunWorkflowStart,
						length: oerunWorkflowLength,
						tokenType: "class",
						tokenModifiers: ["abstract"]
					});
					currentOffset = oerunWorkflowStart + oerunWorkflowLength;
				}

			}

			// Special paramter: sql
			if (command.startsWith("GBQ-SQL")) {
				const sqlFileMatch = /\\"file_name\\":\s*\\"([^\\"]+)\\"/.exec(line);
				if (sqlFileMatch !== null) {
					const sqlFile = sqlFileMatch![1];
					console.log(`sqlFile: ${sqlFile}`);
					const sqlFileStart = line.search(sqlFile);
					const sqlFileLength = sqlFile.length;
					r.push({
						line: i,
						startCharacter: sqlFileStart,
						length: sqlFileLength,
						tokenType: "type",
						tokenModifiers: ["member"]
					});
					currentOffset = sqlFileStart + sqlFileLength;
				}

			}
				
			// Test only the first line:
			// break;

		}
		return r;
	}

	private _parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
		const parts = text.split('.');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
}
