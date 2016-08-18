goog.provide('DD.fx.HammerWrapper');

goog.require('goog.events.EventTarget');
goog.require('goog.events.EventHandler');
goog.require('DD.utils.UserAgent');

/**
 * Класс, инкапсулирующий сторонний компонент, необходимый для работы с CustomDragDrop
 * @extends goog.events.EventTarget
 * @param {Object=} settings Набор надстроек компонента
 * @author Антон Пархоменко
 * @example
 * var eventProvider = new DD.fx.HammerWrapper();
 * @this DD.fx.HammerWrapper
 * @constructor
 */
DD.fx.HammerWrapper = function(settings)
{
	goog.events.EventTarget.call(this);

	settings = settings || {};

	/**
	 * Определяет, навешивать ли события сразу, в момент инициализации, либо навешивать их при вызове события Press
	 * В случае, если указан true, на контейнер сразу навешываются все события, и это работает аюсолютно везде, но есть минус, 
	 * таким образом отключаются все нативные сенсорные события браузера, такие как zoomPan, doubleTouch, pinch.
	 * В случае, если указан false, основные события навешиваются на контейнер в момент срабатывания события Press. Такой метод не работает
	 * на платформах Windows Tablet, потому есть ряд ограничений
	 * 
	 * @type {Boolean}
	 * @default true
	 */
	this.isSetEventNow =  'isSetEventNow' in settings ? settings.isSetEventNow : true;

	/**
	 * Менеджер событий
	 * @type {Object}
	 */
	this.manager = null;

	/**
	 * Контейнер, на котором будет срабатывать провадер событий
	 * @type {Object}
	 * @private
	 */
	this.container_ = null;

	/**
	 * Запоминают положение указателя.
	 * @type {Number}
	 * @private
	 */
	this.dx_ = 0;
	this.dy_ = 0;

	/**
	 * Определяет было ли совершено событие сенсорного взаимодействия с экраном
	 * @type {Boolean}
	 * @private
	 */
	this.touchFirst_ = false;
};
goog.inherits(DD.fx.HammerWrapper, goog.events.EventTarget);

goog.scope(function()
{

    /** @alias DD.fx.HammerWrapper.prototype */
    var prototype = DD.fx.HammerWrapper.prototype;

	/**
	 * Удаляет провайдер событий
	 */
	prototype.destroy = function()
	{
		this.manager.off('press');
		this.manager.remove(this.manager.get('press'));
		this.eh_ && this.eh_.removeAll();

		this.clearLocalEvents_();
		this.manager.destroy();
	};

	/**
	 * Возвращает менеджер событий
	 * @return {Object} Hammer.Manager
	 */
	prototype.getManager = function()
	{
		return this.manager;
	};

	/**
	 * Инициализация компонента	
	 * @param  {HTMLElement} element контейнер
	 * @param  {Object=} settings Набор свойств
	 */
	prototype.init = function(element, settings)
	{
		if (!element) return;

		settings = settings || {};
		var this_ = this,
			type_,
			press,
			pan,
			rotate,
			drop = 'drop' in settings ? settings.drop : false;

		var isSensor = DD.utils.UserAgent.isSensorDevice();
		this.lapseThreshold = isSensor ? settings.lapseThreshold.sensor : settings.lapseThreshold.desktop;
		this.pixelThreshold = isSensor ? settings.pixelThreshold.sensor : settings.pixelThreshold.desktop;

		this.manager = new Hammer.Manager(element, {enable: true, domEvents: true});

		if (!this.manager) return;

		// Если временной порог равен 0, то по сути событие press не должно срабатывать, поэтому используются
		// события типа touchstart/mousedown или touchend/mouseup. Например на устройстве Android первым вызывается событие
		// touchend, а уже потом touchestart, из-за чего ломается дальшейший алгоритм действий. Потому и выбранно такое условие 
		if (this.lapseThreshold == 0)
		{
			this.eh_ = new goog.events.EventHandler(this);

			if ('ontouchstart' in document.documentElement)
			{
				this.eh_.listen(element, 'touchstart', function (event)
				{
					this_.touchFirst_ = true;
					this_.callbacks_(event, 'press');
				});
				this.eh_.listen(window, 'touchend', function (event)
				{
					this_.callbacks_(event, 'pressup');
					this_.touchFirst_ = false;
				});
			}
			else if (window.navigator.msPointerEnabled) {
				this.eh_.listen(element, 'MSPointerDown', function (event)
				{
					this_.touchFirst_ = true;
					this_.callbacks_(event, 'press');
				});						
				this.eh_.listen(element, 'MSPointerUp', function (event)
				{
					this_.callbacks_(event, 'pressup');
					this_.touchFirst_ = false;
				});						
			};

			this.eh_.listen(element, 'mousedown', function (event)
			{
				!this_.touchFirst_ && this_.callbacks_(event, 'press');
			});

			this.eh_.listen(window, 'mouseup', function (event)
			{
				!this_.touchFirst_ && this_.callbacks_(event, 'pressup');
			});
		}
		else
		{
			press = this.manager.add(new Hammer.Press({'time' : this.lapseThreshold}));
			this.manager.on('pressup press', function(event)
			{
				this_.callbacks_(event, event.type);
			});
		};

		this.isSetEventNow && this_.addLocalEvents_(this.pixelThreshold);

		this.container_ = element;
	};

	/**
	 * Метод вызова глобальных событий
	 * @param  {goog.events.BrowserEvent}  event Объект события
	 * @param  {String}                    type  Тип события
	 * @private
	 */
	prototype.callbacks_ = function(event, type)
	{
		if (!event) return;
		var type_ = '';

		switch (type)
		{
			case 'press':
				!this.isSetEventNow && this.addLocalEvents_(this.pixelThreshold);
				type_ = DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE;
				break;
			case 'pressup':
				!this.isSetEventNow && this.clearLocalEvents_();
				type_ = DD.fx.CustomDragDrop.EventType.DRAGDROP;
				break;
		};

		this.dispatchEvent({
			'type'     : type_,
			'resource' : event,
			'source'   : this.container_
		});
	};

	/**
	 * Добавляет второстепенные события, такие как pan, pinch, rotate и т.д.
	 * @param {Number=} pixelThreshold Пиксельный порог срабатывания события Pan
	 * @private
	 */
	prototype.addLocalEvents_ = function(pixelThreshold)
	{
		var this_ = this;

		// Создание объекта Pan
		pan = this.manager.add(new Hammer.Pan({'threshold' : pixelThreshold || 0}));

		// Создание объекта Rotate
		rotate = this.manager.add(new Hammer.Rotate());

		/** Регистрирование событий Pan */
		this.manager.on('panstart panmove panend', function(event)
		{
			event.srcEvent.preventDefault();
			var type_ = '';
			switch (event.type)
			{
				case 'panstart':
					type_ = DD.fx.CustomDragDrop.EventType.DRAGSTART;
					break;
				case 'panmove':
					/** 
					 * Эта проверка нужна для Android 5.1.1 (Nexus9), потому что на этом устройстве событие panmove
					 * срабатывает постоянно, даже если палец находится в одном месте экрана и не двигается
					 */
					if (this_.dx_ == event.deltaX && this_.dy_ == event.deltaY)
						type_ = '';
					else
					{
						this_.dx_ = event.deltaX;
						this_.dy_ = event.deltaY;
						type_ = DD.fx.CustomDragDrop.EventType.DRAGOVER;
					};
					break;
				case 'panend':
					!this_.isSetEventNow && this_.clearLocalEvents_();
					type_ = DD.fx.CustomDragDrop.EventType.DRAGDROP;
					break;
			};

			this_.dispatchEvent({
				'type'     : type_,
				'resource' : event,
				'source'   : this_.container_
			});
		});
	};

	/**
	 * Удаляет все вспомогательные события, кроме press, так как press является главным событием
	 * @private
	 */
	prototype.clearLocalEvents_ = function()
	{
		this.manager.off('panstart');
		this.manager.off('panmove');
		this.manager.off('panend');

		this.manager.remove(this.manager.get('rotate'));
		this.manager.remove(this.manager.get('pan'));
	};
}); // goog.scope