import 'regenerator-runtime';
import { KinveyProvider } from './provider';
import { KinveyError } from 'kinvey-javascript-sdk-core/dist/errors';
import { KinveyRackManager } from 'kinvey-javascript-sdk-core/dist/rack/rack';
import { CacheMiddleware as CoreCacheMiddleware } from 'kinvey-javascript-sdk-core/dist/rack/cache';
import { CacheMiddleware } from 'kinvey-phonegap-sdk/dist/cache';
import { HttpMiddleware as CoreHttpMiddleware } from 'kinvey-javascript-sdk-core/dist/rack/http';
import { HttpMiddleware } from './http';
import { Device } from './device';
import { Popup } from './popup';

// Swap Cache Middelware
const cacheRack = KinveyRackManager.cacheRack;
cacheRack.swap(CoreCacheMiddleware, new CacheMiddleware());

// Swap Http middleware
const networkRack = KinveyRackManager.networkRack;
networkRack.swap(CoreHttpMiddleware, new HttpMiddleware());

// Check that the cordova device plugin is installed
Device.ready().then(() => {
  if (Device.isPhoneGap() && typeof global.device === 'undefined') {
    throw new KinveyError('Cordova Device Plugin is not installed.'
      + ' Please refer to devcenter.kinvey.com/phonegap-v3.0/guides/getting-started for help with'
      + ' setting up your project.');
  }
});

// Expose globals
global.KinveyDevice = Device;
global.KinveyPopup = Popup;

// Register the SDK as a provider
const ngKinvey = angular.module('kinvey', []);
ngKinvey.provider('$kinvey', KinveyProvider);
