goog.require('DD.fx.DragDropHelper');

$(document).foundation(
{
  offcanvas : {
  open_method: 'move', 
  close_on_click : true
  }
});

window.onload = function()
{
  Waves.attach('.waves', ['waves-button']);
  Waves.attach('.off-canvas-list a', ['waves-button']);
  Waves.init();

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
    pixelThreshold  : {desktop: 0, sensor: 0},
    lapseThreshold  : {desktop: 300, sensor: 0},
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