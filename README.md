**Demo**: http://doclabsoft.github.io/DragDropHelper/

DragDropHelper
==========================
Ui component for dragging and dropping.
## Install ##
```$ bower install DragDropHelper```
## Usage ##
### Generate deps.js file ###
Run ```create_deps.bat```.
This operation generates a file deps.js in current dir, which will be registered dependences to the files of the component
### Link files ###
```javascript
<script src="path_to_closure-library/closure/goog/base.js"></script>
<script src="path_to_dragdrophelper/deps.js"></script>
<script src="path_to/hammerjs/hammer.min.js"></script>
```
### Initial DragDropHelper ###
Default options
```javascript
var source = document.getElementById('some-container');
var DragDropHelper = new DD.fx.DragDropHelper({
  'source'            : [source],
  'allowClassNames'   : 'item'
});
```
## Options ##
* __source__ (array) - arrays of DOM-elements. Specifies a container to be produced Drag Event;
* __target__ (array) - arrays of DOM-elements. Specifies a container to be produced Drop Event;
* __scroll__ (array) - arrays of DOM-elements. Specifies a container to be produced Over Event;
* __allowClassNames__ (string) - allowed class name of DOM-element;
* __grid__ (array) - arrays of DOM-elements;
* __gridGutter__ (number) - margin beetwen drag items;
* __pixelThreshold__ (number) - pixel threshold;
* __lapseThreshold__ (number) - lapse threshold;
* __showScrollArea__ (boolean) - show scroll area while dragging;
