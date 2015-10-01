goog.provide('DD.fx.ShuffleGrid');
// goog.require('DD.ui.Component');
/**
 * Класс, имитирующий сетку для компонента DropTarget
 * @extends DD.ui.Component
 * @param {Object=} options Набор надстроек компонента
 * @author Антон Пархоменко
 * @this DD.fx.ShuffleGrid
 * @version 1.0.1
 * @class
 * @TODO Добавить возможность работать с сеткой, в которой находятся элементы произвольного (разного) размера
 */
DD.fx.ShuffleGrid = function(options)
{
	options = options || {};

	/**
	 * Время, по истечению которого создается дроп зона
	 * @type {Number}
	 * @default 100
	 * @private
	 */
	this.dropZoneTime_ = options.dropZoneTime || 100;

	/**
	 * Дельта расстояния между элементами сетки, обычно это либо margin
	 * @type {Number}
	 */
	this.gridGutter = options.gutter || 0;

	/**
	 * Режим замены элемента
	 * @type {DD.fx.ShuffleGrid.replaceDropMode}
	 * @private
	 */
	this.replaceDropMode_ = options.replaceDropMode || DD.fx.ShuffleGrid.replaceDropMode.FULL;

	this.overlapItemDrop = this.overlapItemDrop.bind(this);

	/**
	 * Получение элемента под курсором в сетке компонента
	 * @type {?HTMLElement}
	 * @private
	 */
	this.overlapItem_ = null;
	
	/**
	 * Таймер на выполнения создания зоны дропа перетаскиваемого элемента
	 * @type {?Object}
	 * @private
	 */
	this.dropZoneTimer_ = null;

	/** 
	 * Надстройки сетки компонента
	 * @type {Object}
	 */
	this.Grid =
	{
		'source' 	: options.container || null,
		'class' 	: options.classname || '',
		'target'	: options.target 	|| null
	};
};
DD.fx.ShuffleGrid.prototype.dropArea_;

/**
 * Список режимов переноса элемента при нахлестывании образом переносимого элемента 
 * одного из элементов в сетке компонента
 * @enum {Number}
 */
DD.fx.ShuffleGrid.replaceDropMode =
{
	FULL: 1,
	HALF: 0
};

/**
 * Выполнение события onGetDragSource по умолчанию 
 * @param  {DD.fx.CustomDragDrop.EventType} event 
 */
DD.fx.ShuffleGrid.prototype.onGetDragSource = function(event)
{
	if (!event.dragSource)
		return false;
	
	// console.log('onGetDragSource');
	this.update();

	if (event.source == this.Grid.source)
		event.dragSource.currentGrid = this.Grid.source;
};

/**
 * Выполнение собыьтя onDragOver по умолчанию 
 * @param  {DD.fx.CustomDragDrop.EventType} event 
 */
DD.fx.ShuffleGrid.prototype.onDragOver = function(event)
{
	var pointers = {},
		cell = {},
		scrollLeft = 0,
		scrollTop = 0,
		this_ = this;

	if (event.dropArea != this.Grid.target)
	{
		if (!event.dropArea)
			throw new Error('No drop area defined');
		return false;
	};

	// В случае, если задействована отличная от текущей сетки, вызывается метод обновления
	(event.dragSource.currentGrid != this.Grid.source) && this.update();

	// Координаты указателя на странице
	pointer =
	{
		x: event.sourceEvent.pointers[0].pageX,
		y: event.sourceEvent.pointers[0].pageY
	};

	// Получение значения скролла у body
	var scrollOffset = goog.style.getContainerOffsetToScrollInto(document.documentElement, document.body);

	// Координаты положения контейнера на странице
	var containerPos = this.Grid.source.getBoundingClientRect()

	/**
	 * Поолучение координат элемента относительно координат страницы и положения 
	 * текущего контейнера на странице
	 */
	cell = 
	{
		x: Math.floor((pointer.x - containerPos.left + this.Grid.target.scrollLeft - scrollOffset.x) / (this.Grid.colSize + this.gridGutter)),
		y: Math.floor((pointer.y - containerPos.top + this.Grid.target.scrollTop - scrollOffset.y) / (this.Grid.rowSize + this.gridGutter))
	};

	event.copy.image_ = event.dragSource.image_;
	this.overlapItem_ = this.getItemByCoord(cell.x, cell.y);

	clearTimeout(this.dropZoneTimer_);
	/** Сбрасывается таймер, по истечении которого создается область сброса элемента */
	this.dropZoneTimer_ = setTimeout(function()
	{
		this_.overlapItemDrop(this_.overlapItem_, pointer, cell, event.copy, event.dragSource)
	}, this.dropZoneTime_);
};

/**
 * Выполнение собыьтя onDragDrop по умолчанию 
 * @param  {DD.fx.CustomDragDrop.EventType} event 
 */
DD.fx.ShuffleGrid.prototype.onDragDrop = function(event)
{
	// console.log('event.dragSource');
	this.reset(event.dragSource);
};

/**
 * Сбрасывает элемент до первоначального состояния
 * @param  {HTMLElement} item Ссылка на DOM-элемент
 */
DD.fx.ShuffleGrid.prototype.reset = function(item)
{
	/** Сбрасывается таймер, по истечении которого создается область сброса элемента */
	this.dropZoneTimer_ && clearTimeout(this.dropZoneTimer_);

	item && (item.style.visibility = 'visible');
};

/**
 * Прерывает событие перетаскивания образа, удаляя образ и сбрасывая состояния элемента до 
 * первоначального
 * @param  {Event} event
 */
DD.fx.ShuffleGrid.prototype.cancel = function(event)
{
	this.reset(event.dragSource);
};

DD.fx.ShuffleGrid.prototype.breakDropOverScrolling = function(enable)
{
	this.isScroll_ = enable;
};

/**
 * Вставляет оригинал перетаскиваемошго объекта в необходимое место,
 * справа или слева от объекта, над которым находится перетаскиваемый объект
 * соблюдая правила переноса строк
 * 
 * @param  	{HTMLElement}  	item    	Элемент, над которым произошло перекрытие
 * @param  	{Object} 		pointer 	Координаты указателя
 * @param  	{Object} 		cell    	Координаты X и Y элемента, над которым произошло перекрытие
 * @param 	{HTMLElement}	dragSource  ссылка на перетаскиваемый DOM-элемент
 * @param 	{HTMLElement}	origin  	ссылка на оригинальный DOM-элемент, с которого создан клон. 
 *                                		В DOM-структуре он присутствует, но невиден
 */
DD.fx.ShuffleGrid.prototype.overlapItemDrop = function(item, pointer, cell, dragSource, origin)
{
	if (!item)
		return;

	if (this.isScroll_)
		return;

	var index = this.Grid.items.indexOf(dragSource);
	/**
	 * Если указатель находится на левой части текущего элемента или если переносимый
	 * элемент находится в строке, расположенной ниже текущего, в зависимости от 
	 * текущего режима переноса элементов
	 */
	switch (this.replaceDropMode_)
	{
		case DD.fx.ShuffleGrid.replaceDropMode.FULL:
			if (cell.x < 0
			 || cell.x > this.Grid.cols - 1
			 || cell.y < 0 
			 ||	cell.y > this.Grid.rows
			 || this.Grid.cols * cell.y + cell.x > this.Grid.items.length - 1)
				break;

			var ind = cell.x + (cell.y * this.Grid.cols);

			/** Условие возникает в том случае, если ресурс был перенесен из другой сетки */
			if (origin.currentGrid != this.Grid.source)
			{
				var size = goog.style.getSize(item);
				goog.dom.insertSiblingBefore(dragSource, item);
				goog.style.setSize(dragSource, size.width, size.height);
				goog.style.setSize(dragSource.image_, size.width, size.height);
				this.Grid.items.splice(ind, 0, dragSource);
				origin.currentGrid = this.Grid.source;
				this.columnsUpdate_();
				this.gridUpdate();
				break;
			}

			if ((this.Grid.coord[index].x < cell.x && this.Grid.coord[index].y <= cell.y) || this.Grid.coord[index].y < cell.y)
			{
				goog.dom.insertSiblingAfter(dragSource, item);
				var remItem = this.Grid.items.splice(index, 1)[0];
				this.Grid.items.splice(ind, 0, remItem);
			}
			else
			{
				if (cell.x == this.Grid.coord[index].x && cell.y == this.Grid.coord[index].y)
					break;
				goog.dom.insertSiblingBefore(dragSource, item);
				var remItem = this.Grid.items.splice(index, 1)[0];
				this.Grid.items.splice(ind, 0, remItem);
			}
			break;
		/** по-умолчанию DD.fx.ShuffleGrid.replaceDropMode */
		default:
			// Получает границы элемента на страницу
			var itemBounds = goog.style.getBounds(item);
			if ((pointer.x < itemBounds.left + itemBounds.width / 2) && this.dragSource_.gridY < cell.y)
				goog.dom.insertSiblingAfter(this.dragSource_.item, item);
			else if ((pointer.x < itemBounds.left + itemBounds.width / 2) || this.dragSource_.gridY > cell.y)
				goog.dom.insertSiblingBefore(this.dragSource_.item, item);
			else
				goog.dom.insertSiblingAfter(this.dragSource_.item, item);
	};
};

/**
 * Получает элемент через передаваемые координаты сетки
 * @param  {Number} x 		Индекс элемента в столбце
 * @param  {Number} y 		Индекс элемента в строке
 * @return {HTMLElement}  	item 	Элемент из списка сетки
 */
DD.fx.ShuffleGrid.prototype.getItemByCoord = function(x, y)
{
	var item;

	if (x > this.Grid.cols - 1)
		item = this.Grid.items[this.Grid.cols - 1 + (y * this.Grid.cols)]
	else if (x < 0)
		item = this.Grid.items[0 + (y * this.Grid.cols)]
	else
		item = this.Grid.items[x + (y * this.Grid.cols)];

	if (item == undefined)
		item = this.Grid.items[this.Grid.items.length - 1];

	return item;
};

/**
 * Обновляет сетку элементов
 */
DD.fx.ShuffleGrid.prototype.update = function()
{
	/**
	 * Получение диапазона сетки, что бы исключить поиск элементов за ее пределами
	 */
	var h = this.Grid.target.offsetHeight,
		w = this.Grid.target.offsetWidth,
		items,
		item,
		itemSize;

	this.Grid.items = [];

	/**
	 * Получает список всех потомков контейнера через класс
	 * Возможно в дальнейшем это можно упростить и просто брать всех первых потомков контейнера
	 */
	items = goog.dom.getElementsByClass(this.Grid.class, this.Grid.source);

	/** В список элементов не попадает элемент с атрибутом data-origin */
	for (var i = 0, ln = items.length; i < ln; i++)
		!items[i].dataset.origin && this.Grid.items.push(items[i]);
	this.itemsLength_ = this.Grid.items.length;
	if (this.itemsLength_ < 1)
		return false;

	/**
	 * Считается, что все потомки равны по ширине и высоте, соответственно достаточно будет
	 * взять первого потомка в списке и узнать его размеры
	 */
	item = this.Grid.items[0];

	/** Получает размеры элемента, первого потомка контейнера сетки */
	itemSize = goog.style.getSize(item);

	/** Получает размеры одного элемента сетки */
	this.Grid.colSize = itemSize.width;
	this.Grid.rowSize = itemSize.height;

	/** Обновление количества столбцов */
	this.columnsUpdate_();
	/** Обновление количества строк */
	this.rowsUpdate_()
	/** Обновление координатов сетки элементов */
	this.gridUpdate();
};

/**
 * Вычисляет количество столбцов в строке
 * @private
 */
DD.fx.ShuffleGrid.prototype.columnsUpdate_ = function()
{
	/**
	 * Получение ширины и высоты блока контейнера, его скроллируемые размеры, посколько берется scrollWidth
	 * контейнера, то нет необходимости вычислять ширину полосы прокрутки, так как возвращается значение с вычетом
	 * ширины полосы прокрутки в случае, если она есть
	 */
	var globalWidth = this.Grid.source.scrollWidth,
		localWidth = this.Grid.cols = 0;

	for (var i = 0, ln = this.Grid.items.length; i < ln; i++)
	{
		localWidth += (this.Grid.items[i].offsetWidth || +goog.dom.dataset.get(this.Grid.items[i], 'width')) + this.gridGutter;
		/** +1: в случае процентной величины контейнера и элементов внутри него
		 *  размеры возвращаются дробные, и соответственно есть вероятность погрешности на 1px, потому
		 *  что некоторые браузеры, например IE округляют размеры в большую сторону.
		 */
		if (localWidth > (globalWidth + 1))
			break;

		this.Grid.cols++
	};
};

/**
 * Вычисляет количество строк в столбце
 * @private
 */
DD.fx.ShuffleGrid.prototype.rowsUpdate_ = function()
{
	this.Grid.rows = this.itemsLength_ / this.Grid.cols ^ 0;
};

/**
 * Обновляет координаты элементов в сетке
 */
DD.fx.ShuffleGrid.prototype.gridUpdate = function()
{
	this.Grid.coord = [];
	
	for (var j = 0, x = 0, y = 0, ln = this.Grid.items.length; j < ln; j++, x++)
	{
		if (x > this.Grid.cols - 1)
		{
			x = 0;
			y++;
		};
		this.Grid.coord.push({'x': x, 'y': y});
	};
};