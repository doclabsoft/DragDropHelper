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
* __source__ (array) - The list of DOM element's containers which contains draggable elements.
* __target__ (array) - The list of DOM element's containers which accept being dropped on.
* __grid__ (array) - The two-dimensional array of DOM elements. Inside arrays should contain two dom elements. Generally first link is the same containers list that is set in the source parameter. And second link is usually the list that is set in the target parameter.
* __scroll__ (array) -The list of DOM element's containers which accept being over on.
* __allowClassNames__ (string) - allowed class name of DOM-element;
* __gridGutter__ (number) - The distance between elements in a container, This property is should to set only if the indent between elements is set by css property margin.
* __pixelThreshold__ (number) - The pixel threshold of the drag beginning. It works jointly with lapse threshold. The creation of the shape and the beginning of drag starts after lapseThreshold and pixelThreshold conditions' implementaion. If both properies are equal 0, the shape creation starts immediately on element's click.
* __lapseThreshold__ (number) - The time threshold of element's drag. It works jointly with pixelThreshold. The creation of the shape and the beginning of drag starts after lapseThreshold and pixelThreshold conditions' implementaion. If both properies are equal 0, the shape creation starts immediately on element's click.
* __showScrollArea__ (boolean) - Show/hide the area scrolling container.
* __dropZoneTime__ (number) - Delay before the creation of the area for dropping a portable item.

For more documentation please visit http://doclabsoft.github.io/DragDropHelper/
 
