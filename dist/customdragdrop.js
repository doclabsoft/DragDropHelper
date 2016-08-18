goog.provide('DD.fx.CustomDragDrop');

goog.require('goog.events.EventTarget');
goog.require('goog.events.KeyCodes');

/**
 * Абстрактный класс, инкапсулирующий общее поведение при drag and drop
 * @param {Object=} [settings] Список входящих параметров
 * @param {Array} [settings.containers] Массив контейнеров
 * @param {Array} [settings.plugins] Массив плагинов
 * @extends goog.events.EventTarget
 * @this DD.fx.CustomDragDrop
 * @constructor
 * @author Антон Пархоменко
 *
 * @TODO Написать отдельный класс DD.fx.DragObject, который будет управлять зависимостями между основными функциями DragDrop. Много чего придется
 * вынести из классов DD.fx.DragSource и DD.fx.DropTarget, так как сейчас они выполняют не совсем свои роли и берут на себя
 * гораздо больший функционал, чем планировалось
 */
DD.fx.CustomDragDrop = function(settings)
{
	DD.fx.CustomDragDrop.base(this, 'constructor');

	settings = settings || {};

	/**
	 * Свойство задаёт контейнер(ы), участвующие в работе дочерних компонентов.
	 * В свойство передаётся объект контейнера - элемент DOM или название селектора класса,
	 * определяющего все контейнеры - элементы DOM с таким классом.
	 * @private
	 * @protected
	 */
	this.container_ = [];

	if (settings.containers && goog.isArray(settings.containers))
		for (var i = 0, lni = settings.containers.length; i < lni; i++)
			this.setContainer(settings.containers[i].container, settings.containers[i].classname || '');

	if (settings.plugins && goog.isArray(settings.plugins))
		for (var j = 0, lnj = settings.plugins.length; i < lnj; i++)
			this.setPlugin(settings.plugins[i]);

	/**
	 * Список событий и определение функций, приписанных к ним
	 * @enum {Object}
	 * @private
	 */
	this.sponsoredEvents_ =
	{
		onDragDrop 			: this.onDragDrop_,
		onDragStart 		: this.onDragStart_,
		onDragOver 			: this.onDragOver_,
		onGetDragSource 	: this.onGetDragSource_
	};

	/**
	 * Свойство отвечающее за то, производится ли этим компонентом захват или перемещение захваченного объекта.
	 * @type {Boolean}
	 * @private
	 * @default false
	 */
	this.active_ = false;

	/**
	 * Список разрешенных для перетаскивания классов
	 * @type {Array}
	 * @private
	 * @default []
	 */
	this.allowElements_ = [];

	/**
	 * Свойство указывает на возможность выполнять компонентом свои функции
	 * @type {Boolean}
	 * @private
	 * @default false
	 */
	this.disabled_ = false;

    /**
     * @type {null}
     * @private
     */
    this.customDragImage_ = null;
};             
goog.inherits(DD.fx.CustomDragDrop, goog.events.EventTarget);

/**
* @define {Array} Список подключенных плагинов
 */
goog.define('DD.fx.CustomDragDrop.prototype.plugin_', []);

/**
 * @enum {String}
 * Список всех возможных событий компонента
 */
DD.fx.CustomDragDrop.EventType =
{
	/** Событие определения возможности захвата */
	GETDRAGSOURCE: 'onGetDragSource',
	/** Событие начала перемещения объекта после его захвата */
	DRAGSTART: 'onDragStart',
	/** Событие прекращения перемещения. Возникает безусловно, если drag and drop был прекращён. */
	DRAGEND: 'onDragEnd',
	/** Событие, возникающее при необходимости прокрутки контента в контейнере, над которым производится перемещение образа */
	DRAGOVERSCROLL: 'onDragOverScroll',
	/** Событие при освобождении. Срабатывает на компоненте, на контейнер которого произведено освобождение пользователем */
	DRAGDROP: 'onDragDrop',
	/** Событие определения приёмника для освобождения */
	GETDROPTARGET: 'onGetDropTarget',
	/** Событие при перемещении объекта над контейнером приёмником */
	DRAGOVER: 'onDragOver',
	/** Событие определения создание образа перетаскиваемого элемента */
	CREATEIMAGE: 'onCreateImage',
	/** deprecated */
	PINCH : 'onPinch'
};

/**
 * Состояние перемещения
 * @enum {Number}
 */
DD.fx.CustomDragDrop.DRAG_STATE =
{
	/** Указатель вошёл в пределы контейнера */
	'dsEnter' : 0,
	/** Указатель перемещается над контейнером */
	'dsMove' : 1,
	/** Указатель покинул пределы контейнера */
	'dsLeave' : 2
};

/**
 * Режим drag and drop
 * @enum {Number}
 */
DD.fx.CustomDragDrop.DRAG_MODE =
{
	/** Автоматический режим. Захват и перемещение производится автоматически */
	'dmAuto' : 0,
	/** Ручной режим. Захват и перемещение производится при включении режима dragging */
	'dmManual' : 1
};

/**
 * Выравнивание образа под указателем
 * @enum {Number}
 */
DD.fx.CustomDragDrop.IMAGE_ALIGN =
{
	/** Образ позиционируется по месту нажатия на нём */
	'iaAuto' : 0,
	/** Образ позиционируется по центру */
	'iaCenter' : 1,
	/** Образ позиционируется по верхнему левому углу */
	'iaTopLeft' : 2,
	/** Образ позиционируется по центру нижнего края */
	'iaBottomCenter' : 3
};

/**
 * Захваченный и перемещаемый объект.
 * Имеет значение null если компонентом не произведён захват.
 * @type {Object}
 */
DD.fx.CustomDragDrop.prototype.dragObject_ = null;

/**
 * @enum {DD.fx.CustomDragDrop.EventType}
 * @private
 */
DD.fx.CustomDragDrop.prototype.eventsMap_ =
[
	DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE,
	DD.fx.CustomDragDrop.EventType.DRAGSTART,
	DD.fx.CustomDragDrop.EventType.CREATEIMAGE,
	DD.fx.CustomDragDrop.EventType.DRAGOVER,
	DD.fx.CustomDragDrop.EventType.DRAGDROP,
	DD.fx.CustomDragDrop.EventType.DRAGOVERSCROLL,
	DD.fx.CustomDragDrop.EventType.GETDROPTARGET,
	DD.fx.CustomDragDrop.EventType.PINCH
];

/**
 * Получает пользовательский eventProvider
 * @return {Object} customEventProvider_
 * @private
 */
DD.fx.CustomDragDrop.prototype.getEventProvider = function()
{
	return this.customEventProvider_;
};

/**
 * Совмещение параметров по-умолчанию в параметрами, указанными в момент инициализации компонента
 * @param  {Object} params   Список параметров, указанных в момент инициализации компонента
 * @param  {Object} defaults Список парамметров по-умолчанию
 * @return {Object}
 */
DD.fx.CustomDragDrop.prototype.assignParams = function(params, defaults)
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

DD.fx.CustomDragDrop.prototype.setContainer = function(value, opt_allow)
{
    try 
    {
        if (!value || value.length < 1) return;
		this.setContainer_(value, opt_allow);
    }
    catch (e)
    {
        if (this.params_.debugMode)
            throw e;
        else
            this.logError('setContainer', e);
    };
};

/**
 * Задает контейнер(ы), участвующие в работе дочерних компонентов
 * @param 	{Array} 	value 			Контейнер или массив контейнеров, являющиеся источником
 * @param 	{Array=} 	opt_allow 		Строковый массив, отвечающий за возможность перетаскивания того или иного
 *                              		элемента, в случае, если ничего не передано, то перетаскиваться
 *                              		будут все элементы, которые были указаны в источнике
 * @return 	{Array} 	container_
 * @protected
 */
DD.fx.CustomDragDrop.prototype.setContainer_ = function(value, opt_allow)
{
	var compareArray = [];

	if (goog.isString(value))
	{
		value = value.split(' ');
		this.equalsContainer(this.container_, value);
	}
	else if (goog.isArray(value) || value instanceof NodeList)
		this.equalsContainer(this.container_, value);
	else
	{
		if (this.container_.length > 0)
		{
			compareArray.push(value);
			this.equalsContainer(this.container_, compareArray);
		}
		else
			this.container_.push(value);
	}

	if (opt_allow)
		this.setAllowDragSources(opt_allow);

	return this.container_;
};

/**
 * Метод отменяет перемещение и захват объекта.
 * @param {goog.events.BrowserEvent} event Событие нажатия клавишы
 * @return {Boolean}
 */
DD.fx.CustomDragDrop.prototype.cancel = function(event)
{
	if (event.keyCode == goog.events.KeyCodes.ESC)
	{
		this.reset();
		return true;
	};
	return false;
};

/**
 * Создает список классов и элементов, учавствующих в Drag'n'Drop
 * @param {String} value 	Строковый параметр, который преобразуется в массив.
 *                       	Можно передавать несколько значений через пробел
 * @return {Array} allowElements_
 */
DD.fx.CustomDragDrop.prototype.setAllowDragSources = function(value)
{
	var valueArray;

	// Создает массив строковых параметров
	if (goog.isString(value))
		valueArray = value.split(' ');
	else if (goog.isArray(value))
		valueArray = value;
	else
		return;

	// Объединяет новый строковый массив с уже существующим
	this.allowElements_ = this.equalsContainer(this.allowElements_, valueArray);

	// Задает провайдеру новый строковый массив
	for (var i = 0, ln = this.container_.length; i < ln; i++)
		if (this.container_[i].eventProvider)
			this.container_[i].eventProvider.setAllowDragSources_(this.allowElements_);
};

/**
 * Подключает плагин
 * @param {Object} value Подключаемый объект
 */
DD.fx.CustomDragDrop.prototype.setPlugin = function(value)
{
	if (!goog.isObject(value))
		return false;

	this.plugin_.push(value);
	value.setParent(this)
};

DD.fx.CustomDragDrop.prototype.reDispatchEvent_ = function(event)
{
	this.dispatchEvent({'type': event.type, 'customEvent' : event});
};

/**
 * Назначает подключаемому плагину родитель
 * @param {Object} value Компонент Plugin
 */
DD.fx.CustomDragDrop.prototype.setParent = function(value)
{
	this.parent_ = value;
};

/**
 * Добавляет элементы массива в массив сontainer_
 * @param  {Array}	value	Массив для объединения
 * @return {Array}
 * @private
 */
DD.fx.CustomDragDrop.prototype.arrayPlacement_ = function(value)
{
	for (var i = 0, ln = value.length; i < ln; i++)
		this.container_.push(value[i]);
};

/**
 * Объединяет два разных массива в один с проверкой на присутствие одинаковых значений в обоих массивах
 * @param  {Array} arr1 Массив, который объединяет массив arr2
 * @param  {Array} arr2 Массив, который сливается с массивом arr1
 * @return {Array} arr1
 */
DD.fx.CustomDragDrop.prototype.equalsContainer = function(arr1, arr2)
{
	var equal;
	for (var i = 0, ln = arr2.length; i < ln; i++)
	{
		equal = false;
		for (var j = 0, ln2 = arr1.length; j < ln2; j++)
			if (arr2[i] == arr1[j])
			{
				equal = true;
				break;
			};

		if (equal)
			continue;

		arr1.push(arr2[i]);
	};

	return arr1;
};

/**
 * Определяет переключение между режимами просмотра и перемещения
 * @param {Boolean} value
 *        true - активен режим перемещения
 *        false - активен режим просмотра. Значение по умолчанию
 */
DD.fx.CustomDragDrop.prototype.setDragging = function(value)
{
	this.dragging_ = value;
};

/**
 * Задает пиксельный порог захвата
 * @param {Number} value Значение пиксельного порога захвата
 */
DD.fx.CustomDragDrop.prototype.setPixelThreshold = function(value, component)
{
	if (!component) return;

	this.pixelThreshold = value;
	for (var i = 0, ln = this.container_.length; i < ln; i++)
		this.container_[i][component].setPixelThreshold(value);
};

/**
 * Задает временной порог захвата
 * @param  {Number} value Значение временного порога захвата в ms
 */
DD.fx.CustomDragDrop.prototype.setLapseThreshold = function(value, component)
{
	if (!component) return;
	
	this.lapseThreshold = value;
	for (var i = 0, ln = this.container_.length; i < ln; i++)
		this.container_[i][component].setLapseThreshold(value);
};

/**
 * Возвращает захваченный и перемещаемый объект
 * @return {HTMLElement}
 */
DD.fx.CustomDragDrop.prototype.getDragObject = function()
{
	return this.dragObject_;
};

/**
 * Очищает свойство захваченного объекта
 */
DD.fx.CustomDragDrop.prototype.clearDragObject = function()
{
	this.dragObject_ = null;
	this.clone_ = null;
};

DD.fx.CustomDragDrop.prototype.findDragSource = function(target)
{
	var dragSource = null;
	for (var i = 0, ln = this.allowElements_.length; i < ln; i++)
	{
		dragSource = goog.dom.getAncestorByClass(target, this.allowElements_[i]);
		if (dragSource) break;
	};
	return dragSource;
};

/**
 * Возвращает созданный образ для замещения оригинального элемента
 * @return {HTMLElement}
 */
DD.fx.CustomDragDrop.prototype.getClone = function()
{
	return this.clone_;
};

/**
 * Выполнение события onDragDrop по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 * @abstract
 * @private
 */
DD.fx.CustomDragDrop.prototype.onDragDrop_ = function(event) {};

/**
 * Выполнение события onDragOver по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 * @abstract
 * @private
 */
DD.fx.CustomDragDrop.prototype.onDragOver_ = function(event) {};

/**
 * Выполнение события onGetDragSource по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 * @private
 */
DD.fx.CustomDragDrop.prototype.onGetDragSource_ = function(event) {};

/**
 * Выполнение события onDragStart по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 * @private
 */
DD.fx.CustomDragDrop.prototype.onDragStart_ = function(event) {};

/**
 * Задает пользовательский образ переносимого элемента
 * @param {HTMLElement}   element Созданный образ, он не обязательно должен быть в существующей DOM-структуре
 * @param {Object|Number} margins Объект, либо целое число. Указывает отступы перетаскиваемого элемента относительно перетаскиваемого объекта.
 *                                Учитывается в случае, если образ перетаскиваемого объекта не совпадает с самим перетаскиваемым элементом
 */
DD.fx.CustomDragDrop.prototype.setCustomDragImage = function(element, margins)
{
	this.customDragImage_ =
	{
		'element'   : element,
		'margins' : this.extendCustomDragImageMargins_(margins)
	};
	return this.customDragImage_;
};

/**
 * Возвращает пользовательский образ
 * @return {HTMLElement}
 */
DD.fx.CustomDragDrop.prototype.getCustomDragImage = function()
{
	return this.customDragImage_;
};

/**
 * Определяет отступы перетаскиваемого элемента относительно родителя
 * @param {Object|Number} margins 	Объект, либо целое число. Указывает отступы перетаскиваемого элемента относительно перетаскиваемого объекта.
 *                                	Учитывается в случае, если образ перетаскиваемого объекта не совпадает с самим перетаскиваемым элементом
 * @return {Object}
 */
DD.fx.CustomDragDrop.prototype.extendCustomDragImageMargins_ = function(margins)
{
	var customMargins = 
	{
		'top'    : 0,
		'right'  : 0,
		'bottom' : 0,
		'left'   : 0
	};

	if (!goog.isObject(margins))
	{
		customMargins = 
		{
			'top'    : margins,
			'right'  : margins,
			'bottom' : margins,
			'left'   : margins
		};
	}
	else
		goog.object.extend(customMargins, margins);

	return customMargins;
};

/**
 * Удаляет объект перетаскиваемого элемента из памяти
 */
DD.fx.CustomDragDrop.prototype.clearCustomDragImage = function()
{
	this.customDragImage_ = null;
};

/**
 * Определяет выравнивания образа под указателем при захвате и перемещении
 * @param {DD.fx.CustomDragDrop.IMAGE_ALIGN} value Значение выравнивания элемента
 */
DD.fx.CustomDragDrop.prototype.setImageAlign = function(value)
{
	this.imageAlign_ = value;
};

DD.fx.CustomDragDrop.prototype.getImageAlign = function()
{
	return this.imageAlign_;
};

/**
 * Задает возможность выполнять компонентом свои функции
 * @param {Boolean} value
 */
DD.fx.CustomDragDrop.prototype.setDisable = function(value)
{
	this.disabled_ = value;
};

DD.fx.CustomDragDrop.prototype.isDisable = function()
{
	return this.disabled_;
};

/**
 * Определение производится ли этим компонентом захват или перемещение захваченного объекта.
 * @param {Boolean} value
 * true - производится drag and drop
 * false -drag and drop не производится
 * @default false
 */
DD.fx.CustomDragDrop.prototype.setActive = function(value)
{
	this.active_ = value;
};

DD.fx.CustomDragDrop.prototype.noUserSelectWhileDrag_ = function(value)
{
	// goog.style.setUnselectable(document.body, value, true);
};

/**
 * Проверяет на скроллирование элемента и возвращает тот, который скроллируется.
 * Это либо document.body, либо document.documentElement, в зависимости от браузера
 * @return {HTMLElement}
 * @private
 */
DD.fx.CustomDragDrop.prototype.getDocumentScrollElement_ = function()
{
	var body = document.body;
	var bodyScrollTop = body.scrollTop;
	body.scrollTop = bodyScrollTop + 1;

	if (body.scrollTop == bodyScrollTop)
		return document.documentElement;
	return body;
};

/**
 * Вывод сообщения об ошибка в консоль браузера
 * @param  {String} component Название компонента, в котором произошла ошибка
 * @param  {String} group     Название метода компонента, в котором произошла ошибка
 * @param  {Object} error     Объект ошибки
 */
DD.fx.CustomDragDrop.prototype.logError = function(component, group, error)
{
    if (console)
    {
        console.group(component + '.' + group);
        console.error(error.stack);
        console.groupEnd();
    };
};

Object.defineProperty(DD.fx.CustomDragDrop.prototype, 'disable', {
	get: DD.fx.CustomDragDrop.prototype.isDisable,
	set: DD.fx.CustomDragDrop.prototype.setDisable
}); 