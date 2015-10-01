goog.provide('DD.fx.DragScroll');

goog.require('DD.fx.CustomDragDrop');
goog.require('goog.dom.dataset');
goog.require('goog.events.EventTarget');
goog.require('goog.fx.dom.Scroll');
goog.require('goog.fx.easing');

/**
 * Компонент, инкапсулирующий прокрутку контента контейнеров при drag and drop
 * @param {Object=} settings Список входящих параметров
 * @extends DD.fx.CustomDragDrop
 * @author Антон Пархоменко
 * @this DD.fx.DragScroll
 * @constructor
 * @version 1.0.1
 * @todo Добавить плавную анимацию остаточного скроллирования по горизонтали.
 */
DD.fx.DragScroll = function(settings)
{
	settings = settings || {};

	DD.fx.CustomDragDrop.call(this, settings);

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


	/** Продолжительность анимации плавного (инерционного) скроллирования контейнера.
	 * @type {Number}
	 * @default 1500
	 * @private
	 */
	this.easingDuration_ = 1500;

	/**
	 * Хранит объект анимации
	 * @type {Object}
	 * @private
	 */
	this.tweenScroll_ = null;

	/**
	 * Определяет, производится ли скроллирование контейнера
	 * @type {Boolean}
	 * @default false
	 * @private
	 */
	this.isScroll_ = false

	this.easingInertia_ = 200;
	/**
	 * Продолжительность анимации скроллирования контейнера при помощи областей скроллирования
	 * @type {Number}
	 * @default 4000
	 * @private
	 */
	this.scrollDuration_ = 4000;

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
	 * @private
	 */
	this.Edge = {}

	/**
	 * Величина поля для всех сторон контейнера в пикселах
	 * @type {Number}
	 */
	this.scrollPadding = 50;

	/**
	 * Содержит координаты областей скроллирования
	 * @type {Array}
	 * @private
	 */
	this.areaScrolls_ = [];

	/**
	 * Таймер запуска анимации скроллирования
	 * @type {Object}
	 * @private
	 */
	this.scrollStayAreaTimer_ = null;

	/**
	 * Задержка перед началом анимации скроллирования
	 * @type {Number}
	 * @private
	 */
	this.scrollDelay_ = 100;

	/**
	 * Флаг, отвечающий за визуализацию областей скроллирования в контейнере
	 * @type {Boolean}
	 */
	this.isScrollAreaVisible_ = 'showScrollArea' in settings ? settings.showScrollArea : false;

	/**
	 * Показывает какие родительские контейнеры нужно скроллировать
	 * @type {DD.fx.DragScroll.scrollParentState}
	 */
	this.scrollParentMode_ = settings.scrollParentMode || DD.fx.DragScroll.scrollParentState.NOSCROLL;

	/**
	 * Пиксельный порог захвата
	 * @type {Number}
	 * @default 0
	 */
	this.pixelThreshold = 'pixelThreshold' in settings ? settings.pixelThreshold === undefined ? 0 : settings.pixelThreshold : 0;


	this.isScrollParent_ = false;

	this.directionsArray_ = [
		DD.fx.DragScroll.scrollDirection.TOP,
		DD.fx.DragScroll.scrollDirection.LEFT,
		DD.fx.DragScroll.scrollDirection.RIGHT,
		DD.fx.DragScroll.scrollDirection.BOTTOM
	];
	
	this.directionsArrayCount_ = this.directionsArray_.length;

	/**
	 * Временной порог захвата в ms
	 * @type {Number}
	 * @default 300
	 */
	this.lapseThreshold = 'lapseThreshold' in settings ? settings.lapseThreshold === undefined ? 300 : settings.lapseThreshold : 300;

	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, 	this.onGetDragSource)
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGOVER, 		this.onDragOver);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGDROP, 		this.onDragDrop);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.PINCH, 			this.onPinch);

	this.applyRequestPolyfill();
};
goog.inherits(DD.fx.DragScroll, DD.fx.CustomDragDrop);

/**
 * Определяет какие родительские контейнеры скроллировать и скроллировать ли их вообще
 * @enum {String}
 */
DD.fx.DragScroll.scrollParentState =
{
	/** Не скроллировать родительские контейнеры */
	NOSCROLL 	: 'noscroll',
	/** Скроллировать все родительские контейнеры*/
	ALLSCROLL 	: 'allscroll',
	/** Скроллировать родительские контейнеры, на которых есть свойство DragScroll,
	 * 	показывающее, что на данный контейнер навешаны события такого же компонента DragScroll
	 */
	AKINSCROLL 	: 'akinscroll'
};

/**
 * Направление прокрутки контейнера
 * @enum {String}
 */
DD.fx.DragScroll.scrollDirection =
{
	/** Прокрутка наверх */
	TOP 	: 'top',
	/** Прокрутка влево */
	LEFT 	: 'left',
	/** Прокрутка вправо */
	RIGHT 	: 'right',
	/** Прокрутка вниз */
	BOTTOM 	: 'bottom'
};

/**
 * Задает контейнер(ы), участвующие в работе дочерних компонентов
 * @param 	{Array} 	container 		Контейнер или массив контейнеров, являющиеся источником
 * @param 	{Array=} 	opt_allow 		Строковый массив, отвечающий за возможность перетаскивания того или иного
 *                              		элемента, в случае, если ничего не передано, то перетаскиваться
 *                              		будут все элементы, которые были указаны в источнике
 * @return 	{Array} 	this.container_	Контейнер или массив контейнеров, указанные в роли источников
 */
DD.fx.DragScroll.prototype.setContainer = function(container, opt_allow)
{
	var count = this.container_.length;

	DD.fx.DragScroll.superClass_.setContainer.call(this, container, opt_allow);

	/**
	 * Если в качестве контейнера передан html или body, идет поиск на скроллирование элемента
	 * так как в разных браузерах скроллируются разныеэ элементы
	 * где-то body, где-то html
	 */
	var this_ = this;

	for (var i = count, ln = this.container_.length; i < ln; i++)
	{
		if (this.container_[i].nodeName == 'BODY' || this.container_[i].nodeName == 'HTML')
			this.container_[i] = this.getDocumentScrollElement_();

		this.container_[i].addEventListener('mousedown', function(event)
		{
			this_.startTouchPointer_ =
			{
				'x' : event.screenX,
				'y' : event.screenY
			};

			/** Получение краев скроллирования основного контейнера */
			this_.Edge.scrollEdge = this_.getScrollEdge_(event.currentTarget);
			this_.Edge.active = this_.isReachedEdge_(event.currentTarget)

			this_.isScrollParent_ = false;

			/** Если анимация скролла все еще присутствует, останавливаем ее */
			this_.tweenScroll_ && this_.tweenScroll_.pause();
		});

		this.container_[i].addEventListener('touchstart', function(event)
		{
			this_.startTouchPointer_ =
			{
				'x' : event.touches[0].screenX,
				'y' : event.touches[0].screenY
			};

			/** Получение краев скроллирования основного контейнера */
			this_.Edge.scrollEdge = this_.getScrollEdge_(event.currentTarget);
			this_.Edge.active = this_.isReachedEdge_(event.currentTarget)

			this_.isScrollParent_ = false;

			/** Если анимация скролла все еще присутствует, останавливаем ее */
			this_.tweenScroll_ && this_.tweenScroll_.pause();
		});

	};

	this.getScrollParents_();
	this.setEventProvider(DD.fx.HammerWrapper);

	/**
	 * В случае, если навешивать события сразу на контейнер, в IPad и IPhone скроллирование контейнера работать не будет
	 * так как hammerjs в этом случае прерывает все нативные свобытия в контейнере
	 */
	// this.setEventProvider(new DD.fx.HammerWrapper({'isSetEventNow' : DD.utils.UserAgent.isWindow()}));
};

DD.fx.DragScroll.prototype.getScrollParents_ = function()
{
	var parent = null,
		i = 0,
		ln = this.container_.length;

	this.scrollParents = [];

	for (; i < ln; i++)
	{
		parent = this.container_[i].parentNode;

		while(parent.parentNode)
		{
			(parent.clientHeight < parent.scrollHeight) && (this.scrollParents.push(parent))
			parent = parent.parentNode;
		}
	};
}

DD.fx.DragScroll.prototype.dispose = function()
{
	DD.fx.DragScroll.superClass_.dispose.call(this);

	for (var i = 0, ln = this.container_.length; i < ln; i++)
		this.container_[i].DragScroll.destroy();
};

/**
 * Назначение провайдера событий
 * @param {Object} eventProvider Провайдер событий
 */
DD.fx.DragScroll.prototype.setEventProvider = function(eventProvider)
{
	if (!eventProvider)
		return;

	for (var i = 0, ln = this.container_.length; i < ln; i++)
	{
		var newEventProvider = (goog.isFunction(eventProvider) && new eventProvider())
								|| (goog.isObject(eventProvider) && eventProvider)
								|| null;

		if (!newEventProvider)
			return;

		if (this.container_[i].DragScroll)
		{
			this.container_[i].DragScroll.destroy();
			delete this.container_[i].DragScroll;
			this.customEventProvider_ = newEventProvider;
		};

		typeof newEventProvider.init === "function" &&
		newEventProvider.init(this.container_[i],
		{
			'pixelThreshold' 	: this.pixelThreshold,
			'lapseThreshold' 	: this.lapseThreshold,
			'classItem' 		: this.allowElements_
		});

		goog.events.listen(newEventProvider, this.eventsMap_, function(event)
		{
			var fn = goog.object.get(this.sponsoredEvents_, event.type);
			event.resource.originalEvent = event;
			event.resource.source = event.source;
			fn && fn.apply(this, [event.resource]);
		}, false, this);

		this.container_[i].DragScroll = newEventProvider;
	};
};

/**
 * Очищает массив областей, отвечающих за прокрутку скроллируемого контейнера
 * @private
 */
DD.fx.DragScroll.prototype.clearScrollAreas_ = function()
{
	if (this.isScrollAreaVisible_)
		for (var i = 0, ln = this.areaScrolls_.length; i < ln; i++)
			for (var x = 0, lnx = this.areaScrolls_[i].elements.length; x < lnx; x++)
				goog.dom.removeNode(this.areaScrolls_[i].elements[x]);

	this.areaScrolls_ = [];
};

/**
 * Возвращает направление, в которое осуществляется скроллирование
 * @param  {DD.fx.DragScroll.scrollDirection} value
 * @return {Boolean}
 * @private
 */
DD.fx.DragScroll.prototype.isTopBottom_ = function(value)
{
	return value == DD.fx.DragScroll.scrollDirection.TOP || value == DD.fx.DragScroll.scrollDirection.BOTTOM;
};

/**
 * Создает области скроллирования контейнера
 * @param  {Array} 	Текстовй массив, определяющий какие области скроллирования нужно создать
 * @param  {Object}	Параметры для определения областей скроллирования
 * @return {Array} 	Массив DOM-элементов, видимых областей скроллирования
 * @private
 */
DD.fx.DragScroll.prototype.createScrollArea_ = function(directionArea, options)
{
	var areas = {};
	var containerPosition = goog.style.getClientPosition(options.container);

	if (options.scrollY)
	{
		areas.top =
		{
			'x1' : containerPosition.x,
			'y1' : containerPosition.y,
			'x2' : containerPosition.x + options.width,
			'y2' : containerPosition.y + this.scrollPadding
		};
		areas.bottom =
		{
			'x1' : containerPosition.x,
			'y1' : containerPosition.y + options.height - this.scrollPadding,
			'x2' : containerPosition.x + options.width,
			'y2' : containerPosition.y + options.height
		}
	};
	if (options.scrollX)
	{
		areas.left =
		{
			'x1' : containerPosition.x,
			'y1' : containerPosition.y,
			'x2' : containerPosition.x + this.scrollPadding,
			'y2' : containerPosition.y + options.height
		};
		areas.right =
		{
			'x1' : containerPosition.x + options.cw - this.scrollPadding,
			'y1' : containerPosition.y,
			'x2' : containerPosition.x + options.cw,
			'y2' : containerPosition.y + options.height
		};
	};

	if (this.isScrollAreaVisible_)
	{
		areas.elements = [];
		for (var i = 0, areaCount = directionArea.length; i < areaCount; i++)
		{
			var dir = directionArea[i];
			var area = goog.dom.createDom(goog.dom.TagName.DIV, {'class' : 'scroll-area ' + dir + '-scrolling'});

			goog.style.setStyle(area,
			{
				'width' 	: (this.isTopBottom_(dir) ? options.width + 'px' : this.scrollPadding + 'px'),
				'height'	: (this.isTopBottom_(dir) ? this.scrollPadding + 'px' : options.height - (areaCount > 2 ? this.scrollPadding * 2 : 0) + 'px'),
				'left' 		: this.isTopBottom_(dir) ? containerPosition.x + 'px' : (dir == 'left' ? containerPosition.x : options.cw - this.scrollPadding + 'px'),
				'top' 		: this.isTopBottom_(dir) ? (dir == 'top' ? containerPosition.y + 'px' : areas.bottom.y1 + 'px') : (areaCount > 2 ? containerPosition.y + 'px' : (containerPosition.y + (areaCount > 2 ? this.scrollPadding : 0))) + 'px',
				'position' 	: 'fixed'
			});
			areas.elements.push(area);
			document.body.appendChild(area);
		};
	};
	return areas;
};

/**
 * Подготавливает скроллируемые области для начала скроллирования при событии DD.fx.CustomDragDrop.EventType.onDragStart
 * @private
 */
DD.fx.DragScroll.prototype.prepareToScroll_ = function()
{
	for (var i = 0, ln = this.container_.length; i < ln; i++)
	{
		var container = this.container_[i];

		/** Если у контейнера не стоит соответствующее свойство position, то тут оно проставляется произвольно */
		var position = goog.style.getComputedPosition(container);
		(position == 'static') && (container.style.position = 'relative');

		/** Получает размеры контейнера */
		var bounds = goog.style.getBounds(container);
		var scrollTop = container.scrollTop;
		var scrollLeft = container.scrollLeft;
		var containerOption =
		{
			container 	: container,
			st 			: scrollTop,
			sl 			: scrollLeft,
			sh 			: container.scrollHeight,
			sw 			: container.scrollWidth,
			ch 			: container.clientHeight,
			cw 			: container.clientWidth,
			position 	: position,
			width 		: bounds.width,
			height 		: bounds.height
		};

		var scrollY = containerOption.sh == containerOption.ch ? false : true;
		var scrollX = containerOption.sw == containerOption.cw ? false : true;

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
			'parentHeight' 	: containerOption.height,
			'scrollTop' 	: scrollTop,
			'scrollLeft' 	: scrollLeft,
			'parent' 		: container,
			'top' 			: areas.top,
			'bottom' 		: areas.bottom,
			'left' 			: areas.left,
			'right' 		: areas.right,
			'limitHeight'	: limitHeight,
			'limitWidth'	: limitWidth,
			'options'		: containerOption,
			'elements' 		: areas.elements
		});
	};
};

/**
 * Определяет наличие переносимого элемента, и в положительном случае подготавливает контейнер к скроллированию
 * @param {DD.fx.CustomDragDrop.EventType}
 */
DD.fx.DragScroll.prototype.setDraggingElement = function(event)
{
	if (!event.dragSource)
		return;

	this.setDragObject(event.dragSource);
	this.setCopy_(event.copy);

	if (!event.copy)
		throw new Error('A clone is not created');

	this.prepareToScroll_();
};

/**
 * Выполнение события onGetDragSource по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragScroll.prototype.onGetDragSource = function(event)
{
	this.currentScrollArea_ = event.source;

	this.getDragObject() && (this.isPress_ = true);

	/**
	 * Выполнение события onGetDragSource по умолчанию
	 * @event
	 * @name DD.fx.DragScroll#onGetDragSource
	 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
	 * @param {HTMLElement} [scrollArea] Ссылка на DOM-элемент, является скроллируемым контейнером
	 * @param {DD.fx.DragScroll} [sender] DD.fx.DragScroll
	 */
	this.dispatchEvent(
	{
		'type' 			: DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,
		'scrollArea' 	: this.currentScrollArea_,
		'sender' 		: this
	});
};

DD.fx.DragScroll.prototype.onPinch = function(event)
{
	if (this.historyScale == event.scale)
		return;

	this.historyScale = event.scale

	if (event.scale < 1)
		event.scale = 1;
	else if (event.scale > 2)
		event.scale = 2;

	document.body.style.webkitTransform = 'scale('+ event.scale +')';
};

/**
 * Выполнение события onDragStart по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragScroll.prototype.onDragStart = function(event)
{
	// console.log('DD.fx.DragScroll.onDragStart');

	if (!event.source)
		throw new Error('Scroll area is not defined');

	/** Если нет переносимого объекта или если не было события press, возвращаем false */
	if (!this.getDragObject() || !this.isPress_)
	{
		this.limitScrollEdge =
		{
			'x' : event.source.scrollWidth - event.source.offsetWidth,
			'y' : event.source.scrollHeight - event.source.offsetHeight,
		};
		return;
	};

	this.setDragging(true);
};

/**
 * Выполнение события onDragOver по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragScroll.prototype.onDragOver = function(event)
{
	// console.log('DD.fx.DragScroll.prototype.onDragOver');

	/** Скроллирование контейнера без драга (smoothscrolling) */
	if (!this.getDragObject() && !this.isPress_)
	{
		// // if (event.pointerType == 'mouse') return;

		// /** Пройденное расстояние указателя от точки соприкосновения с экраном */
		// var distance = event.pointers[0].screenY - this.startTouchPointer_.y,
		// /** Новое значение положения полосы скроллирования */
		// 	newScrollY = event.source.scrollTop - distance;

		// /** В случае, если scrollTop основного контейнера достиг предела скроллирования и если траектория
		//   * движения указателя противоположна достигнутого предела, то с этого момента должен скроллироваться
		//   * родительский контейнер, если таковой имеется
		//   */
		// if (this.Edge.active && (newScrollY <= 0 || newScrollY > this.Edge.scrollEdge.bottom))
		// 	this.isScrollParent_ = true;

		// /** Если должен скроллироваться родительский контейнер */
		// if (this.isScrollParent_ && this.scrollParentMode_ != DD.fx.DragScroll.scrollParentState.NOSCROLL)
		// {
		// 	/** Получает родительский скроллируемый контейнер */
		// 	var parent = this.scrollParents[0];

		// 	if (!parent) return;

		// 	!this.Edge.parentScrollEdge && (this.Edge.parentScrollEdge = this.getParentScrollEdge_(parent));

		// 	(distance > this.Edge.parentScrollEdge.top) 	&& (distance = this.Edge.parentScrollEdge.top);
		// 	(distance < this.Edge.parentScrollEdge.bottom) 	&& (distance = this.Edge.parentScrollEdge.bottom)

		// 	this.Edge.distance = distance;
		// 	goog.style.transform.setTranslation(parent, 0, distance);
		// }
		// else
		// {
		// 	this.Edge.active = false;

		// 	/** Переприсвоение координат точки соприкосновения с экраном  */
		// 	this.startTouchPointer_.y = event.pointers[0].screenY;

		// 	/** Изменение положения значения области прокрутки у контейнера */
		// 	event.source.scrollTop = newScrollY;
		// };
	}
	else
	{
		/**
		 * На IPAD возникает неясная ошибка при начале скроллировании вправо или вниз. Ошибку выявить неудалось, так как
		 * при включенном режиме дебага на MacBook ошибка не повторяется, try catch помог это обойти, но непонятно каким образом
		 */
		// try
		// {
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
				'type' 			: DD.fx.CustomDragDrop.EventType.DRAGOVER,
				'scrollArea' 	: this.currentScrollArea_,
				'sender' 		: this,
				'isScroll' 		: this.isScroll_
			});

			var clientX = event.clientX != undefined ? event.clientX : event.pointers[0].clientX,
				clientY = event.clientY != undefined ? event.clientY : event.pointers[0].clientY,
				this_ = this,
				scrollDirection;
				
			for (var i = 0, ln = this.areaScrolls_.length; i < ln; i++)
			{
				for (var ii = 0; ii < this.directionsArrayCount_; ii++)
					if (this.areaScrolls_[i][this.directionsArray_[ii]] &&
						clientX >= this.areaScrolls_[i][this.directionsArray_[ii]].x1 &&
						clientX <= this.areaScrolls_[i][this.directionsArray_[ii]].x2 &&
						clientY >= this.areaScrolls_[i][this.directionsArray_[ii]].y1 &&
						clientY <= this.areaScrolls_[i][this.directionsArray_[ii]].y2)
						scrollDirection = this.directionsArray_[ii];
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
						'type' 			: DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL,
						'scrollArea' 	: this_.currentScrollArea_,
						'sender' 		: this_
					});
				}, this.scrollDelay_);
			}
			else
			{
				this_.isScroll_ = false;
				clearTimeout(this.scrollStayAreaTimer_);
			};
	};
};

/**
 * Получение коэффициэнта скорости скроллирования
 * @param  {Number} Временая дельта
 * @param  {Number} Координата по Х-оси
 * @param  {Number} Координата по Y-оси
 * @return {Object}
 * @private
 */
DD.fx.DragScroll.prototype.getVelocity_ = function(deltaTime, x, y)
{
    return {
        x: x / deltaTime || 0,
        y: y / deltaTime || 0
    };
};
 
/**
 * Выполнение события onDragDrop по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragScroll.prototype.onDragDrop = function(event)
{
	clearTimeout(this.scrollStayAreaTimer_);

	/** Если события press небыло, задаем останочную анимацию скролла */
	if (!this.isPress_ && event.pointerType != 'mouse')
	{
		// Новая позиция скролла
		var newScrollValue;

		/** Если должен скроллироваться родительский контейнер */
		if (this.isScrollParent_ && this.scrollParentMode_ != DD.fx.DragScroll.scrollParentState.NOSCROLL)
		{
			var parent = this.scrollParents[0];

			if (!parent)
				return;

			goog.style.transform.setTranslation(parent, 0, 0);
			parent.scrollTop = parent.scrollTop - this.Edge.distance;
			parent.removeAttribute('style');

			newScrollValue = parent.scrollTop + event.velocityY * this.easingInertia_;
			this.smoothScroll(parent, parent.scrollTop, newScrollValue);
		}
		else
		{
			var velocityY = -(this.getVelocity_(event.deltaTime, event.deltaX, event.deltaY).y);
			// newScrollValue = event.source.scrollTop + event.velocityY * this.easingInertia_;
			newScrollValue = event.source.scrollTop + velocityY * this.easingInertia_;
			this.smoothScroll(event.source, event.source.scrollTop, newScrollValue);
		};
	};

	this.reset();
	this.cancel();
	this.animateScrollOptions_ = null;
};

/**
 * Получает границы скроллирования контейнера
 * @param  {HTMLElement} target Ссылка на DOM-элемент, являющийся скроллируемым контейнером
 * @return {Object}
 * @private
 */
DD.fx.DragScroll.prototype.getScrollEdge_ = function(target)
{
	return {
		'left' 		: 0,
		'top' 		: 0,
		'right' 	: target.scrollWidth - target.clientWidth,
		'bottom' 	: target.scrollHeight -target.clientHeight
	};
};

/**
 * Определяет, достиг ли скроллируемый контейнер одной из своих границ
 * @param  {HTMLElement} target Ссылка на DOM-элемент, являющийся скроллируемым контейнером
 * @return {Boolean}
 * @private
 */
DD.fx.DragScroll.prototype.isReachedEdge_ = function(target)
{
	if (target.scrollTop == 0 || target.scrollTop == this.Edge.scrollEdge.bottom)
		return true;
	return false;
};

/**
 * Получает границы родительского контейнера
 * @param  {HTMLElement} target Ссылка на DOM-элемент, являющийся родительским скроллируемым контейнером
 * @return {Object}
 * @private
 */
DD.fx.DragScroll.prototype.getParentScrollEdge_ = function(target)
{
	var scrollTop = target.scrollTop;
	return{
		'top' 	 	: scrollTop,
		'bottom' 	: scrollTop - (target.scrollHeight - target.offsetHeight)
	};

};

/**
 * Скроллирует родительские контейнеры после окончания скроллирования основного скроллируемого контейнера
 * @param  {Number} 							index     Индекс скроллируемого родительского контейнера
 * @param  {DD.fx.DragScroll.scrollDirection} 	direction Направление скроллирования
 */
DD.fx.DragScroll.prototype.parentScroll_ = function(index, direction)
{
	var parent = this.scrollParents[index];
	if (!parent || (this.scrollParentMode_ == DD.fx.DragScroll.scrollParentState.AKINSCROLL && !parent.DragScroll))
		return;

	this.animateScrollElement(parent, direction)
};


DD.fx.DragScroll.prototype.animateScrollElement = function(element, direction)
{
	var elementSize = goog.style.getSize(element);
	this.animateScrollOptions_ =
	{
		'y' :
		{
			start 		: direction == DD.fx.DragScroll.scrollDirection.BOTTOM ? element.scrollTop : 0,
			end 		: direction == DD.fx.DragScroll.scrollDirection.BOTTOM ? element.scrollHeight - elementSize.height : element.scrollTop
		},
		'x' :
		{
			start  		: direction == DD.fx.DragScroll.scrollDirection.RIGHT ? element.scrollLeft : 0,
			end 		: direction == DD.fx.DragScroll.scrollDirection.RIGHT ? element.scrollWidth - elementSize.width : element.scrollLeft
		},
		'duration' 		: this.scrollDuration_,
		'startTime' 	: 0,
		'element' 		: element,
		'direction' 	: direction,
		'elementSize' 	: elementSize
	};

	requestAnimationFrame(this.animateScrollStep_.bind(this));
};

/**
 * Анимационное скроллирование контейнера в момент попадания координатной области скроллирования
 * @param  {Number} timestamp Текущее время
 * @private
 */
DD.fx.DragScroll.prototype.animateScrollStep_ = function(timestamp)
{
	var o = this.animateScrollOptions_;

	if (!o)
		return;

	var y,
		x,
		speedDelta = .3,
		elapsed;

	o.startTime = o.startTime || timestamp;
	elapsed = (timestamp - o.startTime) * speedDelta;

	if (o.direction == DD.fx.DragScroll.scrollDirection.BOTTOM ||
		o.direction == DD.fx.DragScroll.scrollDirection.TOP)
	{
		y = o.direction == DD.fx.DragScroll.scrollDirection.TOP ? o.y.end - elapsed : o.y.start + elapsed;
		o.element.scrollTop = y;

		if ((o.element.scrollTop == 0 && o.direction == DD.fx.DragScroll.scrollDirection.TOP) &&
			this.scrollParentMode_ != DD.fx.DragScroll.scrollParentState.NOSCROLL)
			this.parentScroll_(0, o.direction);
		else if (o.element.scrollTop == 0 && o.direction == DD.fx.DragScroll.scrollDirection.TOP ||
		  	o.element.scrollTop == o.element.offsetHeight && o.direction == DD.fx.DragScroll.scrollDirection.BOTTOM)
			this.isScroll_ = false;
		else
		{
			this.isScroll_ && requestAnimationFrame(this.animateScrollStep_.bind(this));
			// this.isScroll_ = true;
		};
	};

	// if (o.direction == DD.fx.DragScroll.scrollDirection.LEFT ||
	// 	o.direction == DD.fx.DragScroll.scrollDirection.RIGHT)
	// {
	// 	x = o.direction == DD.fx.DragScroll.scrollDirection.LEFT ? o.x.end - elapsed : o.x.start + elapsed;
	// 	o.element.scrollLeft = x;

	// 	if ((o.element.scrollLeft == 0 && o.direction == DD.fx.DragScroll.scrollDirection.LEFT) &&
	// 		this.scrollParentMode_ != DD.fx.DragScroll.scrollParentState.NOSCROLL)
	// 		this.parentScroll_(0, o.direction);
	// 	else
	// 		this.isScroll_ && requestAnimationFrame(this.animateScrollStep_.bind(this));
	// };
};

DD.fx.DragScroll.prototype.cancel = function()
{
	this.clearScrollAreas_();
	this.isScroll_ = false;
};

DD.fx.DragScroll.prototype.reset = function()
{
	this.isPress_ = false;
	this.setDragging(false);
	this.clearDragObject();
	this.Edge = {};
};

/**
 * Плавная анимация скролла до финального значения
 * @param  {DOM} element Скроллируемая область
 * @param  {Object} y0      Начальные значения
 * @param  {Object} y1      Конечные значения
 */
DD.fx.DragScroll.prototype.smoothScroll = function(element, y0, y1)
{
	this.tweenScroll_ = TweenLite.to(element, 1, {
		scrollTo : { y: y1, autoKill:true },
		ease: Power4.easeOut,
		overwrite: 5
	});
};

/**
 * Обновляет положение скроллируемых областей относительно scrollTop контейнера
 * @param  {HTMLElement} 	scrollArea Скроллируемый контейнер
 * @param  {Number} 		left       Положение по X
 * @param  {Number} 		top        Положение по Y
 */
DD.fx.DragScroll.prototype.updateScrollAreaPosition = function(scrollArea, left, top)
{
	if (scrollArea.top)
	{
		goog.style.transform.setTranslation(scrollArea.top, left, top >= scrollArea.limitHeight ? scrollArea.limitHeight : top);
		goog.style.setElementShown(scrollArea.top, top <= 0 ? false : true);
	};
	if (scrollArea.bottom)
	{
		var deltaHeight = this.scrollPadding - (scrollArea.options.scrollX ? this.scrollbarWidth_ : 0);
		var valueTop = top > 0 ? top + scrollArea.parentHeight - deltaHeight : scrollArea.options.ch - deltaHeight;
		goog.style.transform.setTranslation(scrollArea.bottom, left, valueTop);
		goog.style.setElementShown(scrollArea.bottom, top >= scrollArea.limitHeight ? false : true);
	};
	if (scrollArea.left)
	{
		goog.style.transform.setTranslation(scrollArea.left, left >= scrollArea.limitWidth ? scrollArea.limitWidth : left, top);
		goog.style.setElementShown(scrollArea.left, left <= 0 ? false : true);
	};
	if (scrollArea.right)
	{
		var deltaWidth = scrollArea.options.scrollX ? this.scrollbarWidth_ : 0;
		var valueLeft = left > 0 ? left + deltaWidth : 0 + deltaWidth;
		goog.style.transform.setTranslation(scrollArea.right, valueLeft, top);
		goog.style.setElementShown(scrollArea.right, left >= scrollArea.limitWidth ? false : true);
	};

};

/**
 * Получает родителя скроллируемой области
 * @param  {HTMLElement} element Ссылка на DOM-элемент
 * @return {Object}
 * @private
 */
DD.fx.DragScroll.prototype.getScrollableParent_ = function(element)
{
	var parent = element.parentNode;

	if (parent && parent.nodeType == 1)
	{
		overflowY = goog.style.getComputedOverflowY( parent );
		if (overflowY == 'scroll' || overflowY == 'auto' && parent.clientHeight < parent.scrollHeight)
			return parent;
		else
			return this.getScrollableParent_(parent);
	};

	return null;
};

/**
 * Задает величину поля для всех сторон контейнера в пикселах
 * @param {Number} value
 */
DD.fx.DragScroll.prototype.setScrollPadding = function(value)
{
	this.scrollPadding = value;
};

/**
 * Объект параметров прокрутки при darg and drop, выступающий в роли значений констант.
 * Определяет тип scrollOptions объектного поля options компонента DragScrollи параметра options в его событиях
 * @param  {Object} options
 * @class
 */
DD.fx.DragScroll.ScrollOptions = function(options)
{
	options = options || {};

	/**
	 * Величина поля для всех сторон контейнера в пикселах
	 * @type {Number}
	 */
	this.scrollPadding = 'scrollPadding' in options ? options.scrollPadding : 50;

	/**
	 * Промежуток срабатывания таймера при прокрутке контента в контейнере при наличии соответствующих полос прокрутки
	 * @type {Number}
	 */
	this.scrollLapse = 'scrollLapse' in options ? options.scrollLapse : 500;

	/**
	 * Расстояние в пикселах, на которое необходимо прокрутить контент контейнера
	 * @type {Number}
	 */
	this.scrollDistance = 'scrollDistance' in options ? options.scrollDistance : 20;

	/**
	 * Автоматическое определение размера полей, равное процентам от ширины или высоты контейнера
	 * @type {String}
	 */
	this.autoScrollPadding = 'autoScrollPadding' in options ? options.autoScrollPadding : '25%';

	/**
	 * Пиксельный порог обработки прокрутки
	 * @type {Number}
	 */
	this.pixelThreshold = 'pixelThreshold' in options ? options.pixelThreshold : 8;

	/**
	 * Временной порог в ms обработки прокрутки
	 * @type {Number}
	 */
	this.lapseThreshold = 'lapseThreshold' in options ? options.lapseThreshold : 300;
};

/** ============================= **/
DD.fx.DragScroll.prototype.stopRequestAnim_ = function()
{
	clearTimeout(this.requestAnimID);
};

DD.fx.DragScroll.prototype.requestAnimFrame_ = function(f, fps)
{
	this.requestAnimID = setTimeout(function()
	{
	  return  window.requestAnimationFrame(f)       ||
			  window.webkitRequestAnimationFrame(f) ||
			  window.setTimeout(f, 1000 / fps);
	}, 1000 / fps);
};

DD.fx.DragScroll.prototype.easeInOutCubic = function(t, b, c, d)
{
	if ((t/=d/2) < 1)
		return c/2*t*t*t + b;
	return c/2*((t-=2)*t*t + 2) + b;
};

DD.fx.DragScroll.prototype.linear = function (t, b, c, d)
{
	return c*t/d + b;
};

DD.fx.DragScroll.prototype.easeInSine = function(t, b, c, d)
{
	return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
};

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// MIT license
DD.fx.DragScroll.prototype.applyRequestPolyfill = function()
{
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x){
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
								   || window[vendors[x]+'CancelRequestAnimationFrame'];
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback, element)
		{
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function()
			{
				callback(currTime + timeToCall);
			}, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};

	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
};