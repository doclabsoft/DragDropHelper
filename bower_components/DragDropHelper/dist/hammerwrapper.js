goog.provide('DD.fx.HammerWrapper');

goog.require('goog.events.EventTarget');

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
	 * Пиксельный порог захвата
	 * @type {Number}
	 * @default 4
	 * @private
	 */
	this.pixelThreshold_ = 0;

	/**
	 * Временной порог захвата
	 * @type {Number}
	 * @default 300
	 * @private
	 */
	this.lapseThreshold_ = 300;

	this.mouseInterval = null;

	/**
	 * Запоминают положение указателя.
	 * @type {Number}
	 * @private
	 */
	this.dx_ = 0;
	this.dy_ = 0;
};
goog.inherits(DD.fx.HammerWrapper, goog.events.EventTarget);

/**
 * Удаляет провайдер событий
 */
DD.fx.HammerWrapper.prototype.destroy = function()
{
	this.manager.off('press');
	this.manager.remove(this.manager.get('press'));

	this.clearLocalEvents_();
	this.manager.destroy();
};

/**
 * Возвращает менеджер событий
 * @return {Object} Hammer.Manager
 */
DD.fx.HammerWrapper.prototype.getManager = function()
{
	return this.manager;
};

/**
 * Инициализация компонента	
 * @param  {HTMLElement} element контейнер
 * @param  {Object=} settings Набор свойств
 */
DD.fx.HammerWrapper.prototype.init = function(element, settings)
{
	if (!element) return;

	settings = settings || {};
	var this_ = this,
		type_,
		press,
		pan,
		rotate,
		drop = 'drop' in settings ? settings.drop : false,
		lapseThreshold = 'lapseThreshold' in settings ? settings.lapseThreshold : this.lapseThreshold_;

	('pixelThreshold' in settings) && this.setPixelThreshold(settings.pixelThreshold);

	this.manager = new Hammer.Manager(element, {enable: true, domEvents: true});

	if (!this.manager)
		return;

	// Создание объекта Press
	press = this.manager.add(new Hammer.Press({'time' : lapseThreshold}));

	this.manager.on('pressup', function(event)
	{
		!this_.isSetEventNow && this_.clearLocalEvents_();
		this_.dispatchEvent({'type': DD.fx.CustomDragDrop.EventType.DRAGDROP, 'resource' : event, 'source': this_.container_});
	});

	// Подключение события press
	this.manager.on('press', function(event)
	{

		!this_.isSetEventNow && this_.addLocalEvents_(this_.pixelThreshold_);

		this_.dispatchEvent(
		{
			'type' 		: DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,
			'resource' 	: event,
			'source' 	: this_.container_
		});

	});

	this.isSetEventNow && this_.addLocalEvents_(this.pixelThreshold_);

	this.container_ = element;
};

/**
 * Добавляет второстепенные события, такие как pan, pinch, rotate и т.д.
 * @param {Number=} pixelThreshold Пиксельный порог срабатывания события Pan
 * @private
 */
DD.fx.HammerWrapper.prototype.addLocalEvents_ = function(pixelThreshold)
{
	var this_ = this;

	// Создание объекта Pan
	pan = this.manager.add(new Hammer.Pan({'threshold' : pixelThreshold || 0}));

	// Создание объекта Rotate
	rotate = this.manager.add(new Hammer.Rotate());

	/** Регистрирование событий Pan */
	this.manager.on('panstart panmove panend', function(event)
	{
		var type_ = '';
		switch (event.type)
		{
			case 'panstart':
				type_ = DD.fx.CustomDragDrop.EventType.DRAGSTART;
				break;
			case 'panmove':
				/** 
				 * Эта проверка нужня для Android 5.1.1 (Nexus9), потому что на этом устройстве событие panmove
				 * срабатывает постоянно, даже если палец находится в одном месте экрана и не двигается
				 */
				if (this_.dx == event.deltaX && this_.dy == event.deltaY)
					type_ = '';
				else
				{
					this_.dx = event.deltaX;
					this_.dy = event.deltaY;
					type_ = DD.fx.CustomDragDrop.EventType.DRAGOVER;
				};
				break;
			case 'panend':
				!this_.isSetEventNow && this_.clearLocalEvents_();
				type_ = DD.fx.CustomDragDrop.EventType.DRAGDROP;
				break;
		};

		this_.dispatchEvent({'type': type_, 'resource' : event, 'source': this_.container_});
	});
};

/**
 * Удаляет все вспомогательные события, кроме press, так как press является главным событием
 * @private
 */
DD.fx.HammerWrapper.prototype.clearLocalEvents_ = function()
{
	this.manager.off('panstart');
	this.manager.off('panmove');
	this.manager.off('panend');

	this.manager.remove(this.manager.get('rotate'));
	this.manager.remove(this.manager.get('pan'));
};

/**
 * Задает временной порог
 * @param  {Number} value Временной порог
 */
DD.fx.HammerWrapper.prototype.setlapseThreshold = function(value)
{
	this.manager.get('press').set({'time': value});
};

/**
 * Задает пиксельный порог
 * @param  {Number} value пиксельный порог
 */
DD.fx.HammerWrapper.prototype.setPixelThreshold = function(value)
{
	this.pixelThreshold_ = value;
};