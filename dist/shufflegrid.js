goog.provide('DD.fx.ShuffleGrid');
goog.require('DD.utils.UserAgent');
goog.require('goog.dom.dataset');

/**
 * Класс, имитирующий сетку для компонента DropTarget
 * @extends DD.ui.Component
 * @param {Object=} params Набор надстроек компонента
 * @author Антон Пархоменко
 * @this DD.fx.ShuffleGrid
 * @version 1.0.1
 * @class
 * @TODO Добавить возможность работать с сеткой, в которой находятся элементы произвольного (разного) размера
 */
DD.fx.ShuffleGrid = function(params)
{
	var defaults =
	{
		// Время, по истечению которого создается дроп зона
		dropZoneTime    : {'desktop': 0, 'sensor': 50},
		// Дельта расстояния между элементами сетки, обычно это либо margin
		gridGutter      : 0,
		// Режим замены элемента
		replaceDropMode : DD.fx.ShuffleGrid.replaceDropMode.FULL,
		// Включает режим для разработчиков
		debugMode       : false
	};

	if (!goog.isObject(params.dropZoneTime))
		params.dropZoneTime = {'desktop': params.dropZoneTime, 'sensor': params.dropZoneTime}

	/**
	 * Объект, хранящий список надстроек компонента
	 * @type {Object}
	 * @private
	 */
	this.params_ = this.assignParams(params, defaults);

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
	 * Текущая область для drop события
	 * @type {?HTMLElement}
	 * @private
	 */
	this.dropArea_ = null;

	/**
	 * Определяет является ли устройство сенсорным
	 * @type {Boolean}
	 * @private
	 */
	this.isSensor_ = DD.utils.UserAgent.isSensorDevice();

	/** 
	 * Надстройки сетки компонента
	 * @type {Object}
	 */
	this.Grid =
	{
		'source'    : this.params_.container || null,
		'class'     : this.params_.classname || '',
		'target'    : this.params_.target    || null
	};

	this.overlapItemDrop = this.overlapItemDrop.bind(this);
};

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

goog.scope(function()
{
	/** @alias DD.fx.ShuffleGrid.prototype */
	var prototype = DD.fx.ShuffleGrid.prototype;
	var superClass_ = DD.fx.ShuffleGrid.superClass_;

	/**
	 * Совмещение параметров по-умолчанию в параметрами, указанными в момент инициализации компонента
	 * @param  {Object} params   Список параметров, указанных в момент инициализации компонента
	 * @param  {Object} defaults Список парамметров по-умолчанию
	 * @return {Object}
	 */
	prototype.assignParams = function(params, defaults)
	{
		!params && (params = {});

		for (var prop in defaults)
		{
			if (prop in params && typeof params[prop] === 'object')
			{
				for (var subProp in defaults[prop])
					if (!(subProp in params[prop]))
						params[prop][subProp] = defaults[prop][subProp];
			}
			else if (!(prop in params))
				params[prop] = defaults[prop];
			else if ((prop in params) && params[prop] === undefined)
				params[prop] = defaults[prop];
		};

		return params;
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragStart = function(event)
	{
		try
		{
			if (!event.dragSource) return;
			this.update();
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('onDragStart', e);
		};
	};

	/**
	 * @inheritDoc
	 */
	prototype.onGetDragSource = function(event)
	{
		try
		{
			if (!event.dragSource) return;
			event.dragSource.currentGrid = event.source == this.Grid.source ? this.Grid.source : null;
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('onGetDragSource', e);
		};
	};

	/**
	 * Выполнение собыьтя onDragOver по умолчанию 
	 * @param  {DD.fx.CustomDragDrop.EventType} event 
	 */
	prototype.onDragOver = function(event)
	{
		try
		{
			var pointers = {},
			    cell = {},
			    scrollLeft = 0,
			    scrollTop = 0;

			if (event.dropArea != this.Grid.target)
			{
				if (!event.dropArea)
					throw new Error('No drop area defined');
				return;
			};

			// В случае, если задействована отличная от текущей сетки, вызывается метод обновления
			(event.dragSource.currentGrid != this.Grid.source) && this.update();

			// Координаты указателя на странице
			var pointer = {
				x : event.sourceEvent.pointers[0].pageX,
				y : event.sourceEvent.pointers[0].pageY
			};

			var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;

			// Координаты положения контейнера на странице
			var containerPos = this.Grid.source.getBoundingClientRect()

			/**
			 * Поолучение координат элемента относительно координат страницы и положения 
			 * текущего контейнера на странице
			 */
			var y = Math.floor((pointer.y - containerPos.top + this.Grid.target.scrollTop - scrollTop) / (this.Grid.rowSize + this.params_.gridGutter));
			// Получение крайнего левого элемента необходимо в случае если выравнивание элементов
			// осуществляется по центру, либо с помощью flex-конструкции
			var extremeLeftItem = this.getItemByCoord(0, y);
			var offsetLeft = extremeLeftItem.offsetLeft;
			var x = Math.floor((pointer.x - offsetLeft - containerPos.left + this.Grid.target.scrollLeft - 0) / (this.Grid.colSize + this.params_.gridGutter));
			cell = {
				x: x,
				y: y
			};

			event.clone.image_ = event.dragSource.image_;
			this.overlapItem_ = this.getItemByCoord(cell.x, cell.y);

			clearTimeout(this.dropZoneTimer_);

			/** Сбрасывается таймер, по истечении которого создается область сброса элемента */
			this.dropZoneTimer_ = setTimeout(function()
			{
				this.overlapItemDrop(this.overlapItem_, pointer, cell, event.clone, event.dragSource)
			}.bind(this), this.isSensor_ ? this.params_.dropZoneTime.sensor : this.params_.dropZoneTime.desktop);
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('onDragOver', e);
		};
	};

	/**
	 * Выполнение собыьтя onDragDrop по умолчанию 
	 * @param  {DD.fx.CustomDragDrop.EventType} event 
	 */
	prototype.onDragDrop = function(event)
	{
		try
		{
			this.reset(event.dragSource);
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('onDragDrop', e);
		};
	};

	/**
	 * Сбрасывает элемент до первоначального состояния
	 * @param  {HTMLElement} item Ссылка на DOM-элемент
	 */
	prototype.reset = function(item)
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
	prototype.cancel = function(event)
	{
		this.reset(event.dragSource);
	};

	prototype.breakDropOverScrolling = function(enable)
	{
		this.isScroll_ = enable;
	};

	/**
	 * Вставляет оригинал перетаскиваемошго объекта в необходимое место,
	 * справа или слева от объекта, над которым находится перетаскиваемый объект
	 * соблюдая правила переноса строк
	 * 
	 * @param   {HTMLElement}   item        Элемент, над которым произошло перекрытие
	 * @param   {Object}        pointer     Координаты указателя
	 * @param   {Object}        cell        Координаты X и Y элемента, над которым произошло перекрытие
	 * @param   {HTMLElement}   dragSource  ссылка на перетаскиваемый DOM-элемент
	 * @param   {HTMLElement}   origin      ссылка на оригинальный DOM-элемент, с которого создан клон. 
	 *                                      В DOM-структуре он присутствует, но невиден
	 */
	prototype.overlapItemDrop = function(item, pointer, cell, dragSource, origin)
	{
		try
		{
			if (!item || this.isScroll_) return;

			var index = this.Grid.items.indexOf(dragSource);
			/**
			 * Если указатель находится на левой части текущего элемента или если переносимый
			 * элемент находится в строке, расположенной ниже текущего, в зависимости от 
			 * текущего режима переноса элементов
			 */
			switch (this.params_.replaceDropMode)
			{
				case DD.fx.ShuffleGrid.replaceDropMode.FULL:
					if (cell.x < 0
					 || cell.x > this.Grid.cols - 1
					 || cell.y < 0 
					 || cell.y > this.Grid.rows)
					 // || this.Grid.cols * cell.y + cell.x > this.Grid.items.length - 1)
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
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('overlapItemDrop', e);
		};
	};

	/**
	 * Получает элемент через передаваемые координаты сетки
	 * @param  {Number} x       Индекс элемента в столбце
	 * @param  {Number} y       Индекс элемента в строке
	 * @return {HTMLElement}    item    Элемент из списка сетки
	 */
	prototype.getItemByCoord = function(x, y)
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
	prototype.update = function()
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
		if (item.style.display == 'none')
		{
			itemSize = {
				'width'  : +goog.dom.dataset.get(item, 'width'),
				'height' : +goog.dom.dataset.get(item, 'height')
			};
		}
		else itemSize = goog.style.getSize(item);

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
	prototype.columnsUpdate_ = function()
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
			localWidth += (this.Grid.items[i].offsetWidth || +goog.dom.dataset.get(this.Grid.items[i], 'width')) + this.params_.gridGutter;
			/** (i + 1) * 0.5: в случае процентной величины контейнера и элементов внутри него
			 *  размеры возвращаются дробные, и соответственно есть вероятность погрешности на 1px, потому
			 *  что некоторые браузеры, например IE округляют размеры в большую сторону.
			 *  Бывает и такое, что элементы на пол пикселя больше, и в FF получается так, что сумма ширин элементов в строке 
			 *  больше на 0,5*количество элементов в строке родительского контейнера
			 */
			if (localWidth > (globalWidth + ((i + 1) * 0.5)))
				break;

			this.Grid.cols++
		};
	};

	/**
	 * Вычисляет количество строк в столбце
	 * @private
	 */
	prototype.rowsUpdate_ = function()
	{
		this.Grid.rows = this.itemsLength_ / this.Grid.cols ^ 0;
	};

	/**
	 * Обновляет координаты элементов в сетке
	 */
	prototype.gridUpdate = function()
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

	/**
	 * Вывод сообщения об ошибка в консоль браузера
	 * @param  {String} component Название компонента, в котором произошла ошибка
	 * @param  {String} group     Название метода компонента, в котором произошла ошибка
	 * @param  {Object} error     Объект ошибки
	 */
	prototype.logError = function(group, error)
	{
		if (console)
		{
			console.group('DD.fx.ShuffleGrid.' + group);
			console.error(error.stack);
			console.groupEnd();
		};
	};
}); // goog.scoope