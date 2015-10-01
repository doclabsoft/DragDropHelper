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
    'source'            : [source],
    'target'            : [source],
    'allowClassNames'   : 'item',
    'grid'              : [[source, source]],
    'gridGutter'        : 20,
    'pixelThreshold'    : 0,
    'lapseThreshold'    : 301,
    'onCreateImage'     : customImage,
    // 'scroll'            : [source],
    // 'showScrollArea'    : true
  });

  function customImage(event)
  {
    var this_ = this,
        item = this.getCopy(),
        img = new Image();
    img.src = item.children[0].src;

    img.onload = function ()
    {
      // debugger;
      this_.setCustomDragImage(img);

      goog.style.setStyle(this_.DragSource.getDragObject().image_, 
      { 
        'box-shadow' : '0 0 0 2px #fff, 0 0 10px 2px #000'
      });

      this_.getItemImage().style.visibility = 'visible';
      this_.DragSource.getDragObject().style.display = 'none';
      item.style.display = '';
    };
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