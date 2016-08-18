goog.provide('DD.fx.DragSource');
goog.provide('DD.fx.dragImage_');

goog.require('goog.style.transform');
goog.require('goog.dom.classes');
goog.require('DD.fx.CustomDragDrop');
goog.require('DD.fx.HammerWrapper');
goog.require('DD.utils.UserAgent');

/**
 * Компонент, инкапсулирующий поведение контейнера источника
 * @param {Object=} settings Список входящих параметров
 * @extends DD.fx.CustomDragDrop
 * @author Антон Пархоменко (valianton@mail.ru)
 * @this DD.fx.DragSource
 * @version 1.0.1
 * @constructor
 *
 * @TODO Добавить возможность передавать параметры при инициализации компонента
 * @TODO Вынести ряд методов в новый компонент DD.fx.DragObject
 * @TODO Добавить возможность задавать начальное положение образа перетаскиваемого элемента
 * по-умолчанию образ позиционируется по центру указателя
 */
DD.fx.DragSource = function(params)
{
	DD.fx.CustomDragDrop.call(this, params);

	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGSTART,     this.onDragStart)
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, this.onGetDragSource);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGOVER,      this.onDragOver);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGDROP,      this.onDragDrop);

	var defaults =
	{
		// Способ выравнивания образа под указателем при захвате и перемещении.
		imageAlign : 1,
		// Пиксельный порог захвата
		pixelThreshold : {'desktop': 5, 'sensor': 5},
		// Временной порог захвата в ms
		lapseThreshold : {'desktop': 0, 'sensor': 300},
		// Определяет отображение образа перетаскиваемого элемента по-умолчанию
		showDefaultImage : true,
		// Определяет интервал отображения образа по-умолчанию в случае, если пользовательский образ не может отобразиться
		showDefaultImageTime : 0,
		// Массив игнорируемых классов элементов, при нажатии на которые не будет проихсодит события Drag'n'Drop
		ignored : [],
		// Отвечает за отображение образа перетаскиваемого элемента
		showDragImage : true,
		// Включает режим для разработчиков
		debugMode : false,
		// Контейнер, в котором будет создаваться видимый образ переносимого элемента
		dragObjectContainer : document.body,
		isSensor : DD.utils.UserAgent.isSensorDevice()

	};

	if (!goog.isObject(params.lapseThreshold))
		params.lapseThreshold = {'desktop': params.lapseThreshold, 'sensor': params.lapseThreshold}
	if (!goog.isObject(params.pixelThreshold))
		params.pixelThreshold = {'desktop': params.pixelThreshold, 'sensor': params.pixelThreshold}

	/**
	 * Объект, хранящий список надстроек компонента
	 * @type {Object}
	 * @private
	 */
	this.params_ = this.assignParams(params, defaults);

	/**
	 * Свойство определяет переключение между режимами просмотра и перемещения
	 * @type {Boolean}
	 * @private
	 */
	this.dragging_ = false;

	/**
	 * Показывает является ли элемент игнорируемым
	 * @type {Boolean}
	 * @private
	 */
	this.isIgnore_ = undefined;

	/**
	 * Флаг, показывающий состояния события скроллирования контейнера или вьюпорта
	 * @type {Boolean}
	 * @private
	 */
	this.isScrolled_ = false;

	/**
	 * Количество ms, после которого должно прекратится событие scroll
	 * @type {Number}
	 * @private
	 */
	this.checkScrollTime_ = 200;

	this.deltaOffset = {};
};
goog.inherits(DD.fx.DragSource, DD.fx.CustomDragDrop);

/**
 * @define {string} Режим работы компонента.
 * @type {DD.fx.CustomDragDrop.prototype.DRAG_MODE}
 */
goog.define('DD.fx.DragSource.prototype.MODE', DD.fx.CustomDragDrop.DRAG_MODE.dmAuto);

goog.scope(function()
{
	/** @alias DD.fx.DragSource.prototype */
	var prototype = DD.fx.DragSource.prototype;
	var superClass_ = DD.fx.DragSource.superClass_;

	/**
	 * Задает контейнер(ы), участвующие в работе дочерних компонентов
	 * @param   {Array}     value           Контейнер или массив контейнеров, являющиеся источником
	 * @param   {Array=}    opt_allow       Строковый массив, отвечающий за возможность перетаскивания того или иного
	 *                                      элемента. В случае, если ничего не передано, перетаскиваться
	 *                                      будут все элементы, которые были указаны в источнике
	 */
	prototype.setContainer = function(value, opt_allow)
	{
		try 
		{
			if (!value || value.length < 1) return;
			this.setContainer_(value, opt_allow);
			this.setEventProvider(DD.fx.HammerWrapper);
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('setContainer', e);
		};
	};

	prototype.dispose = function()
	{
		superClass_.dispose.call(this);
		for (var i = 0, ln = this.container_.length; i < ln; i++)
		{
			this.container_[i].DragSource.destroy();
			delete this.container_[i].DragSource;
		};
	};

	/**
	 * Назначение провайдера событий
	 * @param {Object} eventProvider Провайдер событий
	 */
	prototype.setEventProvider = function(eventProvider)
	{
		for (var i = 0, ln = this.container_.length; i < ln; i++)
		{
			this.preventDefaultForMSPointer_(this.container_[i], true);

			var newEventProvider = (goog.isFunction(eventProvider) && new eventProvider({'isSetEventNow' : DD.utils.UserAgent.isWindow()}))
			                       || (goog.isObject(eventProvider) && eventProvider)
			                       || null;

			if (!newEventProvider)
				throw new Error("eventProvider is undefined");


			if (this.container_[i].DragSource)
			{
				this.container_[i].DragSource.destroy();
				delete this.container_[i].DragSource;
				this.customEventProvider_ = newEventProvider;
			};

			typeof newEventProvider.init === "function" &&
			newEventProvider.init(this.container_[i],
			{
				'pixelThreshold'    : this.params_.pixelThreshold,
				'lapseThreshold'    : this.params_.lapseThreshold,
				'classItem'         : this.allowElements_
			});

			/**
			 * Это нужно, что бы предотвратить авто скроллирование
			 * контента в момент срабатывания dragOver события, последствия пока что неизвестны
			 */
			goog.events.listen(this.container_[i], 'mousedown', function(event)
			{
				!this.isIgnore_ && event.preventDefault();
			}, false, this);

			goog.events.listen(this.container_[i], 'scroll', this.checkScrollEvent_, false, this);
			goog.events.listen(window, 'scroll', this.checkScrollEvent_, false, this);

			goog.events.listen(newEventProvider, this.eventsMap_, function(event)
			{
				var fn = goog.object.get(this.sponsoredEvents_, event.type);
				event.resource.originalEvent = event;
				event.resource.source = event.source;
				fn && fn.apply(this, [event.resource]);
			}, false, this);

			this.container_[i].DragSource = newEventProvider;
		};
	};

	/**
	 * Метод, определяющий состояние скроллирования контейнера или вьюпорта
	 * @param  {goog.events}
	 * @private
	 */
	prototype.checkScrollEvent_ = function(event)
	{
		var this_ = this;
		this.isScrolled_ = true;
		this.checkScrollTimer && clearTimeout(this.checkScrollTimer);
		this.checkScrollTimer = setTimeout(function ()
		{
			this_.isScrolled_ = false;
		}, this.checkScrollTime_);
	};

	prototype.preventDefault_ = function(event)
	{
		!this.isIgnored_(event.target) && event.preventDefault();
	};

	/**
	 * Прерывает событие долгого нажатия на сенсорных устройствах / вызов вонтекстного меню
	 * @param  {HTMLElement}    target Ссылка на DOM-элемент, где нужно запретить вызов контекстного меню
	 * @param  {Boolean}        on     Флаг, отвечающий за включение / отключение прерывания
	 * @private
	 */
	prototype.preventDefaultForMSPointer_ = function(target, on)
	{
		if (!target) return false;
		var events = ['MSHoldVisual', 'MSGestureHold', 'contextmenu'],
			preventDefault_ = this.preventDefault_.bind(this);

		events.forEach(function(event)
		{
			target[on ? 'addEventListener' : 'removeEventListener'](event, preventDefault_, false);
		});
	};

	/**
	 * Определение игнорируемого элемента посредством игнорируемых классов
	 * @param  {HTMLElement}  target Ссылка на DOM-элемент, на который был осуществле клик
	 * @return {Boolean}
	 * @private
	 */
	prototype.isIgnored_ = function(target)
	{
		var isIgnored = false;
		for (var i = 0, l = this.params_.ignored.length; i < l; i++)
			if (isIgnored = target.classList.contains(this.params_.ignored[i])) break;
		return isIgnored;
	};

	/**
	 * @inheritDoc
	 */
	prototype.onGetDragSource = function(event)
	{
		// console.log(event.type);
		if (this.disable) return;

		if (event.button == 2) return;

		try {
			// Если на момент onGetDragSource присутствует dragObject, то вероятнее всего произошла ошибка, из-за которой объект не смог
			// расположиться на правильное место, т.е. процесс drag'n'drop был прерван. Если это так, сбрасываем параметры
			this.dragObject_ && this.reset();

			// Проверка на совпадения со списком игнорируемых классов элемента  
			this.isIgnore_ = this.isIgnored_(event.target);
			if (this.isIgnore_ || this.isScrolled_) return;

			// Проверка на наличие перетаскиваемого элемента путем проверки схожости указанного класса при инициализации [allowClassNames]
			this.dragObject_ = this.findDragSource(event.target);
			if (!this.dragObject_) return;

			// Отмена драга в случае нажатии клавишы {Esc}
			goog.events.listen(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);

			this.params_.showDragImage &&
			((this.params_.isSensor && this.params_.pixelThreshold.sensor == 0) ||
			(!this.params_.isSensor && this.params_.pixelThreshold.desktop == 0)) &&
			this.createDragSourceObject_(event);

			/**
			 * Выполнение события onGetDragSource по умолчанию
			 * @event
			 * @name DD.fx.DragSource#onGetDragSource
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {Object} [resource] Список свойств события
			 * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {HTMLElement} [clone] Ссылка на DOM-элемент, являющийся копией оригинального элемента - dragSource
			 * @param {DD.fx.DragSource} [this] DD.fx.DragSource
			 */
			this.dispatchEvent(
			{
				'type'          : event.originalEvent.type,
				'resource'      : event.originalEvent.resource,
				'source'        : event.originalEvent.source,
				'dragSource'    : this.dragObject_,
				'clone'         : this.clone_,
				'sender'        : this,
				'coords'        : 
				{
					'x' : event.pointers && event.pointers[0].clientX || event.clientX,
					'y' : event.pointers && event.pointers[0].clientY || event.clientY
				}
			});
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
	 * Создает образ выбранного элемента
	 * @param  {goog.events} event
	 */
	prototype.createDragSourceObject_ = function(event)
	{
		try
		{
			if (!this.dragObject_ || this.dragging_)
				return false;

			// Создание клона перетаскиваемого элемента. Он вставляется в тоже место в DOM-структуре, что и оригинал
			// и визуально заменяет место оригинала. Сам оригинал прячется с глаз, оставаясь при этим в DOM-структуре
			this.clone_ = this.createCloneDragObject_(this.dragObject_);
			this.setActive(true);
			this.dragging_ = true;

			// Убирает нативное выделение в браузере
			this.noUserSelectWhileDrag_(true);

			// Получает текущие координаты расположения указателя
			var pointer =
			{
				'x' : event.pointers && event.pointers[0].pageX || event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
				'y' : event.pointers && event.pointers[0].pageY || event.clientY + document.body.scrollTop + document.documentElement.scrollTop
			};

			this.dragObject_.image_ = this.createDragImage(this.dragObject_, pointer);
			this.dragObject_.image_.parentItem = this.dragObject_;

			var cx = event.pointers && event.pointers[0].clientX || event.clientX,
				cy = event.pointers && event.pointers[0].clientY || event.clientY;

			goog.style.transform.setTranslation(this.dragObject_.image_, cx, cy);
			goog.dom.classes.add(this.dragObject_.image_, 'drag-object--image');

			this.firstMove = true;
			this.clone_.dataset.width = this.dragObject_.offsetWidth;
			this.clone_.dataset.height = this.dragObject_.offsetHeight;

			if (this.params_.showDefaultImage)
			{
				this.clone_.style.visibility = 'hidden';
				this.clone_.style.display = '';
				this.dragObject_.style.display = 'none';
				this.dragObject_.image_.style.visibility = 'visible';
			}
			else
				this.startDefaultViewTimeout();
		}
		catch (e)
		{
			if (this.params_.debugMode)
				throw e;
			else
				this.logError('createDragSourceObject_', e);
		};            
	};

	prototype.createCloneDragObject_ = function(dragSource)
	{
		var clone = dragSource.cloneNode(true);

		goog.style.setStyle(clone,
		{
			'display'    : 'none',
			'visibility' : 'hidden',
			'height'     : dragSource.offsetHeight + 'px'
		});
		dragSource.dataset.origin = true;

		goog.dom.insertSiblingBefore(clone, dragSource);
		return clone;
	};

	prototype.getItemImage = function()
	{
		var target = this.getDragObject();

		if (!target)
			return false;

		return target.image_;
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragStart = function(event)
	{
		// console.log(event.type);
		try
		{
			if (this.disable) return;

			if (!this.dragObject_ || this.isIgnore_) return false;

			if (!this.dragging_)
			{
				this.params_.showDragImage && this.createDragSourceObject_(event);

				this.setActive(true);
				this.dragging_ = true;

				// Убирает нативное выделение в браузере
				this.noUserSelectWhileDrag_(true);
			};

			/**
			 * Выполнение события onDragStart по умолчанию
			 * @event
			 * @name DD.fx.DragSource#onDragStart
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {Object} [resource] Список свойств события
			 * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {DD.fx.DragSource} [sender] DD.fx.DragSource
			 */
			this.dispatchEvent(
			{
				'type'          : event.originalEvent.type,
				'resource'      : event.originalEvent.resource,
				'source'        : event.originalEvent.source,
				'dragSource'    : this.dragObject_,
				'clone'         : this.clone_,
				'sender'        : this
			});
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
	prototype.onDragOver = function(event)
	{
		// console.log(event.type);
		try
		{
			if (this.disable) return;

			if (this.isIgnore_) return;

			if (this.dragObject_)
			{
				/** Если был создан образ элемента */
				if (this.dragObject_.image_)
				{
					/** Если событие срабатывает впервые, показывает образ перемещаемого элемента */
					if (!this.firstMove)
					{
						this.dragObject_.image_.style.visibility = 'visible';
						this.firstMove = true;
					};

					var cx = event.pointers && event.pointers[0].clientX || event.clientX,
						cy = event.pointers && event.pointers[0].clientY || event.clientY;

					goog.style.transform.setTranslation(this.dragObject_.image_, cx, cy);
				};

				/**
				 * Выполнение события onDragOver по умолчанию
				 * @event
				 * @name DD.fx.DragSource#onDragOver
				 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
				 * @param {Object} [resource] Список свойств события
				 * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
				 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
				 */
				this.dispatchEvent(
				{
					'type'       : event.originalEvent.type,
					'resource'   : event.originalEvent.resource,
					'source'     : event.originalEvent.source,
					'dragSource' : this.dragObject_
				});
			};
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
	 * @inheritDoc
	 */
	prototype.onDragDrop = function(event)
	{
		// console.log(event.type);
		try
		{
			if (this.disable) return;
			
			if (!this.dragObject_ || this.isIgnore_ || !this.dragging_)
				return;

			this.reset();

			/**
			 * Выполнение события onDragDrop по умолчанию
			 * @event
			 * @name DD.fx.DragSource#onDragDrop
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {Object} [resource] Список свойств события
			 * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {DD.fx.DragSource} [sender] DD.fx.DragSource
			 */
			this.dispatchEvent(
			{
				'type'          : DD.fx.CustomDragDrop.EventType.DRAGDROP,
				'resource'      : event.originalEvent.resource,
				'source'        : event.originalEvent.source,
				'dragSource'    : this.dragObject_,
				'sender'        : this,
				'deltaOffset'   : this.deltaOffset
			});

			/** Отмена/Запрет выделения текста на странице*/
			// this.noUserSelectWhileDrag_(false);
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
	 * Сброс состояния компонента до первоначального
	 */
	prototype.reset = function(event)
	{
		this.noUserSelectWhileDrag_(false);

		if (this.dragObject_)
		{
			this.dragObject_.image_ && goog.dom.removeNode(this.dragObject_.image_);
			if (this.clone_)
			{
				goog.dom.insertSiblingBefore(this.dragObject_, this.clone_);
				goog.dom.removeNode(this.clone_);
			};

			this.dragObject_.style.display = '';
			delete this.dragObject_.dataset.origin;
			this.clearCustomDragImage();
			this.clearDragObject();
		};

		/**
		 * Выполнение события onDragEnd по умолчанию
		 * @event
		 * @name DD.fx.DragSource#onDragEnd
		 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
		 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
		 * @param {DD.fx.DragSource} [sender] DD.fx.DragSource
		 */
		this.dispatchEvent(
		{
			'type'          : DD.fx.CustomDragDrop.EventType.DRAGEND,
			'dragSource'    : this.dragObject_,
			'sender'        : this
		});

		this.setActive(false);
		this.dragging_ = false;
		this.isIgnore_ = undefined;

		goog.events.unlisten(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);
	};

	/**
	 * Создает образ динамического перетаскиваемого элемента
	 * @param   {Object} size Высота и ширина перетаскиваемого образа
	 * @param   {Object} pointer Координаты X и Y курсора или указателя в области
	 * @return  {Function} this.setHammerImage
	 */
	prototype.createDragImage = function(size, pointer)
	{
		/** Генерирует событие CREATEIMAGE */
		this.dispatchEvent({'type': DD.fx.CustomDragDrop.EventType.CREATEIMAGE});

		return this.setHammerImage(pointer);
	};

	prototype.setShowDefaultImage = function(value)
	{
		this.params_.showDefaultImage = value;
	};

	prototype.startDefaultViewTimeout = function()
	{
		var func = function()
		{
			if (!this.dragObject_) return;

			try
			{
				this.dragObject_.style.display = 'none';
				this.dragObject_.image_.style.visibility = 'visible';
				goog.dom.classes.add(this.clone_, 'drag-object--clone');
				this.clone_.style.display = '';
				this.clone_.style.visibility = 'hidden';
			}
			catch (e)
			{
				if (this.params_.debugMode)
					throw e;
				else
					this.logError('startDefaultViewTimeout', e);
			}
		};
		this.DefaultViewTimeout_ = setTimeout(func.bind(this), this.params_.showDefaultImageTime);
	};

	/**
	 * Назначает образ перетаскиваемого элемента
	 * @param {Object} pointer Координаты X и Y курсора или указателя в области
	 */
	prototype.setHammerImage = function(pointer)
	{
		if (!this.dragObject_)
			return false;

		this.firstMove = false;
		var image = this.getCustomDragImage();

		/** Если пользовательского образа нет, задается образ по-умолчанию */
		if (!image || !image.element)
		{
			var element = this.dragObject_.cloneNode(false);
			/** Стили образа по умолчанию */
			image = this.setDefaultDragImage(element);
		};

		/** Применение обязательных стилей */
		goog.style.setStyle(image.element,
		{
			'position'      : 'fixed',
			'zIndex'        : '9999999',
			'cursor'        : 'default',
			'visibility'    : 'hidden'
		});

		/** Добавление образа в DOM структуру */
		this.params_.dragObjectContainer.appendChild(image.element);

		/** Получает текущие размеры образа перетаскиваемого элемента */
		var size = goog.style.getSize(image.element),
			margins = goog.style.getMarginBox(image.element);

		switch (this.params_.imageAlign)
		{
			/** Выравнивание по центру */
			case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaCenter:
				this.deltaOffset = 
				{
					'x': 0 - size.width/2 - margins.left,
					'y': 0 - size.height/2 - margins.top
				};
				goog.style.setPosition(image.element, this.deltaOffset.x, this.deltaOffset.y);
				break;
			/** Выравнивание по левому верхнему краю */
			case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaTopLeft:
				this.deltaOffset = 
				{
					'x': pointer.x,
					'y': pointer.y
				};
				goog.style.setPosition(image.element, this.deltaOffset.x, this.deltaOffset.y);
				break;
			/** Выравнивание по центру и по нижнему краю */
			case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaBottomCenter:
				this.deltaOffset = 
				{
					'x': pointer.x - size.width/2,
					'y': pointer.y - size.height
				};
				goog.style.setPosition(image.element, this.deltaOffset.x, this.deltaOffset.y);
				break;
			/**
			 * Выравнивание по умолчанию, где схватили там и осталось
			 * Значение по-умолчанию может быть равным DD.fx.CustomDragDrop.IMAGE_ALIGN.iaAuto
			 */
			default:
				var position = goog.style.getClientPosition(this.dragObject_);
				goog.style.setPosition(image.element,
					position.x - pointer.x
					+ (image.margins.left - image.margins.right)
					+ (document.body.scrollLeft || document.documentElement.scrollLeft),
					position.y - pointer.y
					+ (image.margins.top - image.margins.bottom)
					+ (document.body.scrollTop || document.documentElement.scrollTop));

		};

		return image.element;
	};

	/**
	 * Задает стили образа по-умолчанию
	 * @param {HTMLElement} element Ссылка на DOM-элемент
	 */
	prototype.setDefaultDragImage = function(element)
	{
		if (!this.dragObject_)
			return;

		var size = goog.style.getSize(this.dragObject_);

		goog.style.setStyle(element,
		{
			'background' : '#808080',
			'display'    : 'block',
			'width'      : size.width + 'px',
			'height'     : size.height + 'px',
			'opacity'    : '0.8',
			'box-shadow' : 'none'
		});

		return this.setCustomDragImage(element, 0);
	};

	/**
	 * @inheritDoc
	 */
	prototype.logError = function(group, error)
	{
		DD.fx.DragSource.superClass_.logError.call(this, 'DD.fx.DragSource', group, error);
	};
}); // goog.scope