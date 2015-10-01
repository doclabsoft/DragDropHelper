goog.provide('DD.fx.DragDropHelper');

goog.require('DD.fx.CustomDragDrop');
goog.require('DD.fx.DragScroll');
goog.require('DD.fx.DragSource');
goog.require('DD.fx.DropTarget');
goog.require('DD.fx.ShuffleGrid');
goog.require('DD.fx.HammerWrapper');

/**
 * Вспомогательная сборка DragDrop инструментария
 * @param {Object=} [settings] Список входящих параметров
 * @param {String} [settings.allowClassNames] Название класса, учавствующий в DragDrop
 * @param {Number} [settings.gridGutter] Отступ (margin) у элементов сетки, если отступ создан при помощи padding, gridGutter передавать не нужно
 * @param {Array} [settings.source] Массив, соддержащий ссылки на DOM-элементы. Являются контейнерами, у которых может начинаться событие onGetDragSource
 * @param {Array} [settings.target] Массив, соддержащий ссылки на DOM-элементы. Являются контейнерами, у которых может начинаться событие onGetDropTarget
 * @param {Array} [settings.scroll] Массив, соддержащий ссылки на DOM-элементы. Являются контейнерами, которые имеют полосу скроллирования
 * @param {Array} [settings.pixelThreshold] Пиксельный порог захвата элемента
 * @param {Array} [settings.lapseThreshold] Временной порог захвата элемента
 * @param {Array} [settings.grid] Массив, соддержащий ссылки на DOM-элементы. Являются контейнерами, у которых будут создаваться виртуальная сетка элементов
 * @extends goog.events.EventTarget
 * @author Антон Пархоменко valianton@mail.ru
 * @this DD.fx.DragDropHelper
 * @version 1.0.2
 * @constructor
 */
DD.fx.DragDropHelper = function(settings)
{
	settings = settings || {};

	this.allowClassNames_ 	= 'allowClassNames'	in settings ? settings.allowClassNames 	: '';
	this.showScrollArea_ 	= 'showScrollArea' 	in settings ? settings.showScrollArea 	: false;

	this.gridGutter_ 			= settings.gridGutter;
	this.dropZoneTime_ 			= settings.dropZoneTime;
	this.pixelThreshold_ 		= settings.pixelThreshold;
	this.lapseThreshold_ 		= settings.lapseThreshold;
	this.scrollParentMode_ 		= settings.scrollParentMode;
	this.scrollParent_ 			= settings.scrollParent;
	this.smoothScroll_  		= settings.smoothScroll;
	this.ignore_ 				= settings.ignoreClassNames;
	this.showDefaultImageTime_ 	= settings.showDefaultImageTime;

	this.source_ = 'source' in settings ? settings.source : [];
	(this.source_.length > 0) && this.initDragSource_(this.source_);

	this.target_ = 'target' in settings ? settings.target : [];
	(this.target_.length > 0) && this.initDropTarget_(this.target_);

	this.scroll_ = 'scroll' in settings ? settings.scroll : [];
	(this.scroll_.length > 0) && this.initDragScroll_(this.scroll_);

	this.grid_ 	= 'grid' in settings ? settings.grid : [];
	(this.grid_.length > 0) && this.initShuffleGrid_(this.grid_);

	this.installEventDependence_();

	this.onCreateImage 	  = goog.isFunction(settings.onCreateImage) 	? settings.onCreateImage 	: null;
	this.onGetDragSource  = goog.isFunction(settings.onGetDragSource) 	? settings.onGetDragSource 	: null;
	this.onDragStart 	  = goog.isFunction(settings.onDragStart) 		? settings.onDragStart 		: null;
	this.onDragEnd 		  = goog.isFunction(settings.onDragEnd) 		? settings.onDragEnd 		: null;
	this.onDragOverScroll = goog.isFunction(settings.onDragOverScroll)  ? settings.onDragOverScroll : null;
	this.onDragDrop 	  = goog.isFunction(settings.onDragDrop) 		? settings.onDragDrop 		: null;
	this.onGetDropTarget  = goog.isFunction(settings.onGetDropTarget) 	? settings.onGetDropTarget 	: null;
	this.onDragOver 	  = goog.isFunction(settings.onDragOver) 		? settings.onDragOver 		: null;

	this.enterDocument();
};
goog.inherits(DD.fx.DragDropHelper, DD.fx.CustomDragDrop);

/**
 * Компонент DD.fx.DragSource
 * @type {DD.fx.DragSource}
 */
DD.fx.DragDropHelper.prototype.DragSource = null;

/**
 * Компонент DD.fx.DropTarget
 * @type {DD.fx.DropTarget}
 */
DD.fx.DragDropHelper.prototype.DropTarget = null;

/**
 * Компонент DD.fx.DragScroll
 * @type {DD.fx.DragScroll}
 */
DD.fx.DragDropHelper.prototype.DragScroll = null;

/**
 * Список компонентов DD.fx.ShuffleGrids
 * @type {DD.fx.ShuffleGrids}
 */
DD.fx.DragDropHelper.prototype.ShuffleGrids = [];

DD.fx.DragDropHelper.prototype.enterDocument = function ()
{
	if (this.onCreateImage)
	{
		goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.CREATEIMAGE, this.onCreateImage, false, this);
		this.DragSource.setShowDefaultImage(false);
	};
	this.onGetDragSource  && goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, 	this.onGetDragSource, 	false, this);
	this.onDragStart 	  && goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART,		this.onDragStart, 		false, this);
	this.onDragOverScroll && goog.events.listen(this.DragScroll, DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL, this.onDragOverScroll, 	false, this);
	this.onDragEnd 	 	  && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGEND, 		this.onDragEnd, 		false, this);
	this.onDragDrop 	  && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP, 		this.onDragDrop, 		false, this);
	this.onGetDropTarget  && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.GETDROPTARGET, 	this.onGetDropTarget, 	false, this);
	this.onDragOver  	  && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGOVER, 		this.onDragOver, 		false, this);
};

/**
 * Отвязывание событий
 */
DD.fx.DragDropHelper.prototype.exitDocument = function ()
{
	this.onCreateImage	  && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.CREATEIMAGE, 		this.onCreateImage, 	false, this);
	this.onGetDragSource  && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, 	this.onGetDragSource, 	false, this);
	this.onDragStart 	  && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART,		this.onDragStart, 		false, this);
	this.onDragOverScroll && goog.events.unlisten(this.DragScroll, DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL,	this.onDragOverScroll, 	false, this);
	this.onDragEnd 	 	  && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGEND, 			this.onDragEnd, 		false, this);
	this.onDragDrop 	  && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP, 		this.onDragDrop, 		false, this);
	this.onGetDropTarget  && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.GETDROPTARGET, 	this.onGetDropTarget, 	false, this);
	this.onDragOver  	  && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGOVER, 		this.onDragOver, 		false, this);
};

/**
 * Удаление компонента и списка компонентов в случае, если они созданы
 */
DD.fx.DragDropHelper.prototype.dispose = function()
{
	this.DragSource && this.DragSource.dispose();
	this.DropTarget && this.DropTarget.dispose();
	this.DragScroll && this.DragScroll.dispose();

	for (var i = 0, ln = this.ShuffleGrids.length; i < ln; i++)
		this.ShuffleGrids[i] && this.ShuffleGrids[i].dispose();

	this.exitDocument();
};

/**
 * Получение копии переносимого элемента, который в данный момент виден на странице, так как оригинал скрыт, но тоже присутствует на странице
 * @return {HTMLElement}
 */
DD.fx.DragDropHelper.prototype.getCopy = function ()
{
	return this.DragSource.getCopy_();
};

/**
 * Получение образа переносимого элемента
 * @return {HTMLElement}
 */
DD.fx.DragDropHelper.prototype.getItemImage = function ()
{
	return this.DragSource.getItemImage();
};

/**
 * Устанавливает пользовательский образ переносимого элемента
 * @param {HTMLElement} value Ссылка на DOM-элемент, которые является пользовательским образом переносимого элемента
 * @param {Number} 		align Выравнивание образа под курсором во время перемещения
 */
DD.fx.DragDropHelper.prototype.setCustomDragImage = function (value, align)
{
	this.DragSource.setCustomDragImage(value, align);
};

/**
 * Инициализация компонента DD.fx.DragSource
 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DragSource
 * @private
 */
DD.fx.DragDropHelper.prototype.initDragSource_ = function (containers)
{
	var i = 0,
		ln = containers.length,
		isSensor = DD.utils.UserAgent.isSensorDevice();

	this.DragSource = new DD.fx.DragSource({
		'pixelThreshold'  		: isSensor ? this.pixelThreshold_ : 0,
		'lapseThreshold'  		: isSensor ? this.lapseThreshold_ : 0,
		'showDefaultImageTime'	: this.showDefaultImageTime_,
		'ignore'          		: this.ignore_
	});

	this.DragSource.setContainer(containers, this.allowClassNames_);
};

/**
 * Инициализация компонента DD.fx.DropTarget
 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DropTarget
 * @private
 */
DD.fx.DragDropHelper.prototype.initDropTarget_ = function (containers)
{
	var i = 0,
		ln = containers.length,
		isSensor = DD.utils.UserAgent.isSensorDevice();

	this.DropTarget = new DD.fx.DropTarget({
		'pixelThreshold' : isSensor ? this.pixelThreshold_ : 0,
		'lapseThreshold' : isSensor ? this.lapseThreshold_ : 0
	});
	for (; i < ln; i++)
		this.DropTarget.setContainer(containers[i], this.allowClassNames_);
};

/**
 * Инициализация компонента DD.fx.DragScroll
 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DragScroll
 * @private
 */
DD.fx.DragDropHelper.prototype.initDragScroll_ = function (containers)
{
	var i = 0,
		ln = containers.length,
		isSensor = DD.utils.UserAgent.isSensorDevice();

	this.DragScroll = new DD.fx.DragScroll({
		'pixelThreshold' 	: isSensor ? this.pixelThreshold_ : 0,
		'lapseThreshold' 	: isSensor ? this.lapseThreshold_ : 0,
		'showScrollArea' 	: this.showScrollArea_,
		'scrollParent'  	: this.scrollParent_,
		'scrollParentMode'  : this.scrollParentMode_,
		'smoothScroll' 		: this.smoothScroll_,
	});
	for (; i < ln; i++)
		this.DragScroll.setContainer(containers[i]);
};

/**
 * Инициализация компонента DD.fx.ShuffleGrid
 * @param  {Array} array Массив DOM-элементов
 * @private
 */
DD.fx.DragDropHelper.prototype.initShuffleGrid_ = function (array)
{
	var i = 0,
		ln = array.length;

	for (; i < ln; i++)
		this.ShuffleGrids.push(new DD.fx.ShuffleGrid(
		{
			'container'		: array[i][0],
			'target'		: array[i][1],
			'gutter' 		: this.gridGutter_,
			'classname'		: this.allowClassNames_,
			'dropZoneTime'	: this.dropZoneTime_
		}));
};

/**
 * Связывание компонентов посредством событий
 * @private
 */
DD.fx.DragDropHelper.prototype.installEventDependence_ = function ()
{
	if (this.DragSource)
	{
		goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, function(event)
		{
			this.DragScroll && this.DragScroll.setDraggingElement(event);
			this.DropTarget && this.DropTarget.onGetDragSource(event);
		}, false, this);

		goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART, function(event)
		{
			this.DragScroll && this.DragScroll.onDragStart(event);
		}, false, this);

		goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGEND, function(event)
		{
			this.DragScroll && this.DragScroll.cancel();
		}, false, this);	
	};

	// Добавление элемента перетаскиваемого элемента в новый контейнер
	if (this.DropTarget)
		goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP, function(event)
		{
			if (event.dropArea && (event.dropArea.children.length == 0))
				event.dragSource && event.dropArea.appendChild(event.dragSource);
		});


	var countShuffleGrids = this.ShuffleGrids.length;
	for (var i = 0; i < countShuffleGrids; i++)
	{
		var ShuffleGrid = this.ShuffleGrids[i];

		if (this.DropTarget)
		{
			goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGOVER, function(event)
			{
				this.onDragOver(event);
			}, false, ShuffleGrid);

			goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP, function(event)
			{
				this.onDragDrop(event);
			}, false, ShuffleGrid);
		};

		if (this.DragSource)
		{
			goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, function(event)
			{
				this.onGetDragSource(event);
			}, false, ShuffleGrid);

			goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGEND, function(event)
			{
				this.cancel(event);
			}, false, ShuffleGrid);
		};

		if (this.DragScroll)
		{
			goog.events.listen(this.DragScroll, DD.fx.CustomDragDrop.EventType.DRAGOVER, function(event)
			{
				ShuffleGrid.breakDropOverScrolling(event.isScroll);
			}, false, ShuffleGrid);
		};
	};
};