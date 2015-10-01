goog.provide('DD.fx.DragSource');
goog.provide('DD.fx.dragImage_');

goog.require('DD.fx.CustomDragDrop');
goog.require('goog.style.transform');
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
DD.fx.DragSource = function(settings)
{
    settings = settings || {};

    DD.fx.CustomDragDrop.call(this, settings);

    goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGSTART,     this.onDragStart)
    goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.GETDRAGSOURCE, this.onGetDragSource);
    goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGOVER,      this.onDragOver);
    goog.object.set(this.sponsoredEvents_, DD.fx.CustomDragDrop.EventType.DRAGDROP,      this.onDragDrop);

    /**
     * Способ выравнивания образа под указателем при захвате и перемещении.
     * @type {String}
     * @private
     */
    this.imageAlign_ = '';

    /**
     * Свойство определяет переключение между режимами просмотра и перемещения
     * @type {Boolean}
     * @private
     */
    this.dragging_ = false;

    /**
     * Создает дефолтовый или кастомный образ перетаскиваемого элемента
     * в случае, если система не Windows и в случае, если задан кастомный EventProvider
     * @type {HTMLElement}
     * @private
     */
    this.image_ = null;

    /**
     * Пиксельный порог захвата
     * @type {Number}
     * @default 0
     */
    this.pixelThreshold = 'pixelThreshold' in settings ? settings.pixelThreshold === undefined ? 0 : settings.pixelThreshold : 0;

    /**
     * Временной порог захвата в ms
     * @type {Number}
     * @default 300
     */
    this.lapseThreshold = 'lapseThreshold' in settings ? settings.lapseThreshold === undefined ? 300 : settings.lapseThreshold : 300;

    /**
     * Определяет отображение образа перетаскиваемого элемента по-умолчанию
     * @type {Boolean}
     * @private
     */
    this.showDefaultImage_ = true;

    /**
     * Определяет интервал отображения образа по-умолчанию в случае, если пользовательский образ не может отобразиться
     * @type {Number}
     * @private
     */
    this.showDefaultImageTime_ = 'showDefaultImageTime' in settings ? settings.showDefaultImageTime === undefined ? 500 : settings.showDefaultImageTime : 500;

    /**
     * Массив игнорируемых классов элементов, при нажатии на которые не будет проихсодит события Drag'n'Drop
     * @type {Array}
     */
    this.ignore_ = settings.ignore || [];

    /**
     * Показывает является ли элемент игнорируемым
     * @type {Boolean}
     */
    this.isIgnore_ = false;

    this.deltaOffset = {};
};
goog.inherits(DD.fx.DragSource, DD.fx.CustomDragDrop);

/**
 * Режим работы компонента.
 * @type {DD.fx.CustomDragDrop.prototype.DRAG_MODE}
 */
goog.define('DD.fx.DragSource.prototype.MODE', DD.fx.CustomDragDrop.DRAG_MODE.dmAuto);

/**
 * Задает контейнер(ы), участвующие в работе дочерних компонентов
 * @param   {Array}     value           Контейнер или массив контейнеров, являющиеся источником
 * @param   {Array=}    opt_allow       Строковый массив, отвечающий за возможность перетаскивания того или иного
 *                                      элемента. В случае, если ничего не передано, перетаскиваться
 *                                      будут все элементы, которые были указаны в источнике
 */
DD.fx.DragSource.prototype.setContainer = function(value, opt_allow)
{
    if (typeof value === "undefined")
        throw new Error("No element send into setContainer()");

    DD.fx.DragSource.superClass_.setContainer.call(this, value, opt_allow);
    this.setEventProvider(DD.fx.HammerWrapper);

    /**
     * В случае, если навешивать события сразу на контейнер, в IPad и IPhone скроллирование контейнера работать не будет
     * так как hammerjs в этом случае прерывает все нативные свобытия в контейнере
     */
    // this.setEventProvider(new DD.fx.HammerWrapper({'isSetEventNow' : DD.utils.UserAgent.isWindow()}));
};

DD.fx.DragSource.prototype.dispose = function()
{
    DD.fx.DragSource.superClass_.dispose.call(this);

    for (var i = 0, ln = this.container_.length; i < ln; i++)
        this.container_[i].DragSource.destroy();
};

/**
 * Назначение провайдера событий
 * @param {Object} eventProvider Провайдер событий
 */
DD.fx.DragSource.prototype.setEventProvider = function(eventProvider)
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
            'pixelThreshold'    : this.pixelThreshold,
            'lapseThreshold'    : this.lapseThreshold,
            'classItem'         : this.allowElements_,

            'mousePixelThreshold' : this.mousePixelThreshold
        });

        /**
         * Это нужно, что бы предотвратить авто скроллирование
         * контента в момент срабатывания dragOver события, последствия пока что неизвестны
         */
        goog.events.listen(this.container_[i], 'mousedown', function(event)
        {
            event.preventDefault();
        }, false, this);


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
 * Прерывает событие долгого нажатия на сенсорных устройствах / вызов вонтекстного меню
 * @param  {HTMLElement}    target Ссылка на DOM-элемент, где нужно запретить вызов контекстного меню
 * @param  {Boolean}        on     Флаг, отвечающий за включение / отключение прерывания
 * @private
 */
DD.fx.DragSource.prototype.preventDefaultForMSPointer_ = function(target, on)
{
    if (!target)
        return false;
    var events = ['MSHoldVisual', 'MSGestureHold', 'contextmenu'],
        prevent = function (event){event.preventDefault();};
    events.forEach(function(event)
    {
        target[on ? 'addEventListener' : 'removeEventListener'](event, prevent, false);
    });
};

/**
 * Выполнение события onGetDragSource по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} [event] event
 */
DD.fx.DragSource.prototype.onGetDragSource = function(event)
{
    // console.log('DD.fx.DragSource.onGetDragSource');
    var dragSource = DD.fx.DragSource.superClass_.onGetDragSource_.call(this, event);

    if (!dragSource)
        return false;

    for (var i = 0, l = this.ignore_.length; i < l; i++)
        if (this.isIgnore_ = event.target.classList.contains(this.ignore_[i]))
            break;

    if (this.isIgnore_)
        return false;

    goog.events.listen(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);
    this.pixelThreshold == 0 && this.createDragSourceObject_(event);

    /**
     * Выполнение события onGetDragSource по умолчанию
     * @event
     * @name DD.fx.DragSource#onGetDragSource
     * @param {DD.fx.CustomDragDrop.EventType} [type] Тип события
     * @param {Object} [resource] Список свойств события
     * @param {HTMLElement} [source] Ссылка на DOM-элемент, является контейнером, с которого началось событие
     * @param {HTMLElement} [dragSource] Ссылка на DOM-элемент, образ которго перемещается
     * @param {HTMLElement} [copy] Ссылка на DOM-элемент, являющийся копией оригинального элемента - dragSource
     * @param {DD.fx.DragSource} [this] DD.fx.DragSource
     */
    this.dispatchEvent(
    {
        'type'          : event.originalEvent.type,
        'resource'      : event.originalEvent.resource,
        'source'        : event.originalEvent.source,
        'dragSource'    : dragSource,
        'copy'          : this.getCopy_(),
        'sender'        : this,
        'coords'        : 
        {
            'x' : event.pointers[0].clientX,
            'y' : event.pointers[0].clientY
        }
    });
};

/**
 * Создает образ выбранного элемента
 * @param  {goog.events} event
 */
DD.fx.DragSource.prototype.createDragSourceObject_ = function(event)
{
    var target = this.getDragObject();
    if (!target || this.dragging_)
        return false;

    this.setActive(true);
    this.setDragging(true);

    // Убирает нативное выделение в браузере
    this.noUserSelectWhileDrag_(true);

    // Получает текущие координаты расположения указателя
    var scrollOffset = goog.style.getContainerOffsetToScrollInto(document.documentElement, document.body);

    var pointer =
    {
        'x' : event.pageX != undefined ? event.pageX : event.pointers && event.pointers[0].pageX - scrollOffset.x,
        'y' : event.pageY != undefined ? event.pageY : event.pointers && event.pointers[0].pageY - scrollOffset.y
    };

    target.image_ = this.createDragImage(target, pointer);
    target.image_.parentItem = target;
    goog.style.transform.setTranslation(target.image_, event.pointers[0].clientX, event.pointers[0].clientY);

    this.firstMove = true;

    if (this.showDefaultImage_)
    {
        this.getCopy_().style.visibility = 'hidden';
        this.getDragObject().style.display = 'none';
        this.getCopy_().style.display = '';
        target.image_.style.visibility = 'visible';
    }
    else
        this.startDefaultViewTimeout();
};

DD.fx.DragSource.prototype.getItemImage = function()
{
    var target = this.getDragObject();

    if (!target)
        return false;

    return target.image_;
};

/**
 * Выполнение события onDragStart по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragSource.prototype.onDragStart = function(event)
{
    var target = this.getDragObject();

    if (!target || this.isIgnore_)
        return false;

    if (!this.dragging_)
    {
        this.setActive(true);
        this.setDragging(true);

        // Убирает нативное выделение в браузере
        this.noUserSelectWhileDrag_(true);

        // Получает текущие координаты расположения указателя
        var scrollOffset = goog.style.getContainerOffsetToScrollInto(document.documentElement, document.body);
        var delta = goog.style.getClientPosition(this.copy_);

        var pointer =
        {
            'x': delta.x - scrollOffset.x,
            'y': delta.y - scrollOffset.y
        };

        target.image_ = this.createDragImage(target, pointer);
        target.image_.parentItem = target;

        target.style.opacity = '.8';
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
        'dragSource'    : target,
        'sender'        : this
    });
};

/**
 * Выполнение события onDragOver по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragSource.prototype.onDragOver = function(event)
{
    if (this.isIgnore_)
        return false;

    var target = this.getDragObject();
    if (target)
    {
        /** Если был создан образ элемента */
        if (target.image_)
        {
            /** Если событие срабатывает впервые, показывает образ перемещаемого элемента */
            if (!this.firstMove)
            {
                target.image_.style.visibility = 'visible';
                this.firstMove = true;
            };
            goog.style.transform.setTranslation(target.image_, event.pointers[0].clientX, event.pointers[0].clientY);
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
            'dragSource' : target
        });
    };
};

/**
 * Выполнение собыьтя onDragDrop по умолчанию
 * @param  {DD.fx.CustomDragDrop.EventType} event
 */
DD.fx.DragSource.prototype.onDragDrop = function(event)
{
    var target = this.getDragObject();
    if (!target || this.isIgnore_)
        return false;

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
        'dragSource'    : target,
        'sender'        : this,
        'deltaOffset'   : this.deltaOffset
    });

    /** Отмена/Запрет выделения текста на странице*/
    // this.noUserSelectWhileDrag_(false);

    this.reset();
};

/**
 * Сброс состояния компонента до первоначального
 */
DD.fx.DragSource.prototype.reset = function(event)
{
    this.noUserSelectWhileDrag_(false);

    this.dragObject_.image_ && goog.dom.removeNode(this.dragObject_.image_);
    goog.dom.insertSiblingBefore(this.dragObject_, this.copy_);
    this.copy_ && goog.dom.removeNode(this.copy_);

    this.dragObject_.style.display = '';
    delete this.dragObject_.dataset.origin;
    this.clearCustomDragImage();

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


    this.clearDragObject();
    this.setActive(false);
    this.setDragging(false);

    goog.events.unlisten(window, goog.events.EventType.KEYDOWN, this.cancel, false, this);
};

/**
 * Создает образ динамического перетаскиваемого элемента
 * @param   {Object} size Высота и ширина перетаскиваемого образа
 * @param   {Object} pointer Координаты X и Y курсора или указателя в области
 * @return  {Function} this.setHammerImage
 */
DD.fx.DragSource.prototype.createDragImage = function(size, pointer)
{
    /** Генерирует событие CREATEIMAGE */
    this.dispatchEvent({'type': DD.fx.CustomDragDrop.EventType.CREATEIMAGE});

    return this.setHammerImage(pointer);
};
DD.fx.DragSource.prototype.setShowDefaultImage = function(value)
{
    this.showDefaultImage_ = false;
};

DD.fx.DragSource.prototype.startDefaultViewTimeout = function()
{
    var func = function()
    {
        var dragObject = this.getDragObject();
        var clone = this.getCopy_();
        if (!dragObject)
            return false;

        dragObject.style.display = 'none';
        clone.style.display = '';
        clone.style.visibility = 'hidden';
        dragObject.image_.style.visibility = 'visible';
    };

    this.DefaultViewTimeout_ = setTimeout(func.bind(this), this.showDefaultImageTime_);
};

/**
 * Назначает образ перетаскиваемого элемента
 * @param {Object} pointer Координаты X и Y курсора или указателя в области
 */
DD.fx.DragSource.prototype.setHammerImage = function(pointer)
{
    var target = this.getDragObject();
    if (!target)
        return false;

    this.firstMove = false;
    var image = this.getCustomDragImage();

    /** Если пользовательского образа нет, задается образ по-умолчанию */
    if (!image)
    {
        image = target.cloneNode(false);
        /** Стили образа по умолчанию */
        this.setDefaultDragImage(image, goog.style.getSize(target));
    };

    /** Применение обязательных стилей */
    goog.style.setStyle(image,
    {
        'position'      : 'fixed',
        'zIndex'        : 1001,
        'cursor'        : 'default',
        'visibility'    : 'hidden'
    });

    /** Добавление образа в DOM структуру */
    document.body.appendChild(image);

    /** Получает текущие размеры образа перетаскиваемого элемента */
    var size = goog.style.getSize(image),
        margins = goog.style.getMarginBox(image);

    switch (this.getImageAlign())
    {
        /** Выравнивание по центру */
        case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaCenter:
            this.deltaOffset = 
            {
                'x': 0 - size.width/2 - margins.left,
                'y': 0 - size.height/2 - margins.top
            };
            goog.style.setPosition(image, this.deltaOffset.x, this.deltaOffset.y);
            break;
        /** Выравнивание по левому верхнему краю */
        case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaTopLeft:
            this.deltaOffset = 
            {
                'x': pointer.x,
                'y': pointer.y
            };
            goog.style.setPosition(image, this.deltaOffset.x, this.deltaOffset.y);
            break;
        /** Выравнивание по центру и по нижнему краю */
        case DD.fx.CustomDragDrop.IMAGE_ALIGN.iaBottomCenter:
            this.deltaOffset = 
            {
                'x': pointer.x - size.width/2,
                'y': pointer.y - size.height
            };
            goog.style.setPosition(image, this.deltaOffset.x, this.deltaOffset.y);
            break;
        /**
         * Выравнивание по умолчанию, где схватили там и осталось
         * Значение по-умолчанию может быть равным DD.fx.CustomDragDrop.IMAGE_ALIGN.iaAuto
         */
        default:
            var position = goog.style.getClientPosition(target);
            goog.style.setPosition(image, position.x, position.y);
    };

    return image;

};

/**
 * Задает стили образу по-умолчанию
 * @param {HTMLElement} element Ссылка на DOM-элемент
 * @param {Object}      size    Размер элемента
 */
DD.fx.DragSource.prototype.setDefaultDragImage = function(element, size)
{
    size = size != undefined ? size : goog.style.getSize(element);
    goog.style.setStyle(element,
    {
        background      : '#808080',
        // border           : '2px dashed white',
        display         : 'block',
        width           : size.width + 'px',
        height          : size.height + 'px',
        opacity         : '0.8',
        'box-shadow'    : 'none'
    });
};

DD.fx.DragSource.prototype.setLapseThreshold = function(value)
{
    DD.fx.DragSource.superClass_.setLapseThreshold.call(this, value, 'DragSource');
};

DD.fx.DragSource.prototype.setPixelThreshold = function(value)
{
    DD.fx.DragSource.superClass_.setPixelThreshold.call(this, value, 'DragSource');
};
