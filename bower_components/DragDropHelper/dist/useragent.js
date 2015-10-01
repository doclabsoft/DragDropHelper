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

/**
 * Проверяет присутствует ли на устройстве операционая система Windows
 * @return {Boolean}
 */
DD.utils.UserAgent.isWindow = function()
{
	return goog.userAgent.WINDOWS;
};