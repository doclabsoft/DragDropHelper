goog.provide('DD.fx.DragScroll');

goog.require('DD.fx.CustomDragDrop');
goog.require('goog.dom.dataset');
goog.require('goog.events.EventTarget');
goog.require('goog.fx.dom.Scroll');
goog.require('goog.fx.easing');

/**
 * Компонент, инкапсулирующий прокрутку контента контейнеров при переносе элементов
 * @param {Object=} settings Список входящих параметров
 * @extends DD.fx.CustomDragDrop
 * @author Антон Пархоменко
 * @this DD.fx.DragScroll
 * @constructor
 * @version 1.1.3
 * @todo Добавить возможность отобраджать области скроллирования по одной стороне, напрмиер, отображать только вертикальные области либо горизонтальные
 *       Добавить возможность запрещать скроллирования по одному из направлений
 */
DD.fx.DragScroll = function(containers, params)
{
	DD.fx.CustomDragDrop.call(this, params);

	var defaults =
	{
		// Продолжительность анимации скроллирования контейнера при помощи областей скроллирования
		scrollDuration      : 4000,
		// Величина поля для всех сторон контейнера в пикселах
		scrollPadding       : 50,
		// Задержка перед началом анимации скроллирования
		scrollDelay         : 100,
		// Скорость инерции 
		easingInertia       : 200,
		// Флаг, отвечающий за визуализацию областей скроллирования в контейнере
		showScrollArea      : true,
		// Показывает какие родительские контейнеры нужно скроллировать
		scrollParentMode    : DD.fx.DragScroll.scrollParentState.NOSCROLL
	};

	/**
	 * Массив скроллируемых контейнеров
	 * @type {Array}
	 * @private
	 */
	this.containers_ = containers;

	/**
	 * Объект, хранящий список надстроек компонента
	 * @type {Object}
	 * @private
	 */
	this.params_ = this.assignParams(params, defaults);

	/**
	 * Ширина скроллбара браузера
	 * @type {Number}
	 */
	this.scrollbarWidth_ = goog.style.getScrollbarWidth();

	/**
	 * Определяет, проиведено ли было нажатие на контейнер
	 * @type {Boolean}
	 * @default false
	 * @private
	 */
	this.isPress_ = false;

	/**
	 * Определяет, производится ли скроллирование контейнера
	 * @type {Boolean}
	 * @default false
	 * @private
	 */
	this.isScroll_ = false

	/**
	 * Текущая область, отвечающая за прокручивание контейнера
	 * @type {HTMLElement}
	 * @private
	 */
	this.currentScrollArea_ = null;

	/**
	 * Объект, содержащий сведения о границах скроллирования области,
	 * которая является скроллируемым родителем основного контейнера
	 * @type {Object}
	 */
	this.Edge = {}

	/**
	 * Содержит координаты областей скроллирования
	 * @type {Array}
	 * @private
	 */
	this.areaScrolls_ = [];

	this.hideScrollAreaByX = false;
	this.hideScrollAreaByY = false;
	/**
	 * Таймер запуска анимации скроллирования
	 * @type {Object}
	 * @private
	 */
	this.scrollStayAreaTimer_ = null;

	this.isScrollParent_ = false;

	this.directionsArray_ = [
		DD.fx.DragScroll.scrollDirection.TOP,
		DD.fx.DragScroll.scrollDirection.LEFT,
		DD.fx.DragScroll.scrollDirection.RIGHT,
		DD.fx.DragScroll.scrollDirection.BOTTOM
	];
	
	this.directionsArrayCount_ = this.directionsArray_.length;

	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,    this.onGetDragSource)
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGOVER,         this.onDragOver);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGDROP,         this.onDragDrop);
};
goog.inherits(DD.fx.DragScroll, DD.fx.CustomDragDrop);

/**
 * Определяет какие родительские контейнеры скроллировать и скроллировать ли их вообще
 * @enum {String}
 */
DD.fx.DragScroll.scrollParentState =
{
	/** Не скроллировать родительские контейнеры */
	NOSCROLL    : 'noscroll',
	/** Скроллировать все родительские контейнеры*/
	ALLSCROLL   : 'allscroll',
	/** Скроллировать родительские контейнеры, на которых есть свойство DragScroll,
	 *  показывающее, что на данный контейнер навешаны события такого же компонента DragScroll
	 */
	AKINSCROLL  : 'akinscroll'
};

/**
 * Направление прокрутки контейнера
 * @enum {String}
 */
DD.fx.DragScroll.scrollDirection =
{
	/** Прокрутка наверх */
	TOP     : 'top',
	/** Прокрутка влево */
	LEFT    : 'left',
	/** Прокрутка вправо */
	RIGHT   : 'right',
	/** Прокрутка вниз */
	BOTTOM  : 'bottom'
};

goog.scope(function()
{
	/** @alias DD.fx.DragScroll.prototype */
	var prototype = DD.fx.DragScroll.prototype;
	var superClass_ = DD.fx.DragScroll.superClass_;

	prototype.dispose = function()
	{
		superClass_.dispose.call(this);

		for (var i = 0, ln = this.container_.length; i < ln; i++)
		{
			this.container_[i].DragScroll.destroy();
			delete this.container_[i].DragScroll;
		};
	};

	/**
	 * Очищает массив областей, отвечающих за прокрутку скроллируемого контейнера
	 * @private
	 */
	prototype.clearScrollAreas_ = function()
	{
		if (this.params_.showScrollArea)
			for (var i = 0, ln = this.areaScrolls_.length; i < ln; i++)
				for (var x = 0, lnx = this.areaScrolls_[i].elements.length; x < lnx; x++)
					goog.dom.removeNode(this.areaScrolls_[i].elements[x]);

		this.areaScrolls_ = [];
	};

	/**
	 * Создает области скроллирования контейнера
	 * @param  {Array}  Текстовй массив, определяющий какие области скроллирования нужно создать
	 * @param  {Object} Параметры для определения областей скроллирования
	 * @return {Array}  Массив DOM-элементов, видимых областей скроллирования
	 * @private
	 */
	prototype.createScrollArea_ = function(directionArea, options)
	{
		var areas = {},
		    bounds = goog.style.getBounds(options.container),
		    iOSH = 0;

		// Исправление момента, когда на айфоне появляется нижняя область панели инструментов
		if (DD.utils.UserAgent.isiOSDevice())
		{
			var iOSToolbarHeight = DD.utils.UserAgent.getHeightOfIOSToolbars();
			// IPad & портретный вид & одна вкладка
			(bounds.height == 960 && iOSToolbarHeight == 40)  && (iOSH = 24);
			// IPad & портретный вид & большон одной вкладки в браузере
			(bounds.height == 927 && iOSToolbarHeight == 40)  && (iOSH = 57);
			// IPad & альбомный вид & большон одной вкладки в браузере
			(bounds.height == 671 && iOSToolbarHeight == 40)  && (iOSH = 57);
			// IPad & альбомный вид & одна вкладка
			(bounds.height == 671 && iOSToolbarHeight == 64)  && (iOSH = 33);
			(bounds.height == 480 && iOSToolbarHeight == 108) && (iOSH = -108);
			(bounds.height == 480 && iOSToolbarHeight == 39)  && (iOSH = -39);
			(bounds.height == 480 && iOSToolbarHeight == 0)   && (iOSH = -160);
			(bounds.height == 480 && iOSToolbarHeight == 88)  && (iOSH = -248);
			// IPhone 4
			(bounds.height == 320 && iOSToolbarHeight == 88)  && (iOSH = -88); //top:  182
			(bounds.height == 372 && iOSToolbarHeight == 39)  && (iOSH = 69); //top:  322
			// IPhone 5 портрет
			(bounds.height == 559 && iOSToolbarHeight == 39)  && (iOSH = 69); //top:  509
			// IPhone 5 альбом
			(bounds.height == 375 && iOSToolbarHeight == 44)  && (iOSH = -44); //top:  281
		};

		if (options.scrollY)
		{
			areas.top =
			{
				'x1' : bounds.left,
				'x2' : bounds.left + bounds.width,
				'y1' : bounds.top, 
				'y2' : bounds.top + this.params_.scrollPadding,
				'w'  : bounds.width,
				'h'  : this.params_.scrollPadding
			};
			areas.bottom =
			{
				'x1' : bounds.left,
				'x2' : bounds.left + bounds.width,
				'y1' : bounds.top + bounds.height - this.params_.scrollPadding + iOSH,
				'y2' : bounds.top + bounds.height + iOSH,
				'w'  : bounds.width,
				'h'  : this.params_.scrollPadding
			}
		};

		if (options.scrollX)
		{
			areas.left =
			{
				'x1' : bounds.left,
				'x2' : bounds.left + this.params_.scrollPadding,
				'y1' : bounds.top + this.params_.scrollPadding,
				'y2' : bounds.top + bounds.height - this.params_.scrollPadding,
				'w'  : this.params_.scrollPadding,
				'h'  : bounds.height - this.params_.scrollPadding * 2
			};
			areas.right =
			{
				'x1' : bounds.left + bounds.width - this.params_.scrollPadding,
				'x2' : bounds.left + bounds.width,
				'y1' : bounds.top + this.params_.scrollPadding,
				'y2' : bounds.top + bounds.height - this.params_.scrollPadding,
				'w'  : this.params_.scrollPadding,
				'h'  : bounds.height - this.params_.scrollPadding * 2
			};
		};

		// Если отображение областей скроллирование включено, добавляем их в DOM-структуру
		if (this.params_.showScrollArea)
		{
			areas.elements = [];
			for (var i = 0, areaCount = directionArea.length; i < areaCount; i++)
			{
				var dir = directionArea[i];

				if ((dir == DD.fx.DragScroll.scrollDirection.TOP || dir == DD.fx.DragScroll.scrollDirection.BOTTOM) && this.hideScrollAreaByY)
					continue;

				if ((dir == DD.fx.DragScroll.scrollDirection.LEFT || dir == DD.fx.DragScroll.scrollDirection.RIGHT) && this.hideScrollAreaByX)
					continue;

				var area = goog.dom.createDom(goog.dom.TagName.DIV, {'class' : 'scroll-area ' + dir + '-scrolling'});

				goog.style.setStyle(area,
				{
					'width'     : areas[dir].w  + 'px',
					'height'    : areas[dir].h  + 'px',
					'left'      : areas[dir].x1 + 'px',
					'top'       : areas[dir].y1 + 'px',
					'position'  : 'fixed',
					'z-index'   : '9999999'
				});

				areas.elements.push(area);
				document.body.appendChild(area);
			};
		};
		return areas;
	};

	prototype.setScrollAreaHideByAxis = function(axis)
	{
		if (axis === 'x' || axis === 'X')
			this.hideScrollAreaByX = true;
		else if (axis === 'y' || axis === 'Y')
			this.hideScrollAreaByY = true;
	};

	prototype.setScrollAreaShowByAxis = function(axis)
	{
		if (axis === 'x' || axis === 'X')
			this.hideScrollAreaByX = false;
		else if (axis === 'y' || axis === 'Y')
			this.hideScrollAreaByY = false;
	};

	/**
	 * Подготавливает скроллируемые области для начала скроллирования при событии DD.fx.CustomDragDrop.EventType.onDragStart
	 * @private
	 */
	prototype.prepareToScroll_ = function()
	{
		for (var i = 0, ln = this.containers_.length; i < ln; i++)
		{
			var container = this.containers_[i],
				scrollTop,
				position,
				bounds,
				scrollLeft,
				containerOption = {};

			/** Если нет подходящего контейнера, выходим из метода */
			if (!container) return;

			/** Если у контейнера не стоит соответствующее свойство position, то тут оно проставляется произвольно */
			position = goog.style.getComputedPosition(container);
			(position == 'static') && (container.style.position = 'relative');

			/** Получает размеры контейнера */
			bounds = goog.style.getBounds(container);

			/** В разных браузер скроллируются разные родительские глобальный врапперы, иногда BODY, иногд HTML.
			 *  Проверка нужна в случае, что бы определить что скроллировать в данный момент в случае, если передан BODY 
			 */

			if (container.nodeName == goog.dom.TagName.BODY || container.nodeName == goog.dom.TagName.HTML)
			{
				var currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
				if (currentScrollTop == 0)
				{
					container.scrollTop = 1;
					if (container.nodeName == goog.dom.TagName.BODY && !container.scrollTop)
						container = document.documentElement;
					else if (container.nodeName == goog.dom.TagName.HTML && !container.scrollTop)
						container = document.body;
					container.scrollTop = 0;
				}
				else
				{
					container = document.documentElement.scrollTop ? document.documentElement : document.body;
				}
			}
			else
				scrollTop = container.scrollTop;
			
			scrollLeft = container.scrollLeft;
			containerOption =
			{
				container   : container,
				st          : scrollTop,
				sl          : scrollLeft,
				sh          : container.scrollHeight,
				sw          : container.scrollWidth,
				ch          : container.clientHeight,
				cw          : container.clientWidth,
				position    : position,
				width       : bounds.width,
				height      : bounds.height
			};

			/**
			 * Проверка в погрешность 1px у свойств scrollWidth | scrollHeight нужна для IE браузера. В нем по какой-то причине 
			 * эти свойства на 1px больше в случае
			 */
			var scrollY = containerOption.sh == containerOption.ch || containerOption.sh - 1 == containerOption.ch ? false : true;
			var scrollX = containerOption.sw == containerOption.cw || containerOption.sw - 1 == containerOption.cw ? false : true;

			containerOption.scrollY = scrollY;
			containerOption.scrollX = scrollX;

			var limitHeight = containerOption.sh - containerOption.ch;
			var limitWidth = containerOption.sw - containerOption.cw;

			(limitHeight < 0) && (containerOption.scrollY = false);
			(limitWidth < 0) && (containerOption.scrollX = false);

			containerOption.limitHeight = limitHeight;
			containerOption.limitWidth = limitWidth;

			var areas = {};
			if (scrollY && scrollX)
				areas = this.createScrollArea_(['top', 'bottom', 'left', 'right'], containerOption);
			else if (scrollY)
				areas = this.createScrollArea_(['top', 'bottom'], containerOption);
			else if (scrollX)
				areas = this.createScrollArea_(['left', 'right'], containerOption);

			/** Создание и сохранение объекта, отвечающий за скроллирование контейнера */
			!goog.object.isEmpty(areas) && this.areaScrolls_.push(
			{
				'parentHeight'  : containerOption.height,
				'scrollTop'     : scrollTop,
				'scrollLeft'    : scrollLeft,
				'parent'        : container,
				'top'           : areas.top,
				'bottom'        : areas.bottom,
				'left'          : areas.left,
				'right'         : areas.right,
				'limitHeight'   : limitHeight,
				'limitWidth'    : limitWidth,
				'options'       : containerOption,
				'elements'      : areas.elements
			});
		};
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragStart = function(event)
	{
		if (!event.source) throw new Error('Scroll area is not defined');

		this.prepareToScroll_();
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragOver = function(event)
	{
		/**
		 * Выполнение события onDragOver по умолчанию
		 * @event
		 * @name DD.fx.DragScroll#onDragOver
		 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
		 * @param {HTMLElement} [scrollArea] Ссылка на DOM-элемент, является скроллируемым контейнером
		 * @param {DD.fx.DragScroll} [sender] DD.fx.DragScroll
		 */
		this.dispatchEvent(
		{
			'type'          : DD.fx.CustomDragDrop.EventType.DRAGOVER,
			'scrollArea'    : this.currentScrollArea_,
			'sender'        : this,
			'isScroll'      : this.isScroll_
		});

		var clientX = event.resource.clientX != undefined ? event.resource.clientX : event.resource.pointers[0].clientX,
			clientY = event.resource.clientY != undefined ? event.resource.clientY : event.resource.pointers[0].clientY,
			this_ = this,
			scrollDirection = '';

		/**
		 * Определеят находится ли указатель над одной из областей скроллирования
		 */
		for (var i = 0, ln = this.areaScrolls_.length; i < ln; i++)
		{
			for (var ii = 0; ii < this.directionsArrayCount_; ii++)
				if (this.areaScrolls_[i][this.directionsArray_[ii]] &&
					clientX >= this.areaScrolls_[i][this.directionsArray_[ii]].x1 &&
					clientX <= this.areaScrolls_[i][this.directionsArray_[ii]].x2 &&
					clientY >= this.areaScrolls_[i][this.directionsArray_[ii]].y1 &&
					clientY <= this.areaScrolls_[i][this.directionsArray_[ii]].y2)
					{
						scrollDirection = this.directionsArray_[ii];
						break;
					};

			if (scrollDirection)
			{
				this.currentScrollArea_ = this.areaScrolls_[i].parent;
				break;
			};
		};
		
		if (scrollDirection)
		{
			this_.isScroll_ = true;
			clearTimeout(this.scrollStayAreaTimer_);
			this.scrollStayAreaTimer_ = setTimeout(function()
			{
				this_.animateScrollElement(this_.currentScrollArea_, scrollDirection);

				/**
				 * Выполнение события onDragOverScroll по умолчанию
				 * @event
				 * @name DD.fx.DragScroll#onDragOverScroll
				 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
				 * @param {HTMLElement} [scrollArea] Ссылка на DOM-элемент, является скроллируемым контейнером
				 * @param {DD.fx.DragScroll} [sender] DD.fx.DragScroll
				 */
				this_.dispatchEvent(
				{
					'type'          : DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL,
					'scrollArea'    : this_.currentScrollArea_,
					'sender'        : this_
				});
			}, this.params_.scrollDelay);
		}
		else
		{
			this_.isScroll_ = false;
			clearTimeout(this.scrollStayAreaTimer_);
		};
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragDrop = function(event)
	{
		clearTimeout(this.scrollStayAreaTimer_);

		/** Если события press небыло, задаем останочную анимацию скролла */
		if (!this.isPress_ && event.pointerType != 'mouse')
		{
			// Новая позиция скролла
			var newScrollValue;

			/** Если должен скроллироваться родительский контейнер */
			if (this.isScrollParent_ && this.params_.scrollParentMode != DD.fx.DragScroll.scrollParentState.NOSCROLL)
			{
				var parent = this.scrollParents[0];
				if (!parent) return;

				goog.style.transform.setTranslation(parent, 0, 0);
				parent.scrollTop = parent.scrollTop - this.Edge.distance;
				parent.removeAttribute('style');

				newScrollValue = parent.scrollTop + event.velocityY * this.params_.easingInertia;
				this.smoothScroll(parent, parent.scrollTop, newScrollValue);
			}
			else
			{
				var velocityY = -(this.getVelocity_(event.deltaTime, event.deltaX, event.deltaY).y);
				newScrollValue = event.source.scrollTop + velocityY * this.params_.easingInertia;
				this.smoothScroll(event.source, event.source.scrollTop, newScrollValue);
			};
		};

		this.reset();
		this.cancel();
		this.animateScrollOptions_ = null;
	};

	/**
	 * Получение коэффициэнта скорости скроллирования
	 * @param  {Number} Временая дельта
	 * @param  {Number} Координата по Х-оси
	 * @param  {Number} Координата по Y-оси
	 * @return {Object}
	 * @private
	 */
	prototype.getVelocity_ = function(deltaTime, x, y)
	{
		return {
			x: x / deltaTime || 0,
			y: y / deltaTime || 0
		};
	};

	prototype.animateScrollElement = function(element, direction)
	{
		var elementSize = goog.style.getSize(element);
		this.animateScrollOptions_ =
		{
			'y' :
			{
				start       : direction == DD.fx.DragScroll.scrollDirection.BOTTOM ? element.scrollTop : 0,
				end         : direction == DD.fx.DragScroll.scrollDirection.BOTTOM ? element.scrollHeight - elementSize.height : element.scrollTop
			},
			'x' :
			{
				start       : direction == DD.fx.DragScroll.scrollDirection.RIGHT ? element.scrollLeft : 0,
				end         : direction == DD.fx.DragScroll.scrollDirection.RIGHT ? element.scrollWidth - elementSize.width : element.scrollLeft
			},
			'duration'      : this.params_.scrollDuration,
			'startTime'     : 0,
			'element'       : element,
			'direction'     : direction,
			'elementSize'   : elementSize
		};

		requestAnimationFrame(this.animateScrollStep_.bind(this));
	};

	/**
	 * Анимационное скроллирование контейнера в момент попадания координатной области скроллирования
	 * @param  {Number} timestamp Текущее время
	 * @private
	 */
	prototype.animateScrollStep_ = function(timestamp)
	{
		var o = this.animateScrollOptions_;
		if (!o) return;

		var y,
		    x,
		    speedDelta = .3,
		    elapsed;

		o.startTime = o.startTime || timestamp;
		elapsed = (timestamp - o.startTime) * speedDelta;

		if (o.direction == DD.fx.DragScroll.scrollDirection.BOTTOM || o.direction == DD.fx.DragScroll.scrollDirection.TOP)
		{
			y = o.direction == DD.fx.DragScroll.scrollDirection.TOP ? o.y.end - elapsed : o.y.start + elapsed;
			o.element.scrollTop = y;

			if (((o.element.scrollTop == 0) && (o.direction == DD.fx.DragScroll.scrollDirection.TOP)) ||
				((o.element.scrollTop == o.element.scrollHeight - o.element.offsetHeight) && (o.direction == DD.fx.DragScroll.scrollDirection.BOTTOM)))
				this.isScroll_ = false;
			else
				this.isScroll_ && requestAnimationFrame(this.animateScrollStep_.bind(this));
		}
		else if (o.direction == DD.fx.DragScroll.scrollDirection.LEFT || o.direction == DD.fx.DragScroll.scrollDirection.RIGHT)
		{
			x = o.direction == DD.fx.DragScroll.scrollDirection.LEFT ? o.x.end - elapsed : o.x.start + elapsed;
			o.element.scrollLeft = x;

			if (o.element.scrollLeft == 0 && o.direction == DD.fx.DragScroll.scrollDirection.LEFT ||
				o.element.scrollLeft == o.element.offsetWidth && o.direction == DD.fx.DragScroll.scrollDirection.RIGHT)
				this.isScroll_ = false;
			else
				this.isScroll_ && requestAnimationFrame(this.animateScrollStep_.bind(this));
		};
	};

	prototype.cancel = function()
	{
		this.clearScrollAreas_();
		this.isScroll_ = false;
	};

	prototype.reset = function()
	{
		this.isPress_ = false;
		this.clearDragObject();
		this.Edge = {};
	};

}); // goog.scope