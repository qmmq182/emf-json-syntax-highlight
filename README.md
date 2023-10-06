# emf-json-syntax-highlight README

Syntax Highlight For EMF json workflow file.

## How to run

Launch the extension and open the a json file for EMF workflow and use the following settings (if not added automatically):

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
