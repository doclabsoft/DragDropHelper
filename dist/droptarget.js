goog.provide('DD.fx.DropTarget');
goog.require('DD.fx.CustomDragDrop');

/**
 * Компонент, инкапсулирующий поведение контейнера приёмника
 * @constructor
 * @param {Object=} params Список входящих параметров
 * @extends DD.fx.CustomDragDrop
 * @this DD.fx.DropTarget
 * @version 1.0.1
 * @author Антон Пархоменко
 */
DD.fx.DropTarget = function(params)
{
	this.onDragOver = this.onDragOver.bind(this);
	this.onDragDrop = this.onDragDrop.bind(this);
	
	DD.fx.CustomDragDrop.call(this, params);

	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGOVER, this.onDragOver);
	goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGDROP, this.onDragDrop);   

	var defaults =
	{
		// Пиксельный порог захвата
		pixelThreshold : {'desktop': 5, 'sensor': 5},
		// Временной порог захвата в ms
		lapseThreshold : {'desktop': 0, 'sensor': 300},
		// Включает режим для разработчиков
		debugMode: false,
		// Отвечает за отображение образа перетаскиваемого элемента
		showDragImage: true,
		isSensor : DD.utils.UserAgent.isSensorDevice()
	};

	if (goog.isObject(params))
	{
		if (!goog.isObject(params.lapseThreshold))
			params.lapseThreshold = {'desktop': params.lapseThreshold, 'sensor': params.lapseThreshold};
		if (!goog.isObject(params.pixelThreshold))
			params.pixelThreshold = {'desktop': params.pixelThreshold, 'sensor': params.pixelThreshold};
	};

	/**
	 * Объект, хранящий список надстроек компонента
	 * @type {Object}
	 * @private
	 */
	this.params_ = this.assignParams(params, defaults);

	/**
	 * Текущая dropArea зона
	 * @private
	 */
	this.currentDropArea_ = null; 

	/**
	 * Список контейнеров, в которых запрещен DROP элементов
	 * @type {Array}
	 */
	this.allownot = [];
};
goog.inherits(DD.fx.DropTarget, DD.fx.CustomDragDrop);

/**
 * Количество dropArea-зон
 * @private
 */
DD.fx.DropTarget.prototype.droptargetsCount_;

goog.scope(function()
{
	/** @alias DD.fx.DropTarget.prototype */
	var prototype = DD.fx.DropTarget.prototype;
	var superClass_ = DD.fx.DropTarget.superClass_;

	/**
	 * Задает контейнер(ы), участвующие в работе дочерних компонентов
	 * @param   {Array}     value           Контейнер или массив контейнеров, являющиеся источником
	 * @param   {Boolean}   opt_allow       Разрешает, либо запрещает событие DROP на указанном контейнере
	 */
	prototype.setContainer = function(value, opt_allow)
	{
		try 
		{
			if (!value || value.length < 1) return;
			this.setContainer_(value, opt_allow);
			!opt_allow && this.allownot.push(value);
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
			this.container_[i].DropTarget.destroy();
			delete this.container_[i].DropTarget;
		};
	};

	/**
	 * Назначение провайдера событий
	 * @param {Object} eventProvider Провайдер событий
	 */
	prototype.setEventProvider = function(eventProvider)
	{
		if (!eventProvider)
			return false;

		for (var i = 0, ln = this.container_.length; i < ln; i++)
		{
			var newEventProvider = (goog.isFunction(eventProvider) && new eventProvider({'isSetEventNow' : DD.utils.UserAgent.isWindow()}))
								|| (goog.isObject(eventProvider) && eventProvider)
								|| null;
			
			if (!newEventProvider) return false;

			if (this.container_[i].DropTarget)
			{
				this.container_[i].DropTarget.destroy();
				delete this.container_[i].DropTarget;
				this.customEventProvider_ = newEventProvider;
			};

			typeof newEventProvider.init === "function" &&
			newEventProvider.init(this.container_[i],
			{
				'pixelThreshold'    : this.params_.pixelThreshold,
				'lapseThreshold'    : this.params_.lapseThreshold,
				'classItem'         : this.allowElements_
			});

			goog.events.listen(newEventProvider, this.eventsMap_, function(event)
			{
				var fn = goog.object.get(this.sponsoredEvents_, event.type);
				event.resource.originalEvent = event;
				event.resource.source = event.source;
				fn && fn.apply(this, [event.resource]);
			}, false, this);
				
			this.container_[i].DropTarget = newEventProvider;
			newEventProvider = null;
		};
	};

	/**
	 * @inheritdoc
	 */
	prototype.onGetDragSource = function(event)
	{
		if (!event.dragSource) return;

		this.dragObject_ = event.dragSource;
		this.droptargetsCount_ = this.container_.length;

		goog.events.listen(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);

		/**
		 * Выполнение события onGetDragSource по умолчанию
		 * @event
		 * @name DD.fx.DropTarget#onGetDragSource
		 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
		 * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
		 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
		 */
		this.dispatchEvent(
		{
			'type'       : event.type,
			'source'     : event.source,
			'dragSource' : this.dragObject_
		});
	};

	/**
	 * @inheritdoc
	 */
	prototype.onDragStart = function(event)
	{
		this.clone_ = event.clone;
	};

	/**
	 * @inheritDoc
	 */
	prototype.onDragOver = function(event)
	{
		try
		{
			var droparea = possibleDropContainer = null;

			if (!this.dragObject_ || !this.clone_) return;
			if (!this.droptargetsCount_) 
				console && console.error('No drop area elements');

			/** Осуществляет поиск по всем возможным областям */
			for (var i = this.droptargetsCount_ - 1; i >= 0; i--)
			{
				// контейнер, который возможно является DropArea
				possibleDropContainer = this.container_[i];

				// ХитТест
				droparea = this.hitTest(this.dragObject_.image_, possibleDropContainer, 1, {x: event.pointers[0].clientX, y:  event.pointers[0].clientY});

				// 1. Перетаскиваемый элемент должен находится над областью, переданной через метод SetContainer.
				// 2. Область не должна находится в массиве областей, где запрещено событие DROP.
				// 3. Область не должна быть выбрана повторно.
				if (droparea && !this.allownotTest_(possibleDropContainer) && possibleDropContainer != this.currentDropArea_)
				{
					this.currentDropArea_ = possibleDropContainer;

					/**
					 * Выполнение события onGetDropTarget по умолчанию
					 * @event
					 * @name DD.fx.DropTarget#onGetDropTarget
					 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
					 * @param {DD.fx.DropTarget} [sender] Отправитель события
					 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
					 * @param {HTMLElement} [clone] Ссылка на DOM-элемент, являющийся копией оригинального элемента - this.dragObject_
					 * @param {HTMLElement} [dropArea] Ссылка на DOM-элемент, являющийся областью, в котрою можно бросить элемент
					 * @param {Objecy} [sourceEvent] Список свойств события
					 */
					this.dispatchEvent(
					{
						'type'          : DD.fx.CustomDragDrop.EventType.GETDROPTARGET,
						'sender'        : this,
						'dragSource'    : this.dragObject_,
						'clone'         : this.clone_,
						'dropArea'      : possibleDropContainer,
						'sourceEvent'   : event
					});

					break;
				};
			};

			/**
			 * Выполнение события onDragOver по умолчанию
			 * @event
			 * @name DD.fx.DropTarget#onDragOver
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {DD.fx.DropTarget} [sender] Отправитель события
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {HTMLElement} [clone] Ссылка на DOM-элемент, являющийся копией оригинального элемента - dragSource
			 * @param {HTMLElement} [dropArea] Ссылка на DOM-элемент, являющийся областью, в котрою можно бросить элемент
			 * @param {Object} [sourceEvent] Список свойств события
			 */
			this.currentDropArea_ && this.dispatchEvent(
			{
				'type'          : DD.fx.CustomDragDrop.EventType.DRAGOVER,
				'sender'        : this,
				'dragSource'    : this.dragObject_,
				'clone'         : this.clone_,
				'dropArea'      : this.currentDropArea_,
				'sourceEvent'   : event
			});
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
		try
		{
			if (!this.dragObject_ || (this.params_.showDragImage && !this.clone_)) return;

			/**
			 * Выполнение события onDragDrop по умолчанию
			 * @event
			 * @name DD.fx.DropTarget#onDragDrop
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {DD.fx.DropTarget} [sender] Отправитель события
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {HTMLElement} [dropArea] Ссылка на DOM-элемент, являющийся областью, в котрою можно бросить элемент
			 */
			this.dispatchEvent(
			{
				type        : DD.fx.CustomDragDrop.EventType.DRAGDROP,
				sender      : this,
				dropArea    : this.currentDropArea_,
				dragSource  : this.dragObject_,
				coords      : 
				{
					x : event.pointers && event.pointers[0].clientX || event.clientX,
					y : event.pointers && event.pointers[0].clientY || event.clientY
				}
			});

			/**
			 * Выполнение события onDragEnd по умолчанию
			 * @event
			 * @name DD.fx.DropTarget#onDragEnd
			 * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
			 * @param {DD.fx.DropTarget} [sender] Отправитель события
			 * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
			 * @param {HTMLElement} [dropArea] Ссылка на DOM-элемент, являющийся областью, в котрою можно бросить элемент
			 */
			this.dispatchEvent(
			{
				type        : DD.fx.CustomDragDrop.EventType.DRAGEND,
				sender      : this,
				dropArea    : this.currentDropArea_,
				dragSource  : this.dragObject_
			});

			this.reset();
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
	 * Проверяет на возможность совершения события DROP в конкретном контейнере
	 * @param  {HTMLElement} element Ссылка на DOM-элемент, контейнер, куда необходимо вставить элемент
	 * @return {Boolean}
	 * @private
	 */
	prototype.allownotTest_ = function(element)
	{
		for (var i = 0, ln = this.allownot.length; i < ln; i++)
			if (element == this.allownot[i]) return true;
		return false;
	};

	/**
	 * Сброс состояния компонента до первоначального
	 */
	prototype.reset = function()
	{
		delete this.currentDropArea_;
		this.clearDragObject();
		goog.events.unlisten(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);
	};

	prototype.cancel = function(event)
	{
		if (superClass_.cancel.call(this, event))
			this.dispatchEvent(
			{
				'type'          : DD.fx.CustomDragDrop.EventType.DRAGEND,
				'sender'        : this,
				'dropArea'      : this.currentDropArea_,
				'dragSource'    : this.dragObject_
			}); 
	};

	prototype.unwrapElement_ = function(value)
	{
		if (!value)
			return value;

		if (value.length && value !== window && value[0] && value[0].style && !value.nodeType)
			value = value[0];

		return (value === window || (value.nodeType && value.style)) ? value : null;
	};

	prototype.parseRect_ = function(e, undefined)
	{
		var r = (e.pageX !== undefined) ? {left:e.pageX, top:e.pageY, right:e.pageX + 1, bottom:e.pageY + 1} : (!e.nodeType && e.left !== undefined && e.top !== undefined) ? e : this.unwrapElement_(e).getBoundingClientRect();
		if (r.right === undefined && r.width !== undefined)
		{
			r.right = r.left + r.width;
			r.bottom = r.top + r.height;
		}
		else if (r.width === undefined)
			r = {width: r.right - r.left, height: r.bottom - r.top, right: r.right, left: r.left, bottom: r.bottom, top: r.top};

		return r;
	};

	/**
	 * Определяет, находится ли один объект под другим или нет  
	 * @param  {HTMLElement}    obj1        Проверяемый элемент
	 * @param  {HTMLElement}    obj2        Элемент, над которым проверяем первый элемент
	 * @param  {Number}         threshold   Порог расстояния / погрешность проверки
	 * @param  {Object}         cursorPos   Текущие координаты положения курсора
	 * @return {Boolean}                    Возвращает true/false в зависимости от результата проверки
	 */
	prototype.hitTest = function(obj1, obj2, threshold, cursorPos)
	{
		if (obj1 === obj2)
			return false;

		var r1 = this.parseRect_(obj1),
			r2 = this.parseRect_(obj2),
			overlap, area, isRatio,
			isOutside = (r2.left > cursorPos.x || r2.top > cursorPos.y || r2.right < cursorPos.x || r2.bottom < cursorPos.y);

		if (isOutside || !threshold)
			return !isOutside;

		isRatio = ((threshold + "").indexOf("%") !== -1);
		threshold = parseFloat(threshold) || 0;
		overlap =
		{
			left    : Math.max(r1.left, r2.left),
			top     : Math.max(r1.top, r2.top)
		};

		overlap.width = Math.min(r1.right, r2.right) - overlap.left;
		overlap.height = Math.min(r1.bottom, r2.bottom) - overlap.top;

		if (overlap.width < 0 || overlap.height < 0)
			return false;

		if (isRatio)
		{
			threshold *= 0.01;
			area = overlap.width * overlap.height;
			return (area >= r1.width * r1.height * threshold || area >= r2.width * r2.height * threshold);
		};

		return (overlap.width > threshold && overlap.height > threshold);
	};

	/**
	 * @inheritDoc
	 */
	prototype.logError = function(group, error)
	{
		DD.fx.DropTarget.superClass_.logError.call(this, 'DD.fx.DropTarget', group, error);
	};
}); // goog.scope