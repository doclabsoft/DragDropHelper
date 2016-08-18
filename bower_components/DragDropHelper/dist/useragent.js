goog.provide('DD.utils.UserAgent');
goog.require('goog.userAgent');

/**
 * Получает полную информацию об устройствах и версиях клиента
 * @class
 */
DD.utils.UserAgent = DD && (DD.utils.UserAgent = DD.utils.UserAgent || {});

/**
 * Список сенсорных платформ.
 * @type {Array}
 */
DD.utils.UserAgent.sensorDevices = ['iphone', 'ipad', 'ipod', 'android', 'tablet'];

/**
 * Проверяет устройства на наличие сенсорного ввода
 * @return {Boolean}
 */
DD.utils.UserAgent.isSensorDevice = function()
{
	return (('ontouchstart' in window)
      || (navigator.MaxTouchPoints > 0)
      || (navigator.msMaxTouchPoints > 0));
};

DD.utils.UserAgent.isiOSDevice = function()
{
	return /iPad|iPhone|iPod/.test(navigator.platform);
};

/**
 * Проверяет присутствует ли на устройстве операционая система Windows
 * @return {Boolean}
 */
DD.utils.UserAgent.isWindow = function()
{
	return goog.userAgent.WINDOWS;
};

DD.utils.UserAgent.getIOSWindowHeight = function() {
    // Get zoom level of mobile Safari
    // Note, that such zoom detection might not work correctly in other browsers
    // We use width, instead of height, because there are no vertical toolbars :)
    var zoomLevel = document.documentElement.clientWidth / window.innerWidth;

    // window.innerHeight returns height of the visible area. 
    // We multiply it by zoom and get out real height.
    return window.innerHeight * zoomLevel;
};

// You can also get height of the toolbars that are currently displayed
DD.utils.UserAgent.getHeightOfIOSToolbars = function() {
    var tH = (window.orientation === 0 ? screen.height : screen.width) -  this.getIOSWindowHeight();
    return tH > 1 ? tH : 0;
};