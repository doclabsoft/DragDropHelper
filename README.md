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
```javascript
var DragDropHelper = new DD.fx.DragDropHelper({
  'source'            : "some-HTMLElement",
  'allowClassNames'   : 'item'
});
```
