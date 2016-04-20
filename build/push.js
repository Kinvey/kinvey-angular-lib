'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Push = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _errors = require('kinvey-javascript-sdk-core/build/errors');

var _events = require('events');

var _datastore = require('kinvey-javascript-sdk-core/build/stores/datastore');

var _enums = require('kinvey-javascript-sdk-core/build/enums');

var _user = require('kinvey-javascript-sdk-core/build/user');

var _network = require('kinvey-javascript-sdk-core/build/requests/network');

var _client = require('kinvey-javascript-sdk-core/build/client');

var _query = require('kinvey-javascript-sdk-core/build/query');

var _utils = require('./utils');

var _assign = require('lodash/assign');

var _assign2 = _interopRequireDefault(_assign);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _bind = require('lodash/bind');

var _bind2 = _interopRequireDefault(_bind);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var pushNamespace = process.env.KINVEY_PUSH_NAMESPACE || 'push';
var notificationEvent = process.env.KINVEY_NOTIFICATION_EVENT || 'notification';
var deviceCollectionName = process.env.KINVEY_DEVICE_COLLECTION_NAME || 'kinvey_device';

var Push = exports.Push = function (_EventEmitter) {
  _inherits(Push, _EventEmitter);

  function Push() {
    _classCallCheck(this, Push);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Push).call(this));

    _this.client = _client.Client.sharedInstance();
    _this.eventListeners = {
      notificationListener: (0, _bind2.default)(_this.notificationListener, _this)
    };

    var pushOptions = _this.client.push;
    if (pushOptions && typeof global.PushNotification === 'undefined') {
      _this.phonegapPush = global.PushNotification.init(pushOptions);
      _this.phonegapPush.on(notificationEvent, _this.eventListeners.notificationListener);
    }
    return _this;
  }

  _createClass(Push, [{
    key: 'isSupported',
    value: function isSupported() {
      return (0, _utils.isiOS)() || (0, _utils.isAndroid)();
    }
  }, {
    key: 'onNotification',
    value: function onNotification(listener) {
      return this.on(notificationEvent, listener);
    }
  }, {
    key: 'onceNotification',
    value: function onceNotification(listener) {
      return this.once(notificationEvent, listener);
    }
  }, {
    key: 'notificationListener',
    value: function notificationListener(data) {
      this.emit(notificationEvent, data);
    }
  }, {
    key: 'register',
    value: function register() {
      var _this2 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (!this.isSupported()) {
        return Promise.reject(new _errors.KinveyError('Kinvey currently only supports ' + 'push notifications on iOS and Android platforms.'));
      }

      options = (0, _assign2.default)({
        android: {
          senderID: undefined
        },
        ios: {
          alert: true,
          badge: true,
          sound: true
        },
        force: false
      }, options);

      var promise = new Promise(function (resolve, reject) {
        if (typeof global.PushNotification === 'undefined') {
          return reject(new _errors.KinveyError('PhoneGap Push Notification Plugin is not installed.', 'Please refer to http://devcenter.kinvey.com/phonegap-v3.0/guides/push#ProjectSetUp for help with ' + 'setting up your project.'));
        }

        if (_this2.phonegapPush) {
          _this2.phonegapPush.off(notificationEvent, _this2.eventListeners.notificationListener);
        }

        return global.PushNotification.hasPermission(function (data) {
          if (!data.isEnabled) {
            return reject(new _errors.KinveyError('Permission for push notifications has not been granted by the user.'));
          }

          _this2.phonegapPush = global.PushNotification.init(options);

          _this2.phonegapPush.on('registration', function (data) {
            resolve(data.registrationId);
          });

          _this2.phonegapPush.on('error', function (error) {
            reject(new _errors.KinveyError('An error occurred registering this device for push notifications.', error));
          });

          return _this2;
        });
      }).then(function (deviceId) {
        if (!deviceId) {
          throw new _errors.KinveyError('Unable to retrieve the device id to register this device for push notifications.');
        }

        var store = _datastore.DataStore.getInstance(deviceCollectionName, _datastore.DataStoreType.Sync);
        store.client = _this2.client;
        store.disableSync();
        return store.findById(deviceId).catch(function (error) {
          if (error instanceof _errors.NotFoundError) {
            return undefined;
          }

          throw error;
        }).then(function (entity) {
          if (entity && options.force !== true) {
            _this2.phonegapPush.on(notificationEvent, _this2.eventListeners.notificationListener);
            return entity;
          }

          var user = _user.User.getActiveUser(_this2.client);
          var request = new _network.NetworkRequest({
            method: _enums.HttpMethod.POST,
            url: _url2.default.format({
              protocol: _this2.client.protocol,
              host: _this2.client.host,
              pathname: _this2._pathname + '/register-device'
            }),
            properties: options.properties,
            authType: user ? _enums.AuthType.Session : _enums.AuthType.Master,
            data: {
              platform: global.device.platform.toLowerCase(),
              framework: 'phonegap',
              deviceId: deviceId,
              userId: user ? undefined : options.userId
            },
            timeout: options.timeout
          });
          return request.execute().then(function () {
            return store.save({ _id: deviceId, registered: true });
          }).then(function (response) {
            _this2.phonegapPush.on(notificationEvent, _this2.eventListeners.notificationListener);
            _this2.client.push = options;
            return response;
          });
        });
      });

      return promise;
    }
  }, {
    key: 'unregister',
    value: function unregister() {
      var _this3 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (!this.isSupported()) {
        return Promise.reject(new _errors.KinveyError('Kinvey currently only supports ' + 'push notifications on iOS and Android platforms.'));
      }

      var store = _datastore.DataStore.getInstance(deviceCollectionName, _datastore.DataStoreType.Sync);
      store.client = this.client;
      store.disableSync();

      var promise = new Promise(function (resolve, reject) {
        if (_this3.phonegapPush) {
          _this3.phonegapPush.unregister(function () {
            _this3.phonegapPush = null;
            resolve();
          }, function () {
            reject(new _errors.KinveyError('Unable to unregister with the PhoneGap Push Plugin.'));
          });
        }

        resolve();
      });

      promise = promise.then(function () {
        var query = new _query.Query();
        query.equalsTo('registered', true);
        return store.find(query);
      }).then(function (data) {
        if (data.length === 1) {
          return data[0]._id;
        }

        return undefined;
      }).then(function (deviceId) {
        if (!deviceId) {
          throw new _errors.KinveyError('This device has not been registered for push notifications.');
        }

        var user = _user.User.getActiveUser(_this3.client);
        var request = new _network.NetworkRequest({
          method: _enums.HttpMethod.POST,
          url: _url2.default.format({
            protocol: _this3.client.protocol,
            host: _this3.client.host,
            pathname: _this3._pathname + '/unregister-device'
          }),
          properties: options.properties,
          authType: user ? _enums.AuthType.Session : _enums.AuthType.Master,
          data: {
            platform: global.device.platform.toLowerCase(),
            framework: 'phonegap',
            deviceId: deviceId,
            userId: user ? null : options.userId
          },
          timeout: options.timeout
        });
        return request.execute().then(function (response) {
          return store.removeById(deviceId).then(function () {
            _this3.client.push = null;
            return response.data;
          });
        });
      });

      return promise;
    }
  }, {
    key: '_pathname',
    get: function get() {
      return '/' + pushNamespace + '/' + this.client.appKey;
    }
  }, {
    key: 'client',
    get: function get() {
      return this._client;
    },
    set: function set(client) {
      if (!client) {
        throw new _errors.KinveyError('$kinvey.Push much have a client defined.');
      }

      this._client = client;
    }
  }]);

  return Push;
}(_events.EventEmitter);