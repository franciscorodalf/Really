// react-native-worklets@0.10.x ships a dedicated Jest mock for its native
// bindings. Without it, importing react-native-reanimated (which now depends
// on react-native-worklets) throws:
//   "Cannot read properties of undefined (reading 'loadUnpackers')"
// because there is no native module available in the Jest/Node environment.
//
// This is the officially documented "Mock Implementation" setup from the
// react-native-worklets testing guide:
// https://docs.swmansion.com/react-native-worklets/docs/guides/testing/
jest.mock('react-native-worklets', () =>
    require('react-native-worklets/lib/module/mock')
);
