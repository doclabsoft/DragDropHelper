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

	this.allowClassNames_       = 'allowClassNames' in settings ? settings.allowClassNames : '';
	this.showScrollArea_        = 'showScrollArea'  in settings ? settings.showScrollArea  : false;

	this.gridGutter_            = settings.gridGutter;
	this.dropZoneTime_          = settings.dropZoneTime;
	this.pixelThreshold_        = settings.pixelThreshold;
	this.lapseThreshold_        = settings.lapseThreshold;
	this.scrollParentMode_      = settings.scrollParentMode;
	this.scrollParent_          = settings.scrollParent;
	this.smoothScroll_          = settings.smoothScroll;
	this.ignored_               = settings.ignoreClassNames;
	this.imageAlign_            = settings.imageAlign;
	this.showDefaultImageTime_  = settings.showDefaultImageTime;
	this.showDragImage_         = settings.showDragImage;
	this.debugMode_             = settings.debugMode;
	this.dragObjectContainer_   = settings.dragObjectContainer;

	this.source_ = 'source' in settings ? settings.source : [];
	(this.source_.length > 0) && this.initDragSource_(this.source_);

	this.target_ = 'target' in settings ? settings.target : [];
	(this.target_.length > 0) && this.initDropTarget_(this.target_);

	this.scroll_ = 'scroll' in settings ? settings.scroll : [];
	(this.scroll_.length > 0) && this.initDragScroll_(this.scroll_);

	this.grid_ 	= 'grid' in settings ? settings.grid : [];
	(this.grid_.length > 0) && this.initShuffleGrid_(this.grid_);

	this.installEventDependence_();

	this.onCreateImage    = goog.isFunction(settings.onCreateImage)     ? settings.onCreateImage    : null;
	this.onGetDragSource  = goog.isFunction(settings.onGetDragSource)   ? settings.onGetDragSource  : null;
	this.onDragStart      = goog.isFunction(settings.onDragStart)       ? settings.onDragStart      : null;
	this.onDragEnd        = goog.isFunction(settings.onDragEnd)         ? settings.onDragEnd        : null;
	this.onDragOverScroll = goog.isFunction(settings.onDragOverScroll)  ? settings.onDragOverScroll : null;
	this.onDragDrop       = goog.isFunction(settings.onDragDrop)        ? settings.onDragDrop       : null;
	this.onGetDropTarget  = goog.isFunction(settings.onGetDropTarget)   ? settings.onGetDropTarget  : null;
	this.onDragOver       = goog.isFunction(settings.onDragOver)        ? settings.onDragOver       : null;

	this.enterDocument();
};
goog.inherits(DD.fx.DragDropHelper, DD.fx.CustomDragDrop);

goog.scope(function()
{
	/** @alias DD.fx.DragDropHelper.prototypee */
    var prototype = DD.fx.DragDropHelper.prototype;

	/**
	 * Компонент DD.fx.DragSource
	 * @type {DD.fx.DragSource}
	 */
	prototype.DragSource = null;

	/**
	 * Компонент DD.fx.DropTarget
	 * @type {DD.fx.DropTarget}
	 */
	prototype.DropTarget = null;

	/**
	 * Компонент DD.fx.DragScroll
	 * @type {DD.fx.DragScroll}
	 */
	prototype.DragScroll = null;

	/**
	 * Список компонентов DD.fx.ShuffleGrids
	 * @type {DD.fx.ShuffleGrids}
	 */
	prototype.ShuffleGrids = null;

	prototype.enterDocument = function ()
	{
		if (this.DragSource)
		{
			if (this.onCreateImage)
			{
				goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.CREATEIMAGE, this.onCreateImage, false, this);
				this.DragSource.setShowDefaultImage(false);
			};

			this.onGetDragSource  && goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,  this.onGetDragSource,   false, this);
			this.onDragStart      && goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART,      this.onDragStart,       false, this);
			this.onDragOver       && goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGOVER,       this.onDragOver,        false, this);
		};

		if (this.DragScroll)
			this.onDragOverScroll && goog.events.listen(this.DragScroll, DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL, this.onDragOverScroll,  false, this);

		if (this.DropTarget)
		{
			this.onDragEnd        && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGEND,        this.onDragEnd,         false, this);
			this.onDragDrop       && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP,       this.onDragDrop,        false, this);
			this.onGetDropTarget  && goog.events.listen(this.DropTarget, DD.fx.CustomDragDrop.EventType.GETDROPTARGET,  this.onGetDropTarget,   false, this);
		};
	};

	/**
	 * Отвязывание событий
	 */
	prototype.exitDocument = function ()
	{
		this.onCreateImage    && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.CREATEIMAGE,      this.onCreateImage,     false, this);
		this.onGetDragSource  && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,    this.onGetDragSource,   false, this);
		this.onDragStart      && goog.events.unlisten(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART,        this.onDragStart,       false, this);
		this.onDragOverScroll && goog.events.unlisten(this.DragScroll, DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL,   this.onDragOverScroll,  false, this);
		this.onDragEnd        && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGEND,          this.onDragEnd,         false, this);
		this.onDragDrop       && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGDROP,         this.onDragDrop,        false, this);
		this.onGetDropTarget  && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.GETDROPTARGET,    this.onGetDropTarget,   false, this);
		this.onDragOver       && goog.events.unlisten(this.DropTarget, DD.fx.CustomDragDrop.EventType.DRAGOVER,         this.onDragOver,        false, this);
	};

	/**
	 * Удаление компонента и списка компонентов в случае, если они созданы
	 */
	prototype.dispose = function()
	{
		this.DragSource && this.DragSource.dispose();
		this.DropTarget && this.DropTarget.dispose();
		this.DragScroll && this.DragScroll.dispose();

		this.exitDocument();
	};

	/**
	 * Получение копии переносимого элемента, который в данный момент виден на странице, так как оригинал скрыт, но тоже присутствует на странице
	 * @return {HTMLElement}
	 */
	prototype.getCopy = function ()
	{
		return this.DragSource.getCopy_();
	};

	/**
	 * Получение образа переносимого элемента
	 * @return {HTMLElement}
	 */
	prototype.getItemImage = function ()
	{
		return this.DragSource.getItemImage();
	};

	/**
	 * Сброс состояния компонента до первоначального
	 */
	prototype.reset = function ()
	{
		this.DragSource.reset();
		this.DropTarget.reset();
		this.DragScroll.reset();
	};

	/**
	 * Устанавливает пользовательский образ переносимого элемента
	 * @param {HTMLElement} value Ссылка на DOM-элемент, которые является пользовательским образом переносимого элемента
	 * @param {Number} 		align Выравнивание образа под курсором во время перемещения
	 */
	prototype.setCustomDragImage = function (value, align)
	{
		this.DragSource.setCustomDragImage(value, align);
	};

	/**
	 * Инициализация компонента DD.fx.DragSource
	 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DragSource
	 * @private
	 */
	prototype.initDragSource_ = function (containers)
	{
		this.DragSource = new DD.fx.DragSource({
			pixelThreshold       : this.pixelThreshold_,
			lapseThreshold       : this.lapseThreshold_,
			imageAlign           : this.imageAlign_,
			ignored              : this.ignored_,
			showDefaultImageTime : this.showDefaultImageTime_,
			showDragImage        : this.showDragImage_,
			debugMode            : this.debugMode_,
			dragObjectContainer  : this.dragObjectContainer_
		});

		this.DragSource.setContainer(containers, this.allowClassNames_);
	};

	/**
	 * Инициализация компонента DD.fx.DropTarget
	 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DropTarget
	 * @private
	 */
	prototype.initDropTarget_ = function (containers)
	{
		var i = 0,
			ln = containers.length;

		this.DropTarget = new DD.fx.DropTarget({
			pixelThreshold  : this.pixelThreshold_,
			lapseThreshold  : this.lapseThreshold_,
			showDragImage   : this.showDragImage_,
			debugMode       : this.debugMode_
		});

		for (; i < ln; i++)
			this.DropTarget.setContainer(containers[i], this.allowClassNames_);
	};

	/**
	 * Инициализация компонента DD.fx.DragScroll
	 * @param  {HTMLElement} containers Массив DOM-элементов, контейнеров, к которым относится DragScroll
	 * @private
	 */
	prototype.initDragScroll_ = function (containers)
	{
		var i = 0,
			ln = containers.length;

		this.DragScroll = new DD.fx.DragScroll(containers, {
			pixelThreshold    : this.pixelThreshold_,
			lapseThreshold    : this.lapseThreshold_,
			showScrollArea    : this.showScrollArea_,
			scrollParent      : this.scrollParent_,
			scrollParentMode  : this.scrollParentMode_,
			smoothScroll      : this.smoothScroll_,
			debugMode         : this.debugMode_
		});
	};

	prototype.setScrollAreaHideByAxis = function (value)
	{
		this.DragScroll && this.DragScroll.setScrollAreaHideByAxis(value);
	};

	prototype.setScrollAreaShowByAxis = function (value)
	{
		this.DragScroll && this.DragScroll.setScrollAreaShowByAxis(value);
	};

	/**
	 * Инициализация компонента DD.fx.ShuffleGrid
	 * @param  {Array} array Массив DOM-элементов
	 * @private
	 */
	prototype.initShuffleGrid_ = function (array)
	{
		var i = 0,
			ln = array.length;

		this.ShuffleGrids = [];
		for (; i < ln; i++)
			this.ShuffleGrids.push(new DD.fx.ShuffleGrid(
			{
				container      : array[i][0],
				target         : array[i][1],
				gridGutter     : this.gridGutter_,
				classname      : this.allowClassNames_,
				dropZoneTime   : this.dropZoneTime_,
				debugMode      : this.debugMode_
			}));
	};

	/**
	 * Связывание компонентов посредством событий
	 * @private
	 */
	prototype.installEventDependence_ = function ()
	{
		if (this.DragSource)
		{
			goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, function(event)
			{
				this.DropTarget && this.DropTarget.onGetDragSource(event);
			}, false, this);

			goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART, function(event)
			{
				this.DragScroll && this.DragScroll.onDragStart(event);
				this.DropTarget && this.DropTarget.onDragStart(event);
			}, false, this);

			goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGOVER, function(event)
			{
				this.DragScroll && this.DragScroll.onDragOver(event);
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

		var countShuffleGrids = this.ShuffleGrids ? this.ShuffleGrids.length : 0;
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

				goog.events.listen(this.DragSource, DD.fx.CustomDragDrop.EventType.DRAGSTART, function(event)
				{
					this.onDragStart(event);
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
}); // goog.scoope