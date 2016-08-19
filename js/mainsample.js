goog.require('DD.fx.DragDropHelper');

$(document).foundation();

window.onload = function()
{

  window.addEventListener("MSHoldVisual", function(e) {e.preventDefault(); }, false);
  window.addEventListener("contextmenu", function(e) { e.preventDefault(); }, false);

  var source = document.querySelector('#original-container');
  createItem(source, 50);

  var DragDropHelper = new DD.fx.DragDropHelper(
  {
    source          : [source],
    target          : [source],
    allowClassNames : 'item',
    grid            : [[source, source]],
    gridGutter      : 20,
    pixelThreshold  : {desktop: 0, sensor: 20},
    lapseThreshold  : {desktop: 0, sensor: 300},
    onCreateImage   : customImage,
    scroll          : [source],
    showScrollArea  : true
  });

  function customImage(event)
  {
    this.setCustomDragImage(event.target.getDragObject().cloneNode(true));
  };

  function createItem(container, count)
  {
    for (var i = 0; i < count; i++)
    {
      var img = goog.dom.createDom('img', {'draggable': false, 'src' : 'img/'+ (Math.floor(Math.random() * (10 - 1 + 1)) + 1) +'.png'});
      var item = goog.dom.createDom('div', {'class' : 'item'}, [img])
      container.appendChild(item);
    };
  }

};