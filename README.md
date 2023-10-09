# emf-json-syntax-highlight README

Syntax Highlight For EMF json workflow file.

## How to use


1. Install the extension and open the a json file for EMF workflow.
2. Use the following settings (optional, if not use this setting may lost some extra font-style like bold/italic, but will still have colors highlight):
	- `Ctrl+P` to open command dialogue, then search "open user settings json", will open a "settings.json" file,
	- Copy below setting into `settings.json` and save:
		```jsonc
		"editor.semanticTokenColorCustomizations": {


			"enabled": true, // enable for all themes
			"rules": {
				"*.static": {
					"fontStyle": "bold"
				},
				"type": {
					"foreground": "#00aa00"
				},
				"*.abstract": {
					"fontStyle": "italic"
				}
			}
		}
		```
