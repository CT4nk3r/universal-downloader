//
//  SaveToDevice.m
//  Universal Downloader
//
//  Objective-C bridge stubs that expose the Swift `SaveToDeviceModule`
//  to React Native.
//
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SaveToDeviceModule, NSObject)

RCT_EXTERN_METHOD(saveVideo:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(saveAudio:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end
